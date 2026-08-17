'use client'
import {useState,useCallback,useEffect,useMemo,} from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { toast } from 'react-toastify'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {FaArrowLeft,FaUpload,FaFile,FaCheck,FaTimes,FaEye,FaTrash,FaExclamationTriangle,FaSpinner,} from 'react-icons/fa'
import { BossomLogo } from '@/components/ui/BossomLogo'
import { componentStyles } from '@/lib/design-system'
import { createClient } from '@/lib/supabase/client'

interface UploadedFile {
  id: string
  file: File
  preview?: string
  serverImageId?: string
  status: 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  metadata?: {
    patientName?: string
    studyDate?: string
    modality?: string
    bodyPart?: string
  }
}

type MammogramView = {
  laterality: 'Left' | 'Right' | null
  viewPosition: 'CC' | 'MLO' | null
}

// function getFileContentType(file: File): string {
//   if (file.type) {
//     return file.type
//   }

//   const fileName = file.name.toLowerCase()

//   if (
//     fileName.endsWith('.dcm') ||
//     fileName.endsWith('.dicom')
//   ) {
//     return 'application/dicom'
//   }

//   if (
//     fileName.endsWith('.jpg') ||
//     fileName.endsWith('.jpeg')
//   ) {
//     return 'image/jpeg'
//   }

//   if (fileName.endsWith('.png')) {
//     return 'image/png'
//   }

//   if (
//     fileName.endsWith('.tif') ||
//     fileName.endsWith('.tiff')
//   ) {
//     return 'image/tiff'
//   }

//   return 'application/octet-stream'
// }

function getFileContentType(file: File): string {
  const fileName = file.name.toLowerCase()

  if (
    fileName.endsWith('.dcm') ||
    fileName.endsWith('.dicom')
  ) {
    return 'application/dicom'
  }

  if (
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg')
  ) {
    return 'image/jpeg'
  }

  if (fileName.endsWith('.png')) {
    return 'image/png'
  }

  if (
    fileName.endsWith('.tif') ||
    fileName.endsWith('.tiff')
  ) {
    return 'image/tiff'
  }

  if (
    file.type &&
    file.type !== 'application/octet-stream'
  ) {
    return file.type
  }
  return 'application/octet-stream'
}

function inferMammogramView(fileName: string): MammogramView {
  const normalizedName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  if (
    normalizedName.startsWith('ccl') ||
    normalizedName.startsWith('lcc')
  ) {
    return {
      laterality: 'Left',
      viewPosition: 'CC',
    }
  }

  if (
    normalizedName.startsWith('ccr') ||
    normalizedName.startsWith('rcc')
  ) {
    return {
      laterality: 'Right',
      viewPosition: 'CC',
    }
  }

  if (
    normalizedName.startsWith('mlol') ||
    normalizedName.startsWith('lmlo')
  ) {
    return {
      laterality: 'Left',
      viewPosition: 'MLO',
    }
  }

  if (
    normalizedName.startsWith('mlor') ||
    normalizedName.startsWith('rmlo')
  ) {
    return {
      laterality: 'Right',
      viewPosition: 'MLO',
    }
  }

  return {
    laterality: null,
    viewPosition: null,
  }
}

export default function UploadPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = useMemo(() => createClient(), [])

  const [uploadedFiles, setUploadedFiles] = useState<
    UploadedFile[]
  >([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [removeConfirmId, setRemoveConfirmId] = useState<
    string | null
  >(null)

  useEffect(() => {
    if (
      uploadedFiles.length > 0 &&
      uploadedFiles.every(
        (file) => file.status === 'success'
      )
    ) {
      toast.success(
        `${uploadedFiles.length} file${
          uploadedFiles.length !== 1 ? 's' : ''
        } uploaded successfully!`
      )
    }
  }, [uploadedFiles])

  const uploadFileToApi = useCallback(
    async (uploadFile: UploadedFile) => {
      const caseId = Array.isArray(params.id)
        ? params.id[0]
        : params.id

      if (!caseId) {
        setUploadedFiles((previousFiles) =>
          previousFiles.map((file) =>
            file.id === uploadFile.id
              ? {
                  ...file,
                  status: 'error',
                  error: 'Case ID is missing',
                }
              : file
          )
        )

        return
      }

      const safeName = uploadFile.file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      )

      const filePath = `cases/${caseId}/${crypto.randomUUID()}-${safeName}`
      const fileType = getFileContentType(uploadFile.file)
      const { laterality, viewPosition } =
        inferMammogramView(uploadFile.file.name)

      try {
        setUploadedFiles((previousFiles) =>
          previousFiles.map((file) =>
            file.id === uploadFile.id
              ? {
                  ...file,
                  progress: 10,
                }
              : file
          )
        )

        // Upload the file directly to Storage so it does not pass through the Vercel function payload limit.
        // const { error: storageError } =
        //   await supabase.storage
        //     .from('mammograms')
        //     .upload(filePath, uploadFile.file, {
        //       contentType: fileType,
        //       upsert: false,
        //     })

        const typedFile = new File([uploadFile.file],uploadFile.file.name,{type: fileType,lastModified: uploadFile.file.lastModified,})
        const { error: storageError } = await supabase.storage.from('mammograms').upload(filePath, typedFile, {upsert: false,})

        if (storageError) {
          throw new Error(storageError.message)
        }

        setUploadedFiles((previousFiles) =>
          previousFiles.map((file) =>
            file.id === uploadFile.id
              ? {
                  ...file,
                  progress: 85,
                }
              : file
          )
        )

        // Register the uploaded file in the images table.
        const response = await fetch(
          `/api/cases/${caseId}/images`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: uploadFile.file.name,
              filePath,
              fileSize: uploadFile.file.size,
              fileType,
              laterality,
              viewPosition,
            }),
          }
        )

        const responseBody = await response
          .json()
          .catch(() => null)

        if (!response.ok) {
          // Remove the Storage file if its database record
          // could not be created.
          await supabase.storage
            .from('mammograms')
            .remove([filePath])

          const message =
            responseBody?.error?.message ||
            'Failed to save image information'

          throw new Error(message)
        }

        const image = responseBody?.data

        if (!image?.id) {
          throw new Error(
            'The server did not return an image ID'
          )
        }

        setUploadedFiles((previousFiles) =>
          previousFiles.map((file) =>
            file.id === uploadFile.id
              ? {
                  ...file,
                  progress: 100,
                  status: 'success',
                  serverImageId: image.id,
                  metadata: {
                    modality: 'MG',
                    bodyPart: 'BREAST',
                  },
                }
              : file
          )
        )
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Upload failed'

        setUploadedFiles((previousFiles) =>
          previousFiles.map((file) =>
            file.id === uploadFile.id
              ? {
                  ...file,
                  status: 'error',
                  error: message,
                }
              : file
          )
        )

        toast.error(`Upload failed: ${message}`)
      }
    },
    [params.id, supabase]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] =
        acceptedFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          status: 'uploading',
          progress: 0,
        }))

      setUploadedFiles((previousFiles) => [
        ...previousFiles,
        ...newFiles,
      ])

      newFiles.forEach((uploadFile) => {
        void uploadFileToApi(uploadFile)
      })
    },
    [uploadFileToApi]
  )

  const {
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    onDrop,
    accept: {
      'application/dicom': ['.dcm', '.dicom'],
      'image/*': [
        '.jpg',
        '.jpeg',
        '.png',
        '.tif',
        '.tiff',
      ],
    },
    multiple: true,
    maxSize: 50 * 1024 * 1024,
  })

  const removeFile = (fileId: string) => {
    setUploadedFiles((previousFiles) =>
      previousFiles.filter(
        (file) => file.id !== fileId
      )
    )
    setRemoveConfirmId(null)
  }

  const handleStartAnalysis = () => {
    setIsProcessing(true)
    router.push(`/cases/${params.id}/analysis`)
  }

  const successfulFiles = uploadedFiles.filter(
    (file) => file.status === 'success'
  )

  const hasErrors = uploadedFiles.some(
    (file) => file.status === 'error'
  )

  return (
    <div className="min-h-screen bg-gray-50">
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
                <h1 className="text-2xl font-bold text-gray-900">
                  Upload Mammograms
                </h1>
                <p className="text-gray-600">
                  Upload DICOM files for AI analysis
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload area */}
        <div className={componentStyles.card.elevated}>
          <div className="p-8">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-2xl p-12 text-center
                transition-all duration-200 cursor-pointer
                ${
                  isDragActive
                    ? 'border-bossom-pink-400 bg-bossom-pink-50'
                    : 'border-gray-300 hover:border-bossom-pink-400 hover:bg-bossom-pink-25'
                }
              `}
            >
              <input {...getInputProps()} />

              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-16 h-16 rounded-full flex items-center justify-center
                    mb-4 transition-colors
                    ${
                      isDragActive
                        ? 'bg-bossom-pink-100'
                        : 'bg-gray-100'
                    }
                  `}
                >
                  <FaUpload
                    className={`w-8 h-8 ${
                      isDragActive
                        ? 'text-bossom-pink-500'
                        : 'text-gray-400'
                    }`}
                  />
                </div>

                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {isDragActive
                    ? 'Drop files here'
                    : 'Upload Mammogram Files'}
                </h3>

                <p className="text-gray-600 mb-4">
                  Drag and drop DICOM files or click to
                  browse
                </p>

                <div className="flex flex-wrap justify-center gap-2 text-sm text-gray-500">
                  <span className="px-3 py-1 bg-gray-100 rounded-full">
                    .dcm
                  </span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full">
                    .dicom
                  </span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full">
                    .jpg
                  </span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full">
                    .png
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Uploaded files */}
        {uploadedFiles.length > 0 && (
          <div
            className={`${componentStyles.card.elevated} mt-8`}
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Uploaded Files ({uploadedFiles.length})
                </h2>

                {successfulFiles.length > 0 && (
                  <button
                    onClick={handleStartAnalysis}
                    disabled={isProcessing || hasErrors}
                    className={`${
                      componentStyles.button.primary
                    } ${
                      isProcessing || hasErrors
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <FaSpinner className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Start AI Analysis (${successfulFiles.length} files)`
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {uploadedFiles.map((uploadFile) => (
                  <div
                    key={uploadFile.id}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl"
                  >
                    <div
                      className={`
                        w-12 h-12 rounded-lg flex items-center justify-center
                        ${
                          uploadFile.status === 'success'
                            ? 'bg-green-100'
                            : uploadFile.status === 'error'
                              ? 'bg-red-100'
                              : 'bg-blue-100'
                        }
                      `}
                    >
                      {uploadFile.status === 'success' ? (
                        <FaCheck className="w-6 h-6 text-green-600" />
                      ) : uploadFile.status === 'error' ? (
                        <FaTimes className="w-6 h-6 text-red-600" />
                      ) : (
                        <FaFile className="w-6 h-6 text-blue-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {uploadFile.file.name}
                        </h3>

                        <span className="text-sm text-gray-500">
                          (
                          {(
                            uploadFile.file.size /
                            1024 /
                            1024
                          ).toFixed(1)}{' '}
                          MB)
                        </span>
                      </div>

                      {uploadFile.metadata && (
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          {uploadFile.metadata.patientName && (
                            <span>
                              Patient:{' '}
                              {
                                uploadFile.metadata
                                  .patientName
                              }
                            </span>
                          )}

                          {uploadFile.metadata.studyDate && (
                            <span>
                              Date:{' '}
                              {
                                uploadFile.metadata
                                  .studyDate
                              }
                            </span>
                          )}

                          {uploadFile.metadata.modality && (
                            <span>
                              Modality:{' '}
                              {
                                uploadFile.metadata
                                  .modality
                              }
                            </span>
                          )}

                          {uploadFile.metadata.bodyPart && (
                            <span>
                              Body Part:{' '}
                              {
                                uploadFile.metadata
                                  .bodyPart
                              }
                            </span>
                          )}
                        </div>
                      )}

                      {uploadFile.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-gray-600">
                              Uploading...
                            </span>

                            <span className="text-sm font-medium text-blue-600">
                              {Math.round(
                                uploadFile.progress
                              )}
                              %
                            </span>
                          </div>

                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                              style={{
                                width: `${uploadFile.progress}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {uploadFile.status === 'error' &&
                        uploadFile.error && (
                          <div className="mt-2 flex items-center gap-2 text-red-600">
                            <FaExclamationTriangle className="w-4 h-4" />
                            <span className="text-sm">
                              {uploadFile.error}
                            </span>
                          </div>
                        )}

                      {uploadFile.status === 'success' && (
                        <div className="mt-2 text-sm text-green-600 font-medium">
                          Upload complete - Ready for
                          analysis
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {uploadFile.status === 'success' && (
                        <button
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Preview"
                        >
                          <FaEye className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() =>
                          setRemoveConfirmId(
                            uploadFile.id
                          )
                        }
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove"
                      >
                        <FaTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {uploadedFiles.length}
                    </div>
                    <div className="text-sm text-gray-600">
                      Total Files
                    </div>
                  </div>

                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {successfulFiles.length}
                    </div>
                    <div className="text-sm text-gray-600">
                      Successfully Uploaded
                    </div>
                  </div>

                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {
                        uploadedFiles.filter(
                          (file) =>
                            file.status === 'error'
                        ).length
                      }
                    </div>
                    <div className="text-sm text-gray-600">
                      Failed
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload guidelines */}
        <div
          className={`${componentStyles.card.base} mt-8`}
        >
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Upload Guidelines
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Supported Formats
                </h4>

                <ul className="space-y-1">
                  <li>• DICOM files (.dcm, .dicom)</li>
                  <li>
                    • JPEG images (.jpg, .jpeg)
                  </li>
                  <li>• PNG images (.png)</li>
                  <li>
                    • TIFF images (.tif, .tiff)
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Requirements
                </h4>

                <ul className="space-y-1">
                  <li>• Maximum file size: 50MB</li>
                  <li>
                    • Minimum resolution: 1024x1024
                  </li>
                  <li>
                    • Bilateral mammogram views
                    preferred
                  </li>
                  <li>
                    • Clear, high-quality images
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={removeConfirmId !== null}
        title="Remove file?"
        message="This file will be removed from the upload queue."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() =>
          removeConfirmId &&
          removeFile(removeConfirmId)
        }
        onCancel={() => setRemoveConfirmId(null)}
      />
    </div>
  )
}