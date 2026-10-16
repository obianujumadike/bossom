import { NextResponse, type NextRequest } from 'next/server'
import { fetchAction } from 'convex/nextjs'
import { ConvexError } from 'convex/values'

// POST /api/auth — the proxy between useAuthActions() and Convex's auth:signIn
// / auth:signOut, keeping the refresh token in an httpOnly cookie.
//
// Vendored from @convex-dev/auth@0.0.96 (dist/nextjs/server/proxy.js and
// cookies.js) with one change: a failed sign-in returns the ConvexError code
// (e.g. ACCOUNT_EXISTS) instead of `error.message`. Production deployments
// guarantee a ConvexError's `data` but not its message, and the stock proxy
// only forwards the message, so in production every auth failure would have
// read "Something went wrong" — the same dead end as the original QA reports.
//
// Cookie names and options must stay identical to the library's: its
// middleware refreshes these cookies and its server provider reads them.
// Re-check this file whenever @convex-dev/auth is upgraded.

type Tokens = { token: string; refreshToken: string }

export const AUTH_PROXY_PATH = '/api/auth'

export function isAuthProxyRequest(request: NextRequest): boolean {
  const { pathname } = request.nextUrl
  return pathname === AUTH_PROXY_PATH || pathname === `${AUTH_PROXY_PATH}/`
}

function isLocalHost(host: string) {
  return /(localhost|127\.0\.0\.1):\d+/.test(host)
}

function cookieNames(request: NextRequest) {
  const prefix = isLocalHost(request.headers.get('Host') ?? '') ? '' : '__Host-'
  return {
    token: `${prefix}__convexAuthJWT`,
    refreshToken: `${prefix}__convexAuthRefreshToken`,
    verifier: `${prefix}__convexAuthOAuthVerifier`,
  }
}

function setAuthCookies(request: NextRequest, response: NextResponse, tokens: Tokens | null) {
  const names = cookieNames(request)
  const local = isLocalHost(request.headers.get('Host') ?? '')
  // Session cookies (no maxAge): matches cookieConfig in src/middleware.ts.
  const options = { secure: !local, httpOnly: true, sameSite: 'lax' as const, path: '/' }
  const clear = (name: string) => response.cookies.set(name, '', { ...options, expires: 0 })

  if (tokens === null) {
    clear(names.token)
    clear(names.refreshToken)
  } else {
    response.cookies.set(names.token, tokens.token, options)
    response.cookies.set(names.refreshToken, tokens.refreshToken, options)
  }
  clear(names.verifier)
}

function isCorsRequest(request: NextRequest) {
  const origin = request.headers.get('Origin')
  if (!origin) return false
  const originURL = new URL(origin)
  return originURL.host !== request.headers.get('Host') || originURL.protocol !== new URL(request.url).protocol
}

function errorCode(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === 'string') return error.data
  return error instanceof Error ? error.message : 'UNKNOWN'
}

export async function proxyAuthAction(request: NextRequest): Promise<Response> {
  if (request.method !== 'POST') return new Response('Invalid method', { status: 405 })
  if (isCorsRequest(request)) return new Response('Invalid origin', { status: 403 })

  const { action, args } = await request.json()
  if (action !== 'auth:signIn' && action !== 'auth:signOut') {
    return new Response('Invalid action', { status: 400 })
  }

  const names = cookieNames(request)
  const cookie = (name: string) => request.cookies.get(name)?.value ?? null

  if (action === 'auth:signOut') {
    try {
      await fetchAction(action as any, args, { token: cookie(names.token) ?? undefined })
    } catch (error) {
      console.error('Hit error while running `auth:signOut`:', error)
    }
    const response = NextResponse.json(null)
    setAuthCookies(request, response, null)
    return response
  }

  let token: string | undefined
  if (args.refreshToken !== undefined) {
    // The client only ever holds a dummy refresh token; the real one is the cookie.
    const refreshToken = cookie(names.refreshToken)
    if (refreshToken === null) return NextResponse.json({ tokens: null })
    args.refreshToken = refreshToken
  } else {
    token = cookie(names.token) ?? undefined
  }

  // Refreshing tokens and redeeming codes are steps of the auth flow and must
  // not require an existing session.
  const authOptions = args.refreshToken !== undefined || args.params?.code !== undefined ? {} : { token }

  let result: { tokens?: Tokens | null; redirect?: string; verifier?: string }
  try {
    result = await fetchAction(action as any, args, authOptions)
  } catch (error) {
    const response = NextResponse.json({ error: errorCode(error) }, { status: 400 })
    setAuthCookies(request, response, null)
    return response
  }

  if (result.redirect !== undefined) {
    // OAuth only; Bossom has no OAuth providers.
    return NextResponse.json({ error: 'UNSUPPORTED' }, { status: 400 })
  }
  if (result.tokens !== undefined) {
    const response = NextResponse.json({
      tokens: result.tokens !== null ? { token: result.tokens.token, refreshToken: 'dummy' } : null,
    })
    setAuthCookies(request, response, result.tokens)
    return response
  }
  return NextResponse.json(result)
}
