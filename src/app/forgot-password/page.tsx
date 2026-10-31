'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FaArrowLeft, FaEye, FaEyeSlash } from 'react-icons/fa'
import { useAuthActions } from '@convex-dev/auth/react'
import { BossomLogo } from '@/components/ui/BossomLogo'
import { componentStyles } from '@/lib/design-system'
import { authErrorMessage, emailError, normalizeEmail, passwordError } from '@/convex/lib/rules'

// Step 1 emails a 6-digit code; step 2 takes the code and the new password on
// this same screen. The response is identical whether or not the email has an
// account, so this page can't be used to discover who is registered.

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { signIn } = useAuthActions()
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const requestCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const normalized = normalizeEmail(email)
    const problem = emailError(normalized)
    if (problem) return setError(problem)

    setLoading(true)
    try {
      await signIn('password', { flow: 'reset', email: normalized })
      setEmail(normalized)
      setStep('reset')
    } catch (err) {
      setError(authErrorMessage(err))
    }
    setLoading(false)
  }

  const resetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const form = new FormData(e.currentTarget)
    const code = ((form.get('code') as string | null) ?? '').trim()
    const newPassword = (form.get('password') as string | null) ?? ''

    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from the email.')
    const problem = passwordError(newPassword) || (newPassword !== form.get('confirm') && 'Passwords do not match')
    if (problem) return setError(problem)

    setLoading(true)
    try {
      const { signingIn } = await signIn('password', { flow: 'reset-verification', email, code, newPassword })
      if (signingIn) return router.replace('/dashboard')
      setError('That code is invalid or has expired. Request a new one.')
    } catch (err) {
      setError(authErrorMessage(err))
    }
    setLoading(false)
  }

  const inputClass = `${componentStyles.input.base} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-bossom-pink-50 to-bossom-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex justify-center mb-6">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <BossomLogo size="lg" />
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {step === 'email' ? 'Forgot password?' : 'Set a new password'}
            </h1>
            <p className="text-gray-600">
              {step === 'email' ? (
                "Enter your email and we'll send you a 6-digit code to reset your password."
              ) : (
                <>
                  If an account exists for <span className="font-medium text-gray-900 break-all">{email}</span>, we&apos;ve
                  sent it a code. It expires in 15 minutes.
                </>
              )}
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={requestCode} className="space-y-4">
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
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="Enter your email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className={`${componentStyles.button.primary} w-full ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="space-y-4">
              {/* Browsers treat the text field before a new-password field as
                  the username and autofilled the email into the code box. An
                  explicit read-only username field takes that autofill instead
                  (and tells password managers which account to update). */}
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="reset-email"
                  name="username"
                  type="email"
                  autoComplete="username"
                  value={email}
                  readOnly
                  className={`${componentStyles.input.base} bg-gray-50 text-gray-700`}
                />
              </div>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                  Reset code
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  disabled={loading}
                  className={`${inputClass} text-center text-xl tracking-[0.5em] font-semibold`}
                  placeholder="000000"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={loading}
                    className={`${inputClass} pr-10`}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(v => !v)}
                  >
                    {showPassword ? <FaEyeSlash className="h-4 w-4 text-gray-400" /> : <FaEye className="h-4 w-4 text-gray-400" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirm"
                  name="confirm"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                  className={inputClass}
                  placeholder="Repeat your new password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className={`${componentStyles.button.primary} w-full ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Updating…' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setError('') }}
                className="w-full text-sm text-bossom-pink-600 hover:text-bossom-pink-500"
              >
                Didn&apos;t receive it? Send another code
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
              <FaArrowLeft className="w-3 h-3" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
