import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
} from 'lucide-react'
import Link from 'next/link'
import {
  computeUnrealizedPnl,
  formatInteger,
  formatMoney,
  formatQuantity,
  formatUtcDate,
  formatUtcDateTime,
  subtractDecimals,
} from '@/lib/format'
import type { AssetListResult } from '../queries'
import {
  ASSET_CLASS_LABELS,
  ASSET_STATUS_LABELS,
  type AssetListQuery,
  type AssetSortColumn,
  type AssetStatusValue,
  DEPRECIATION_METHOD_LABELS,
  buildAssetListHref,
} from '../schemas'

interface AssetTableProps {
  query: AssetListQuery
  result: AssetListResult
}

const STATUS_BADGE_STYLES: Record<AssetStatusValue, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  suspended: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  matured: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  disposed: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
}

function SortableHeader({
  column,
  label,
  query,
  align = 'left',
  tooltip = '',
}: {
  column: AssetSortColumn
  label: string
  query: AssetListQuery
  align?: 'left' | 'right'
  tooltip?: string
}) {
  const isActive = query.sort === column
  const nextDir = isActive && query.dir === 'desc' ? 'asc' : 'desc'
  const href = buildAssetListHref({
    ...query,
    sort: column,
    dir: nextDir,
    cursor: undefined,
    cursorDir: 'next',
  })

  const Icon = !isActive ? ArrowUpDown : query.dir === 'asc' ? ArrowUp : ArrowDown

  return (
    <th
      scope="col"
      aria-sort={isActive ? (query.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-3.5 py-2.5 text-xs font-semibold tracking-wider text-neutral-600 uppercase ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-1 transition-colors hover:text-neutral-950 ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${isActive ? 'text-primary' : ''}`}
      >
        <span title={tooltip} className={`${tooltip ? 'dotted-alias' : ''}`}>
          {label}
        </span>
        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      </Link>
    </th>
  )
}

export function AssetTable({ query, result }: AssetTableProps) {
  const { items, hasPrevPage, nextCursor, prevCursor, approxTotal, isFiltered } = result

  const firstPageHref = buildAssetListHref({
    ...query,
    cursor: undefined,
    cursorDir: 'next',
  })

  const prevHref = prevCursor
    ? buildAssetListHref({
        ...query,
        cursor: prevCursor,
        cursorDir: 'prev',
      })
    : null

  const nextHref = nextCursor
    ? buildAssetListHref({
        ...query,
        cursor: nextCursor,
        cursorDir: 'next',
      })
    : null

  return (
    <section
      aria-label="Asset holdings"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xs"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <SortableHeader
                column="symbol"
                label="Asset ID / Symbol"
                query={query}
                tooltip="Ticker symbol, ISO country code, 12-char ISIN, and unique asset UUID (#id)"
              />
              <SortableHeader
                column="name"
                label="Asset / Acquisition"
                query={query}
                tooltip="Asset name, owning portfolio, acquisition date, and supplier."
              />
              <th
                scope="col"
                className="dotted-alias px-3.5 py-2.5 text-left text-xs font-semibold tracking-wider text-neutral-600 uppercase"
                title="Asset classification and depreciation or amortization schedule (method and useful life in months)"
              >
                Class &amp; Depr.
              </th>
              <th
                scope="col"
                className="dotted-alias px-3.5 py-2.5 text-left text-xs font-semibold tracking-wider text-neutral-600 uppercase"
                title="Lifecycle status (Active, Suspended, Matured, Disposed) and, when exited, disposal date, sale proceeds, and retirement reason"
              >
                Status &amp; Disposal
              </th>
              <th
                scope="col"
                title="Total units, shares, or contracts held"
                className="dotted-alias px-3.5 py-2.5 text-right text-xs font-semibold tracking-wider text-neutral-600 uppercase"
              >
                Quantity
              </th>
              <th
                scope="col"
                title="Original acquisition cost (cost basis), accumulated depreciation, and Net Book Value (NBV)"
                className="dotted-alias px-3.5 py-2.5 text-right text-xs font-semibold tracking-wider text-neutral-600 uppercase"
              >
                Cost / Accum. Depr.
              </th>
              <SortableHeader
                column="marketValue"
                label="Market Value"
                query={query}
                align="right"
                tooltip="Current valuation of the holding in its native currency"
              />
              <th
                scope="col"
                title="Unrealized gain or loss (Market Value - Cost Basis) and percentage return"
                className="dotted-alias px-3.5 py-2.5 text-right text-xs font-semibold tracking-wider text-neutral-600 uppercase"
              >
                Unrealized P&amp;L
              </th>
              <SortableHeader
                column="updatedAt"
                label="Updated"
                query={query}
                align="right"
                tooltip="Last modification date, time (on tooltip)"
              />
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100 bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-14 text-center">
                  <p className="text-sm font-medium text-neutral-900">
                    {isFiltered ? 'No assets match the current filters' : 'No assets recorded yet'}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {isFiltered
                      ? 'Try broadening your search query or clearing one of the active filters.'
                      : 'Seed the database with pnpm db:seed to populate the ledger.'}
                  </p>
                  {isFiltered && (
                    <div className="mt-4">
                      <Link
                        href="/assets"
                        className="bg-primary inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                      >
                        Clear all filters
                      </Link>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              items.map((asset) => {
                const pnl = computeUnrealizedPnl(
                  asset.marketValue,
                  asset.costBasis,
                  asset.currencyMinorUnits,
                )
                const pnlColor =
                  pnl.direction === 'positive'
                    ? 'text-emerald-700'
                    : pnl.direction === 'negative'
                      ? 'text-rose-700'
                      : 'text-neutral-500'

                const hasDepr = asset.depreciationMethod !== 'none'
                const netBookValue = hasDepr
                  ? subtractDecimals(asset.costBasis, asset.accumulatedDepreciation)
                  : asset.costBasis

                return (
                  <tr
                    key={asset.publicId}
                    className="odd:bg-white even:bg-neutral-50/70 transition-colors hover:bg-neutral-100/70"
                  >
                    <td className="px-3.5 py-2.5 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/transactions?asset=${asset.publicId}`}
                          title="View transaction history"
                          className="hover:text-primary font-mono text-xs font-semibold text-neutral-950 hover:underline"
                        >
                          {asset.symbol}
                        </Link>
                        <span className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[10px] font-medium text-neutral-600">
                          {asset.country}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-neutral-500">
                        {asset.isin ?? '—'}
                      </div>
                      <div
                        className="mt-0.5 font-mono text-[10px] text-neutral-400"
                        title={`Asset ID: ${asset.publicId}`}
                      >
                        #{asset.publicId.slice(0, 8)}
                      </div>
                    </td>

                    <td className="max-w-72 px-3.5 py-2.5 align-top">
                      <div className="truncate font-medium text-neutral-900" title={asset.name}>
                        {asset.name}
                      </div>
                      <div
                        className="mt-0.5 truncate text-xs text-neutral-500"
                        title={`${asset.portfolioCode} — ${asset.portfolioName}`}
                      >
                        <span className="font-mono font-medium text-neutral-600">
                          {asset.portfolioCode}
                        </span>
                        {' · '}
                        {asset.portfolioName}
                      </div>
                      <div
                        className="mt-0.5 truncate text-[11px] text-neutral-400"
                        title={`Acquired ${formatUtcDate(asset.acquisitionDate)}${asset.supplier ? ` from ${asset.supplier}` : ''}`}
                      >
                        Acq. {formatUtcDate(asset.acquisitionDate)}
                        {asset.supplier ? ` · ${asset.supplier}` : ''}
                      </div>
                    </td>

                    <td className="px-3.5 py-2.5 align-top whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                        {ASSET_CLASS_LABELS[asset.assetClass]}
                      </span>
                      <div className="mt-1 text-[11px] text-neutral-500">
                        {DEPRECIATION_METHOD_LABELS[asset.depreciationMethod]}
                        {asset.usefulLifeMonths ? ` · ${asset.usefulLifeMonths}m` : ''}
                      </div>
                    </td>

                    <td className="px-3.5 py-2.5 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_BADGE_STYLES[asset.status]}`}
                      >
                        {ASSET_STATUS_LABELS[asset.status]}
                      </span>
                      {asset.disposalDate && (
                        <div className="mt-1 text-[11px] text-neutral-500">
                          <div>Disp. {formatUtcDate(asset.disposalDate)}</div>
                          {asset.disposalValue && (
                            <div className="font-mono text-[10px] text-neutral-600 tabular-nums">
                              Sale:{' '}
                              {formatMoney(
                                asset.disposalValue,
                                asset.currency,
                                asset.currencyMinorUnits,
                              )}
                            </div>
                          )}
                          {asset.retirementReason && (
                            <div
                              className="max-w-36 truncate text-[10px] text-neutral-400"
                              title={asset.retirementReason}
                            >
                              {asset.retirementReason}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-3.5 py-2.5 text-right align-top font-mono text-xs whitespace-nowrap text-neutral-800 tabular-nums">
                      {formatQuantity(asset.quantity)}
                    </td>

                    <td className="px-3.5 py-2.5 text-right align-top font-mono text-xs whitespace-nowrap text-neutral-700 tabular-nums">
                      <div>
                        {formatMoney(asset.costBasis, asset.currency, asset.currencyMinorUnits)}
                      </div>
                      {hasDepr && (
                        <>
                          <div
                            className="mt-0.5 text-[11px] text-amber-700"
                            title="Accumulated depreciation / amortization"
                          >
                            −
                            {formatMoney(
                              asset.accumulatedDepreciation,
                              asset.currency,
                              asset.currencyMinorUnits,
                            )}
                          </div>
                          <div
                            className="mt-0.5 text-[10px] text-neutral-500"
                            title="Net Book Value (Cost Basis − Accumulated Depreciation)"
                          >
                            <span className="dotted-alias" title="Net Book Value">
                              NBV
                            </span>
                            : {formatMoney(netBookValue, asset.currency, asset.currencyMinorUnits)}
                          </div>
                        </>
                      )}
                    </td>

                    <td className="px-3.5 py-2.5 text-right align-top font-mono text-xs font-semibold whitespace-nowrap text-neutral-950 tabular-nums">
                      {formatMoney(asset.marketValue, asset.currency, asset.currencyMinorUnits)}
                    </td>

                    <td
                      className={`px-3.5 py-2.5 text-right align-top font-mono text-xs whitespace-nowrap tabular-nums ${pnlColor}`}
                    >
                      <div className="font-medium">
                        {pnl.amount} {asset.currency}
                      </div>
                      {pnl.percent && <div className="mt-0.5 text-[11px]">{pnl.percent}</div>}
                    </td>

                    <td
                      className="px-3.5 py-2.5 text-right align-top text-xs whitespace-nowrap text-neutral-500"
                      title={formatUtcDateTime(asset.updatedAt)}
                    >
                      {formatUtcDate(asset.updatedAt)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Keyset pagination footer */}
      <div className="flex flex-col items-start justify-between gap-3 border-t border-neutral-200 bg-neutral-50/70 px-4 py-3 text-xs text-neutral-600 sm:flex-row sm:items-center">
        <div>
          Showing <span className="font-semibold text-neutral-900">{items.length}</span>{' '}
          {items.length === 1 ? 'asset' : 'assets'}
          {!isFiltered && approxTotal !== null && (
            <>
              {' '}
              of ~
              <span className="font-semibold text-neutral-900">
                {formatInteger(approxTotal)}
              </span>{' '}
              total
            </>
          )}
          {isFiltered && <span className="text-neutral-500"> (filtered view)</span>}
        </div>

        <nav aria-label="Pagination" className="flex items-center gap-1.5">
          {hasPrevPage ? (
            <Link
              href={firstPageHref}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
              First
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-100/70 px-2.5 font-medium text-neutral-400"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
              First
            </span>
          )}

          {prevHref ? (
            <Link
              href={prevHref}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-100/70 px-2.5 font-medium text-neutral-400"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </span>
          )}

          {nextHref ? (
            <Link
              href={nextHref}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-100/70 px-2.5 font-medium text-neutral-400"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          )}
        </nav>
      </div>
    </section>
  )
}
