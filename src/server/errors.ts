/** Domain errors. The HTTP layer maps each `code` to a status code. */
export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INSUFFICIENT_FUNDS'
  | 'CONFLICT'
  | 'INVALID_STATE'
  | 'LEVEL_LOCKED'
  | 'INCOMPATIBLE'
  | 'INVALID_SOLUTION'

export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION: 400,
  INVALID_SOLUTION: 422,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE: 409,
  INSUFFICIENT_FUNDS: 402,
  LEVEL_LOCKED: 403,
  INCOMPATIBLE: 422,
}

export class DomainError extends Error {
  readonly code: ErrorCode
  readonly details?: unknown

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.details = details
  }
}

export const notFound = (what: string): DomainError => new DomainError('NOT_FOUND', `${what} not found.`)
