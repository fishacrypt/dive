'use client'
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Boxes, Cpu, Gauge, Hammer, Layers, LogOut, Puzzle, Settings, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { SIMULATION_NOTICE } from '@/lib/game/config'
import { Wordmark } from './logo'
import { ResourceBar } from './resource-bar'

const NAV = [
  { href: '/dashboard', label: 'Command', icon: Gauge },
  { href: '/challenges', label: 'Challenges', icon: Puzzle },
  { href: '/jobs', label: 'Jobs', icon: Hammer },
  { href: '/rigs', label: 'Rigs', icon: Cpu },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/market', label: 'Market', icon: Layers },
  { href: '/progress', label: 'Progress', icon: Trophy },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export function AppShell({ children, username }: { children: React.ReactNode; username: string }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname.startsWith(href)
  const [leaving, setLeaving] = React.useState(false)

  const logout = async () => {
    setLeaving(true)
    try {
      await api('/auth/logout', { method: 'POST', body: {} })
    } finally {
      // A full page load drops every cached screen, so nothing of this account stays in the browser.
      window.location.assign('/')
    }
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="hidden border-r border-ink-600 bg-ink-900/80 p-4 lg:block">
        <div className="sticky top-4">
          <Link href="/dashboard" aria-label="dive home" className="block">
            <Wordmark size="lg" />
          </Link>
          <p className="mt-1 text-xs text-fog-500">Useful-work mining simulator</p>
          <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={cn(
                  'flex min-h-[40px] items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                  isActive(href) ? 'bg-ink-700 text-cyan-dive shadow-glow' : 'text-fog-300 hover:bg-ink-800 hover:text-fog-100',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 rounded-lg border border-ink-600 bg-ink-800 p-3">
            <p className="label-caps">Signed in as</p>
            <p className="truncate font-display text-sm font-semibold text-fog-100" data-testid="nav-username">
              {username}
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={leaving}
              className="mt-2 flex min-h-[36px] w-full items-center gap-2 rounded-md px-2 text-sm text-fog-300 hover:bg-ink-700 hover:text-fog-100 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Log out
            </button>
          </div>
          <p className="mt-4 rounded-lg border border-amber-dive/20 bg-amber-dive/5 p-3 text-xs text-fog-300">{SIMULATION_NOTICE}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-ink-600 bg-ink-950/90 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <Link href="/dashboard" className="lg:hidden" aria-label="dive home">
              <Wordmark />
            </Link>
            <ResourceBar />
            <button
              type="button"
              onClick={() => void logout()}
              disabled={leaving}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-ink-600 px-3 text-sm text-fog-300 hover:bg-ink-700 lg:hidden"
              aria-label={`Log out ${username}`}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Log out
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label="Main mobile">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={cn(
                  'flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg px-3 text-sm',
                  isActive(href) ? 'bg-ink-700 text-cyan-dive' : 'text-fog-300',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">{children}</main>
        <footer className="px-4 pb-8 text-center text-xs text-fog-500 lg:hidden">{SIMULATION_NOTICE}</footer>
      </div>
    </div>
  )
}
