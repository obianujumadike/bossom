import { ConvexCredentials } from '@convex-dev/auth/providers/ConvexCredentials'
import {
  createAccount,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  signInViaProvider,
} from '@convex-dev/auth/server'
import { ConvexError } from 'convex/values'
import bcrypt from 'bcryptjs'
import { Scrypt } from 'lucia'
import { internal } from '../_generated/api'
import { emailError, normalizeEmail, passwordError, PASSWORD_PROVIDER_ID } from './rules'
import { ResetPasswordOTP, VerifyEmailOTP } from './otpEmail'

// Adapted from @convex-dev/auth's Password provider. The stock provider:
//  - keyed accounts by the email exactly as typed, so case variants became
//    separate accounts;
//  - on `signUp` with an existing email and the same password, quietly signed
//    the person into the existing account, which looked like a second sign-up;
//  - threw plain Errors, which Convex redacts to "Server Error" in production.
// This version normalises the email, refuses sign-up for any existing account,
// and throws ConvexError codes the client maps to messages (rules.ts).

const MAX_FIELD_LENGTH = 200

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().slice(0, MAX_FIELD_LENGTH)
  return trimmed || undefined
}

// Supabase stored bcrypt hashes; accounts created here use scrypt.
const isBcrypt = (hash: string) => /^\$2[aby]\$/.test(hash)

async function hashSecret(password: string) {
  return await new Scrypt().hash(password)
}

async function verifySecret(password: string, hash: string) {
  if (!hash) return false
  // compareSync: the async variant schedules work with setTimeout, which
  // Convex forbids inside the mutation that verifies passwords.
  if (isBcrypt(hash)) return bcrypt.compareSync(password, hash)
  return await new Scrypt().verify(hash, password)
}

function rethrowAccountError(err: unknown): never {
  const message = err instanceof Error ? err.message : ''
  if (message.includes('TooManyFailedAttempts')) throw new ConvexError('TOO_MANY_ATTEMPTS')
  if (message.includes('InvalidSecret') || message.includes('InvalidAccountId')) {
    throw new ConvexError('INVALID_CREDENTIALS')
  }
  throw err
}

type OtpProvider = typeof VerifyEmailOTP
type SignInCtx = Parameters<typeof signInViaProvider>[0]

/**
 * Redeems an emailed code. The library throws a plain "Could not verify code"
 * Error for a wrong or expired code (shown as "Server Error" in production),
 * so it is mapped to INVALID_CODE here.
 */
async function redeemCode(ctx: SignInCtx, provider: OtpProvider, args: Parameters<typeof signInViaProvider>[2]) {
  try {
    return await signInViaProvider(ctx, provider, args)
  } catch (err) {
    if (err instanceof Error && err.message.includes('Could not verify code')) throw new ConvexError('INVALID_CODE')
    throw err
  }
}

export const BossomPassword = ConvexCredentials({
  id: PASSWORD_PROVIDER_ID,
  crypto: { hashSecret, verifySecret },
  extraProviders: [VerifyEmailOTP, ResetPasswordOTP],

  authorize: async (params, ctx) => {
    const flow = params.flow
    const email = normalizeEmail(params.email)
    if (emailError(email)) throw new ConvexError('INVALID_EMAIL')
    // The OTP providers compare params.email to the stored account id, so
    // they must see the normalised form too.
    const otpParams = { ...params, email }
    const lookup = await ctx.runQuery(internal.accountLookup.byEmail, { email })

    switch (flow) {
      case 'signUp': {
        if (passwordError(params.password)) throw new ConvexError('INVALID_PASSWORD')
        const full_name = text(params.fullName)
        const medical_license_number = text(params.medicalLicense)
        if (!full_name || !medical_license_number) throw new ConvexError('MISSING_PROFILE')

        if (lookup.exists) throw new ConvexError('ACCOUNT_EXISTS')

        const now = new Date().toISOString()
        const { account } = await createAccount(ctx, {
          provider: PASSWORD_PROVIDER_ID,
          account: { id: email, secret: params.password as string },
          profile: {
            email,
            name: full_name,
            full_name,
            medical_license_number,
            specialization: text(params.specialization) ?? 'Radiology',
            ...(text(params.hospitalAffiliation) ? { hospital_affiliation: text(params.hospitalAffiliation)! } : {}),
            role: 'radiologist',
            is_active: true,
            created_at: now,
            updated_at: now,
          },
          shouldLinkViaEmail: false,
          shouldLinkViaPhone: false,
        })
        // No session until the emailed code is entered.
        return await signInViaProvider(ctx, VerifyEmailOTP, { accountId: account._id, params: otpParams })
      }

      case 'signIn': {
        if (typeof params.password !== 'string' || !params.password) {
          throw new ConvexError('INVALID_CREDENTIALS')
        }
        if (lookup.exists && !lookup.hasSecret) throw new ConvexError('PASSWORD_NOT_SET')

        const { account, user } = await retrieveAccount(ctx, {
          provider: PASSWORD_PROVIDER_ID,
          account: { id: email, secret: params.password },
        }).catch(rethrowAccountError)

        if (user.is_active === false) throw new ConvexError('INVALID_CREDENTIALS')

        if (lookup.hasLegacyHash) {
          await modifyAccountCredentials(ctx, {
            provider: PASSWORD_PROVIDER_ID,
            account: { id: email, secret: params.password },
          })
        }

        if (!account.emailVerified) {
          // Sends a fresh code; the client then shows the code step.
          return await signInViaProvider(ctx, VerifyEmailOTP, { accountId: account._id, params: otpParams })
        }
        return { userId: user._id }
      }

      case 'email-verification': {
        if (!lookup.exists) throw new ConvexError('INVALID_CODE')
        const { account } = await retrieveAccount(ctx, {
          provider: PASSWORD_PROVIDER_ID,
          account: { id: email },
        }).catch(rethrowAccountError)
        const result = await redeemCode(ctx, VerifyEmailOTP, { accountId: account._id, params: otpParams })
        if (result === null && params.code !== undefined) throw new ConvexError('INVALID_CODE')
        return result
      }

      case 'reset': {
        // Unknown emails get the same response as known ones (no code is
        // sent), so this screen doesn't reveal who has an account.
        if (!lookup.exists) return null
        const { account } = await retrieveAccount(ctx, {
          provider: PASSWORD_PROVIDER_ID,
          account: { id: email },
        }).catch(rethrowAccountError)
        return await signInViaProvider(ctx, ResetPasswordOTP, { accountId: account._id, params: otpParams })
      }

      case 'reset-verification': {
        if (passwordError(params.newPassword)) throw new ConvexError('INVALID_PASSWORD')
        if (!lookup.exists) throw new ConvexError('INVALID_CODE')
        const { account } = await retrieveAccount(ctx, {
          provider: PASSWORD_PROVIDER_ID,
          account: { id: email },
        }).catch(rethrowAccountError)

        if (typeof params.code !== 'string' || !params.code) throw new ConvexError('INVALID_CODE')
        const result = await redeemCode(ctx, ResetPasswordOTP, { params: otpParams })
        if (result === null || result.userId !== account.userId) throw new ConvexError('INVALID_CODE')

        await modifyAccountCredentials(ctx, {
          provider: PASSWORD_PROVIDER_ID,
          account: { id: email, secret: params.newPassword as string },
        })
        // A reset signs out every other device.
        await invalidateSessions(ctx, { userId: result.userId, except: [result.sessionId] })
        return result
      }

      default:
        throw new ConvexError('INVALID_CREDENTIALS')
    }
  },
})
