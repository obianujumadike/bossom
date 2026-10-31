'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import { FaArrowLeft, FaUser, FaCalendarAlt, FaIdCard, FaPhone, FaMars, FaVenus } from 'react-icons/fa'
import { BossomLogo } from '@/components/ui/BossomLogo'
import { componentStyles } from '@/lib/design-system'

interface PatientData {
  firstName: string
  lastName: string
  dateOfBirth: string
  medicalRecordNumber: string
  phoneNumber: string
  email: string
  gender: 'female' | 'male' | 'other'
  address: string
  emergencyContact: string
  emergencyPhone: string
  insuranceProvider: string
  insuranceNumber: string
  referringPhysician: string
  clinicalHistory: string
  currentSymptoms: string
  priorMammograms: 'yes' | 'no' | 'unknown'
  familyHistory: string
  medications: string
}

export default function NewCasePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [patientData, setPatientData] = useState<PatientData>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    medicalRecordNumber: '',
    phoneNumber: '',
    email: '',
    gender: 'female',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    insuranceProvider: '',
    insuranceNumber: '',
    referringPhysician: '',
    clinicalHistory: '',
    currentSymptoms: '',
    priorMammograms: 'unknown',
    familyHistory: '',
    medications: ''
  })

  const steps = [
    { id: 1, title: 'Patient Information', icon: FaUser },
    { id: 2, title: 'Medical Details', icon: FaIdCard },
    { id: 3, title: 'Clinical History', icon: FaCalendarAlt }
  ]

  const handleInputChange = (field: keyof PatientData, value: string) => {
    setPatientData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Calculate age from DOB
      const dob = new Date(patientData.dateOfBirth)
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patientData.medicalRecordNumber,
          patientAge: age,
          patientGender: patientData.gender === 'female' ? 'Female' : patientData.gender === 'male' ? 'Male' : 'Other',
          clinicalIndication: patientData.currentSymptoms || patientData.clinicalHistory || null,
          referringPhysician: patientData.referringPhysician,
          priority: 'normal',
          studyType: 'Screening Mammogram',
          clinicalHistory: patientData.clinicalHistory || null,
          familyHistory: patientData.familyHistory || null,
          medications: patientData.medications || null,
          priorMammograms: patientData.priorMammograms,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || 'Failed to create case')
      }

      const { data: newCase } = await res.json()
      toast.success('Case created successfully!')
      router.push(`/cases/${newCase.id}/upload`)
    } catch (error) {
      console.error('Error creating case:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create case')
    } finally {
      setLoading(false)
    }
  }

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return patientData.firstName && patientData.lastName && patientData.dateOfBirth && patientData.medicalRecordNumber
      case 2:
        return patientData.phoneNumber && patientData.email && patientData.address
      case 3:
        return patientData.referringPhysician
      default:
        return false
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-bossom-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FaArrowLeft className="w-5 h-5" />
              </button>
              <BossomLogo size="sm" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">New Patient Case</h1>
                <p className="text-gray-600">Create a new mammogram analysis case</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <nav aria-label="Progress">
            <ol className="flex items-center justify-between">
              {steps.map((step, index) => {
                const isActive = step.id === currentStep
                const isCompleted = step.id < currentStep
                const Icon = step.icon
                
                return (
                  <li key={step.id} className="flex-1">
                    <div className={`flex items-center ${index < steps.length - 1 ? 'w-full' : ''}`}>
                      <div className="flex items-center">
                        <div className={`
                          w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200
                          ${isActive 
                            ? 'bg-bossom-pink-500 border-bossom-pink-500 text-white' 
                            : isCompleted 
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-white border-gray-300 text-gray-600'
                          }
                        `}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="ml-4">
                          <p className={`text-sm font-medium ${isActive ? 'text-bossom-pink-600' : isCompleted ? 'text-green-600' : 'text-gray-700'}`}>
                            Step {step.id}
                          </p>
                          <p className={`text-sm ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                            {step.title}
                          </p>
                        </div>
                      </div>
                      {index < steps.length - 1 && (
                        <div className={`flex-1 h-0.5 ml-8 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </nav>
        </div>

        {/* Form Content */}
        <div className={componentStyles.card.elevated}>
          <div className="p-8">
            {/* Step 1: Patient Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Patient Information</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      className={componentStyles.input.base}
                      placeholder="Enter first name"
                      value={patientData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      className={componentStyles.input.base}
                      placeholder="Enter last name"
                      value={patientData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      required
                      className={componentStyles.input.base}
                      value={patientData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Medical Record Number *
                    </label>
                    <input
                      type="text"
                      required
                      className={componentStyles.input.base}
                      placeholder="Enter MRN"
                      value={patientData.medicalRecordNumber}
                      onChange={(e) => handleInputChange('medicalRecordNumber', e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Gender
                    </label>
                    <div className="flex gap-4">
                      {[
                        { value: 'female', label: 'Female', icon: FaVenus },
                        { value: 'male', label: 'Male', icon: FaMars },
                        { value: 'other', label: 'Other', icon: FaUser }
                      ].map(({ value, label, icon: Icon }) => (
                        <label key={value} className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="gender"
                            value={value}
                            checked={patientData.gender === value}
                            onChange={(e) => handleInputChange('gender', e.target.value)}
                            className="sr-only"
                          />
                          <div className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all duration-200
                            ${patientData.gender === value 
                              ? 'border-bossom-pink-500 bg-bossom-pink-50 text-bossom-pink-700' 
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                            }
                          `}>
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{label}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Medical Details */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Contact & Insurance Information</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      className={componentStyles.input.base}
                      placeholder="(555) 123-4567"
                      value={patientData.phoneNumber}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      className={componentStyles.input.base}
                      placeholder="patient@example.com"
                      value={patientData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address *
                    </label>
                    <textarea
                      required
                      rows={3}
                      className={componentStyles.input.base}
                      placeholder="Enter full address"
                      value={patientData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Contact
                    </label>
                    <input
                      type="text"
                      className={componentStyles.input.base}
                      placeholder="Contact name"
                      value={patientData.emergencyContact}
                      onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Phone
                    </label>
                    <input
                      type="tel"
                      className={componentStyles.input.base}
                      placeholder="(555) 123-4567"
                      value={patientData.emergencyPhone}
                      onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Insurance Provider
                    </label>
                    <input
                      type="text"
                      className={componentStyles.input.base}
                      placeholder="Insurance company"
                      value={patientData.insuranceProvider}
                      onChange={(e) => handleInputChange('insuranceProvider', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Insurance Number
                    </label>
                    <input
                      type="text"
                      className={componentStyles.input.base}
                      placeholder="Policy number"
                      value={patientData.insuranceNumber}
                      onChange={(e) => handleInputChange('insuranceNumber', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Clinical History */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Clinical History</h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Referring Physician *
                    </label>
                    <input
                      type="text"
                      required
                      className={componentStyles.input.base}
                      placeholder="Dr. Smith, MD"
                      value={patientData.referringPhysician}
                      onChange={(e) => handleInputChange('referringPhysician', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Symptoms
                    </label>
                    <textarea
                      rows={4}
                      className={componentStyles.input.base}
                      placeholder="Describe any current symptoms or concerns..."
                      value={patientData.currentSymptoms}
                      onChange={(e) => handleInputChange('currentSymptoms', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Prior Mammograms
                    </label>
                    <div className="flex gap-4">
                      {[
                        { value: 'yes', label: 'Yes' },
                        { value: 'no', label: 'No' },
                        { value: 'unknown', label: 'Unknown' }
                      ].map(({ value, label }) => (
                        <label key={value} className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="priorMammograms"
                            value={value}
                            checked={patientData.priorMammograms === value}
                            onChange={(e) => handleInputChange('priorMammograms', e.target.value)}
                            className="sr-only"
                          />
                          <div className={`
                            px-4 py-2 rounded-lg border-2 transition-all duration-200
                            ${patientData.priorMammograms === value 
                              ? 'border-bossom-pink-500 bg-bossom-pink-50 text-bossom-pink-700' 
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                            }
                          `}>
                            <span className="text-sm font-medium">{label}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Family History
                    </label>
                    <textarea
                      rows={4}
                      className={componentStyles.input.base}
                      placeholder="Any family history of breast or ovarian cancer..."
                      value={patientData.familyHistory}
                      onChange={(e) => handleInputChange('familyHistory', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Medications
                    </label>
                    <textarea
                      rows={3}
                      className={componentStyles.input.base}
                      placeholder="List current medications..."
                      value={patientData.medications}
                      onChange={(e) => handleInputChange('medications', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Clinical History & Notes
                    </label>
                    <textarea
                      rows={4}
                      className={componentStyles.input.base}
                      placeholder="Additional clinical history, previous procedures, etc..."
                      value={patientData.clinicalHistory}
                      onChange={(e) => handleInputChange('clinicalHistory', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-8 mt-8 border-t border-gray-200">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className={`${componentStyles.button.secondary} ${
                  currentStep === 1 ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                Previous
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => router.back()}
                  className={componentStyles.button.ghost}
                >
                  Cancel
                </button>

                {currentStep < 3 ? (
                  <button
                    onClick={handleNext}
                    disabled={!isStepValid()}
                    className={`${componentStyles.button.primary} ${
                      !isStepValid() ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !isStepValid()}
                    className={`${componentStyles.button.primary} ${
                      loading || !isStepValid() ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {loading ? 'Creating Case...' : 'Create Case'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}