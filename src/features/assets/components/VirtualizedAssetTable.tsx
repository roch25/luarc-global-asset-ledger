'use client'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Cpu,
  Database,
  Layers,
  LoaderCircle,
  Plus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  computeUnrealizedPnl,
  formatInteger,
  formatMoney,
  formatQuantity,
  formatUtcDate,
  formatUtcDateTime,
} from '@/lib/format'
import {
  ASSET_CLASS_LABELS,
  ASSET_STATUS_LABELS,
  type AssetListQuery,
  type AssetSortColumn,
  type AssetStatusValue,
  DEPRECIATION_METHOD_LABELS,
  type SerializedAssetListItem,
  buildAssetListHref,
} from '../schemas'
import type {
  LedgerWorkerRequest,
  LedgerWorkerResponse,
  LedgerWorkerStats,
} from '../workers/ledgerStats.worker'
import { AssetDetailModal } from './AssetDetailModal'

const ROW_HEIGHT = 68
const OVERSCAN = 10
const GRID_COLS = 'grid-cols-[145px_minmax(230px,1.4fr)_135px_135px_110px_155px_155px_155px_100px]'

const STATUS_BADGE_STYLES: Record<AssetStatusValue, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  suspended: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  matured: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  disposed: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
}

interface VirtualizedAssetTableProps {
  query: AssetListQuery
  initialItems: SerializedAssetListItem[]
  initialHasNextPage: boolean
  initialNextCursor: string | null
  initialQueryMs: number
  approxTotal: number | null
  isFiltered: boolean
}

interface ApiAssetsResponse {
  items: SerializedAssetListItem[]
  hasNextPage: boolean
  nextCursor: string | null
  queryMs: number
  error?: string
}

function buildApiUrl(query: AssetListQuery, cursor: string, limit: number): string {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.assetClass) params.set('assetClass', query.assetClass)
  if (query.status) params.set('status', query.status)
  if (query.depreciationMethod) params.set('depreciationMethod', query.depreciationMethod)
  if (query.currency) params.set('currency', query.currency)
  if (query.portfolioId !== undefined) params.set('portfolioId', String(query.portfolioId))
  params.set('sort', query.sort)
  params.set('dir', query.dir)
  params.set('cursor', cursor)
  params.set('limit', String(limit))
  return `/api/assets?${params.toString()}`
}

function SortableGridHeader({
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
    view: 'virtual',
  })

  const Icon = !isActive ? ArrowUpDown : query.dir === 'asc' ? ArrowUp : ArrowDown

  return (
    <div
      role="columnheader"
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
    </div>
  )
}

export function VirtualizedAssetTable({
  query,
  initialItems,
  initialHasNextPage,
  initialNextCursor,
  initialQueryMs,
  approxTotal,
  isFiltered,
}: VirtualizedAssetTableProps) {
  const [items, setItems] = useState<SerializedAssetListItem[]>(initialItems)
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [lastQueryMs, setLastQueryMs] = useState(initialQueryMs)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [workerStats, setWorkerStats] = useState<LedgerWorkerStats | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<SerializedAssetListItem | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(620)

  const inFlightRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const workerReqIdRef = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewportHeight(el.clientHeight || 620)

    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height
      if (height && height > 0) setViewportHeight(height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const worker = new Worker(new URL('../workers/ledgerStats.worker.ts', import.meta.url))
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<LedgerWorkerResponse>) => {
      if (event.data.requestId === workerReqIdRef.current) {
        setWorkerStats(event.data.stats)
      }
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    const worker = workerRef.current
    if (!worker) return
    const requestId = ++workerReqIdRef.current
    const payload: LedgerWorkerRequest = { requestId, items }
    worker.postMessage(payload)
  }, [items])

  const fetchChunks = useCallback(
    async (totalRowsToLoad: number) => {
      if (inFlightRef.current || !hasNextPage || !nextCursor) return
      inFlightRef.current = true
      setIsLoadingMore(true)
      setLoadError(null)

      const controller = new AbortController()
      abortRef.current = controller

      let cursor: string | null = nextCursor
      let remaining = totalRowsToLoad
      let more: boolean = hasNextPage

      try {
        while (remaining > 0 && more && cursor) {
          const chunkLimit = Math.min(500, remaining)
          const res = await fetch(buildApiUrl(query, cursor, chunkLimit), {
            signal: controller.signal,
          })
          if (!res.ok) {
            throw new Error(`Request failed (${res.status})`)
          }
          const data = (await res.json()) as ApiAssetsResponse
          setItems((prev) => [...prev, ...data.items])
          setLastQueryMs(data.queryMs)
          setHasNextPage(data.hasNextPage)
          setNextCursor(data.nextCursor)

          cursor = data.nextCursor
          more = data.hasNextPage
          remaining -= data.items.length
          if (data.items.length === 0) break
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setLoadError('Failed to stream next chunk. Try again.')
        }
      } finally {
        inFlightRef.current = false
        setIsLoadingMore(false)
      }
    },
    [hasNextPage, nextCursor, query],
  )

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      const nextScrollTop = target.scrollTop
      setScrollTop(nextScrollTop)

      // Trigger next 200-row keyset chunk when within 600px of the bottom.
      const distanceFromBottom = target.scrollHeight - (nextScrollTop + target.clientHeight)
      if (distanceFromBottom < 600 && hasNextPage && !inFlightRef.current) {
        void fetchChunks(200)
      }
    },
    [fetchChunks, hasNextPage],
  )

  const totalHeight = items.length * ROW_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
  )
  const visibleItems = items.slice(startIndex, endIndex)

  return (
    <div className="space-y-3">
      {/* Live Virtualizer & Web Worker Telemetry Bar */}
      <section
        aria-label="Stream buffer and worker analytics"
        className="rounded-lg border border-neutral-200 bg-white p-3.5 shadow-xs"
      >
        <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 ring-1 ring-emerald-600/20 ring-inset">
              <Layers aria-hidden="true" className="h-3.5 w-3.5" />
              Loaded:{' '}
              <strong className="font-mono tabular-nums">{formatInteger(items.length)}</strong>
              {!isFiltered && approxTotal !== null && (
                <span className="text-emerald-700/80">/ ~{formatInteger(approxTotal)}</span>
              )}
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700">
              DOM rows: <strong className="font-mono tabular-nums">{visibleItems.length}</strong>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700">
              <Database aria-hidden="true" className="h-3.5 w-3.5 text-neutral-500" />
              DB chunk: <strong className="font-mono tabular-nums">{lastQueryMs}ms</strong>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-800 ring-1 ring-sky-600/20 ring-inset">
              <Cpu aria-hidden="true" className="h-3.5 w-3.5" />
              Worker rollup:{' '}
              <strong className="font-mono tabular-nums">
                {workerStats ? `${workerStats.workerMs}ms` : '...'}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasNextPage && (
              <>
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={() => void fetchChunks(500)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Load +500
                </button>
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={() => void fetchChunks(2000)}
                  className="bg-primary inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Load +2,000
                </button>
              </>
            )}
          </div>
        </div>

        {/* Off-main-thread Web Worker summary chips */}
        {workerStats && workerStats.totalLoaded > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-100 pt-2.5 text-xs text-neutral-600">
            {workerStats.topCurrencies.map((c) => (
              <div
                key={c.code}
                className="inline-flex items-baseline gap-1.5 font-mono tabular-nums"
              >
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700">
                  {c.code} ({formatInteger(c.count)})
                </span>
                <span className="font-semibold text-neutral-950">{c.marketValueCompact}</span>
                {c.pnlPercent && (
                  <span
                    className={
                      c.pnlDirection === 'positive'
                        ? 'text-emerald-700'
                        : c.pnlDirection === 'negative'
                          ? 'text-rose-700'
                          : 'text-neutral-500'
                    }
                  >
                    {c.pnlPercent}
                  </span>
                )}
              </div>
            ))}

            {workerStats.bestPerformer && (
              <div className="inline-flex items-center gap-1 text-emerald-700">
                <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="text-neutral-500">Top:</span>
                <span className="font-mono font-semibold">{workerStats.bestPerformer.symbol}</span>
                <span className="font-mono">{workerStats.bestPerformer.pnlPercent}</span>
              </div>
            )}

            {workerStats.worstPerformer && (
              <div className="inline-flex items-center gap-1 text-rose-700">
                <TrendingDown aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="text-neutral-500">Lagging:</span>
                <span className="font-mono font-semibold">{workerStats.worstPerformer.symbol}</span>
                <span className="font-mono">{workerStats.worstPerformer.pnlPercent}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Virtualized Ledger Viewport */}
      <section
        aria-label="Virtualized asset holdings"
        className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xs"
      >
        {items.length === 0 ? (
          <div className="px-6 py-14 text-center">
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
                  href="/assets?view=virtual"
                  className="bg-primary inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                >
                  Clear all filters
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            role="table"
            aria-rowcount={items.length}
            className="h-155 overflow-auto"
          >
            <div className="min-w-305">
              {/* Sticky header */}
              <div
                role="row"
                className={`sticky top-0 z-10 grid items-center border-b border-neutral-200 bg-neutral-50 ${GRID_COLS}`}
              >
                <SortableGridHeader
                  column="symbol"
                  label="Asset ID / Symbol"
                  query={query}
                  tooltip="Ticker symbol, ISO country code, 12-char ISIN, and unique asset UUID (#id)"
                />
                <SortableGridHeader
                  column="name"
                  label="Asset / Acquisition"
                  query={query}
                  tooltip="Asset name, owning portfolio, acquisition date, and supplier."
                />
                <div
                  role="columnheader"
                  title="Asset classification and depreciation or amortization schedule (method and useful life in months)"
                  className="dotted-alias px-3.5 py-2.5 text-left text-xs font-semibold tracking-wider text-neutral-600 uppercase"
                >
                  Class &amp; Depr.
                </div>
                <div
                  role="columnheader"
                  title="Lifecycle status (Active, Suspended, Matured, Disposed) and, when exited, disposal date, sale proceeds, and retirement reason"
                  className="dotted-alias px-3.5 py-2.5 text-left text-xs font-semibold tracking-wider text-neutral-600 uppercase"
                >
                  Status &amp; Disposal
                </div>
                <div
                  role="columnheader"
                  title="Total units, shares, or contracts held"
                  className="dotted-alias px-3.5 py-2.5 text-right text-xs font-semibold tracking-wider text-neutral-600 uppercase"
                >
                  Quantity
                </div>
                <div
                  role="columnheader"
                  title="Original acquisition cost (cost basis), accumulated depreciation, and Net Book Value (NBV)"
                  className="dotted-alias px-3.5 py-2.5 text-right text-xs font-semibold tracking-wider text-neutral-600 uppercase"
                >
                  Cost / Accum. Depr.
                </div>
                <SortableGridHeader
                  column="marketValue"
                  label="Market Value"
                  query={query}
                  align="right"
                  tooltip="Current valuation of the holding in its native currency"
                />
                <div
                  role="columnheader"
                  title="Unrealized gain or loss (Market Value - Cost Basis) and percentage return"
                  className="dotted-alias px-3.5 py-2.5 text-right text-xs font-semibold tracking-wider text-neutral-600 uppercase"
                >
                  Unrealized P&amp;L
                </div>
                <SortableGridHeader
                  column="updatedAt"
                  label="Updated"
                  query={query}
                  align="right"
                  tooltip="Last modification date, time (on tooltip)"
                />
              </div>

              {/* Virtualized body */}
              <div role="rowgroup" className="relative" style={{ height: `${totalHeight}px` }}>
                {visibleItems.map((asset, offset) => {
                  const rowIndex = startIndex + offset
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

                  return (
                    <div
                      key={asset.publicId}
                      role="row"
                      aria-rowindex={rowIndex + 1}
                      onClick={() => setSelectedAsset(asset)}
                      style={{
                        height: `${ROW_HEIGHT}px`,
                        transform: `translateY(${rowIndex * ROW_HEIGHT}px)`,
                      }}
                      className={`absolute top-0 right-0 left-0 grid cursor-pointer items-center border-b border-neutral-100 text-sm transition-colors hover:bg-neutral-100/70 ${
                        rowIndex % 2 === 1 ? 'bg-neutral-50/70' : 'bg-white'
                      } ${GRID_COLS}`}
                    >
                      <div role="cell" className="px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/transactions?asset=${asset.publicId}`}
                            onClick={(e) => e.stopPropagation()}
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
                      </div>

                      <div role="cell" className="min-w-0 px-3.5">
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
                      </div>

                      <div role="cell" className="px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                          {ASSET_CLASS_LABELS[asset.assetClass]}
                        </span>
                        <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                          {DEPRECIATION_METHOD_LABELS[asset.depreciationMethod]}
                          {asset.usefulLifeMonths ? ` · ${asset.usefulLifeMonths}m` : ''}
                        </div>
                      </div>

                      <div role="cell" className="px-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_BADGE_STYLES[asset.status]}`}
                        >
                          {ASSET_STATUS_LABELS[asset.status]}
                        </span>
                        {asset.disposalDate && (
                          <div
                            className="mt-0.5 truncate text-[11px] text-neutral-500"
                            title={asset.retirementReason ?? undefined}
                          >
                            Disp. {formatUtcDate(asset.disposalDate)}
                          </div>
                        )}
                      </div>

                      <div
                        role="cell"
                        className="px-3.5 text-right font-mono text-xs whitespace-nowrap text-neutral-800 tabular-nums"
                      >
                        {formatQuantity(asset.quantity)}
                      </div>

                      <div
                        role="cell"
                        className="px-3.5 text-right font-mono text-xs whitespace-nowrap text-neutral-700 tabular-nums"
                      >
                        <div>
                          {formatMoney(asset.costBasis, asset.currency, asset.currencyMinorUnits)}
                        </div>
                        {asset.depreciationMethod !== 'none' && (
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
                        )}
                      </div>

                      <div
                        role="cell"
                        className="px-3.5 text-right font-mono text-xs font-semibold whitespace-nowrap text-neutral-950 tabular-nums"
                      >
                        {formatMoney(asset.marketValue, asset.currency, asset.currencyMinorUnits)}
                      </div>

                      <div
                        role="cell"
                        className={`px-3.5 text-right font-mono text-xs whitespace-nowrap tabular-nums ${pnlColor}`}
                      >
                        <div className="font-medium">
                          {pnl.amount} {asset.currency}
                        </div>
                        {pnl.percent && <div className="mt-0.5 text-[11px]">{pnl.percent}</div>}
                      </div>

                      <div
                        role="cell"
                        className="px-3.5 text-right text-xs whitespace-nowrap text-neutral-500"
                        title={formatUtcDateTime(asset.updatedAt)}
                      >
                        {formatUtcDate(asset.updatedAt)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer status bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 bg-neutral-50/70 px-4 py-2.5 text-xs text-neutral-600">
          <div>
            {loadError ? (
              <span className="font-medium text-rose-700">{loadError}</span>
            ) : isLoadingMore ? (
              <span className="text-primary inline-flex items-center gap-1.5 font-medium">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Streaming next keyset chunk...
              </span>
            ) : hasNextPage ? (
              <span>Scroll down to stream more rows automatically, or use Load +500 / +2,000.</span>
            ) : (
              <span>Reached end of matching ledger records.</span>
            )}
          </div>
          <div className="font-mono text-[11px] text-neutral-500 tabular-nums">
            Rows{' '}
            {items.length > 0 ? `${formatInteger(startIndex + 1)}–${formatInteger(endIndex)}` : '0'}{' '}
            of {formatInteger(items.length)} loaded
          </div>
        </div>
      </section>

      <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
    </div>
  )
}
