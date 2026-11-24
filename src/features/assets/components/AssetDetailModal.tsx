'use client'

import { ArrowRight, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import {
  computeUnrealizedPnl,
  formatMoney,
  formatQuantity,
  formatUtcDate,
  formatUtcDateTime,
  subtractDecimals,
} from '@/lib/format'
import {
  ASSET_CLASS_LABELS,
  ASSET_STATUS_LABELS,
  type AssetClassValue,
  type AssetStatusValue,
  DEPRECIATION_METHOD_LABELS,
  type DepreciationMethodValue,
} from '../schemas'

export interface AssetModalData {
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
  valuedAt: Date | string
  acquisitionDate: string
  supplier: string | null
  depreciationMethod: DepreciationMethodValue
  usefulLifeMonths: number | null
  salvageValue: string
  accumulatedDepreciation: string
  disposalDate: string | null
  disposalValue: string | null
  retirementReason: string | null
  updatedAt: Date | string
}

const STATUS_BADGE_STYLES: Record<AssetStatusValue, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  suspended: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  matured: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  disposed: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
}

export function AssetDetailModal({
  asset,
  onClose,
}: {
  asset: AssetModalData | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!asset) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [asset, onClose])

  if (!asset) return null

  const pnl = computeUnrealizedPnl(asset.marketValue, asset.costBasis, asset.currencyMinorUnits)
  const pnlColor =
    pnl.direction === 'positive'
      ? 'text-emerald-700'
      : pnl.direction === 'negative'
        ? 'text-rose-700'
        : 'text-neutral-600'

  const hasDepr = asset.depreciationMethod !== 'none'
  const netBookValue = hasDepr
    ? subtractDecimals(asset.costBasis, asset.accumulatedDepreciation)
    : asset.costBasis

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/50 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-bold text-neutral-950">{asset.symbol}</span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs font-medium text-neutral-700">
                {asset.country}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_BADGE_STYLES[asset.status]}`}
              >
                {ASSET_STATUS_LABELS[asset.status]}
              </span>
              <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                {ASSET_CLASS_LABELS[asset.assetClass]}
              </span>
            </div>
            <h2
              id="asset-modal-title"
              className="mt-1 truncate text-sm font-semibold text-neutral-900"
            >
              {asset.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close asset details"
            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4 text-xs sm:p-5">
          <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50/80 p-3">
            <div>
              <div className="text-[11px] font-medium text-neutral-500 uppercase">Market Value</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-neutral-950 tabular-nums">
                {formatMoney(asset.marketValue, asset.currency, asset.currencyMinorUnits)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-neutral-500 uppercase">
                Unrealized P&amp;L
              </div>
              <div className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${pnlColor}`}>
                {pnl.amount} {asset.currency}{' '}
                {pnl.percent && <span className="text-xs font-medium">({pnl.percent})</span>}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-neutral-500 uppercase">Cost Basis</div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-neutral-800 tabular-nums">
                {formatMoney(asset.costBasis, asset.currency, asset.currencyMinorUnits)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-neutral-500 uppercase">Quantity</div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-neutral-800 tabular-nums">
                {formatQuantity(asset.quantity)}
              </div>
            </div>
          </div>

          {/* Identifiers & Portfolio */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              Identification &amp; Portfolio
            </h3>
            <dl className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-neutral-500">Asset UUID</dt>
                <dd className="font-mono text-[11px] break-all text-neutral-900">
                  {asset.publicId}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-neutral-500">ISIN</dt>
                <dd className="font-mono text-neutral-900">{asset.isin ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-neutral-500">Portfolio</dt>
                <dd className="text-right font-medium text-neutral-900">
                  <span className="font-mono font-semibold">{asset.portfolioCode}</span> ·{' '}
                  {asset.portfolioName}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-neutral-500">Currency / Country</dt>
                <dd className="font-mono text-neutral-900">
                  {asset.currency} · {asset.country}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              Acquisition &amp; Depreciation
            </h3>
            <dl className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-neutral-500">Acquisition Date</dt>
                <dd className="font-mono text-neutral-900">
                  {formatUtcDate(asset.acquisitionDate)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-neutral-500">Supplier / Counterparty</dt>
                <dd className="text-right text-neutral-900">{asset.supplier ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-neutral-500">Depreciation Method</dt>
                <dd className="text-neutral-900">
                  {DEPRECIATION_METHOD_LABELS[asset.depreciationMethod]}
                  {asset.usefulLifeMonths ? ` (${asset.usefulLifeMonths} months)` : ''}
                </dd>
              </div>
              {hasDepr && (
                <>
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <dt className="text-neutral-500">Accumulated Depreciation</dt>
                    <dd className="font-mono text-amber-700 tabular-nums">
                      −
                      {formatMoney(
                        asset.accumulatedDepreciation,
                        asset.currency,
                        asset.currencyMinorUnits,
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <dt className="text-neutral-500">Net Book Value (NBV)</dt>
                    <dd className="font-mono font-semibold text-neutral-900 tabular-nums">
                      {formatMoney(netBookValue, asset.currency, asset.currencyMinorUnits)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <dt className="text-neutral-500">Salvage Value</dt>
                    <dd className="font-mono text-neutral-900 tabular-nums">
                      {formatMoney(asset.salvageValue, asset.currency, asset.currencyMinorUnits)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {(asset.disposalDate || asset.disposalValue || asset.retirementReason) && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                Disposal &amp; Retirement
              </h3>
              <dl className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-neutral-500">Disposal Date</dt>
                  <dd className="font-mono text-neutral-900">
                    {asset.disposalDate ? formatUtcDate(asset.disposalDate) : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-neutral-500">Disposal Proceeds</dt>
                  <dd className="font-mono text-neutral-900 tabular-nums">
                    {asset.disposalValue
                      ? formatMoney(asset.disposalValue, asset.currency, asset.currencyMinorUnits)
                      : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-neutral-500">Retirement Reason</dt>
                  <dd className="text-right text-neutral-900">{asset.retirementReason ?? '—'}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-neutral-400">
            <span>Valued: {formatUtcDateTime(asset.valuedAt)}</span>
            <span>Updated: {formatUtcDateTime(asset.updatedAt)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-4 py-3 sm:px-5">
          <Link
            href={`/transactions?asset=${asset.publicId}`}
            className="text-primary inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
          >
            View transaction history
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
