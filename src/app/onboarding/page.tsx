import Link from 'next/link'

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Bossom</h1>
        <p className="text-gray-600 mb-6">Your account is set up. Start by creating your first case.</p>
        <Link href="/dashboard" className="text-bossom-pink-600 hover:text-bossom-pink-700 font-medium">
          Go to Dashboard →
        </Link>
      </div>
    </div>
  )
}
