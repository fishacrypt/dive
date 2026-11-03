import { createHash, randomBytes } from 'node:crypto'

/** 256 bits of randomness, URL-safe. This is the only form that is ever sent to the user. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Tokens are stored hashed, so a database leak does not leak usable sessions or reset links. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
