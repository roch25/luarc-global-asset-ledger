'use client'

import { ChevronDown, LoaderCircle } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'

interface CurrencySelectorProps {
  activeCode: string
  currencies: { code: string; name: string }[]
}

export function CurrencySelector({ activeCode, currencies }: CurrencySelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function handleChange(code: string) {
    const href = `${pathname}?currency=${encodeURIComponent(code)}`
    startTransition(() => {
      router.replace(href, { scroll: false })
    })
  }

  return (
    <div className="flex items-center gap-2">
      {isPending && (
        <LoaderCircle
          aria-label="Updating reporting currency"
          className="text-primary h-4 w-4 animate-spin"
        />
      )}
      <label className="inline-flex items-center gap-2 text-xs text-neutral-600">
        <span className="font-medium text-neutral-500">Reporting currency</span>
        <div className="relative">
          <select
            aria-label="Select reporting currency"
            value={activeCode}
            onChange={(e) => handleChange(e.target.value)}
            className="border-foreground/10 bg-background text-foreground focus:border-primary appearance-none rounded-lg border py-1.5 pr-9 pl-3 text-sm font-medium outline-none"
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            size={18}
            className="text-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
          />
        </div>
      </label>
    </div>
  )
}
