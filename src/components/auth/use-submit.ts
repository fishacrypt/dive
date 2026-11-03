'use client'
import * as React from 'react'
import { ApiError, errorMessage } from '@/lib/api-client'

/** Runs an async form submission and keeps track of pending state, a top-level message and per-field errors. */
export function useSubmit() {
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [fields, setFields] = React.useState<Record<string, string>>({})

  const submit = async (run: () => Promise<void>): Promise<boolean> => {
    setPending(true)
    setMessage(null)
    setFields({})
    try {
      await run()
      return true
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        setFields(error.fields)
        // Field errors speak for themselves; keep the banner for non-field problems.
        setMessage(error.code === 'VALIDATION' || error.code === 'CONFLICT' ? null : error.message)
      } else {
        setMessage(errorMessage(error))
      }
      return false
    } finally {
      setPending(false)
    }
  }
  return { pending, message, fields, submit }
}

/** Only follow same-site relative paths after login, never an arbitrary URL. */
export function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) return raw
  return '/dashboard'
}
