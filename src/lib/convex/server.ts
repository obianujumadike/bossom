import 'server-only'
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'
import { ConvexError } from 'convex/values'
import { api, log } from '@/lib/api/response'

// The /api/* routes are the contract the pages call. Each one forwards the
// session token from the httpOnly cookie to Convex, which derives the user
// from it; nothing identifying is taken from the request body.

const CLIENT_ERRORS: Record<string, string> = {
  INVALID_INPUT: 'Some fields are missing or invalid',
  INVALID_PHONE: 'Please enter a valid phone number (e.g. +2348012345678)',
  INVALID_UPLOAD: 'The upload could not be verified. Please try again.',
  FILE_TOO_LARGE: 'File too large (max 10 MB). Export a smaller JPEG or PNG of the image.',
}

const UNAVAILABLE: Record<string, string> = {
  STORAGE_NOT_CONFIGURED: 'Image storage is not configured. Contact your administrator.',
  ANALYSIS_NOT_CONFIGURED: 'AI model endpoint is not configured. Contact your administrator.',
}

function errorCode(err: unknown): string | null {
  if (err instanceof ConvexError && typeof err.data === 'string') return err.data
  return null
}

export function convexErrorResponse(err: unknown, message: string, context?: Record<string, unknown>) {
  const code = errorCode(err)
  if (code === 'UNAUTHENTICATED') return api.unauthorized()
  if (code === 'NOT_FOUND') return api.notFound('Not found')
  if (code && CLIENT_ERRORS[code]) return api.badRequest(CLIENT_ERRORS[code])
  if (code && UNAVAILABLE[code]) {
    log.warn(message, { code, ...context })
    return api.serviceUnavailable(UNAVAILABLE[code])
  }
  if (code === 'ANALYSIS_FAILED') return api.serverError('Analysis failed', err, context)
  // Convex argument validation: a malformed value from the client.
  if (err instanceof Error && err.message.includes('ArgumentValidationError')) {
    return api.badRequest('Invalid request')
  }
  return api.serverError(message, err, context)
}

/** Runs `fn` with the caller's Convex token, or answers 401 when signed out. */
export async function withSession(
  message: string,
  fn: (token: string) => Promise<Response>,
  context?: Record<string, unknown>,
): Promise<Response> {
  const token = await convexAuthNextjsToken()
  if (!token) return api.unauthorized()
  try {
    return await fn(token)
  } catch (err) {
    return convexErrorResponse(err, message, context)
  }
}
