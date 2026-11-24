import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AssetTableSkeleton } from '@/features/assets/components/AssetTableSkeleton'
import { getAssetFilterOptions } from '@/features/assets/queries'
import { TransactionFilters } from '@/features/transactions/components/TransactionFilters'
import { TransactionTable } from '@/features/transactions/components/TransactionTable'
import { listTransactions } from '@/features/transactions/queries'
import { type RawSearchParams, parseTransactionSearchParams } from '@/features/transactions/schemas'
import { getLedgerSettings } from '@/features/settings/queries'

export const metadata: Metadata = {
  title: 'Transactions',
  description: 'Append-only global transaction ledger with reversal tracking.',
}

async function TransactionLedgerContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const [rawParams, settings] = await Promise.all([searchParams, getLedgerSettings()])
  const effectiveRaw: RawSearchParams =
    Object.keys(rawParams).length === 0 ? { pageSize: String(settings.defaultPageSize) } : rawParams
  const query = parseTransactionSearchParams(effectiveRaw)

  const [result, filterOptions] = await Promise.all([
    listTransactions(query),
    getAssetFilterOptions(),
  ])

  return (
    <div className="space-y-4">
      <TransactionFilters query={query} currencies={filterOptions.currencies} />
      <TransactionTable query={query} result={result} />
    </div>
  )
}

export default function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl tracking-tight text-neutral-950">Transactions</h1>
        <p className="mt-0.5 text-sm text-neutral-600">
          Append-only ledger of every trade, transfer, income, fee, and correction.
        </p>
      </header>

      <Suspense fallback={<AssetTableSkeleton />}>
        <TransactionLedgerContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
