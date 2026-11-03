import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { getServerSession } from '@/server/auth/server'

export const dynamic = 'force-dynamic'

/** Everything in the game requires a verified session: no cookie, or a revoked/expired one, goes to the login page. */
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession()
  if (!session) redirect('/login')
  return <AppShell username={session.username}>{children}</AppShell>
}
