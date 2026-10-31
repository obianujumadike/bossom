'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuthActions } from '@convex-dev/auth/react'
import { BossomLogo } from '@/components/ui/BossomLogo'
import { componentStyles } from '@/lib/design-system'
import { authErrorMessage } from '@/convex/lib/rules'

interface VerifyCodeFormProps {
  email: string
  intro: string
  onVerified: () => void
  onBack: () => void
}

/** Second step of sign-up (and of signing in to an unconfirmed account). */
export function VerifyCodeForm({ email, intro, onVerified, onBack }: VerifyCodeFormProps) {
  const { signIn } = useAuthActions()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from the email.')

    setLoading(true)
    try {
      const { signingIn } = await signIn('password', { flow: 'email-verification', email, code })
      if (signingIn) return onVerified()
      setError('That code is invalid or has expired. Request a new one.')
    } catch (err) {
      setError(authErrorMessage(err))
    }
    setLoading(false)
  }

  const resend = async () => {
    setError('')
    setNotice('')
    try {
      await signIn('password', { flow: 'email-verification', email })
      setNotice('A new code is on its way.')
    } catch (err) {
      setError(authErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-bossom-pink-50 to-bossom-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Link href="/" className="hover:opacity-80 transition-opacity">
                <BossomLogo size="lg" />
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
            <p className="text-gray-600">
              {intro} <span className="font-medium text-gray-900 break-all">{email}</span>
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          {notice && (
            <div role="status" className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-sm">{notice}</p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {/* Hidden username field: gives browser autofill somewhere to put
                the email other than the code box. */}
            <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                Verification code
              </label>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
                className={`${componentStyles.input.base} text-center text-2xl tracking-[0.5em] font-semibold`}
                placeholder="000000"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className={`${componentStyles.button.primary} w-full ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Verifying...' : 'Verify and continue'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button type="button" onClick={onBack} className="text-gray-600 hover:text-gray-900">
              ← Back
            </button>
            <button type="button" onClick={resend} className="text-bossom-pink-600 hover:text-bossom-pink-500 font-medium">
              Resend code
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
