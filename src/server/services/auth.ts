import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { DomainError } from '../errors'
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../auth/password'
import { clear, enforce, hit, isBlocked } from '../auth/rate-limit'
import { createSession } from '../auth/session'
import { generateToken, hashToken } from '../auth/tokens'
import { sendMail } from '../mailer'
import { initializePlayer } from './player-init'

const MINUTE = 60
const HOUR = 60 * MINUTE

export const RESET_TOKEN_TTL_MIN = 30

export interface RequestInfo {
  ip: string
  userAgent: string | null
}

function fieldError(path: string, message: string, status: 'CONFLICT' | 'VALIDATION' = 'CONFLICT'): DomainError {
  return new DomainError(status, message, [{ path, message }])
}

/**
 * Register: creates the User, the player's profile and resources, the starting
 * balances, the Starter Rig and the opening ledger entries in ONE transaction,
 * so a failure can never leave a half-initialised account.
 */
export async function registerUser(input: { username: string; email: string; password: string }, info: RequestInfo) {
  await enforce(`register:ip:${info.ip}`, 10, HOUR, 'Too many sign-ups from this network. Please try again later.')
  const passwordHash = await hashPassword(input.password)
  const usernameLower = input.username.toLowerCase()

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { username: input.username, usernameLower, email: input.email, passwordHash },
      })
      await initializePlayer(tx, { userId: created.id, handle: usernameLower, displayName: input.username })
      return created
    })
    const session = await createSession(user.id, info.userAgent)
    return { user: { id: user.id, username: user.username, email: user.email }, session }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const [byName, byEmail] = await Promise.all([
        prisma.user.findUnique({ where: { usernameLower }, select: { id: true } }),
        prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
      ])
      const details = [
        ...(byName ? [{ path: 'username', message: 'That username is already taken.' }] : []),
        ...(byEmail ? [{ path: 'email', message: 'That email is already registered.' }] : []),
      ]
      throw new DomainError('CONFLICT', 'That username or email is already registered.', details.length ? details : undefined)
    }
    throw error
  }
}

const INVALID_LOGIN = 'Incorrect email, username or password.'

/** Log in with email or username. Same error and similar timing whether the account exists or not. */
export async function loginUser(input: { identifier: string; password: string }, info: RequestInfo) {
  const identifier = input.identifier.trim().toLowerCase()
  await enforce(`login:ip:${info.ip}`, 30, 15 * MINUTE)
  // Only FAILED attempts count against an account, so someone else's wrong guesses
  // cannot be repeated forever, but a legitimate login is never penalised.
  const idKey = `login:id:${identifier}`
  const blocked = await isBlocked(idKey, 8, 15 * MINUTE)
  if (blocked.blocked) {
    throw new DomainError('RATE_LIMITED', 'Too many failed attempts for this account. Please wait 15 minutes or reset your password.', { retryAfterSec: blocked.retryAfterSec })
  }

  const user = await prisma.user.findFirst({
    where: identifier.includes('@') ? { email: identifier } : { usernameLower: identifier },
  })
  if (!user) {
    await verifyAgainstDummy(input.password)
    await hit(idKey, 8, 15 * MINUTE)
    throw new DomainError('UNAUTHENTICATED', INVALID_LOGIN)
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) {
    await hit(idKey, 8, 15 * MINUTE)
    throw new DomainError('UNAUTHENTICATED', INVALID_LOGIN)
  }

  await clear(`login:id:${identifier}`)
  const session = await createSession(user.id, info.userAgent)
  return { user: { id: user.id, username: user.username, email: user.email }, session }
}

export async function logout(userId: string, sessionId: string, everywhere: boolean): Promise<void> {
  await prisma.session.deleteMany({ where: everywhere ? { userId } : { id: sessionId, userId } })
}

/**
 * Start a password reset. Always behaves the same whether or not the email is
 * registered, so it cannot be used to discover accounts.
 */
export async function requestPasswordReset(email: string, info: RequestInfo, baseUrl: string): Promise<void> {
  await enforce(`forgot:ip:${info.ip}`, 10, HOUR)
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return
  try {
    await enforce(`forgot:email:${email}`, 3, HOUR)
  } catch {
    return // silently ignore: do not reveal that the address exists
  }

  const token = generateToken()
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * MINUTE * 1000)
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } }),
  ])

  // The token travels in the URL fragment, which browsers never send to servers.
  const link = `${baseUrl}/reset-password#token=${token}`
  await sendMail({
    to: user.email,
    subject: 'Reset your dive password',
    text: `Hi ${user.username},\n\nUse this link to choose a new password. It works once and expires in ${RESET_TOKEN_TTL_MIN} minutes:\n\n${link}\n\nIf you did not ask for this, you can ignore this email. Your password has not changed.\n`,
  })
}

/** Complete a reset: the token works once, then every session for the account is revoked. */
export async function resetPassword(token: string, newPassword: string, info: RequestInfo): Promise<void> {
  await enforce(`reset:ip:${info.ip}`, 10, HOUR)
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } })
  const now = new Date()
  if (!record || record.usedAt || record.expiresAt <= now) {
    throw new DomainError('VALIDATION', 'This reset link is invalid or has expired. Request a new one.')
  }
  if (newPassword.toLowerCase().includes(record.user.usernameLower)) {
    throw fieldError('password', 'Do not put your username in your password.', 'VALIDATION')
  }
  const passwordHash = await hashPassword(newPassword)
  await prisma.$transaction(async (tx) => {
    // The conditional update is the single-use guard: only one request can flip usedAt.
    const used = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
    if (used.count === 0) throw new DomainError('VALIDATION', 'This reset link is invalid or has expired. Request a new one.')
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } })
    await tx.session.deleteMany({ where: { userId: record.userId } })
    await tx.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } })
  })
}

/** Change password while logged in. Other devices are signed out; this one stays signed in. */
export async function changePassword(userId: string, sessionId: string, currentPassword: string, newPassword: string): Promise<void> {
  await enforce(`chpw:user:${userId}`, 10, HOUR)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new DomainError('UNAUTHENTICATED', 'Please log in to continue.')
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw fieldError('currentPassword', 'Your current password is incorrect.', 'VALIDATION')
  }
  if (newPassword.toLowerCase().includes(user.usernameLower)) {
    throw fieldError('newPassword', 'Do not put your username in your password.', 'VALIDATION')
  }
  const passwordHash = await hashPassword(newPassword)
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId, id: { not: sessionId } } }),
  ])
}

export async function getAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { player: { select: { id: true, createdAt: true } } } })
  if (!user) throw new DomainError('NOT_FOUND', 'Account not found.')
  const sessions = await prisma.session.count({ where: { userId, expiresAt: { gt: new Date() } } })
  return { username: user.username, email: user.email, memberSince: user.createdAt.toISOString(), activeSessions: sessions }
}

/** Change the username. The player handle and display name follow it. */
export async function updateUsername(userId: string, username: string) {
  await enforce(`username:user:${userId}`, 5, HOUR)
  const usernameLower = username.toLowerCase()
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { username, usernameLower } })
      await tx.player.update({ where: { userId }, data: { handle: usernameLower, displayName: username } })
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw fieldError('username', 'That username is already taken.')
    }
    throw error
  }
  return getAccount(userId)
}
