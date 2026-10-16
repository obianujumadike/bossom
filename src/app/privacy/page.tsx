'use client'

import Link from 'next/link'
import { BossomLogo } from '@/components/ui/BossomLogo'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/" className="inline-flex items-center hover:opacity-80 transition-opacity">
            <BossomLogo className="h-8" />
            <span className="ml-3 text-xl font-semibold text-gray-900">Bossom</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-600 mb-8">Last updated: January 9, 2026</p>

          <div className="space-y-8 text-gray-700">
            {/* Medical Disclaimer */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-900 mb-3">Important Medical Disclaimer</h2>
              <div className="space-y-3 text-red-800">
                <p><strong>Bossom is NOT a medical device and does not provide medical advice, diagnosis, or treatment.</strong></p>
                <p>We are not medical professionals. This platform is intended for informational and educational purposes only to assist healthcare professionals and individuals in understanding mammography analysis.</p>
                <p><strong>This service does NOT substitute for professional medical consultation, examination, diagnosis, or treatment. Always consult with a qualified healthcare provider for medical advice and never disregard professional medical advice or delay seeking it because of information obtained from this platform.</strong></p>
                <p>If you have a medical emergency, immediately contact your doctor or emergency services.</p>
              </div>
            </div>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Personal Information</h3>
              <ul className="list-disc pl-6 space-y-1 mb-4">
                <li>Account information (name, email address, professional credentials)</li>
                <li>Profile information and preferences</li>
                <li>Communication and support interactions</li>
              </ul>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">Medical Images and Data</h3>
              <ul className="list-disc pl-6 space-y-1 mb-4">
                <li>Mammography images uploaded for analysis</li>
                <li>Analysis results and AI-generated insights</li>
                <li>Case notes and metadata</li>
                <li>Usage patterns and platform interactions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide AI-assisted mammography analysis services</li>
                <li>Improve our algorithms and platform functionality</li>
                <li>Ensure platform security and prevent fraud</li>
                <li>Communicate service updates and support</li>
                <li>Comply with legal and regulatory requirements</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Security & HIPAA Compliance</h2>
              <p className="mb-4">We implement industry-standard security measures to protect your data:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>End-to-end encryption for all medical data</li>
                <li>Secure cloud storage with access controls</li>
                <li>Regular security audits and monitoring</li>
                <li>HIPAA-compliant data handling procedures</li>
                <li>Staff training on privacy and security protocols</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Information Sharing</h2>
              <p className="mb-4">We do not sell, trade, or rent your personal information. We may share information only in these limited circumstances:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>With your explicit consent</li>
                <li>To comply with legal obligations or court orders</li>
                <li>To protect rights, safety, or property</li>
                <li>With trusted service providers under strict confidentiality agreements</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Rights</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access and review your personal information</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account and data</li>
                <li>Withdraw consent for data processing</li>
                <li>Export your data in a portable format</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Retention</h2>
              <p>We retain your information only as long as necessary to provide services and comply with legal obligations. Medical images and analysis data are typically retained for 7 years in accordance with medical record retention standards, unless you request earlier deletion.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p>If you have questions about this Privacy Policy or your data rights, please contact us at:</p>
              <p className="mt-2">
                Email: <a href="mailto:tamaraelaye2gmail.com" className="text-bossom-pink-600 hover:underline">Technical Support</a>
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}