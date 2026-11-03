import { z } from 'zod'
import { solutionSchema } from './challenges/types'

const id = z.string().min(1).max(64)
const idempotencyKey = z.string().min(8).max(100).optional()

export const purchaseSchema = z.object({ equipmentId: id, idempotencyKey })
export const upgradeSchema = z.object({ idempotencyKey })
export const rigNameSchema = z.object({ name: z.string().trim().min(1, 'Name is required.').max(32, 'Name is too long.') })
export const assignSchema = z.object({ inventoryItemId: id })
export const generateChallengeSchema = z.object({ definitionId: id })
export const checkSolutionSchema = z.object({ solution: solutionSchema })
export const startJobSchema = z.object({
  rigId: id,
  challengeInstanceId: id,
  solution: solutionSchema,
  idempotencyKey,
})
export const rechargeSchema = z.object({ packs: z.number().int().min(1).max(10), idempotencyKey })
export const exchangeSchema = z.object({ quanta: z.number().int().min(1).max(1000), idempotencyKey })
export const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(64).optional(),
})

// ---------- Accounts ----------

export const USERNAME_RULES = /^[A-Za-z0-9_]{3,20}$/
const RESERVED_USERNAMES = new Set(['admin', 'administrator', 'root', 'system', 'support', 'dive', 'moderator', 'mod', 'staff', 'null', 'undefined', 'api', 'me'])
const COMMON_PASSWORDS = new Set(['password123', 'password1234', '1234567890', '12345678910', 'qwertyuiop', 'iloveyou123', 'letmein1234', 'welcome1234', 'admin1234567'])

const usernameField = z
  .string()
  .trim()
  .regex(USERNAME_RULES, 'Use 3 to 20 letters, numbers or underscores.')
  .refine((v) => !RESERVED_USERNAMES.has(v.toLowerCase()), 'That username is reserved.')

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long.')
  .email('Enter a valid email address.')

export const passwordField = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128, 'Use at most 128 characters.')
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), 'Include at least one letter and one number.')
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), 'That password is too common.')

export const registerSchema = z
  .object({
    username: usernameField,
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' })
  .refine((v) => !v.password.toLowerCase().includes(v.username.toLowerCase()), { path: ['password'], message: 'Do not put your username in your password.' })

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username.').max(254),
  password: z.string().min(1, 'Enter your password.').max(128),
})

export const forgotPasswordSchema = z.object({ email: emailField })

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordField,
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.').max(128),
  newPassword: passwordField,
})

export const updateAccountSchema = z.object({ username: usernameField })

export const logoutSchema = z.object({ everywhere: z.boolean().optional() })
