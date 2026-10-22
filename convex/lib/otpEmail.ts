import { Email } from '@convex-dev/auth/providers/Email'
import { ConvexError } from 'convex/values'
import type { GenericActionCtx, GenericDataModel } from 'convex/server'
import { internal } from '../_generated/api'
import { chooseEmailTransport } from './emailTransport'

// One-time codes for sign-up verification and password reset. Codes replace
// Supabase's magic links: a link in an email signed people straight in, a
// code only works on the screen that asked for it.
//
// Sent through Gmail (convex/email.ts) when GMAIL_USER and GMAIL_APP_PASSWORD
// are set, otherwise Resend (AUTH_RESEND_KEY + AUTH_EMAIL_FROM); see
// lib/emailTransport.ts.

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

type Message = { to: string; subject: string; html: string; text: string }

async function sendViaResend(message: Message) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, ...message, to: [message.to] }),
  })
  if (!res.ok) {
    console.error('Resend rejected the email', res.status, await res.text())
    throw new ConvexError('EMAIL_SEND_FAILED')
  }
}

async function send(purpose: Purpose, to: string, code: string, ctx: GenericActionCtx<GenericDataModel> | undefined) {
  const transport = chooseEmailTransport(process.env)

  if (transport === 'log') {
    console.log(`[DEV_LOG_AUTH_CODES] ${purpose} code for ${to}: ${code}`)
    return
  }

  const message: Message = {
    to,
    subject: COPY[purpose].subject,
    html: renderEmail(purpose, code),
    text: `${COPY[purpose].body}\n\nYour code: ${code}\n\nIt expires in 15 minutes.`,
  }

  if (transport === 'gmail') {
    if (!ctx) {
      console.error('No action context passed to sendVerificationRequest; cannot reach the Gmail action')
      throw new ConvexError('EMAIL_SEND_FAILED')
    }
    await ctx.runAction(internal.email.sendViaGmail, message)
    return
  }
  if (transport === 'resend') return await sendViaResend(message)

  console.error('No email service configured: set GMAIL_USER + GMAIL_APP_PASSWORD (or AUTH_RESEND_KEY + AUTH_EMAIL_FROM) on the Convex deployment')
  throw new ConvexError('EMAIL_SEND_FAILED')
}

function otpProvider(id: string, purpose: Purpose) {
  return Email({
    id,
    maxAge: CODE_TTL_SECONDS,
    async generateVerificationToken() {
      return sixDigitCode()
    },
    // Convex Auth passes the action ctx as a second argument at runtime; the
    // Auth.js type it reuses doesn't declare it, hence the optional parameter.
    async sendVerificationRequest({ identifier, token }, ctx?: GenericActionCtx<GenericDataModel>) {
      await send(purpose, identifier, token, ctx)
    },
  })
}

export const VerifyEmailOTP = otpProvider('email-verify-otp', 'verify')
export const ResetPasswordOTP = otpProvider('password-reset-otp', 'reset')
