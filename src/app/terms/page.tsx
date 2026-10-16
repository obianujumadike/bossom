'use client'

import Link from 'next/link'
import { BossomLogo } from '@/components/ui/BossomLogo'

export default function TermsAndConditions() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
          <p className="text-gray-600 mb-8">Last updated: January 9, 2026</p>

          <div className="space-y-8 text-gray-700">
            {/* Critical Medical Disclaimer */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-900 mb-3">CRITICAL MEDICAL DISCLAIMER</h2>
              <div className="space-y-3 text-red-800">
                <p><strong>BOSSOM IS NOT A MEDICAL DEVICE AND DOES NOT PROVIDE MEDICAL ADVICE, DIAGNOSIS, OR TREATMENT.</strong></p>
                <p><strong>WE ARE NOT MEDICAL PROFESSIONALS.</strong> This platform is intended solely for informational and educational purposes to assist healthcare professionals and individuals in understanding mammography analysis.</p>
                <p><strong>THIS SERVICE DOES NOT SUBSTITUTE FOR PROFESSIONAL MEDICAL CONSULTATION, EXAMINATION, DIAGNOSIS, OR TREATMENT. YOU MUST ALWAYS CONSULT WITH A QUALIFIED HEALTHCARE PROVIDER FOR MEDICAL ADVICE.</strong></p>
                <p><strong>NEVER DISREGARD PROFESSIONAL MEDICAL ADVICE OR DELAY SEEKING MEDICAL TREATMENT BECAUSE OF INFORMATION OBTAINED FROM THIS PLATFORM.</strong></p>
                <p><strong>IF YOU HAVE A MEDICAL EMERGENCY, IMMEDIATELY CONTACT YOUR DOCTOR OR EMERGENCY SERVICES (911).</strong></p>
                <p>By using this service, you acknowledge that any AI analysis results are for informational purposes only and require validation by qualified medical professionals.</p>
              </div>
            </div>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p>By accessing and using Bossom ("the Platform"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our service.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Service Description</h2>
              <p className="mb-4">Bossom provides AI-assisted mammography image analysis tools designed to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Assist healthcare professionals in mammography interpretation</li>
                <li>Provide educational insights about mammographic findings</li>
                <li>Support clinical workflow optimization</li>
                <li>Generate preliminary analysis reports for review by qualified professionals</li>
              </ul>
              <p className="mt-4"><strong>Our service is a tool to assist medical professionals and is NOT a replacement for professional medical judgment or diagnosis.</strong></p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Eligibility and User Responsibilities</h2>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Eligible Users</h3>
              <ul className="list-disc pl-6 space-y-1 mb-4">
                <li>Licensed healthcare professionals</li>
                <li>Medical students and trainees under supervision</li>
                <li>Researchers with appropriate institutional approval</li>
                <li>Individuals seeking educational information (not medical advice)</li>
              </ul>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">User Responsibilities</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Ensure you have proper authorization to upload any medical images</li>
                <li>Maintain patient confidentiality and comply with HIPAA requirements</li>
                <li>Use the platform in accordance with your professional obligations</li>
                <li>Seek appropriate medical supervision when required</li>
                <li>Report any technical issues or concerns immediately</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Limitations and Disclaimers</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">AI Analysis Limitations</h3>
                <ul className="list-disc pl-6 space-y-1 text-yellow-800">
                  <li>AI analysis results are preliminary and require professional validation</li>
                  <li>False positives and false negatives may occur</li>
                  <li>The system may miss findings that a qualified radiologist would detect</li>
                  <li>Results should never be the sole basis for medical decisions</li>
                </ul>
              </div>
              
              <p><strong>THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</strong></p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Data Privacy and Security</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>All medical images are encrypted and securely stored</li>
                <li>We comply with HIPAA and other applicable privacy regulations</li>
                <li>You retain ownership of your uploaded images and data</li>
                <li>We may use anonymized data to improve our algorithms</li>
                <li>Data sharing requires your explicit consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibent text-gray-900 mb-4">6. Prohibited Uses</h2>
              <p className="mb-4">You may not use the Platform to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Make final medical diagnoses without professional validation</li>
                <li>Replace consultation with qualified healthcare providers</li>
                <li>Upload images without proper authorization</li>
                <li>Violate patient privacy or confidentiality</li>
                <li>Distribute or share analysis results inappropriately</li>
                <li>Attempt to reverse engineer our algorithms</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Limitation of Liability</h2>
              <p><strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE PLATFORM.</strong></p>
              <p className="mt-4">Our total liability to you for any damages shall not exceed the amount paid by you for the service in the 12 months preceding the claim.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Indemnification</h2>
              <p>You agree to indemnify and hold harmless Bossom and its affiliates from any claims, damages, or expenses arising from your use of the Platform, violation of these Terms, or infringement of any rights of another party.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Termination</h2>
              <p>We may terminate or suspend your access to the Platform at any time, with or without cause or notice, if you violate these Terms or for any other reason at our sole discretion.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Changes to Terms</h2>
              <p>We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the new Terms. We will notify users of significant changes via email or platform notification.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Contact Information</h2>
              <p>For questions about these Terms and Conditions, please contact:</p>
              <p className="mt-2">
                Email: <Link href="mailto:tamaraelaye2gmail.com"> Technical support</Link><br/>
                {/* Address: [Your Business Address]<br/>
                Phone: [Your Contact Number] */}
              </p>
            </section>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Emergency Medical Situations</h3>
              <p className="text-gray-700">If you are experiencing a medical emergency, do not use this platform for diagnosis or treatment guidance. Immediately contact emergency services (911) or go to the nearest emergency room.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}