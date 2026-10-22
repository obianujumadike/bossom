// Which service sends sign-up and reset codes, decided by the deployment's
// environment so switching (e.g. Gmail → Resend once there's a domain) is a
// settings change, not a code change. Pure, so emailTransport.test.ts covers it.

export type EmailTransport = 'log' | 'gmail' | 'resend'

type Env = Record<string, string | undefined>

export function chooseEmailTransport(env: Env): EmailTransport | null {
  // Dev deployments only: codes go to `npx convex logs`.
  if (env.DEV_LOG_AUTH_CODES === 'true') return 'log'
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) return 'gmail'
  if (env.AUTH_RESEND_KEY && env.AUTH_EMAIL_FROM) return 'resend'
  return null
}

/** Google shows app passwords as four groups of four; SMTP wants them unspaced. */
export function normalizeAppPassword(raw: string): string {
  return raw.replace(/\s+/g, '')
}
