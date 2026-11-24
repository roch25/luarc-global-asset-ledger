'use client'

import { PageError } from '@/app/components/ui/PageError'

export default function AssetsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Unable to load the Asset Ledger" error={error} reset={reset} />
}
