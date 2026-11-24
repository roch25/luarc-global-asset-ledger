import type { Metadata } from 'next'
import { Suspense } from 'react'
import type { RawSearchParams } from '@/features/assets/schemas'
import { OverviewDashboard } from '@/features/dashboard/components/OverviewDashboard'
import { OverviewSkeleton } from '@/features/dashboard/components/OverviewSkeleton'
import { getOverviewSummary } from '@/features/dashboard/queries'
import { getLedgerSettings } from '@/features/settings/queries'

export const metadata: Metadata = {
  title: 'Overview',
  description: 'High-level global asset ledger analytics, holding status, top portfolios',
}

async function OverviewContent({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [raw, settings] = await Promise.all([searchParams, getLedgerSettings()])
  const rawCurrency = Array.isArray(raw.currency) ? raw.currency[0] : raw.currency
  const currency =
    rawCurrency && /^[A-Za-z]{3}$/.test(rawCurrency)
      ? rawCurrency.toUpperCase()
      : settings.defaultCurrency

  const summary = await getOverviewSummary(currency)
  return <OverviewDashboard summary={summary} numberDisplay={settings.numberDisplay} />
}

export default function OverviewPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl tracking-tight text-neutral-950">Ledger Overview</h1>
        <p className="mt-0.5 text-sm text-neutral-600">
          Pre-aggregated exposure, valuation, and portfolio analytics across the global ledger.
        </p>
      </header>

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
