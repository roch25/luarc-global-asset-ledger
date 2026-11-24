import { ArrowRight, Briefcase, Layers, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import Link from 'next/link'
import {
  ASSET_CLASS_LABELS,
  ASSET_STATUS_LABELS,
  type AssetStatusValue,
} from '@/features/assets/schemas'
import {
  computeUnrealizedPnl,
  formatCompactMoney,
  formatInteger,
  formatMoney,
  formatSharePercent,
  formatUtcDateTime,
  parseDecimalToScaled,
  subtractDecimals,
} from '@/lib/format'
import type { NumberDisplayMode } from '@/features/settings/schemas'
import type { OverviewSummary } from '../queries'
import { CurrencySelector } from '@/app/components/ui/CurrencySelector'

interface OverviewDashboardProps {
  summary: OverviewSummary
  numberDisplay?: NumberDisplayMode
}

const STATUS_BAR_COLORS: Record<AssetStatusValue, string> = {
  active: 'bg-emerald-600',
  suspended: 'bg-amber-500',
  matured: 'bg-sky-600',
  disposed: 'bg-neutral-400',
}

const STATUS_DOT_COLORS: Record<AssetStatusValue, string> = {
  active: 'bg-emerald-600',
  suspended: 'bg-amber-500',
  matured: 'bg-sky-600',
  disposed: 'bg-neutral-400',
}

export function OverviewDashboard({ summary, numberDisplay = 'compact' }: OverviewDashboardProps) {
  const fmtMoney = (
    val: string,
    code: string,
    minorUnits: number,
    options?: { showPlus?: boolean },
  ) =>
    numberDisplay === 'full'
      ? formatMoney(val, code, minorUnits, options)
      : formatCompactMoney(val, code, minorUnits, options)
  const {
    totalAssets,
    activeAssets,
    portfolioCount,
    currencyCount,
    lastValuedAt,
    activeCurrency,
    currencyExposure,
    assetClassExposure,
    statusDistribution,
    topPortfolios,
    queryMs,
  } = summary

  const activePnl = computeUnrealizedPnl(
    activeCurrency.marketValue,
    activeCurrency.costBasis,
    activeCurrency.minorUnits,
  )

  const activeTotalMvScaled = parseDecimalToScaled(activeCurrency.marketValue, 0)
  const zero = BigInt(0)

  function pctOfActiveMv(mv: string): number {
    if (activeTotalMvScaled <= zero) return 0
    const rowScaled = parseDecimalToScaled(mv, 0)
    if (rowScaled <= zero) return 0
    const basisPoints = Number((rowScaled * BigInt(1000)) / activeTotalMvScaled)
    return Math.min(100, Math.max(0, basisPoints / 10))
  }

  return (
    <div className="space-y-5">
      {/* Toolbar: currency selector + performance pill */}
      <div className="flex flex-col justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-xs sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 ring-1 ring-emerald-600/20 ring-inset">
            <Zap aria-hidden="true" className="h-3.5 w-3.5" />
            Materialized view · {queryMs}ms
          </span>
          {lastValuedAt && (
            <span className="text-neutral-500">
              Latest valuation: {formatUtcDateTime(lastValuedAt)}
            </span>
          )}
        </div>

        <CurrencySelector
          activeCode={activeCurrency.code}
          currencies={currencyExposure.map((c) => ({ code: c.code, name: c.name }))}
        />
      </div>

      {/* KPI Strip */}
      <section aria-label="Key ledger metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
            <span>Total Positions</span>
            <Layers aria-hidden="true" className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-neutral-950 tabular-nums">
            {formatInteger(totalAssets)}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            <span className="font-medium text-emerald-700">{formatInteger(activeAssets)}</span>{' '}
            active ({formatSharePercent(activeAssets, totalAssets)})
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
            <span>Market Value ({activeCurrency.code})</span>
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-neutral-700">
              {activeCurrency.code}
            </span>
          </div>
          <p
            className="mt-2 font-mono text-2xl font-bold tracking-tight text-neutral-950 tabular-nums"
            title={formatMoney(
              activeCurrency.marketValue,
              activeCurrency.code,
              activeCurrency.minorUnits,
            )}
          >
            {fmtMoney(activeCurrency.marketValue, activeCurrency.code, activeCurrency.minorUnits)}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Across{' '}
            <span className="font-medium text-neutral-900">
              {formatInteger(activeCurrency.assetCount)}
            </span>{' '}
            {activeCurrency.code} holdings
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
            <span>Unrealized P&amp;L ({activeCurrency.code})</span>
            {activePnl.direction === 'negative' ? (
              <TrendingDown aria-hidden="true" className="h-4 w-4 text-rose-600" />
            ) : (
              <TrendingUp aria-hidden="true" className="h-4 w-4 text-emerald-600" />
            )}
          </div>
          <p
            className={`mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums ${
              activePnl.direction === 'positive'
                ? 'text-emerald-700'
                : activePnl.direction === 'negative'
                  ? 'text-rose-700'
                  : 'text-neutral-950'
            }`}
            title={`${activePnl.amount} ${activeCurrency.code}`}
          >
            {fmtMoney(
              subtractDecimals(activeCurrency.marketValue, activeCurrency.costBasis),
              activeCurrency.code,
              activeCurrency.minorUnits,
              { showPlus: true },
            )}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            {activePnl.percent ? (
              <>
                <span
                  className={`font-semibold ${
                    activePnl.direction === 'positive'
                      ? 'text-emerald-700'
                      : activePnl.direction === 'negative'
                        ? 'text-rose-700'
                        : 'text-neutral-600'
                  }`}
                >
                  {activePnl.percent}
                </span>{' '}
                vs. cost basis
              </>
            ) : (
              'No cost basis recorded'
            )}
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
            <span>Ledger Coverage</span>
            <Briefcase aria-hidden="true" className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-neutral-950 tabular-nums">
            {formatInteger(portfolioCount)}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Portfolios across <span className="font-medium text-neutral-900">{currencyCount}</span>{' '}
            currencies
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section
          aria-label="Asset class exposure"
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs lg:col-span-2"
        >
          <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950">
                Asset Class Exposure ({activeCurrency.code})
              </h2>
              <p className="text-xs text-neutral-500">
                Click any class to inspect its holdings in the Asset Ledger.
              </p>
            </div>
            <Link
              href={`/assets?currency=${activeCurrency.code}`}
              className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              View ledger
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-3 space-y-3">
            {assetClassExposure.map((row) => {
              const share = pctOfActiveMv(row.marketValue)
              const pnl = computeUnrealizedPnl(
                row.marketValue,
                row.costBasis,
                activeCurrency.minorUnits,
              )
              const pnlTone =
                pnl.direction === 'positive'
                  ? 'text-emerald-700'
                  : pnl.direction === 'negative'
                    ? 'text-rose-700'
                    : 'text-neutral-500'

              return (
                <Link
                  key={row.assetClass}
                  href={`/assets?assetClass=${row.assetClass}&currency=${activeCurrency.code}`}
                  className="group block rounded-md p-2 transition-colors hover:bg-neutral-50"
                >
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <div className="flex items-baseline gap-2">
                      <span className="group-hover:text-primary font-semibold text-neutral-900">
                        {ASSET_CLASS_LABELS[row.assetClass]}
                      </span>
                      <span className="text-neutral-500 tabular-nums">
                        {formatInteger(row.assetCount)} positions
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3 font-mono tabular-nums">
                      {pnl.percent && (
                        <span className={`text-[11px] font-medium ${pnlTone}`}>{pnl.percent}</span>
                      )}
                      <span
                        className="font-semibold text-neutral-950"
                        title={formatMoney(
                          row.marketValue,
                          activeCurrency.code,
                          activeCurrency.minorUnits,
                        )}
                      >
                        {fmtMoney(row.marketValue, activeCurrency.code, activeCurrency.minorUnits)}
                      </span>
                      <span className="w-11 text-right text-neutral-500">{share.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${Math.max(share, 0.5)}%` }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        <section
          aria-label="Holding status distribution"
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs"
        >
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-semibold text-neutral-950">Holding Status</h2>
            <p className="text-xs text-neutral-500">Global distribution across all currencies.</p>
          </div>

          {/* Segmented bar */}
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-neutral-100">
            {statusDistribution.map((row) => {
              const pct = totalAssets > 0 ? (row.globalCount / totalAssets) * 100 : 0
              if (pct <= 0) return null
              return (
                <div
                  key={row.status}
                  className={STATUS_BAR_COLORS[row.status]}
                  style={{ width: `${pct}%` }}
                  title={`${ASSET_STATUS_LABELS[row.status]}: ${formatInteger(row.globalCount)} (${pct.toFixed(1)}%)`}
                />
              )
            })}
          </div>

          <div className="mt-4 divide-y divide-neutral-100">
            {statusDistribution.map((row) => (
              <Link
                key={row.status}
                href={`/assets?status=${row.status}`}
                className="flex items-center justify-between py-2.5 text-xs transition-colors hover:bg-neutral-50"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_COLORS[row.status]}`} />
                  <span className="font-medium text-neutral-900">
                    {ASSET_STATUS_LABELS[row.status]}
                  </span>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="font-semibold text-neutral-950">
                    {formatInteger(row.globalCount)}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {formatSharePercent(row.globalCount, totalAssets)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom Row: Top Portfolios + Multi-Currency Exposure */}
      <div className="grid gap-5 xl:grid-cols-2">
        <section
          aria-label="Top portfolios"
          className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950">
                Top Portfolios ({activeCurrency.code})
              </h2>
              <p className="text-xs text-neutral-500">
                Ranked by {activeCurrency.code} market value.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-xs">
              <thead className="bg-neutral-50 text-[11px] font-semibold tracking-wider text-neutral-600 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left">
                    Portfolio
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Positions
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Market Value
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    P&amp;L
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {topPortfolios.map((pf) => {
                  const pnl = computeUnrealizedPnl(
                    pf.marketValue,
                    pf.costBasis,
                    activeCurrency.minorUnits,
                  )
                  const pnlTone =
                    pnl.direction === 'positive'
                      ? 'text-emerald-700'
                      : pnl.direction === 'negative'
                        ? 'text-rose-700'
                        : 'text-neutral-500'

                  return (
                    <tr
                      key={pf.portfolioId}
                      className="odd:bg-white even:bg-neutral-50/70 transition-colors hover:bg-neutral-100/70"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/assets?portfolioId=${pf.portfolioId}&currency=${activeCurrency.code}`}
                          className="group block"
                        >
                          <div className="group-hover:text-primary font-mono font-semibold text-neutral-900">
                            {pf.portfolioCode}
                          </div>
                          <div className="max-w-56 truncate text-neutral-500">
                            {pf.portfolioName}
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-neutral-700 tabular-nums">
                        {formatInteger(pf.assetCount)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-neutral-950 tabular-nums"
                        title={formatMoney(
                          pf.marketValue,
                          activeCurrency.code,
                          activeCurrency.minorUnits,
                        )}
                      >
                        {fmtMoney(pf.marketValue, activeCurrency.code, activeCurrency.minorUnits)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-medium whitespace-nowrap tabular-nums ${pnlTone}`}
                      >
                        {pnl.percent ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section
          aria-label="Currency exposure"
          className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950">Currency Exposure</h2>
              <p className="text-xs text-neutral-500">
                Native-currency totals (no unverified FX aggregation).
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-xs">
              <thead className="bg-neutral-50 text-[11px] font-semibold tracking-wider text-neutral-600 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left">
                    Currency
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Positions
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Market Value
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    P&amp;L
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {currencyExposure.map((c) => {
                  const isSelected = c.code === activeCurrency.code
                  const pnl = computeUnrealizedPnl(c.marketValue, c.costBasis, c.minorUnits)
                  const pnlTone =
                    pnl.direction === 'positive'
                      ? 'text-emerald-700'
                      : pnl.direction === 'negative'
                        ? 'text-rose-700'
                        : 'text-neutral-500'

                  return (
                    <tr
                      key={c.code}
                      className={`transition-colors hover:bg-neutral-100/70 ${
                        isSelected ? 'bg-emerald-50/40' : 'odd:bg-white even:bg-neutral-50/70'
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/?currency=${c.code}`}
                          className="group flex items-center gap-2"
                        >
                          <span className="group-hover:text-primary font-mono font-semibold text-neutral-900">
                            {c.code}
                          </span>
                          <span className="truncate text-neutral-500">{c.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-neutral-700 tabular-nums">
                        {formatInteger(c.assetCount)}{' '}
                        <span className="text-neutral-400">
                          ({formatSharePercent(c.assetCount, totalAssets)})
                        </span>
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-neutral-950 tabular-nums"
                        title={formatMoney(c.marketValue, c.code, c.minorUnits)}
                      >
                        {fmtMoney(c.marketValue, c.code, c.minorUnits)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-medium whitespace-nowrap tabular-nums ${pnlTone}`}
                      >
                        {pnl.percent ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
