import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Wordmark } from '@/components/layout/logo'
import { SIMULATION_NOTICE } from '@/lib/game/config'
import { getServerSession } from '@/server/auth/server'

export const dynamic = 'force-dynamic'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Already signed in: skip the forms.
  if (await getServerSession()) redirect('/dashboard')
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8">
      <Link href="/" aria-label="dive home" className="mb-6 inline-block">
        <Wordmark />
      </Link>
      <main className="flex-1">{children}</main>
      <p className="mt-8 text-center text-xs text-fog-500">{SIMULATION_NOTICE}</p>
    </div>
  )
}
