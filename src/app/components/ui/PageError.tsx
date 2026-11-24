'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

interface PageErrorProps {
  title: string
  error: Error & { digest?: string }
  reset: () => void
}

export function PageError({ title, error, reset }: PageErrorProps) {
  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
      <div role="alert" className="rounded-lg border border-rose-200 bg-white p-6 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-950">{title}</h2>

            <div className="pt-1">
              <button
                type="button"
                onClick={reset}
                className="bg-primary inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
