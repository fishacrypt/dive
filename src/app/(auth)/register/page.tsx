'use client'
import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormMessage } from '@/components/auth/field'
import { useSubmit } from '@/components/auth/use-submit'
import { api } from '@/lib/api-client'

export default function RegisterPage() {
  const [form, setForm] = React.useState({ username: '', email: '', password: '', confirmPassword: '' })
  const { pending, message, fields, submit } = useSubmit()
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await submit(async () => {
      await api('/auth/register', { method: 'POST', body: form })
    })
    // Full navigation: the new account starts with a clean browser state.
    if (ok) window.location.assign('/dashboard')
  }

  return (
    <Card className="p-6">
      <h1 className="font-display text-2xl font-semibold text-fog-100">Create your account</h1>
      <p className="mt-1 text-sm text-fog-300">You start with 1,500 credits, 400 energy and a ready Starter Rig.</p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4" noValidate>
        <Field label="Username" name="username" autoComplete="username" value={form.username} onChange={set('username')} error={fields.username} hint="3 to 20 letters, numbers or underscores." />
        <Field label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={fields.email} />
        <Field label="Password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={fields.password} hint="At least 10 characters, with a letter and a number." />
        <Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} error={fields.confirmPassword} />
        {message ? <FormMessage tone="error">{message}</FormMessage> : null}
        <Button type="submit" className="w-full" size="lg" loading={pending}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-fog-300">
        Already have an account?{' '}
        <Link href="/login" className="text-cyan-dive hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  )
}
