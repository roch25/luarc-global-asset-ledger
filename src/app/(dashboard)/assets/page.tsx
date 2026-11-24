import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AssetFilters } from '@/features/assets/components/AssetFilters'
import { AssetTable } from '@/features/assets/components/AssetTable'
import { AssetTableSkeleton } from '@/features/assets/components/AssetTableSkeleton'
import { VirtualizedAssetTable } from '@/features/assets/components/VirtualizedAssetTable'
import { getAssetFilterOptions, listAssets, serializeAssetItem } from '@/features/assets/queries'
import { type RawSearchParams, parseAssetSearchParams } from '@/features/assets/schemas'
import { getLedgerSettings } from '@/features/settings/queries'

export const metadata: Metadata = {
  title: 'Asset Ledger',
  description: 'Search, filter, and monitor global financial asset holdings.',
}

async function AssetLedgerContent({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [rawParams, settings] = await Promise.all([searchParams, getLedgerSettings()])
  const effectiveRaw: RawSearchParams =
    Object.keys(rawParams).length === 0
      ? {
          sort: settings.defaultAssetSort,
          dir: settings.defaultAssetDir,
          pageSize: String(settings.defaultPageSize),
          view: settings.defaultAssetView,
        }
      : rawParams
  const query = parseAssetSearchParams(effectiveRaw)

  const [result, filterOptions] = await Promise.all([
    listAssets(query, query.view === 'virtual' ? { limitOverride: 200 } : undefined),
    getAssetFilterOptions(),
  ])

  const virtualKey = [
    query.q ?? '',
    query.assetClass ?? '',
    query.status ?? '',
    query.depreciationMethod ?? '',
    query.currency ?? '',
    query.portfolioId ?? '',
    query.sort,
    query.dir,
  ].join('|')

  return (
    <div className="space-y-4">
      <AssetFilters query={query} options={filterOptions} />
      {query.view === 'virtual' ? (
        <VirtualizedAssetTable
          key={virtualKey}
          query={query}
          initialItems={result.items.map(serializeAssetItem)}
          initialHasNextPage={result.hasNextPage}
          initialNextCursor={result.nextCursor}
          initialQueryMs={result.queryMs}
          approxTotal={result.approxTotal}
          isFiltered={result.isFiltered}
        />
      ) : (
        <AssetTable query={query} result={result} />
      )}
    </div>
  )
}

export default function AssetsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return (
    <div className="mx-auto max-w-[1600px] space-y-2 p-4 sm:space-x-5 sm:p-6">
      <header className="flex flex-col gap-0 sm:flex-row sm:items-end sm:justify-between sm:gap-1">
        <div>
          <h1 className="text-2xl tracking-tight text-neutral-950">Asset Ledger</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-600 sm:block">
            Global holdings across portfolios, currencies, and asset classes.
          </p>
        </div>
      </header>

      <Suspense fallback={<AssetTableSkeleton />}>
        <AssetLedgerContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
