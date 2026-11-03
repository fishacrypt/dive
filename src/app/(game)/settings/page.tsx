'use client'
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, PageHeader, Skeleton, Stat } from '@/components/ui/misc'
import { Field, FormMessage } from '@/components/auth/field'
import { useSubmit } from '@/components/auth/use-submit'
import { api } from '@/lib/api-client'
import { formatTime } from '@/lib/utils'

interface Account {
  username: string
  email: string
  memberSince: string
  activeSessions: number
}

function UsernameForm({ account }: { account: Account }) {
  const client = useQueryClient()
  const [username, setUsername] = React.useState(account.username)
  const { pending, message, fields, submit } = useSubmit()
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await submit(async () => {
      await api('/account', { method: 'PATCH', body: { username } })
    })
    if (ok) {
      toast.success('Username updated.')
      await client.invalidateQueries()
    }
  }
  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
      <Field label="Username" name="username" autoComplete="username" value={username} onChange={setUsername} error={fields.username} hint="Your progress, rigs and balances stay exactly as they are." />
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <Button type="submit" loading={pending} disabled={username.trim() === account.username}>
        Save username
      </Button>
    </form>
  )
}

function PasswordForm() {
  const [form, setForm] = React.useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [mismatch, setMismatch] = React.useState<string | undefined>()
  const { pending, message, fields, submit } = useSubmit()
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.newPassword !== form.confirm) return setMismatch('Passwords do not match.')
    setMismatch(undefined)
    const ok = await submit(async () => {
      await api('/account/password', { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } })
    })
    if (ok) {
      toast.success('Password changed. Your other devices were signed out.')
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
    }
  }
  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
      <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(v) => setForm((f) => ({ ...f, currentPassword: v }))} error={fields.currentPassword} />
      <Field label="New password" name="newPassword" type="password" autoComplete="new-password" value={form.newPassword} onChange={(v) => setForm((f) => ({ ...f, newPassword: v }))} error={fields.newPassword} hint="At least 10 characters, with a letter and a number." />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={(v) => setForm((f) => ({ ...f, confirm: v }))} error={mismatch} />
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <Button type="submit" loading={pending}>
        Change password
      </Button>
    </form>
  )
}

export default function SettingsPage() {
  const { data, error, refetch, isLoading } = useQuery({ queryKey: ['account'], queryFn: () => api<Account>('/account') })
  const [busy, setBusy] = React.useState<'one' | 'all' | null>(null)

  const logout = async (everywhere: boolean) => {
    setBusy(everywhere ? 'all' : 'one')
    try {
      await api('/auth/logout', { method: 'POST', body: { everywhere } })
    } finally {
      window.location.assign('/')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Account settings" subtitle="Your account, password and sessions." />
      {error ? <ErrorState message={error.message} onRetry={() => void refetch()} /> : null}
      {isLoading ? <Skeleton className="h-40" /> : null}
      {data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Username" value={<span data-testid="account-username">{data.username}</span>} />
              <Stat label="Email" value={<span className="break-all text-base">{data.email}</span>} />
              <Stat label="Member since" value={<span className="text-base">{formatTime(data.memberSince)}</span>} />
              <Stat label="Active sessions" value={data.activeSessions} hint="Devices signed in" />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change username</CardTitle>
            </CardHeader>
            <UsernameForm key={data.username} account={data} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
            </CardHeader>
            <PasswordForm />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Log out</CardTitle>
            </CardHeader>
            <p className="mb-4 text-sm text-fog-300">Log out of this device, or sign out everywhere if you used a shared computer.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={busy === 'one'} disabled={busy !== null} onClick={() => void logout(false)}>
                <LogOut className="h-4 w-4" aria-hidden /> Log out
              </Button>
              <Button variant="danger" loading={busy === 'all'} disabled={busy !== null} onClick={() => void logout(true)}>
                Log out of all devices
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
