'use client'

import {
  ArrowLeftRight,
  ChartAreaIcon,
  Database,
  Globe,
  LayoutDashboard,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const workspaceLinks = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Asset Ledger', href: '/assets', icon: Database },
  { label: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  { label: 'Reports', href: '/reports', icon: ChartAreaIcon },
]

const managementLinks = [{ label: 'Settings', href: '/settings', icon: Settings }]

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  const renderLinks = (links: typeof workspaceLinks | typeof managementLinks) =>
    links.map(({ label, href, icon: Icon }) => {
      const active = isActive(href)

      return (
        <Link
          key={label}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={`hover:bg-sidebar-hover flex flex-1 shrink-0 flex-col items-center justify-center gap-x-3 gap-y-1 rounded-t-md p-2 transition-colors sm:flex-row sm:p-3 lg:w-full lg:justify-start lg:rounded-none lg:px-4 ${
            active
              ? 'bg-sidebar-active text-sidebar-foreground active:bg-sidebar-active font-medium'
              : 'text-sidebar-foreground'
          }`}
        >
          <Icon size={18} strokeWidth={1.8} className="shrink-0" />
          <span className="text-xs whitespace-nowrap md:text-sm">{label}</span>
        </Link>
      )
    })

  return (
    <aside className="bg-sidebar-background text-sidebar-foreground flex w-full shrink-0 flex-col lg:sticky lg:top-0 lg:h-screen lg:w-65">
      <div className="flex shrink-0 items-center justify-between gap-x-3 px-4 py-4 lg:mt-8 lg:mb-4">
        <div className="flex items-center gap-x-2">
          <Globe size={22} strokeWidth={1.8} />

          <span className="font-sans text-lg font-bold tracking-wider uppercase">
            Global Ledger
          </span>
        </div>

        <Link
          href={'/settings'}
          aria-label="Settings"
          aria-current={isActive('/settings') ? 'page' : undefined}
        >
          <div
            className={`hover:bg-sidebar-hover flex rounded-full p-2 lg:hidden ${isActive('/settings') ? 'bg-sidebar-active text-sidebar-foreground active:bg-sidebar-active' : ''}`}
          >
            <Settings size={18} strokeWidth={1.8} className="shrink-0" />
          </div>
        </Link>
      </div>

      <nav className="flex w-full items-center justify-between overflow-x-auto lg:block">
        <div className="flex flex-1 shrink-0 items-center justify-start lg:block">
          <p className="hidden px-4 py-4 text-xs font-bold tracking-widest uppercase">Workspace</p>

          <div className="flex w-full flex-row items-start justify-between sm:justify-start lg:flex-col lg:space-y-0.5">
            {renderLinks(workspaceLinks)}
          </div>
        </div>

        <div className="flex flex-0 shrink-0 items-center justify-evenly lg:block">
          <p className="hidden px-4 py-4 text-xs font-bold tracking-widest uppercase lg:block">
            Management
          </p>

          <div className="hidden w-full items-center lg:flex lg:space-y-0.5">
            {renderLinks(managementLinks)}
          </div>
        </div>
      </nav>
    </aside>
  )
}
