export function OverviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard overview">
      <div className="h-14 animate-pulse rounded-lg border border-neutral-200 bg-white" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs">
            <div className="h-3.5 w-28 animate-pulse rounded bg-neutral-200/70" />
            <div className="mt-3 h-7 w-36 animate-pulse rounded bg-neutral-200/80" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-neutral-200/60" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-lg border border-neutral-200 bg-white lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-lg border border-neutral-200 bg-white" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg border border-neutral-200 bg-white" />
        <div className="h-72 animate-pulse rounded-lg border border-neutral-200 bg-white" />
      </div>
    </div>
  )
}
