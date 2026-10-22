'use node'

import { ConvexError, v } from 'convex/values'
import nodemailer from 'nodemailer'
import { internalAction } from './_generated/server'
import { normalizeAppPassword } from './lib/emailTransport'

// Sends sign-up and password-reset codes through a Gmail account using an app
// password: free, about 500 messages a day, and no domain required. SMTP
// needs Node's net/tls modules, hence the Node runtime for this file.
//
//   GMAIL_USER          the sending Gmail address (use a dedicated account)
//   GMAIL_APP_PASSWORD  16-character app password from
//                       https://myaccount.google.com/apppasswords
//   EMAIL_FROM_NAME     optional display name, default "Bossom"
//
// Gmail always sends as GMAIL_USER, so only the display name is configurable.

export const sendViaGmail = internalAction({
  args: { to: v.string(), subject: v.string(), html: v.string(), text: v.string() },
  handler: async (_ctx, { to, subject, html, text }) => {
    const user = process.env.GMAIL_USER
    const pass = process.env.GMAIL_APP_PASSWORD
    if (!user || !pass) {
      console.error('GMAIL_USER and GMAIL_APP_PASSWORD must be set on the Convex deployment')
      throw new ConvexError('EMAIL_SEND_FAILED')
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass: normalizeAppPassword(pass) },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    })

    const name = (process.env.EMAIL_FROM_NAME ?? 'Bossom').replace(/["<>]/g, '')
    try {
      await transporter.sendMail({ from: `"${name}" <${user}>`, to, subject, html, text })
    } catch (err) {
      // e.g. 535 "Username and Password not accepted" when the app password is
      // wrong or 2-Step Verification was turned off.
      console.error('Gmail rejected the email', err instanceof Error ? err.message : err)
      throw new ConvexError('EMAIL_SEND_FAILED')
    }
  },
})
