'use client'

import {
  CheckCircle2,
  ChevronDown,
  Database,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Save,
} from 'lucide-react'
import { useState, useTransition } from 'react'
import {
  PAGE_SIZES,
  type AssetSortColumn,
  type AssetViewMode,
  type PageSize,
  type SortDirection,
} from '@/features/assets/schemas'
import { formatInteger } from '@/lib/format'
import {
  refreshMaterializedViewsAction,
  resetLedgerSettingsAction,
  saveLedgerSettingsAction,
} from '../actions'
import type { DatabaseDiagnostics } from '../queries'
import {
  EXPORT_ROW_CAPS,
  type ExportRowCap,
  type LedgerSettings,
  type NumberDisplayMode,
} from '../schemas'

const SELECT_CLASS =
  'border-foreground/10 bg-background text-foreground focus:border-primary w-full appearance-none rounded-lg border py-2 pr-10 pl-3 text-sm outline-none'

function SelectChevron() {
  return (
    <ChevronDown
      aria-hidden="true"
      size={20}
      className="text-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
    />
  )
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const val = bytes / Math.pow(1024, i)
  return `${val >= 100 ? val.toFixed(0) : val.toFixed(1)} ${units[i]}`
}

interface SettingsViewProps {
  initialSettings: LedgerSettings
  diagnostics: DatabaseDiagnostics
}

export function SettingsView({ initialSettings, diagnostics }: SettingsViewProps) {
  const [form, setForm] = useState<LedgerSettings>(initialSettings)
  const [isSaving, startSaveTransition] = useTransition()
  const [isRefreshingMv, startRefreshTransition] = useTransition()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [mvFeedback, setMvFeedback] = useState<{
    ok: boolean
    durationMs: number
    error?: string
  } | null>(null)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveMessage(null)
    startSaveTransition(async () => {
      const res = await saveLedgerSettingsAction(form)
      if (res.ok) {
        setForm(res.settings)
        setSaveMessage('Defaults saved. Overview, Assets, Transactions, and Reports updated.')
      }
    })
  }

  function handleReset() {
    setSaveMessage(null)
    startSaveTransition(async () => {
      const res = await resetLedgerSettingsAction()
      if (res.ok) {
        setForm(res.settings)
        setSaveMessage('Preferences reset to system defaults.')
      }
    })
  }

  function handleRefreshMatViews() {
    setMvFeedback(null)
    startRefreshTransition(async () => {
      const res = await refreshMaterializedViewsAction()
      setMvFeedback(res)
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Card 1: Reporting & Valuation Defaults */}
          <section
            aria-label="Reporting and valuation defaults"
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs sm:p-5"
          >
            <div className="border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-semibold text-neutral-950">
                Reporting &amp; Valuation Defaults
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Pre-selected currency and monetary display format for Overview (/) and Reports
                (/reports).
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block space-y-1.5 text-xs">
                <span className="font-medium text-neutral-700">Default Reporting Currency</span>
                <div className="relative">
                  <select
                    aria-label="Default reporting currency"
                    value={form.defaultCurrency}
                    onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })}
                    className={SELECT_CLASS}
                  >
                    {diagnostics.currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name} ({c.minorUnits} minor units)
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
                <p className="text-[11px] text-neutral-500">
                  Used whenever no <code>?currency=</code> parameter is present in the URL.
                </p>
              </label>

              <label className="block space-y-1.5 text-xs">
                <span className="font-medium text-neutral-700">
                  Summary Monetary Display Format
                </span>
                <div className="relative">
                  <select
                    aria-label="Summary monetary display format"
                    value={form.numberDisplay}
                    onChange={(e) =>
                      setForm({ ...form, numberDisplay: e.target.value as NumberDisplayMode })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="compact">Compact (e.g. 245.12B {form.defaultCurrency})</option>
                    <option value="full">
                      Full Precision (e.g. 245,123,456,789.00 {form.defaultCurrency})
                    </option>
                  </select>
                  <SelectChevron />
                </div>
              </label>

              <label className="block space-y-1.5 text-xs">
                <span className="font-medium text-neutral-700">Default CSV Export Row Cap</span>
                <div className="relative">
                  <select
                    aria-label="Default CSV export row cap"
                    value={form.defaultExportMaxRows}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        defaultExportMaxRows: Number(e.target.value) as ExportRowCap,
                      })
                    }
                    className={SELECT_CLASS}
                  >
                    {EXPORT_ROW_CAPS.map((cap) => (
                      <option key={cap} value={cap}>
                        Up to {formatInteger(cap)} rows per stream
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </label>
            </div>
          </section>

          {/* Card 2: Ledger View & Pagination Defaults */}
          <section
            aria-label="Ledger view and pagination defaults"
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs sm:p-5"
          >
            <div className="border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-semibold text-neutral-950">
                Ledger View &amp; Pagination Defaults
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Controls initial table rendering mode, page size, and sort order on /assets and
                /transactions.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block space-y-1.5 text-xs">
                <span className="font-medium text-neutral-700">Default Asset Ledger View Mode</span>
                <div className="relative">
                  <select
                    aria-label="Default asset ledger view mode"
                    value={form.defaultAssetView}
                    onChange={(e) =>
                      setForm({ ...form, defaultAssetView: e.target.value as AssetViewMode })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="paginated">Paginated (SSR Keyset Pages)</option>
                    <option value="virtual">
                      Virtual Stream (60fps Windowed + Off-Thread Web Worker)
                    </option>
                  </select>
                  <SelectChevron />
                </div>
              </label>

              <label className="block space-y-1.5 text-xs">
                <span className="font-medium text-neutral-700">Default Rows Per Page</span>
                <div className="relative">
                  <select
                    aria-label="Default rows per page"
                    value={form.defaultPageSize}
                    onChange={(e) =>
                      setForm({ ...form, defaultPageSize: Number(e.target.value) as PageSize })
                    }
                    className={SELECT_CLASS}
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size} rows per page
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 text-xs">
                  <span className="font-medium text-neutral-700">Default Asset Sort Column</span>
                  <div className="relative">
                    <select
                      aria-label="Default asset sort column"
                      value={form.defaultAssetSort}
                      onChange={(e) =>
                        setForm({ ...form, defaultAssetSort: e.target.value as AssetSortColumn })
                      }
                      className={SELECT_CLASS}
                    >
                      <option value="marketValue">Market Value</option>
                      <option value="updatedAt">Last Updated</option>
                      <option value="symbol">Symbol</option>
                      <option value="name">Asset Name</option>
                    </select>
                    <SelectChevron />
                  </div>
                </label>

                <label className="block space-y-1.5 text-xs">
                  <span className="font-medium text-neutral-700">Default Sort Direction</span>
                  <div className="relative">
                    <select
                      aria-label="Default sort direction"
                      value={form.defaultAssetDir}
                      onChange={(e) =>
                        setForm({ ...form, defaultAssetDir: e.target.value as SortDirection })
                      }
                      className={SELECT_CLASS}
                    >
                      <option value="desc">Descending (High → Low / Newest)</option>
                      <option value="asc">Ascending (Low → High / A → Z)</option>
                    </select>
                    <SelectChevron />
                  </div>
                </label>
              </div>
            </div>
          </section>
        </div>

        {/* Save / Reset Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs">
            {saveMessage ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {saveMessage}
              </span>
            ) : (
              <span className="text-neutral-500">
                Preferences are stored in an HTTP cookie so Server Components apply them on the
                first render.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleReset}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Defaults
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-primary inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Preferences
            </button>
          </div>
        </div>
      </form>

      {/* Card 3: Database & Materialized View Operations */}
      <section
        aria-label="Database diagnostics and materialized views"
        className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xs"
      >
        <div className="flex flex-col justify-between gap-3 border-b border-neutral-200 px-4 py-3.5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-950">
                PostgreSQL Engine &amp; Materialized Views
              </h2>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[11px] font-medium text-neutral-700">
                PG {diagnostics.pgVersion} · {formatBytes(diagnostics.databaseBytes)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">
              Live relation storage, B-tree/GIN index footprint, and non-blocking materialized view
              refresh.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {mvFeedback && (
              <span
                className={`text-xs font-medium ${
                  mvFeedback.ok ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {mvFeedback.ok ? `Refreshed in ${mvFeedback.durationMs}ms` : mvFeedback.error}
              </span>
            )}
            <button
              type="button"
              disabled={isRefreshingMv}
              onClick={handleRefreshMatViews}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingMv ? 'animate-spin' : ''}`} />
              Refresh Materialized Views Concurrently
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-3">
          {/* Materialized Views Status */}
          <div className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              <Database className="h-3.5 w-3.5" />
              Materialized Views
            </h3>
            {diagnostics.matViews.map((mv) => (
              <div
                key={mv.viewName}
                className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50/60 px-3 py-2.5 text-xs"
              >
                <div>
                  <div className="font-mono font-semibold text-neutral-900">{mv.viewName}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    Size: {formatBytes(mv.totalBytes)}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                    mv.isPopulated
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                      : 'bg-amber-50 text-amber-800 ring-amber-600/20'
                  }`}
                >
                  {mv.isPopulated ? 'Populated' : 'Unpopulated'}
                </span>
              </div>
            ))}
          </div>

          {/* Table & Index Footprint */}
          <div className="lg:col-span-2">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              <HardDrive className="h-3.5 w-3.5" />
              Table &amp; Index Storage Footprint
            </h3>
            <div className="overflow-x-auto rounded-md border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200 text-xs">
                <thead className="bg-neutral-50 text-[11px] font-semibold tracking-wider text-neutral-600 uppercase">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left">
                      Table
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Est. Rows
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Heap Size
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Index Size
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white font-mono tabular-nums">
                  {diagnostics.tables.map((t) => (
                    <tr key={t.tableName}>
                      <td className="px-3 py-2 font-semibold text-neutral-900">{t.tableName}</td>
                      <td className="px-3 py-2 text-right text-neutral-700">
                        ~{formatInteger(t.estimatedRows)}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-600">
                        {formatBytes(t.tableBytes)}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-600">
                        {formatBytes(t.indexBytes)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-neutral-950">
                        {formatBytes(t.totalBytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
