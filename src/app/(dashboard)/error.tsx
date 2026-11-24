'use client'

import { PageError } from '@/app/components/ui/PageError'

export default function OverviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Unable to load Ledger Overview" error={error} reset={reset} />
}
