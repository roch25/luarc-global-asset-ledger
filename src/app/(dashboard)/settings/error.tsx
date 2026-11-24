'use client'

import { PageError } from '@/app/components/ui/PageError'

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Unable to load Settings" error={error} reset={reset} />
}
