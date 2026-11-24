export function AssetTableSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading asset ledger">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="h-9 flex-1 animate-pulse rounded-md bg-neutral-200/70" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
            <div className="h-9 w-32 animate-pulse rounded-md bg-neutral-200/70" />
            <div className="h-9 w-32 animate-pulse rounded-md bg-neutral-200/70" />
            <div className="h-9 w-36 animate-pulse rounded-md bg-neutral-200/70" />
            <div className="h-9 w-40 animate-pulse rounded-md bg-neutral-200/70" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xs">
        <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="h-4 w-48 animate-pulse rounded bg-neutral-200/80" />
        </div>
        <div className="divide-y divide-neutral-100">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-24 animate-pulse rounded bg-neutral-200/70" />
              <div className="h-4 flex-1 animate-pulse rounded bg-neutral-200/60" />
              <div className="hidden h-4 w-20 animate-pulse rounded bg-neutral-200/70 sm:block" />
              <div className="hidden h-4 w-16 animate-pulse rounded bg-neutral-200/70 md:block" />
              <div className="h-4 w-28 animate-pulse rounded bg-neutral-200/70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
