export function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading settings">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg border border-neutral-200 bg-white" />
        <div className="h-72 animate-pulse rounded-lg border border-neutral-200 bg-white" />
      </div>
      <div className="h-14 animate-pulse rounded-lg border border-neutral-200 bg-white" />
      <div className="h-64 animate-pulse rounded-lg border border-neutral-200 bg-white" />
    </div>
  )
}
