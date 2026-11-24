import 'server-only'
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { cacheLife } from 'next/cache'
import { db } from '@/lib/db'
import { assets, currencies, portfolios } from '@/lib/db/schema'
import {
  type AssetClassValue,
  type AssetCursor,
  type AssetListQuery,
  type AssetSortColumn,
  type AssetStatusValue,
  type DepreciationMethodValue,
  type SerializedAssetListItem,
  decodeAssetCursor,
  encodeAssetCursor,
  hasActiveFilters,
} from './schemas'

export interface AssetListItem {
  id: number
  publicId: string
  symbol: string
  isin: string | null
  name: string
  assetClass: AssetClassValue
  status: AssetStatusValue
  currency: string
  currencyMinorUnits: number
  country: string
  portfolioId: number
  portfolioCode: string
  portfolioName: string
  quantity: string
  costBasis: string
  marketValue: string
  valuedAt: Date
  acquisitionDate: string
  supplier: string | null
  depreciationMethod: DepreciationMethodValue
  usefulLifeMonths: number | null
  salvageValue: string
  accumulatedDepreciation: string
  disposalDate: string | null
  disposalValue: string | null
  retirementReason: string | null
  updatedAt: Date
}

export interface AssetListResult {
  items: AssetListItem[]
  hasNextPage: boolean
  hasPrevPage: boolean
  nextCursor: string | null
  prevCursor: string | null
  /** Instant pg_class.reltuples estimate when unfiltered; null when filtered or unanalyzed. */
  approxTotal: number | null
  isFiltered: boolean
  queryMs: number
}

export function serializeAssetItem(item: AssetListItem): SerializedAssetListItem {
  return {
    ...item,
    valuedAt: item.valuedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export interface AssetFilterOptions {
  currencies: { code: string; name: string; minorUnits: number }[]
  portfolios: { id: number; code: string; name: string; baseCurrency: string }[]
}

/**
 * Reference lists for filter dropdowns. Cached across requests since
 * currencies and portfolios change infrequently.
 */
export async function getAssetFilterOptions(): Promise<AssetFilterOptions> {
  'use cache'
  cacheLife('minutes')

  const database = db()
  const [currencyRows, portfolioRows] = await Promise.all([
    database
      .select({
        code: currencies.code,
        name: currencies.name,
        minorUnits: currencies.minorUnits,
      })
      .from(currencies)
      .orderBy(asc(currencies.code)),
    database
      .select({
        id: portfolios.id,
        code: portfolios.code,
        name: portfolios.name,
        baseCurrency: portfolios.baseCurrency,
      })
      .from(portfolios)
      .orderBy(asc(portfolios.code)),
  ])

  return {
    currencies: currencyRows,
    portfolios: portfolioRows,
  }
}

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/
const NUMERIC_REGEX = /^[+-]?\d+(?:\.\d+)?$/

function buildKeysetCondition(
  sort: AssetSortColumn,
  effectiveDir: 'asc' | 'desc',
  cursor: AssetCursor,
): SQL | null {
  const op = effectiveDir === 'asc' ? sql.raw('>') : sql.raw('<')

  switch (sort) {
    case 'name':
      return sql`(${assets.name}, ${assets.id}) ${op} (${cursor.v}, ${cursor.id})`
    case 'symbol':
      return sql`(${assets.symbol}, ${assets.id}) ${op} (${cursor.v}, ${cursor.id})`
    case 'marketValue': {
      if (!NUMERIC_REGEX.test(cursor.v)) return null
      return sql`(${assets.marketValue}, ${assets.id}) ${op} (${cursor.v}::numeric, ${cursor.id})`
    }
    case 'updatedAt': {
      const parsed = new Date(cursor.v)
      if (Number.isNaN(parsed.getTime())) return null
      return sql`(${assets.updatedAt}, ${assets.id}) ${op} (${parsed.toISOString()}::timestamptz, ${cursor.id})`
    }
  }
}

function extractSortCursorValue(row: AssetListItem, sort: AssetSortColumn): string {
  switch (sort) {
    case 'name':
      return row.name
    case 'symbol':
      return row.symbol
    case 'marketValue':
      return row.marketValue
    case 'updatedAt':
      return row.updatedAt.toISOString()
  }
}

function getOrderBy(sort: AssetSortColumn, effectiveDir: 'asc' | 'desc') {
  const dirFn = effectiveDir === 'asc' ? asc : desc
  switch (sort) {
    case 'name':
      return [dirFn(assets.name), dirFn(assets.id)]
    case 'symbol':
      return [dirFn(assets.symbol), dirFn(assets.id)]
    case 'marketValue':
      return [dirFn(assets.marketValue), dirFn(assets.id)]
    case 'updatedAt':
      return [dirFn(assets.updatedAt), dirFn(assets.id)]
  }
}

async function getApproxAssetCount(): Promise<number | null> {
  const result = await db().execute<{ estimate: string | number | null }>(
    sql`select reltuples::bigint as estimate from pg_class where relname = 'assets'`,
  )
  const raw = result[0]?.estimate
  if (raw === null || raw === undefined) return null
  const num = Number(raw)
  return Number.isFinite(num) && num >= 0 ? num : null
}

/**
 * Keyset-paginated asset ledger query.
 *
 * Uses composite `(sort_col, id)` indexes with `LIMIT pageSize + 1` to avoid
 * linear-time `OFFSET` scans and expensive `COUNT(*)` over millions of rows.
 */
export async function listAssets(
  query: AssetListQuery,
  options?: { limitOverride?: number },
): Promise<AssetListResult> {
  const start = performance.now()
  const database = db()
  const limit = options?.limitOverride
    ? Math.max(1, Math.min(500, Math.floor(options.limitOverride)))
    : query.pageSize
  const isFiltered = hasActiveFilters(query)
  const decodedCursor = decodeAssetCursor(query.cursor)
  const isPrev = Boolean(decodedCursor && query.cursorDir === 'prev')
  const effectiveDir: 'asc' | 'desc' = isPrev ? (query.dir === 'asc' ? 'desc' : 'asc') : query.dir

  const conditions: SQL[] = []

  if (query.assetClass) {
    conditions.push(eq(assets.assetClass, query.assetClass))
  }
  if (query.status) {
    conditions.push(eq(assets.status, query.status))
  }
  if (query.depreciationMethod) {
    conditions.push(eq(assets.depreciationMethod, query.depreciationMethod))
  }
  if (query.currency) {
    conditions.push(eq(assets.currency, query.currency))
  }
  if (query.portfolioId !== undefined) {
    conditions.push(eq(assets.portfolioId, query.portfolioId))
  }
  if (query.q) {
    const upper = query.q.toUpperCase()
    const pattern = `%${escapeLike(query.q)}%`
    if (ISIN_REGEX.test(upper)) {
      const searchCond = or(
        eq(assets.isin, upper),
        ilike(assets.symbol, pattern),
        ilike(assets.name, pattern),
      )
      if (searchCond) conditions.push(searchCond)
    } else {
      const searchCond = or(ilike(assets.symbol, pattern), ilike(assets.name, pattern))
      if (searchCond) conditions.push(searchCond)
    }
  }

  let appliedCursor = false
  if (decodedCursor) {
    const keysetCond = buildKeysetCondition(query.sort, effectiveDir, decodedCursor)
    if (keysetCond) {
      conditions.push(keysetCond)
      appliedCursor = true
    }
  }

  const rowsPromise = database
    .select({
      id: assets.id,
      publicId: assets.publicId,
      symbol: assets.symbol,
      isin: assets.isin,
      name: assets.name,
      assetClass: assets.assetClass,
      status: assets.status,
      currency: assets.currency,
      currencyMinorUnits: currencies.minorUnits,
      country: assets.country,
      portfolioId: assets.portfolioId,
      portfolioCode: portfolios.code,
      portfolioName: portfolios.name,
      quantity: assets.quantity,
      costBasis: assets.costBasis,
      marketValue: assets.marketValue,
      valuedAt: assets.valuedAt,
      acquisitionDate: assets.acquisitionDate,
      supplier: assets.supplier,
      depreciationMethod: assets.depreciationMethod,
      usefulLifeMonths: assets.usefulLifeMonths,
      salvageValue: assets.salvageValue,
      accumulatedDepreciation: assets.accumulatedDepreciation,
      disposalDate: assets.disposalDate,
      disposalValue: assets.disposalValue,
      retirementReason: assets.retirementReason,
      updatedAt: assets.updatedAt,
    })
    .from(assets)
    .innerJoin(portfolios, eq(assets.portfolioId, portfolios.id))
    .innerJoin(currencies, eq(assets.currency, currencies.code))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(...getOrderBy(query.sort, effectiveDir))
    .limit(limit + 1)

  const approxTotalPromise = isFiltered ? Promise.resolve(null) : getApproxAssetCount()

  const [rawRows, approxTotal] = await Promise.all([rowsPromise, approxTotalPromise])

  const hasMore = rawRows.length > limit
  const items = hasMore ? rawRows.slice(0, limit) : rawRows

  if (isPrev && appliedCursor) {
    items.reverse()
  }

  const hasNextPage = isPrev && appliedCursor ? items.length > 0 : hasMore
  const hasPrevPage = isPrev && appliedCursor ? hasMore : appliedCursor

  const first = items[0]
  const last = items[items.length - 1]

  const nextCursor =
    hasNextPage && last
      ? encodeAssetCursor({ v: extractSortCursorValue(last, query.sort), id: last.id })
      : null

  const prevCursor =
    hasPrevPage && first
      ? encodeAssetCursor({ v: extractSortCursorValue(first, query.sort), id: first.id })
      : null

  return {
    items,
    hasNextPage,
    hasPrevPage,
    nextCursor,
    prevCursor,
    approxTotal,
    isFiltered,
    queryMs: Math.max(1, Math.round(performance.now() - start)),
  }
}
