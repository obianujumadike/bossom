'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai'
import Link from 'next/link'
import { useAuthActions } from '@convex-dev/auth/react'
import { BossomLogo } from '@/components/ui/BossomLogo'
import { Select } from '@/components/ui/Select'
import { VerifyCodeForm } from '@/components/auth/VerifyCodeForm'
import { authErrorMessage, emailError, normalizeEmail, passwordError } from '@/convex/lib/rules'

export default function SignupPage() {
  const router = useRouter()
  const { signIn } = useAuthActions()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [specializationValue, setSpecializationValue] = useState('Radiology')
  // Set once the account is created; the emailed code finishes sign-up.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const handleEmailSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const formData = new FormData(e.currentTarget)
    const field = (name: string) => ((formData.get(name) as string | null) ?? '').trim()
    const email = normalizeEmail(formData.get('email'))
    const password = (formData.get('password') as string | null) ?? ''

    const problem =
      (!field('fullName') && 'Full name is required') ||
      emailError(email) ||
      (!field('medicalLicense') && 'Medical license number is required') ||
      passwordError(password) ||
      (password !== formData.get('confirmPassword') && 'Passwords do not match')
    if (problem) return setError(problem)

    setIsLoading(true)
    try {
      await signIn('password', {
        flow: 'signUp',
        email,
        password,
        fullName: field('fullName'),
        medicalLicense: field('medicalLicense'),
        specialization: field('specialization') || 'Radiology',
        hospitalAffiliation: field('hospitalAffiliation'),
      })
      setPendingEmail(email)
    } catch (err) {
      setError(authErrorMessage(err))
    }
    setIsLoading(false)
  }

  if (pendingEmail) {
    return (
      <VerifyCodeForm
        email={pendingEmail}
        intro="To finish creating your account, enter the 6-digit code we sent to"
        onVerified={() => router.replace('/dashboard')}
        onBack={() => setPendingEmail(null)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <BossomLogo size="xl" />
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Join Bossom</h1>
          <p className="text-gray-600 text-lg">Create your professional account</p>
        </div>

        {/* Signup Form */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 border border-gray-100 max-h-[90vh] overflow-y-auto">
          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
              {error.includes('already exists') && (
                <p className="text-sm mt-2">
                  <Link href="/login" className="font-medium text-bossom-600 hover:text-bossom-700">Sign in</Link>
                  {' · '}
                  <Link href="/forgot-password" className="font-medium text-bossom-600 hover:text-bossom-700">Reset password</Link>
                </p>
              )}
            </div>
          )}

          {/* Email Signup Form */}
          <form onSubmit={handleEmailSignup} className="space-y-5">
            <div>
              <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-bossom-500 focus:border-transparent outline-none transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-500"
                placeholder="Dr. Jane Smith"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-bossom-500 focus:border-transparent outline-none transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-500"
                placeholder="doctor@hospital.com"
              />
            </div>

            <div>
              <label htmlFor="medicalLicense" className="block text-sm font-semibold text-gray-700 mb-2">
                Medical License Number
              </label>
              <input
                id="medicalLicense"
                name="medicalLicense"
                type="text"
                required
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-bossom-500 focus:border-transparent outline-none transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-500"
                placeholder="MD123456"
              />
            </div>

            <div>
              <label htmlFor="specialization" className="block text-sm font-semibold text-gray-700 mb-2">
                Specialization
              </label>
              <Select
                id="specialization"
                options={[
                  { value: 'Radiology', label: 'Radiology' },
                  { value: 'Oncology', label: 'Oncology' },
                  { value: 'Surgery', label: 'Surgery' },
                  { value: 'General Practice', label: 'General Practice' },
                ]}
                value={specializationValue}
                onChange={setSpecializationValue}
                disabled={isLoading}
              />
              <input type="hidden" name="specialization" value={specializationValue} />
            </div>

            <div>
              <label htmlFor="hospitalAffiliation" className="block text-sm font-semibold text-gray-700 mb-2">
                Hospital Affiliation
              </label>
              <input
                id="hospitalAffiliation"
                name="hospitalAffiliation"
                type="text"
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-bossom-500 focus:border-transparent outline-none transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-500"
                placeholder="General Hospital"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-bossom-500 focus:border-transparent outline-none transition-all duration-200 pr-12 bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-500"
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <AiOutlineEyeInvisible className="w-5 h-5" /> : <AiOutlineEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-bossom-500 focus:border-transparent outline-none transition-all duration-200 pr-12 bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-500"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <AiOutlineEyeInvisible className="w-5 h-5" /> : <AiOutlineEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-bossom-500 text-white font-bold py-4 px-6 rounded-2xl hover:bg-bossom-600 transition-all duration-200 disabled:opacity-70 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 mt-6"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-bossom-600 hover:text-bossom-700 font-semibold">
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 leading-relaxed">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-bossom-600 hover:text-bossom-700">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-bossom-600 hover:text-bossom-700">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  )
}