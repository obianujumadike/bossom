import { Email } from '@convex-dev/auth/providers/Email'
import { ConvexError } from 'convex/values'

// One-time codes for sign-up verification and password reset, sent through
// Resend's HTTP API. Codes replace Supabase's magic links: a link in an email
// signed people straight in, a code only works on the screen that asked for it.

const CODE_TTL_SECONDS = 15 * 60

function sixDigitCode(): string {
  const n = new Uint32Array(1)
  crypto.getRandomValues(n)
  return (n[0] % 1_000_000).toString().padStart(6, '0')
}

type Purpose = 'verify' | 'reset'

const COPY: Record<Purpose, { subject: string; heading: string; body: string }> = {
  verify: {
    subject: 'Your Bossom verification code',
    heading: 'Confirm your email address',
    body: 'Enter this code on the sign-up screen to activate your Bossom account.',
  },
  reset: {
    subject: 'Your Bossom password reset code',
    heading: 'Reset your password',
    body: 'Enter this code on the password reset screen to choose a new password.',
  },
}

function renderEmail(purpose: Purpose, code: string): string {
  const c = COPY[purpose]
  return `<!DOCTYPE html><html><body style="margin:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:40px auto;padding:0 16px">
  <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(233,30,140,0.08)">
    <div style="background:linear-gradient(135deg,#E91E8C 0%,#C2185B 100%);padding:32px;text-align:center;color:#fff;font-size:22px;font-weight:700">Bossom</div>
    <div style="padding:40px">
      <h1 style="color:#1F2937;font-size:22px;margin:0 0 12px">${c.heading}</h1>
      <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 28px">${c.body}</p>
      <div style="text-align:center;font-size:34px;font-weight:700;letter-spacing:10px;color:#1F2937;background:#FDF2F8;border-radius:12px;padding:20px">${code}</div>
      <p style="color:#9CA3AF;font-size:13px;line-height:1.6;margin:28px 0 0">This code expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
    </div>
  </div>
</div></body></html>`
}

async function send(purpose: Purpose, to: string, code: string) {
  // Opt-in for dev deployments only: print the code to the Convex logs
  // instead of emailing it, so sign-up can be exercised before Resend is set up.
  if (process.env.DEV_LOG_AUTH_CODES === 'true') {
    console.log(`[DEV_LOG_AUTH_CODES] ${purpose} code for ${to}: ${code}`)
    return
  }

  const apiKey = process.env.AUTH_RESEND_KEY
  const from = process.env.AUTH_EMAIL_FROM
  if (!apiKey || !from) {
    console.error('AUTH_RESEND_KEY and AUTH_EMAIL_FROM must be set on the Convex deployment')
    throw new ConvexError('EMAIL_SEND_FAILED')
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: COPY[purpose].subject,
      html: renderEmail(purpose, code),
      text: `${COPY[purpose].body}\n\nYour code: ${code}\n\nIt expires in 15 minutes.`,
    }),
  })
  if (!res.ok) {
    console.error('Resend rejected the email', res.status, await res.text())
    throw new ConvexError('EMAIL_SEND_FAILED')
  }
}

function otpProvider(id: string, purpose: Purpose) {
  return Email({
    id,
    maxAge: CODE_TTL_SECONDS,
    async generateVerificationToken() {
      return sixDigitCode()
    },
    async sendVerificationRequest({ identifier, token }) {
      await send(purpose, identifier, token)
    },
  })
}

export const VerifyEmailOTP = otpProvider('email-verify-otp', 'verify')
export const ResetPasswordOTP = otpProvider('password-reset-otp', 'reset')
