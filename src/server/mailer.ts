import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface Mail {
  to: string
  subject: string
  text: string
}

/** Messages captured by the "memory" transport. Used by the automated tests only. */
export const sentMail: Mail[] = []

/**
 * Sends transactional email. Message bodies (which contain reset links) are
 * NEVER written to application logs.
 *
 * EMAIL_TRANSPORT:
 *  - "resend"      send through Resend (needs RESEND_API_KEY and MAIL_FROM). Default when RESEND_API_KEY is set.
 *  - "dev-outbox"  write each message to .dev-mail/ on disk. Local development only; refused in production.
 *  - "memory"      keep messages in memory. Tests only.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const transport = process.env.EMAIL_TRANSPORT || (process.env.RESEND_API_KEY ? 'resend' : 'none')

  if (transport === 'memory') {
    sentMail.push(mail)
    return
  }

  if (transport === 'dev-outbox') {
    if (process.env.NODE_ENV === 'production') {
      console.warn('EMAIL_TRANSPORT=dev-outbox is not allowed in production. Message not sent.')
      return
    }
    const dir = path.join(process.cwd(), '.dev-mail')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, `${Date.now()}.json`), JSON.stringify(mail, null, 2))
    return
  }

  if (transport === 'resend') {
    const key = process.env.RESEND_API_KEY
    const from = process.env.MAIL_FROM
    if (!key || !from) {
      console.warn('Email not sent: RESEND_API_KEY and MAIL_FROM must both be set.')
      return
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: mail.to, subject: mail.subject, text: mail.text }),
    })
    if (!res.ok) console.warn(`Email provider rejected a message (HTTP ${res.status}).`)
    return
  }

  console.warn('Email not sent: no email transport is configured (set RESEND_API_KEY and MAIL_FROM).')
}
