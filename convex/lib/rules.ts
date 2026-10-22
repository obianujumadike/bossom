// Pure auth rules shared by Convex functions and the Next.js pages. No Convex,
// Next or I/O imports, so they are unit-tested directly (rules.test.ts).

export const MIN_PASSWORD_LENGTH = 8

/** Convex Auth provider id for email + password accounts. */
export const PASSWORD_PROVIDER_ID = 'password'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * One canonical form per mailbox. Without this, "Jane@x.com" and "jane@x.com"
 * were stored as two different accounts — the "same email twice" QA report.
 */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

export function emailError(email: string): string | null {
  if (!email) return 'Email is required'
  if (!EMAIL_RE.test(email)) return 'Invalid email address'
  return null
}

export function passwordError(password: unknown): string | null {
  if (typeof password !== 'string' || !password) return 'Password is required'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  return null
}

/** Same rule as the profile form: E.164-style once spaces, dashes, dots and brackets are removed. */
export function isValidPhone(raw: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(raw.replace(/[\s\-().]/g, ''))
}

/**
 * Error codes thrown as `ConvexError(code)` by the auth provider. Convex
 * redacts plain Error messages in production, so the client keys off these
 * codes rather than message text.
 */
export const AUTH_ERRORS = {
  ACCOUNT_EXISTS: 'An account with this email already exists. Sign in instead, or reset your password.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  TOO_MANY_ATTEMPTS: 'Too many failed attempts. Wait a few minutes or reset your password.',
  INVALID_CODE: 'That code is invalid or has expired. Request a new one.',
  INVALID_EMAIL: 'Enter a valid email address.',
  INVALID_PASSWORD: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  MISSING_PROFILE: 'Full name and medical license number are required.',
  PASSWORD_NOT_SET: 'This account needs a new password. Use "Forgot password" to set one.',
  // Sign-up creates the account before emailing the code, so after a failed
  // send the way back is signing in (which sends a fresh code), not signing up again.
  EMAIL_SEND_FAILED: "We couldn't send the code email. Wait a minute, then sign in to get a new code.",
} as const

export type AuthErrorCode = keyof typeof AUTH_ERRORS

/** Maps an error from `signIn()` to a message a person can act on. */
export function authErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const code = (Object.keys(AUTH_ERRORS) as AuthErrorCode[]).find(c => raw.includes(c))
  if (code) return AUTH_ERRORS[code]
  if (/network|fetch/i.test(raw)) return 'Network error. Check your connection and try again.'
  return 'Something went wrong. Please try again.'
}

/**
 * Only same-origin paths are allowed as a post-login destination, so a crafted
 * `/login?next=https://evil.example` cannot bounce a user off-site.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
