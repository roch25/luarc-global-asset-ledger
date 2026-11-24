import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SettingsSkeleton } from '@/features/settings/components/SettingsSkeleton'
import { SettingsView } from '@/features/settings/components/SettingsView'
import { getDatabaseDiagnostics, getLedgerSettings } from '@/features/settings/queries'

export const metadata: Metadata = {
  title: 'Settings',
  description:
    'Configure default reporting currency, ledger view preferences, and database diagnostics.',
}

async function SettingsContent() {
  const [settings, diagnostics] = await Promise.all([getLedgerSettings(), getDatabaseDiagnostics()])

  return <SettingsView initialSettings={settings} diagnostics={diagnostics} />
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl tracking-tight text-neutral-950">Settings &amp; Diagnostics</h1>
        <p className="mt-0.5 text-sm text-neutral-600">
          Configure default reporting currency, ledger pagination/streaming behavior, and manage
          materialized views.
        </p>
      </header>

      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  )
}
