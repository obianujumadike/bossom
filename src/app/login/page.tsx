'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { BossomLogo } from '@/components/ui/BossomLogo'
import { componentStyles } from '@/lib/design-system'
import { useAuthActions } from '@convex-dev/auth/react'
import { authErrorMessage, emailError, normalizeEmail, safeNextPath } from '@/convex/lib/rules'
import { VerifyCodeForm } from '@/components/auth/VerifyCodeForm'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNextPath(searchParams.get('next'))
  const { signIn } = useAuthActions()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Set when the account exists but its email was never confirmed: sign-in
  // sends a fresh code instead of a session.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    const email = normalizeEmail(formData.get('email'))
    const password = (formData.get('password') as string | null) ?? ''

    const emailErr = emailError(email)
    if (emailErr) return setError(emailErr)
    if (!password) return setError('Password is required')

    setLoading(true)
    try {
      const { signingIn } = await signIn('password', { flow: 'signIn', email, password })
      if (signingIn) {
        router.replace(next)
      } else {
        setPendingEmail(email)
        setLoading(false)
      }
    } catch (err) {
      setError(authErrorMessage(err))
      setLoading(false)
    }
  }

  if (pendingEmail) {
    return (
      <VerifyCodeForm
        email={pendingEmail}
        intro="Your email isn't confirmed yet. We've sent a 6-digit code to"
        onVerified={() => router.replace(next)}
        onBack={() => setPendingEmail(null)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-bossom-pink-50 to-bossom-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Link href="/" className="hover:opacity-80 transition-opacity">
                <BossomLogo size="lg" />
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Sign in to your Bossom account</p>
          </div>

          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                required
                disabled={loading}
                className={`${componentStyles.input.base} ${
                  loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className={`${componentStyles.input.base} pr-10 ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <FaEyeSlash className="h-4 w-4 text-gray-400" />
                  ) : (
                    <FaEye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-bossom-pink-600 hover:text-bossom-pink-500"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`${componentStyles.button.primary} w-full ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                href="/signup"
                className="font-medium text-bossom-pink-600 hover:text-bossom-pink-500"
              >
                Sign up for free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-white via-bossom-pink-50 to-bossom-pink-100 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bossom-pink-600"></div></div>}>
      <LoginForm />
    </Suspense>
  )
}
