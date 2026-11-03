'use client'
import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormMessage } from '@/components/auth/field'
import { useSubmit } from '@/components/auth/use-submit'
import { api } from '@/lib/api-client'

function readToken(): string {
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') ?? ''
}
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export default function ResetPasswordPage() {
  // The token lives in the URL fragment, which browsers never send to any server.
  const token = React.useSyncExternalStore(subscribe, readToken, () => '')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [done, setDone] = React.useState(false)
  const { pending, message, fields, submit } = useSubmit()
  const [mismatch, setMismatch] = React.useState<string | undefined>()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return setMismatch('Passwords do not match.')
    setMismatch(undefined)
    const ok = await submit(async () => {
      await api('/auth/reset', { method: 'POST', body: { token, password } })
    })
    if (ok) {
      history.replaceState(null, '', window.location.pathname)
      setDone(true)
    }
  }

  return (
    <Card className="p-6">
      <h1 className="font-display text-2xl font-semibold text-fog-100">Choose a new password</h1>
      {done ? (
        <div className="mt-4 space-y-4">
          <FormMessage tone="success">Your password has been changed and all devices were signed out.</FormMessage>
          <Button asChild className="w-full">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      ) : !token ? (
        <div className="mt-4 space-y-4">
          <FormMessage tone="error">This reset link is incomplete. Open the link from your email again, or request a new one.</FormMessage>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4" noValidate>
          <Field label="New password" name="password" type="password" autoComplete="new-password" value={password} onChange={setPassword} error={fields.password} hint="At least 10 characters, with a letter and a number." />
          <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={mismatch} />
          {message ? <FormMessage tone="error">{message}</FormMessage> : null}
          <Button type="submit" className="w-full" size="lg" loading={pending}>
            Change password
          </Button>
        </form>
      )}
    </Card>
  )
}
