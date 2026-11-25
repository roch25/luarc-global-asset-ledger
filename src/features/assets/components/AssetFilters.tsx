'use client'

import {
  ChevronDown,
  Download,
  Layers,
  List,
  LoaderCircle,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  ASSET_CLASSES,
  ASSET_CLASS_LABELS,
  ASSET_STATUSES,
  ASSET_STATUS_LABELS,
  type AssetClassValue,
  type AssetListQuery,
  type AssetStatusValue,
  DEPRECIATION_METHODS,
  DEPRECIATION_METHOD_LABELS,
  type DepreciationMethodValue,
  PAGE_SIZES,
  type PageSize,
  buildAssetListHref,
  hasActiveFilters,
} from '../schemas'

export interface AssetFilterOptionsClient {
  currencies: { code: string; name: string; minorUnits: number }[]
  portfolios: { id: number; code: string; name: string; baseCurrency: string }[]
}

interface AssetFiltersProps {
  query: AssetListQuery
  options: AssetFilterOptionsClient
}

export function AssetFilters({ query, options }: AssetFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [searchText, setSearchText] = useState(query.q ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function navigate(patch: Partial<AssetListQuery>) {
    const next: AssetListQuery = {
      ...query,
      ...patch,
      // Always reset cursor when filters or page size change.
      cursor: undefined,
      cursorDir: 'next',
    }
    startTransition(() => {
      router.replace(buildAssetListHref(next), { scroll: false })
    })
  }

  function handleSearchChange(value: string) {
    setSearchText(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim()
      if ((trimmed || undefined) !== query.q) {
        navigate({ q: trimmed || undefined })
      }
    }, 500)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = searchText.trim()
    navigate({ q: trimmed || undefined })
  }

  function handleReset() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearchText('')
    startTransition(() => {
      router.replace(
        buildAssetListHref({
          sort: query.sort,
          dir: query.dir,
          pageSize: query.pageSize,
          view: query.view,
        }),
        { scroll: false },
      )
    })
  }

  const filtered = hasActiveFilters(query)

  const exportParams = new URLSearchParams()
  if (query.q) exportParams.set('q', query.q)
  if (query.assetClass) exportParams.set('assetClass', query.assetClass)
  if (query.status) exportParams.set('status', query.status)
  if (query.depreciationMethod) exportParams.set('depreciationMethod', query.depreciationMethod)
  if (query.currency) exportParams.set('currency', query.currency)
  if (query.portfolioId !== undefined) exportParams.set('portfolioId', String(query.portfolioId))
  const exportHref = exportParams.toString()
    ? `/api/assets/export?${exportParams.toString()}`
    : '/api/assets/export'

  return (
    <section
      aria-label="Asset filters"
      className="rounded-lg border border-neutral-200 bg-white p-3.5 shadow-xs sm:p-4"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={searchText}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search symbol, asset name, or exact ISIN"
              aria-label="Search assets by symbol, name, or ISIN"
              className="focus:border-primary focus:ring-primary/20 h-9 w-full rounded-md border border-neutral-300 bg-white pr-8 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => {
                  if (debounceRef.current) clearTimeout(debounceRef.current)
                  setSearchText('')
                  navigate({ q: undefined })
                }}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center">
            <div className="relative">
              <select
                aria-label="Filter by asset class"
                value={query.assetClass ?? ''}
                onChange={(e) =>
                  navigate({
                    assetClass: (e.target.value || undefined) as AssetClassValue | undefined,
                  })
                }
                className="border-foreground/10 bg-background text-foreground focus:border-primary w-full appearance-none rounded-lg border py-2 pr-10 pl-3 text-sm outline-none"
              >
                <option value="">All Classes</option>
                {ASSET_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {ASSET_CLASS_LABELS[cls]}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={20}
                className="text-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
              />
            </div>
            <div className="relative">
              <select
                aria-label="Filter by status"
                value={query.status ?? ''}
                onChange={(e) =>
                  navigate({
                    status: (e.target.value || undefined) as AssetStatusValue | undefined,
                  })
                }
                className="border-foreground/10 bg-background text-foreground focus:border-primary w-full appearance-none rounded-lg border py-2 pr-10 pl-3 text-sm outline-none"
              >
                <option value="">All Statuses</option>
                {ASSET_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {ASSET_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>

              <ChevronDown
                aria-hidden="true"
                size={20}
                className="text-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
              />
            </div>

            <div className="relative">
              <select
                aria-label="Filter by depreciation method"
                value={query.depreciationMethod ?? ''}
                onChange={(e) =>
                  navigate({
                    depreciationMethod: (e.target.value || undefined) as
                      DepreciationMethodValue | undefined,
                  })
                }
                className="border-foreground/10 bg-background text-foreground focus:border-primary w-full appearance-none rounded-lg border py-2 pr-10 pl-3 text-sm outline-none"
              >
                <option value="">All Depr. Methods</option>
                {DEPRECIATION_METHODS.map((dm) => (
                  <option key={dm} value={dm}>
                    {DEPRECIATION_METHOD_LABELS[dm]}
                  </option>
                ))}
              </select>

              <ChevronDown
                aria-hidden="true"
                size={20}
                className="text-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
              />
            </div>

            <div className="relative">
              <select
                aria-label="Filter by currency"
                value={query.currency ?? ''}
                onChange={(e) => navigate({ currency: e.target.value || undefined })}
                className="border-foreground/10 bg-background text-foreground focus:border-primary w-full appearance-none rounded-lg border py-2 pr-10 pl-3 text-sm outline-none"
              >
                <option value="">All Currencies</option>
                {options.currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>

              <ChevronDown
                aria-hidden="true"
                size={20}
                className="text-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
              />
            </div>

            <div className="relative lg:max-w-52">
              <select
                aria-label="Filter by portfolio"
                value={query.portfolioId !== undefined ? String(query.portfolioId) : ''}
                onChange={(e) =>
                  navigate({
                    portfolioId: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="border-foreground/10 bg-background text-foreground focus:border-primary w-full appearance-none rounded-lg border py-2 pr-10 pl-3 text-sm outline-none"
              >
                <option value="">All Portfolios</option>
                {options.portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>

              <ChevronDown
                aria-hidden="true"
                size={20}
                className="text-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 text-xs text-neutral-600">
          <div className="flex items-center gap-2">
            {isPending && (
              <span className="text-primary inline-flex items-center gap-1.5 font-medium">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Updating ledger...
              </span>
            )}
            {filtered && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                <RotateCcw className="h-3 w-3" />
                Reset filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={exportHref}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Download aria-hidden="true" className="h-3.5 w-3.5" />
              Export CSV
            </a>

            <div
              role="group"
              aria-label="Ledger view mode"
              className="border-foreground/10 bg-background inline-flex rounded-lg border p-0.5"
            >
              <button
                type="button"
                aria-pressed={query.view === 'paginated'}
                onClick={() => {
                  if (query.view !== 'paginated') navigate({ view: 'paginated' })
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  query.view === 'paginated'
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <List aria-hidden="true" className="h-3.5 w-3.5" />
                Paginated
              </button>
              <button
                type="button"
                aria-pressed={query.view === 'virtual'}
                onClick={() => {
                  if (query.view !== 'virtual') navigate({ view: 'virtual' })
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  query.view === 'virtual'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Layers aria-hidden="true" className="h-3.5 w-3.5" />
                Virtual Stream
              </button>
            </div>

            {query.view === 'paginated' && (
              <label className="inline-flex items-center gap-2">
                <span className="text-neutral-500">Rows per page</span>
                <div className="relative">
                  <select
                    aria-label="Rows per page"
                    value={query.pageSize}
                    onChange={(e) => navigate({ pageSize: Number(e.target.value) as PageSize })}
                    className="border-foreground/10 bg-background text-foreground focus:border-primary appearance-none rounded-lg border py-1.5 pr-8 pl-2.5 text-xs font-medium outline-none"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    aria-hidden="true"
                    size={16}
                    className="text-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2"
                  />
                </div>
              </label>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
