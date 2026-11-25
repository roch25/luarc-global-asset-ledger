import { and, asc, eq, gt, ilike, or, sql, type SQL } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { type RawSearchParams, parseAssetSearchParams } from '@/features/assets/schemas'
import { db } from '@/lib/db'
import { assets, portfolios } from '@/lib/db/schema'
import { subtractDecimals } from '@/lib/format'

const BATCH_SIZE = 2_000
const DEFAULT_MAX_ROWS = 50_000
const HARD_MAX_ROWS = 250_000
const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/**
 * RFC 4180 CSV field formatter with formula-injection hardening for text fields.
 */
function csvText(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  // Neutralize spreadsheet formula triggers on untrusted text cells.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

const CSV_HEADER =
  [
    'public_id',
    'symbol',
    'isin',
    'name',
    'asset_class',
    'status',
    'currency',
    'country',
    'portfolio_code',
    'portfolio_name',
    'acquisition_date',
    'supplier',
    'depreciation_method',
    'useful_life_months',
    'salvage_value',
    'quantity',
    'cost_basis',
    'accumulated_depreciation',
    'net_book_value',
    'market_value',
    'unrealized_pnl',
    'disposal_date',
    'disposal_value',
    'retirement_reason',
    'valued_at',
    'updated_at',
  ].join(',') + '\n'

/**
 * Backpressure-aware streaming CSV export (`GET /api/assets/export`).
 *
 * Pages through PostgreSQL in 2,000-row keyset chunks (`assets.id > lastId`)
 * inside `ReadableStream.pull()`, keeping Node heap flat while streaming
 * up to 250,000 rows directly to the client.
 */
export async function GET(request: NextRequest) {
  const raw: RawSearchParams = {}
  request.nextUrl.searchParams.forEach((value, key) => {
    if (raw[key] === undefined) raw[key] = value
  })

  const query = parseAssetSearchParams(raw)
  const rawMax = Number(request.nextUrl.searchParams.get('maxRows'))
  const maxRows =
    Number.isFinite(rawMax) && rawMax >= 100
      ? Math.min(HARD_MAX_ROWS, Math.floor(rawMax))
      : DEFAULT_MAX_ROWS

  const baseConditions: SQL[] = []
  if (query.assetClass) baseConditions.push(eq(assets.assetClass, query.assetClass))
  if (query.status) baseConditions.push(eq(assets.status, query.status))
  if (query.depreciationMethod) {
    baseConditions.push(eq(assets.depreciationMethod, query.depreciationMethod))
  }
  if (query.currency) baseConditions.push(eq(assets.currency, query.currency))
  if (query.portfolioId !== undefined) {
    baseConditions.push(eq(assets.portfolioId, query.portfolioId))
  }
  if (query.q) {
    const upper = query.q.toUpperCase()
    const pattern = `%${escapeLike(query.q)}%`
    if (ISIN_REGEX.test(upper)) {
      const cond = or(
        eq(assets.isin, upper),
        ilike(assets.symbol, pattern),
        ilike(assets.name, pattern),
      )
      if (cond) baseConditions.push(cond)
    } else {
      const tokens = query.q.split(/\s+/).filter(Boolean).slice(0, 5)
      for (const token of tokens) {
        const tokenPattern = `%${escapeLike(token)}%`
        const cond =
          token.length >= 4
            ? or(
                ilike(assets.symbol, tokenPattern),
                ilike(assets.name, tokenPattern),
                sql`${token} <% ${assets.name}`,
              )
            : or(ilike(assets.symbol, tokenPattern), ilike(assets.name, tokenPattern))
        if (cond) baseConditions.push(cond)
      }
    }
  }

  const encoder = new TextEncoder()
  const database = db()
  let lastId = 0
  let exportedRows = 0
  let cancelled = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(CSV_HEADER))
    },
    async pull(controller) {
      if (cancelled || exportedRows >= maxRows) {
        controller.close()
        return
      }

      const batchLimit = Math.min(BATCH_SIZE, maxRows - exportedRows)
      const conditions = lastId > 0 ? [...baseConditions, gt(assets.id, lastId)] : baseConditions

      try {
        const rows = await database
          .select({
            id: assets.id,
            publicId: assets.publicId,
            symbol: assets.symbol,
            isin: assets.isin,
            name: assets.name,
            assetClass: assets.assetClass,
            status: assets.status,
            currency: assets.currency,
            country: assets.country,
            portfolioCode: portfolios.code,
            portfolioName: portfolios.name,
            acquisitionDate: assets.acquisitionDate,
            supplier: assets.supplier,
            depreciationMethod: assets.depreciationMethod,
            usefulLifeMonths: assets.usefulLifeMonths,
            salvageValue: assets.salvageValue,
            quantity: assets.quantity,
            costBasis: assets.costBasis,
            accumulatedDepreciation: assets.accumulatedDepreciation,
            marketValue: assets.marketValue,
            disposalDate: assets.disposalDate,
            disposalValue: assets.disposalValue,
            retirementReason: assets.retirementReason,
            valuedAt: assets.valuedAt,
            updatedAt: assets.updatedAt,
          })
          .from(assets)
          .innerJoin(portfolios, eq(assets.portfolioId, portfolios.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(asc(assets.id))
          .limit(batchLimit)

        if (rows.length === 0 || cancelled) {
          controller.close()
          return
        }

        const lines: string[] = new Array(rows.length)
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]
          const pnl = subtractDecimals(r.marketValue, r.costBasis)
          const nbv = subtractDecimals(r.costBasis, r.accumulatedDepreciation)
          lines[i] =
            [
              r.publicId,
              csvText(r.symbol),
              r.isin ?? '',
              csvText(r.name),
              r.assetClass,
              r.status,
              r.currency,
              r.country,
              csvText(r.portfolioCode),
              csvText(r.portfolioName),
              r.acquisitionDate,
              csvText(r.supplier),
              r.depreciationMethod,
              r.usefulLifeMonths !== null ? String(r.usefulLifeMonths) : '',
              r.salvageValue,
              r.quantity,
              r.costBasis,
              r.accumulatedDepreciation,
              nbv,
              r.marketValue,
              pnl,
              r.disposalDate ?? '',
              r.disposalValue ?? '',
              csvText(r.retirementReason),
              r.valuedAt.toISOString(),
              r.updatedAt.toISOString(),
            ].join(',') + '\n'
        }

        lastId = rows[rows.length - 1].id
        exportedRows += rows.length
        controller.enqueue(encoder.encode(lines.join('')))

        if (rows.length < batchLimit || exportedRows >= maxRows) {
          controller.close()
        }
      } catch (err) {
        console.error('[GET /api/assets/export] stream error:', err)
        controller.error(err)
      }
    },
    cancel() {
      cancelled = true
    },
  })

  const parts = ['global-asset-ledger']
  if (query.currency) parts.push(query.currency.toLowerCase())
  if (query.assetClass) parts.push(query.assetClass)
  if (query.status) parts.push(query.status)
  const dateStamp = new Date().toISOString().slice(0, 10)
  const filename = `${parts.join('-')}-${dateStamp}.csv`

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Export-Max-Rows': String(maxRows),
    },
  })
}
