import type { NextFetchEvent, NextRequest } from 'next/server'
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from '@convex-dev/auth/nextjs/server'
import { isAuthProxyRequest, proxyAuthAction } from '@/lib/convex/authProxy'

const isProtectedPage = createRouteMatcher([
  '/dashboard(.*)',
  '/cases(.*)',
  '/profile(.*)',
  '/settings(.*)',
  '/reports(.*)',
  '/notifications(.*)',
  '/compliance(.*)',
  '/verification(.*)',
  '/onboarding(.*)',
])
const isAuthPage = createRouteMatcher(['/login', '/signup'])

// /api/* data routes check the session themselves and answer 401 JSON rather
// than redirecting.
const convexAuthMiddleware = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const signedIn = await convexAuth.isAuthenticated()

    if (!signedIn && isProtectedPage(request)) {
      const next = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)
      return nextjsMiddlewareRedirect(request, `/login?next=${next}`)
    }
    if (signedIn && isAuthPage(request)) {
      return nextjsMiddlewareRedirect(request, '/dashboard')
    }
  },
  {
    // Session cookies: closing the browser ends the session. Convex also ends
    // idle sessions after 12h (convex/auth.ts).
    cookieConfig: { maxAge: null },
    // No magic links or OAuth, so `?code=` in a URL is never an auth code.
    shouldHandleCode: false,
  },
)

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  // POST /api/auth is served by our copy of the library's proxy, which passes
  // sign-in error codes through to the page (see authProxy.ts).
  if (isAuthProxyRequest(request)) return proxyAuthAction(request)
  return convexAuthMiddleware(request, event)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp|sw.js|workbox-.*\\.js|swe-worker-.*\\.js|manifest.json).*)',
  ],
}
