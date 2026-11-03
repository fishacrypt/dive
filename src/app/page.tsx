import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Boxes, Cpu, Gem, Puzzle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/layout/logo'
import { SIMULATION_NOTICE } from '@/lib/game/config'
import { getServerSession } from '@/server/auth/server'

export const dynamic = 'force-dynamic'

const STEPS = [
  { n: '1', title: 'Buy', text: 'Equip your rig from the market.', icon: Boxes },
  { n: '2', title: 'Build', text: 'Assemble parts into a mining rig.', icon: Cpu },
  { n: '3', title: 'Solve', text: 'Crack real routing, scheduling and design puzzles.', icon: Puzzle },
  { n: '4', title: 'Earn', text: 'Collect simulated Quanta and level up.', icon: Gem },
] as const

export default async function WelcomePage() {
  if (await getServerSession()) redirect('/dashboard')
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 lg:px-8">
      <header className="flex items-center justify-between">
        <Wordmark />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Sign up</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative mt-8 overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 p-6 sm:p-10">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(420px circle at 100% 0%, rgba(167,139,250,0.12), transparent 70%), radial-gradient(360px circle at 0% 100%, rgba(34,211,238,0.10), transparent 70%)' }}
            aria-hidden
          />
          <p className="label-caps relative">Useful-work mining simulator</p>
          <h1 className="relative mt-2 font-display text-7xl font-bold lowercase tracking-tight text-teal-400 sm:text-8xl">dive</h1>
          <p className="relative mt-3 font-display text-xl text-cyan-dive sm:text-2xl">Build Your Rig. Solve Useful Work. Earn Quanta.</p>
          <p className="relative mt-4 max-w-xl text-fog-300">
            Create your own mining operation. Your credits, Quanta, energy, rigs and progress belong to your account and follow you to any device.
          </p>
          <div className="relative mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">Create account</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-4" aria-label="How it works">
          {STEPS.map(({ n, title, text, icon: Icon }) => (
            <div key={n} className="rounded-xl border border-ink-600 bg-ink-800/80 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-fog-500">{n}</span>
                <Icon className="h-4 w-4 text-fog-500" aria-hidden />
              </div>
              <p className="mt-1 font-display text-base font-semibold text-fog-100">{title}</p>
              <p className="text-sm text-fog-300">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mt-8 rounded-lg border border-amber-dive/20 bg-amber-dive/5 p-3 text-center text-xs text-fog-300">{SIMULATION_NOTICE}</footer>
    </div>
  )
}
