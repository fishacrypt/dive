import { cookies } from 'next/headers'
import { readCookie, resolveSession, SESSION_COOKIE, type AuthContext } from './session'

/** The verified session for the current page request (server components and layouts), or null. */
export async function getServerSession(): Promise<AuthContext | null> {
  const jar = cookies()
  return resolveSession(jar.get(SESSION_COOKIE)?.value ?? readCookie(jar.toString(), SESSION_COOKIE))
}
