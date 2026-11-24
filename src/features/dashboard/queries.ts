import 'server-only'
import { asc, sql } from 'drizzle-orm'
import { cacheLife } from 'next/cache'
import { db } from '@/lib/db'
import { currencies, portfolios } from '@/lib/db/schema'
import type { AssetClassValue, AssetStatusValue } from '@/features/assets/schemas'

export interface CurrencyExposureRow {
  code: string
  name: string
  minorUnits: number
  assetCount: number
  activeCount: number
  costBasis: string
  marketValue: string
}

export interface AssetClassExposureRow {
  assetClass: AssetClassValue
  assetCount: number
  costBasis: string
  marketValue: string
}

export interface StatusDistributionRow {
  status: AssetStatusValue
  globalCount: number
  currencyCount: number
  marketValue: string
}

export interface TopPortfolioRow {
  portfolioId: number
  portfolioCode: string
  portfolioName: string
  baseCurrency: string
  assetCount: number
  activeCount: number
  costBasis: string
  marketValue: string
}

export interface OverviewSummary {
  totalAssets: number
  activeAssets: number
  portfolioCount: number
  currencyCount: number
  lastValuedAt: Date | null
  activeCurrency: CurrencyExposureRow
  currencyExposure: CurrencyExposureRow[]
  assetClassExposure: AssetClassExposureRow[]
  statusDistribution: StatusDistributionRow[]
  topPortfolios: TopPortfolioRow[]
  queryMs: number
}

interface LedgerSummaryRow {
  asset_class: AssetClassValue
  status: AssetStatusValue
  currency: string
  asset_count: string | number
  total_cost_basis: string
  total_market_value: string
  last_valued_at: Date | string | null
  [key: string]: unknown
}

interface PortfolioSummaryRow {
  portfolio_id: string | number
  portfolio_code: string
  portfolio_name: string
  base_currency: string
  asset_count: string | number
  active_count: string | number
  total_cost_basis: string
  total_market_value: string
  [key: string]: unknown
}

const ZERO = BigInt(0)

function parseScaled4(raw: string): bigint {
  const trimmed = raw.trim()
  const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(trimmed)
  if (!match) return ZERO
  const neg = match[1] === '-'
  const intPart = match[2]
  const fracPart = (match[3] ?? '').slice(0, 4).padEnd(4, '0')
  const val = BigInt(intPart + fracPart)
  return neg ? -val : val
}

function formatScaled4(val: bigint): string {
  const neg = val < ZERO
  const abs = neg ? -val : val
  const s = abs.toString().padStart(5, '0')
  const intPart = s.slice(0, s.length - 4)
  const fracPart = s.slice(s.length - 4)
  return `${neg ? '-' : ''}${intPart}.${fracPart}`
}

export async function getOverviewSummary(requestedCurrency?: string): Promise<OverviewSummary> {
  'use cache'
  cacheLife('minutes')

  const start = performance.now()
  const database = db()

  const [summaryRows, currencyRows, portfolioCountRows] = await Promise.all([
    database.execute<LedgerSummaryRow>(sql`
      SELECT
        asset_class,
        status,
        currency,
        asset_count,
        total_cost_basis::text AS total_cost_basis,
        total_market_value::text AS total_market_value,
        last_valued_at
      FROM mv_ledger_summary
    `),
    database
      .select({
        code: currencies.code,
        name: currencies.name,
        minorUnits: currencies.minorUnits,
      })
      .from(currencies)
      .orderBy(asc(currencies.code)),
    database.select({ count: sql<number>`count(*)::int` }).from(portfolios),
  ])

  const currencyMeta = new Map(currencyRows.map((c) => [c.code, c]))

  // 1. Roll up global totals and per-currency exposure using exact BigInt sums.
  let totalAssets = 0
  let activeAssets = 0
  let lastValuedAt: Date | null = null

  const byCurrency = new Map<
    string,
    { assetCount: number; activeCount: number; costBasis: bigint; marketValue: bigint }
  >()

  for (const row of summaryRows) {
    const count = Number(row.asset_count)
    const cb = parseScaled4(row.total_cost_basis)
    const mv = parseScaled4(row.total_market_value)

    totalAssets += count
    if (row.status === 'active') activeAssets += count

    if (row.last_valued_at) {
      const dt =
        row.last_valued_at instanceof Date ? row.last_valued_at : new Date(row.last_valued_at)
      if (!lastValuedAt || dt > lastValuedAt) lastValuedAt = dt
    }

    const entry = byCurrency.get(row.currency) ?? {
      assetCount: 0,
      activeCount: 0,
      costBasis: ZERO,
      marketValue: ZERO,
    }
    entry.assetCount += count
    if (row.status === 'active') entry.activeCount += count
    entry.costBasis += cb
    entry.marketValue += mv
    byCurrency.set(row.currency, entry)
  }

  const currencyExposure: CurrencyExposureRow[] = [...byCurrency.entries()]
    .map(([code, agg]) => {
      const meta = currencyMeta.get(code)
      return {
        code,
        name: meta?.name ?? code,
        minorUnits: meta?.minorUnits ?? 2,
        assetCount: agg.assetCount,
        activeCount: agg.activeCount,
        costBasis: formatScaled4(agg.costBasis),
        marketValue: formatScaled4(agg.marketValue),
      }
    })
    .sort((a, b) => b.assetCount - a.assetCount)

  const normalizedReq = requestedCurrency?.toUpperCase()

  const activeCurrency: CurrencyExposureRow = currencyExposure.find(
    (c) => c.code === normalizedReq,
  ) ??
    currencyExposure.find((c) => c.code === 'INR') ??
    currencyExposure[0] ?? {
      code: 'INR',
      name: 'Indian Rupee',
      minorUnits: 2,
      assetCount: 0,
      activeCount: 0,
      costBasis: '0.0000',
      marketValue: '0.0000',
    }

  // 2. Roll up Asset Class exposure (for activeCurrency) and Status distribution.
  const byClass = new Map<
    AssetClassValue,
    { assetCount: number; costBasis: bigint; marketValue: bigint }
  >()
  const byStatus = new Map<
    AssetStatusValue,
    { globalCount: number; currencyCount: number; marketValue: bigint }
  >()

  for (const row of summaryRows) {
    const count = Number(row.asset_count)
    const cb = parseScaled4(row.total_cost_basis)
    const mv = parseScaled4(row.total_market_value)

    const statusEntry = byStatus.get(row.status) ?? {
      globalCount: 0,
      currencyCount: 0,
      marketValue: ZERO,
    }
    statusEntry.globalCount += count
    if (row.currency === activeCurrency.code) {
      statusEntry.currencyCount += count
      statusEntry.marketValue += mv
    }
    byStatus.set(row.status, statusEntry)

    if (row.currency === activeCurrency.code) {
      const classEntry = byClass.get(row.asset_class) ?? {
        assetCount: 0,
        costBasis: ZERO,
        marketValue: ZERO,
      }
      classEntry.assetCount += count
      classEntry.costBasis += cb
      classEntry.marketValue += mv
      byClass.set(row.asset_class, classEntry)
    }
  }

  const assetClassExposure: AssetClassExposureRow[] = [...byClass.entries()]
    .sort((a, b) =>
      b[1].marketValue > a[1].marketValue ? 1 : b[1].marketValue < a[1].marketValue ? -1 : 0,
    )
    .map(([assetClass, agg]) => ({
      assetClass,
      assetCount: agg.assetCount,
      costBasis: formatScaled4(agg.costBasis),
      marketValue: formatScaled4(agg.marketValue),
    }))

  const statusOrder: AssetStatusValue[] = ['active', 'suspended', 'matured', 'disposed']
  const statusDistribution: StatusDistributionRow[] = statusOrder.map((status) => {
    const agg = byStatus.get(status)
    return {
      status,
      globalCount: agg?.globalCount ?? 0,
      currencyCount: agg?.currencyCount ?? 0,
      marketValue: formatScaled4(agg?.marketValue ?? ZERO),
    }
  })

  // 3. Top 8 portfolios for the active reporting currency via indexed materialized view.
  const topPortfolioRows = await database.execute<PortfolioSummaryRow>(sql`
    SELECT
      portfolio_id,
      portfolio_code,
      portfolio_name,
      base_currency,
      asset_count,
      active_count,
      total_cost_basis::text AS total_cost_basis,
      total_market_value::text AS total_market_value
    FROM mv_portfolio_summary
    WHERE currency = ${activeCurrency.code}
    ORDER BY total_market_value DESC
    LIMIT 8
  `)

  const topPortfolios: TopPortfolioRow[] = topPortfolioRows.map((row) => ({
    portfolioId: Number(row.portfolio_id),
    portfolioCode: row.portfolio_code,
    portfolioName: row.portfolio_name,
    baseCurrency: row.base_currency,
    assetCount: Number(row.asset_count),
    activeCount: Number(row.active_count),
    costBasis: row.total_cost_basis,
    marketValue: row.total_market_value,
  }))

  const queryMs = Math.max(1, Math.round(performance.now() - start))

  return {
    totalAssets,
    activeAssets,
    portfolioCount: portfolioCountRows[0]?.count ?? 0,
    currencyCount: currencyExposure.length,
    lastValuedAt,
    activeCurrency,
    currencyExposure,
    assetClassExposure,
    statusDistribution,
    topPortfolios,
    queryMs,
  }
}
