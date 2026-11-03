import { hash, verify } from '@node-rs/argon2'

/** Argon2id with the OWASP-recommended minimum parameters (19 MiB, 2 passes, 1 lane). 2 = Argon2id. */
const ARGON2ID = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2ID)
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

let dummyHash: Promise<string> | null = null

/**
 * Burn the same CPU time as a real check when the account does not exist, so
 * response timing does not reveal which usernames or emails are registered.
 */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password-for-timing-only')
  await verifyPassword(await dummyHash, password)
}
