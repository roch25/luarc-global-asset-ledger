'use client'

import { PageError } from '@/app/components/ui/PageError'

export default function TransactionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Unable to load the Transactions ledger" error={error} reset={reset} />
}
