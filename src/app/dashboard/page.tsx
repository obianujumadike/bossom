'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

import {
  FaPlus,
  FaEye,
  FaChartBar,
  FaClock,
  FaUsers,
  FaExclamationTriangle,
  FaCheckCircle,
  FaUserCircle,
  FaSignOutAlt,
  FaIdCard,
  FaBars,
  FaTimes
} from 'react-icons/fa'
import { BossomLogo } from '@/components/ui/BossomLogo'
import { componentStyles } from '@/lib/design-system'
import { useAuth } from '@/lib/auth/context'
import { getRoleName } from '@/lib/auth/permissions'

interface DashboardData {
  total_cases: number
  pending_cases: number
  in_progress_cases: number
  completed_cases: number
  recent_cases: RecentCase[]
}

interface RecentCase {
  id: string
  case_number: string
  status: string
  priority: string
  study_date: string
  clinical_indication: string | null
  patients: { patient_id: string; age: number; gender: string } | null
  analyses: Array<{ birads_category: number | null; confidence_score: number | null; analysis_status: string }> | null
}

export default function DashboardPage() {
  const { profile, user, signOut } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
  }

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => {
        if (r.status === 401) { window.location.replace('/login'); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-gray-600 bg-gray-100'
      case 'in_progress':
        return 'text-blue-600 bg-blue-100'
      case 'completed':
        return 'text-green-600 bg-green-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'text-green-600 bg-green-100'
      case 'normal':
        return 'text-yellow-600 bg-yellow-100'
      case 'high':
        return 'text-orange-600 bg-orange-100'
      case 'urgent':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'case_created':
        return <FaPlus className="w-4 h-4" />
      case 'analysis_completed':
        return <FaCheckCircle className="w-4 h-4" />
      case 'review_submitted':
        return <FaEye className="w-4 h-4" />
      case 'report_generated':
        return <FaChartBar className="w-4 h-4" />
      default:
        return <FaCheckCircle className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BossomLogo size="sm" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Clinical Dashboard</h1>
                <p className="text-gray-600">Welcome back{profile?.full_name ? `, Dr. ${profile.full_name.split(' ').pop()}` : ''}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileNavOpen(o => !o)}
                className="sm:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                {mobileNavOpen ? <FaTimes className="w-5 h-5" /> : <FaBars className="w-5 h-5" />}
              </button>

              {/* User menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="flex items-center gap-2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Account menu"
                  aria-expanded={menuOpen}
                >
                  <FaUserCircle className="w-6 h-6" />
                  <span className="hidden sm:block text-sm font-medium text-gray-700">
                    {profile?.full_name ? `Dr. ${profile.full_name.split(' ').pop()}` : user?.email?.split('@')[0] ?? ''}
                  </span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs text-gray-500">Signed in as</p>
                      {profile ? (
                        <>
                          <p className="text-sm font-semibold text-gray-900 truncate">{profile.full_name || profile.email}</p>
                          {profile.full_name && <p className="text-xs text-gray-500 truncate">{profile.email}</p>}
                          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-bossom-pink-50 text-bossom-pink-700 text-xs font-medium">
                            {getRoleName(profile.role)} account
                          </span>
                        </>
                      ) : (
                        <p className="mt-1 h-4 w-32 rounded bg-gray-100 animate-pulse" aria-label="Loading account" />
                      )}
                    </div>
                    <div className="py-1">
                      <Link
                        href="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <FaIdCard className="w-4 h-4 text-gray-400" />
                        My Profile
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <FaSignOutAlt className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <Link
                href="/cases/new"
                className={`${componentStyles.button.primary} flex items-center gap-2`}
              >
                <FaPlus className="w-4 h-4" />
                New Case
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="sm:hidden bg-white border-b border-gray-200 px-4 py-4 space-y-1">
          <Link href="/cases/new" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg">
            <FaPlus className="w-4 h-4 text-gray-400" /> New Case
          </Link>
          <Link href="/cases" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg">
            <FaUsers className="w-4 h-4 text-gray-400" /> All Cases
          </Link>
          <Link href="/cases?status=pending" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg">
            <FaExclamationTriangle className="w-4 h-4 text-gray-400" /> Pending Review
          </Link>
          <Link href="/cases?status=in_progress" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg">
            <FaChartBar className="w-4 h-4 text-gray-400" /> In Progress
          </Link>
          <Link href="/cases?status=completed" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg">
            <FaCheckCircle className="w-4 h-4 text-gray-400" /> Completed
          </Link>
          <Link href="/profile" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg">
            <FaIdCard className="w-4 h-4 text-gray-400" /> My Profile
          </Link>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-lg">
            <FaSignOutAlt className="w-4 h-4" /> Sign Out
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bossom-pink-600"></div>
          </div>
        ) : data?.total_cases === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-bossom-pink-50 rounded-full flex items-center justify-center mb-6 border-2 border-bossom-pink-100">
              <svg className="w-12 h-12 text-bossom-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7.5 3h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No cases yet</h2>
            <p className="text-gray-500 max-w-sm mb-8">
              Welcome{profile?.full_name ? `, Dr. ${profile.full_name.split(' ').pop()}` : ''}! Create your first case to start using AI-powered mammogram analysis.
            </p>
            <Link
              href="/cases/new"
              className={`${componentStyles.button.primary} flex items-center gap-2 text-base px-6 py-3`}
            >
              <FaPlus className="w-4 h-4" />
              Create Your First Case
            </Link>
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl w-full text-left">
              {[
                { icon: FaUsers, title: 'Register a Patient', desc: 'Enter patient demographics and medical history.' },
                { icon: FaChartBar, title: 'Upload Mammograms', desc: 'Upload DICOM or image files for analysis.' },
                { icon: FaCheckCircle, title: 'Get AI Analysis', desc: 'Receive instant BI-RADS scoring and ROI detection.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className={`${componentStyles.card.elevated} p-5`}>
                  <div className="w-10 h-10 bg-bossom-pink-50 rounded-lg flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-bossom-pink-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Link href="/cases" className={`${componentStyles.card.elevated} p-6 hover:shadow-md transition-shadow`}>
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Total Cases</p>
                    <p className="text-3xl font-bold text-gray-900">{data?.total_cases ?? 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FaUsers className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </Link>

              <Link href="/cases?status=pending" className={`${componentStyles.card.elevated} p-6 hover:shadow-md transition-shadow`}>
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Pending Review</p>
                    <p className="text-3xl font-bold text-gray-900">{data?.pending_cases ?? 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <FaClock className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </Link>

              <Link href="/cases?status=in_progress" className={`${componentStyles.card.elevated} p-6 hover:shadow-md transition-shadow`}>
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">In Progress</p>
                    <p className="text-3xl font-bold text-gray-900">{data?.in_progress_cases ?? 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FaChartBar className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </Link>

              <Link href="/cases?status=completed" className={`${componentStyles.card.elevated} p-6 hover:shadow-md transition-shadow`}>
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-3xl font-bold text-gray-900">{data?.completed_cases ?? 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <FaCheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Recent Cases */}
              <div className="lg:col-span-2">
                <div className={componentStyles.card.elevated}>
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-gray-900">Recent Cases</h2>
                      <Link
                        href="/cases"
                        className="text-sm text-bossom-pink-600 hover:text-bossom-pink-500 font-medium"
                      >
                        View All Cases
                      </Link>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    {(!data?.recent_cases || data.recent_cases.length === 0) ? (
                      <div className="text-center py-8 text-gray-500">
                        <FaUsers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No cases yet. Create your first case to get started.</p>
                        <Link href="/cases/new" className="text-bossom-pink-600 hover:underline mt-2 inline-block">
                          Create New Case
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {data.recent_cases.map((c) => {
                          const birads = c.analyses?.find(a => a.birads_category !== null)
                          return (
                            <Link key={c.id} href={`/cases/${c.id}/analysis`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-medium text-gray-900">{c.case_number}</h3>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(c.priority)}`}>
                                    {c.priority}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>
                                    {c.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>Patient: {c.patients?.patient_id ?? 'N/A'}</span>
                                  <span>Age: {c.patients?.age ?? 'N/A'}</span>
                                  <span>Date: {new Date(c.study_date).toLocaleDateString()}</span>
                                  {birads && (
                                    <span className="font-medium text-gray-900">BI-RADS {birads.birads_category}</span>
                                  )}
                                </div>
                              </div>
                              <FaEye className="w-4 h-4 text-gray-400 ml-4 flex-shrink-0" />
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <div className={componentStyles.card.elevated}>
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-3">
                      <Link
                        href="/cases/new"
                        className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <FaPlus className="w-4 h-4 text-gray-400" />
                        <span>Create New Case</span>
                      </Link>
                      
                      <Link
                        href="/cases?status=pending"
                        className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <FaExclamationTriangle className="w-4 h-4 text-gray-400" />
                        <span>Cases Pending Review</span>
                      </Link>

                      <Link
                        href="/cases?status=in_progress"
                        className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <FaChartBar className="w-4 h-4 text-gray-400" />
                        <span>In Progress Cases</span>
                      </Link>
                      
                      <Link
                        href="/cases?status=completed"
                        className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <FaCheckCircle className="w-4 h-4 text-gray-400" />
                        <span>Completed Cases</span>
                      </Link>
                      
                      <Link
                        href="/profile"
                        className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <FaIdCard className="w-4 h-4 text-gray-400" />
                        <span>My Profile</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}