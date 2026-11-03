import { route } from '@/server/http'

export const dynamic = 'force-dynamic'
export const GET = route(({ username }) => Promise.resolve({ username }))
