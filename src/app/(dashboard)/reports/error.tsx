'use client'

import { PageError } from '@/app/components/ui/PageError'

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Unable to load Reports & Exports" error={error} reset={reset} />
}
