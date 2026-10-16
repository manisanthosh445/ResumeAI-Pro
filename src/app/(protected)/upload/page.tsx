'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { PageHeader } from '@/components/layout/PageHeader'

const FilePreview = dynamic(
  () => import('@/components/upload/FilePreview').then((m) => m.FilePreview),
  { ssr: false }
)

type UploadState = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error'

interface UploadedFile {
  name: string
  size: number
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function parseResponseJson<T>(res: Response, fallbackDesc: string): Promise<T> {
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    if (res.status === 413) {
      throw new Error('Upload rejected: file exceeds the server 5 MB limit (HTTP 413). Please upload a smaller file.')
    }
    if (res.status === 504) {
      throw new Error('The request timed out (HTTP 504 Gateway Timeout). Please try again.')
    }
    if (res.status === 502) {
      throw new Error('The AI analysis service is temporarily unavailable (HTTP 502). Please try again in a moment.')
    }
    throw new Error(`${fallbackDesc}: server returned HTTP ${res.status} ${res.statusText || 'Error'}.`)
  }
  try {
    return (await res.json()) as T
  } catch {
    throw new Error(`${fallbackDesc}: unable to parse response (HTTP ${res.status}).`)
  }
}

export default function UploadPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [file, setFile] = useState<UploadedFile | null>(null)
  const [rawFile, setRawFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback((f: File) => {
    const allowedExtensions = /\.(pdf|docx|txt|png|jpe?g|webp|bmp|tiff?)$/i

    if (!allowedExtensions.test(f.name)) {
      setError('Unsupported file format. Please upload a PDF, DOCX, TXT, PNG, JPG, JPEG, WEBP, BMP, or TIFF file.')
      return
    }

    if (f.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum allowed size is 5 MB.')
      return
    }

    setError(null)
    setFile({ name: f.name, size: f.size })
    setRawFile(f)
  }, [])

  const handleRemoveFile = useCallback(() => {
    setFile(null)
    setRawFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  async function handleAnalyze() {
    if (!rawFile || state === 'uploading' || state === 'analyzing') return

    setError(null)
    setState('uploading')
    setProgress('Extracting text and verifying document…')

    const formData = new FormData()
    formData.append('file', rawFile)

    let resumeId: string

    try {
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await parseResponseJson<{ resumeId?: string; error?: string }>(
        uploadRes,
        'Upload failed'
      )

      if (!uploadRes.ok || !uploadData.resumeId) {
        throw new Error(uploadData.error ?? `Upload failed (HTTP ${uploadRes.status}).`)
      }
      resumeId = uploadData.resumeId
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Upload failed.')
      return
    }

    setState('analyzing')
    setProgress('Analyzing with Gemini AI… (evaluating ATS score & recommendations)')

    try {
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId }),
      })
      const analyzeData = await parseResponseJson<{
        success?: boolean
        saved?: boolean
        warning?: string
        analysisId?: string
        error?: string
        overall_score?: number
        section_scores?: Record<string, unknown>
        feedback?: unknown[]
        ats_issues?: unknown[]
      }>(
        analyzeRes,
        'Analysis failed'
      )

      if (!analyzeRes.ok || (!analyzeData.analysisId && analyzeData.saved !== false)) {
        throw new Error(analyzeData.error ?? `Analysis failed (HTTP ${analyzeRes.status}).`)
      }

      if (analyzeData.saved === false) {
        try {
          sessionStorage.setItem(`unsaved_analysis_${resumeId}`, JSON.stringify(analyzeData))
        } catch {
          // Ignore storage failures
        }
      }

      setState('done')
      router.push(`/analysis/${resumeId}`)
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
    }
  }

  const isIdle = state === 'idle' || state === 'error'

  return (
    <div className="flex flex-col gap-8 w-full">
      <PageHeader
        badge="ATS OPTIMIZATION"
        title="Analyze Resume"
        subtitle="Upload your resume in PDF, DOCX, TXT, or Image format for instant ATS scoring and actionable recruiter feedback."
      />

      <div className="w-full flex flex-col gap-4">
        {error && (
          <div className="flex items-center justify-between gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-[var(--ios-red)] text-xs font-medium flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
            {file && isIdle && (
              <button
                type="button"
                onClick={handleAnalyze}
                className="btn btn-secondary h-8 px-3 text-xs"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* Upload & Preview Box */}
        <div
          className="card min-h-[60vh] w-full rounded-[28px] flex flex-col"
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            padding: 0,
            border: `2px dashed ${
              dragging
                ? 'var(--brand-red)'
                : rawFile
                ? 'rgba(255, 59, 48, 0.45)'
                : 'var(--border)'
            }`,
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            transition: 'border-color 0.2s ease',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />

          {!rawFile ? (
            <div
              onClick={() => isIdle && inputRef.current?.click()}
              style={{
                width: '100%',
                minHeight: '60vh',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isIdle ? 'pointer' : 'default',
                padding: '2rem 1.25rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--bg-glass-subtle)',
                  border: '1px solid var(--border)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-red)',
                  marginBottom: '1rem',
                  boxShadow: 'inset 0 1px 0 var(--card-inset-highlight)',
                }}
              >
                <Upload size={24} />
              </div>

              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                {dragging ? 'Drop file here' : 'Click to select or drag and drop'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                PDF, DOCX, TXT, PNG, JPG, JPEG, WEBP, BMP, or TIFF (up to 5 MB)
              </p>
            </div>
          ) : (
            <FilePreview
              file={rawFile}
              isBusy={!isIdle}
              onChangeFile={() => isIdle && inputRef.current?.click()}
              onRemoveFile={handleRemoveFile}
            />
          )}
        </div>

        {/* Processing State */}
        {(state === 'uploading' || state === 'analyzing') && (
          <div
            className="card flex items-center gap-3 p-4 mb-4"
          >
            <Loader2 size={18} className="animate-spin text-[var(--ios-blue)]" />
            <span className="text-sm text-[var(--text-primary)] font-medium">
              {progress}
            </span>
          </div>
        )}

        {/* Submit Button */}
        {file && isIdle && (
          <button
            onClick={handleAnalyze}
            disabled={!isIdle}
            className="btn btn-primary h-11 w-full text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Run Resume Analysis</span>
          </button>
        )}
      </div>
    </div>
  )
}
