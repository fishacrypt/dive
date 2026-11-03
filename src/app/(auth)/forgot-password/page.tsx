'use client'
import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormMessage } from '@/components/auth/field'
import { useSubmit } from '@/components/auth/use-submit'
import { api } from '@/lib/api-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('')
  const [sent, setSent] = React.useState(false)
  const { pending, message, fields, submit } = useSubmit()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await submit(async () => {
      await api('/auth/forgot', { method: 'POST', body: { email } })
    })
    if (ok) setSent(true)
  }

  return (
    <Card className="p-6">
      <h1 className="font-display text-2xl font-semibold text-fog-100">Reset your password</h1>
      {sent ? (
        <div className="mt-4 space-y-4">
          <FormMessage tone="success">If that email is registered, a reset link is on its way. It works once and expires in 30 minutes.</FormMessage>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/login">Back to log in</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-fog-300">Enter your account email and we will send you a link.</p>
          <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4" noValidate>
            <Field label="Email" name="email" type="email" autoComplete="email" value={email} onChange={setEmail} error={fields.email} />
            {message ? <FormMessage tone="error">{message}</FormMessage> : null}
            <Button type="submit" className="w-full" size="lg" loading={pending}>
              Send reset link
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link href="/login" className="text-fog-300 hover:text-fog-100">
              Back to log in
            </Link>
          </p>
        </>
      )}
    </Card>
  )
}
