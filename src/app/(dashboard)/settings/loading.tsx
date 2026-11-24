import { SettingsSkeleton } from '@/features/settings/components/SettingsSkeleton'

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
      <header className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded bg-neutral-200/80" />
        <div className="h-4 w-96 animate-pulse rounded bg-neutral-200/60" />
      </header>
      <SettingsSkeleton />
    </div>
  )
}
