'use client'
import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormMessage } from '@/components/auth/field'
import { safeNext, useSubmit } from '@/components/auth/use-submit'
import { api } from '@/lib/api-client'

export default function LoginPage() {
  const [form, setForm] = React.useState({ identifier: '', password: '' })
  const { pending, message, fields, submit } = useSubmit()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await submit(async () => {
      await api('/auth/login', { method: 'POST', body: form })
    })
    if (ok) window.location.assign(safeNext(new URLSearchParams(window.location.search).get('next')))
  }

  return (
    <Card className="p-6">
      <h1 className="font-display text-2xl font-semibold text-fog-100">Welcome back</h1>
      <p className="mt-1 text-sm text-fog-300">Log in to your mining operation.</p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4" noValidate>
        <Field label="Email or username" name="identifier" autoComplete="username" value={form.identifier} onChange={(v) => setForm((f) => ({ ...f, identifier: v }))} error={fields.identifier} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} error={fields.password} />
        {message ? <FormMessage tone="error">{message}</FormMessage> : null}
        <Button type="submit" className="w-full" size="lg" loading={pending}>
          Log in
        </Button>
      </form>
      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-cyan-dive hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="text-fog-300 hover:text-fog-100">
          Create account
        </Link>
      </div>
    </Card>
  )
}
