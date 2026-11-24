'use client'

import { ChevronDown, LoaderCircle, RotateCcw, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  REVERSAL_FILTERS,
  REVERSAL_FILTER_LABELS,
  type ReversalFilter,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  TX_PAGE_SIZES,
  type TransactionListQuery,
  type TransactionTypeValue,
  type TxPageSize,
  buildTransactionListHref,
  hasActiveTxFilters,
} from '../schemas'

interface TransactionFiltersProps {
  query: TransactionListQuery
  currencies: { code: string; name: string }[]
}

const SELECT_CLASS =
  'border-foreground/10 bg-background text-foreground focus:border-primary w-full appearance-none rounded-lg border py-2 pr-10 pl-3 text-sm outline-none'
const DATE_CLASS =
  'border-foreground/10 bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-1.5 text-sm outline-none'

function SelectChevron() {
  return (
    <ChevronDown
      aria-hidden="true"
      size={20}
      className="text-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
    />
  )
}

export function TransactionFilters({ query, currencies }: TransactionFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [searchText, setSearchText] = useState(query.q ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSearchText(query.q ?? '')
  }, [query.q])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function navigate(patch: Partial<TransactionListQuery>) {
    const next: TransactionListQuery = {
      ...query,
      ...patch,
      cursor: undefined,
      cursorDir: 'next',
    }
    startTransition(() => {
      router.replace(buildTransactionListHref(next), { scroll: false })
    })
  }

  function handleSearchChange(value: string) {
    setSearchText(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim()
      if ((trimmed || undefined) !== query.q) navigate({ q: trimmed || undefined })
    }, 300)
  }

  function handleReset() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearchText('')
    startTransition(() => {
      router.replace(buildTransactionListHref({ dir: query.dir, pageSize: query.pageSize }), {
        scroll: false,
      })
    })
  }

  return (
    <section
      aria-label="Transaction filters"
      className="rounded-lg border border-neutral-200 bg-white p-3.5 shadow-xs sm:p-4"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (debounceRef.current) clearTimeout(debounceRef.current)
              navigate({ q: searchText.trim() || undefined })
            }}
            className="relative flex-1"
          >
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={searchText}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Symbol prefix, exact ISIN, or transaction ID..."
              aria-label="Search transactions by symbol, ISIN, or transaction ID"
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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:items-center">
            <div className="relative">
              <select
                aria-label="Filter by transaction type"
                value={query.type ?? ''}
                onChange={(e) =>
                  navigate({
                    type: (e.target.value || undefined) as TransactionTypeValue | undefined,
                  })
                }
                className={SELECT_CLASS}
              >
                <option value="">All Types</option>
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TRANSACTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>

            <div className="relative">
              <select
                aria-label="Filter by currency"
                value={query.currency ?? ''}
                onChange={(e) => navigate({ currency: e.target.value || undefined })}
                className={SELECT_CLASS}
              >
                <option value="">All Currencies</option>
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>

            <div className="relative">
              <select
                aria-label="Filter by reversal status"
                value={query.reversal}
                onChange={(e) => navigate({ reversal: e.target.value as ReversalFilter })}
                className={SELECT_CLASS}
              >
                {REVERSAL_FILTERS.map((r) => (
                  <option key={r} value={r}>
                    {REVERSAL_FILTER_LABELS[r]}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-neutral-100 pt-2.5 text-xs text-neutral-600">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-neutral-500">Trade date from</span>
              <input
                type="date"
                value={query.from ?? ''}
                max={query.to}
                onChange={(e) => navigate({ from: e.target.value || undefined })}
                className={DATE_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-neutral-500">to</span>
              <input
                type="date"
                value={query.to ?? ''}
                min={query.from}
                onChange={(e) => navigate({ to: e.target.value || undefined })}
                className={DATE_CLASS}
              />
            </label>

            {isPending && (
              <span className="text-primary mb-2 inline-flex items-center gap-1.5 font-medium">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Updating ledger...
              </span>
            )}
            {hasActiveTxFilters(query) && (
              <button
                type="button"
                onClick={handleReset}
                className="mb-1 inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                <RotateCcw className="h-3 w-3" />
                Reset filters
              </button>
            )}
          </div>

          <label className="inline-flex items-center gap-2">
            <span className="text-neutral-500">Rows per page</span>
            <div className="relative">
              <select
                aria-label="Rows per page"
                value={query.pageSize}
                onChange={(e) => navigate({ pageSize: Number(e.target.value) as TxPageSize })}
                className="border-foreground/10 bg-background text-foreground focus:border-primary appearance-none rounded-lg border py-1.5 pr-8 pl-2.5 text-xs font-medium outline-none"
              >
                {TX_PAGE_SIZES.map((size) => (
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
        </div>
      </div>
    </section>
  )
}
