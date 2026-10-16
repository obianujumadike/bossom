'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FaBars, FaTimes } from 'react-icons/fa'
import { BossomLogo } from '@/components/ui/BossomLogo'

export function LandingNav() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="relative">
      <div className="flex justify-between items-center p-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-3">
          <BossomLogo size="md" />
          <span className="text-2xl font-bold text-gray-900">Bossom</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center space-x-6">
          <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
            Sign In
          </Link>
          <Link href="/signup" className="bg-bossom-500 text-white px-6 py-2.5 rounded-full hover:bg-bossom-600 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl">
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(o => !o)}
          className="sm:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          {open ? <FaTimes className="w-5 h-5" /> : <FaBars className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50 px-6 py-4 space-y-3">
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="block w-full text-center py-3 text-gray-700 font-medium hover:bg-gray-50 rounded-xl transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            onClick={() => setOpen(false)}
            className="block w-full text-center py-3 bg-bossom-500 text-white font-semibold rounded-xl hover:bg-bossom-600 transition-colors"
          >
            Get Started
          </Link>
        </div>
      )}
    </nav>
  )
}
