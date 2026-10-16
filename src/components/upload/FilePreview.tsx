'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FileText, X, Loader2, Maximize2, Upload } from 'lucide-react'

interface FilePreviewProps {
  file: File
  isBusy: boolean
  onChangeFile: () => void
  onRemoveFile: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getFileType(fileName: string): 'image' | 'pdf' | 'txt' | 'docx' | 'unsupported' {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'txt') return 'txt'
  if (ext === 'docx') return 'docx'
  return 'unsupported'
}

export function FilePreview({
  file,
  isBusy,
  onChangeFile,
  onRemoveFile,
}: FilePreviewProps) {
  const fileType = getFileType(file.name)
  const extBadge = file.name.split('.').pop()?.toUpperCase() || 'FILE'

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [txtContent, setTxtContent] = useState<string | null>(null)
  const [docxHtml, setDocxHtml] = useState<string | null>(null)
  const [docxLoading, setDocxLoading] = useState(false)
  const [docxError, setDocxError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Manage blob URL for Images and PDFs with proper revokeObjectURL cleanup
  useEffect(() => {
    if (fileType === 'image' || fileType === 'pdf') {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => {
        URL.revokeObjectURL(url)
      }
    } else {
      setPreviewUrl(null)
    }
  }, [file, fileType])

  // Read text for TXT files
  useEffect(() => {
    let active = true
    if (fileType === 'txt') {
      file.text()
        .then((text) => {
          if (active) setTxtContent(text)
        })
        .catch(() => {
          if (active) setTxtContent('Unable to read text file.')
        })
    } else {
      setTxtContent(null)
    }
    return () => {
      active = false
    }
  }, [file, fileType])

  // Convert DOCX with mammoth and sanitize with DOMPurify
  useEffect(() => {
    let active = true
    if (fileType === 'docx') {
      setDocxLoading(true)
      setDocxError(null)

      Promise.all([
        import('mammoth'),
        import('dompurify'),
        file.arrayBuffer(),
      ])
        .then(([mammothModule, domPurifyModule, arrayBuffer]) => {
          const mammoth = mammothModule.default || mammothModule
          const DOMPurify = domPurifyModule.default || domPurifyModule
          return (mammoth as { convertToHtml: (arg: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> })
            .convertToHtml({ arrayBuffer })
            .then((result) => ({
              result,
              DOMPurify,
            }))
        })
        .then(({ result, DOMPurify }) => {
          if (active) {
            const sanitized = (DOMPurify as { sanitize: (s: string) => string }).sanitize(result.value)
            setDocxHtml(sanitized || '<p style="color:#666">Empty document</p>')
          }
        })
        .catch((err) => {
          if (active) {
            setDocxError('Preview not available for this format. You can still analyze it.')
          }
        })
        .finally(() => {
          if (active) setDocxLoading(false)
        })
    } else {
      setDocxHtml(null)
      setDocxLoading(false)
      setDocxError(null)
    }

    return () => {
      active = false
    }
  }, [file, fileType])

  // Close modal on Escape key
  useEffect(() => {
    if (!isModalOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen])

  // Prevent background scroll while modal is open
  useEffect(() => {
    if (isModalOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isModalOpen])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Slim Header Bar inside the upload box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-[#161618] border-b border-[var(--border)] z-10 shrink-0">
        {/* Left: Type badge, file name (truncated), size */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              backgroundColor: 'rgba(225, 29, 46, 0.15)',
              border: '1px solid rgba(225, 29, 46, 0.35)',
              color: 'var(--accent-red)',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            {extBadge}
          </span>
          <span
            title={file.name}
            className="text-xs sm:text-sm font-semibold text-white truncate min-w-0"
          >
            {file.name}
          </span>
          <span className="text-[0.7rem] sm:text-xs text-[var(--text-muted)] shrink-0">
            ({formatSize(file.size)})
          </span>
        </div>

        {/* Right: View full size, Change File & Remove Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsModalOpen(true)
            }}
            disabled={isBusy}
            title="View full size"
            aria-label="View full size"
            className="btn btn-secondary text-xs p-1.5 sm:px-2.5 sm:py-1 inline-flex items-center gap-1"
            style={{
              opacity: isBusy ? 0.5 : 1,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            <Maximize2 size={13} />
            <span className="hidden sm:inline">View full size</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChangeFile()
            }}
            disabled={isBusy}
            title="Change file"
            aria-label="Change file"
            className="btn btn-secondary text-xs p-1.5 sm:px-2.5 sm:py-1 inline-flex items-center gap-1"
            style={{
              opacity: isBusy ? 0.5 : 1,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            <Upload size={13} />
            <span className="hidden sm:inline">Change file</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveFile()
            }}
            disabled={isBusy}
            title="Remove file"
            aria-label="Remove file"
            className="btn btn-secondary p-1.5 sm:px-2 sm:py-1 text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:border-[rgba(225,29,46,0.4)] inline-flex items-center justify-center"
            style={{
              opacity: isBusy ? 0.5 : 1,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Preview Content Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#0c0c0e',
        }}
      >
        {/* 1. Image Preview */}
        {fileType === 'image' && previewUrl && (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem',
              overflow: 'hidden',
            }}
          >
            <img
              src={previewUrl}
              alt={file.name}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '4px',
              }}
            />
          </div>
        )}

        {/* 2. PDF Preview */}
        {fileType === 'pdf' && previewUrl && (
          <iframe
            src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
            title={file.name}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: '#0c0c0e',
            }}
          />
        )}

        {/* 3. TXT Preview */}
        {fileType === 'txt' && (
          <div
            style={{
              width: '100%',
              height: '100%',
              padding: '0.5rem',
              boxSizing: 'border-box',
              display: 'flex',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#ffffff',
                color: '#18181b',
                padding: '0.65rem 0.85rem',
                borderRadius: '4px',
                overflowY: 'auto',
                overflowX: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.75rem',
                  lineHeight: 1.45,
                  color: '#18181b',
                  margin: 0,
                }}
              >
                {txtContent ?? 'Loading text preview…'}
              </pre>
            </div>
          </div>
        )}

        {/* 4. DOCX Preview */}
        {fileType === 'docx' && (
          <div
            style={{
              width: '100%',
              height: '100%',
              padding: '0.5rem',
              boxSizing: 'border-box',
              display: 'flex',
            }}
          >
            {docxLoading ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  color: 'var(--text-secondary)',
                  padding: '1rem',
                }}
              >
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-red)' }} />
                <span style={{ fontSize: '0.75rem' }}>Converting document preview…</span>
              </div>
            ) : docxError || !docxHtml ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '8px',
                    backgroundColor: '#18181b',
                    border: '1px solid var(--border)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-red)',
                    marginBottom: '0.5rem',
                  }}
                >
                  <FileText size={20} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  Preview not available for this format.
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  You can still analyze it below.
                </p>
              </div>
            ) : (
              <div
                className="w-full h-full bg-white text-[#18181b] p-2.5 sm:p-3 rounded overflow-y-auto overflow-x-hidden text-xs leading-normal shadow-md break-words [&_*]:text-xs [&_p]:mb-1 [&_p]:leading-normal [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-semibold [&_table]:text-xs [&_table]:max-w-full"
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            )}
          </div>
        )}

        {/* 5. Unsupported / Fallback Card (TIFF, etc.) */}
        {fileType === 'unsupported' && (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '8px',
                backgroundColor: '#18181b',
                border: '1px solid var(--border)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-red)',
                marginBottom: '0.5rem',
              }}
            >
              <FileText size={22} />
            </div>
            <h4
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#ffffff',
                marginBottom: '0.2rem',
                wordBreak: 'break-all',
                maxWidth: '300px',
              }}
            >
              {file.name}
            </h4>
            <p
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              {formatSize(file.size)} • {extBadge}
            </p>
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border)',
                padding: '0.25rem 0.65rem',
                borderRadius: '4px',
              }}
            >
              Preview not available for this format. You can still analyze it.
            </div>
          </div>
        )}
      </div>

      {/* Full Size Modal */}
      {mounted &&
        isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsModalOpen(false)
              }
            }}
          >
            <div
              className="w-[90vw] h-[90vh] max-w-6xl max-h-[90vh] bg-[#121212] border border-[var(--border)] rounded-lg flex flex-col overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#161618] border-b border-[var(--border)] shrink-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(225, 29, 46, 0.15)',
                      border: '1px solid rgba(225, 29, 46, 0.35)',
                      color: 'var(--accent-red)',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    {extBadge}
                  </span>
                  <span
                    title={file.name}
                    className="text-sm font-semibold text-white truncate min-w-0"
                  >
                    {file.name}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] shrink-0">
                    ({formatSize(file.size)})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  title="Close (Esc)"
                  aria-label="Close full size view"
                  className="btn btn-secondary p-1.5 text-[var(--text-muted)] hover:text-white inline-flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 min-h-0 overflow-hidden relative bg-[#0c0c0e]">
                {/* 1. Image */}
                {fileType === 'image' && previewUrl && (
                  <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="max-w-full max-h-full object-contain rounded shadow-lg"
                    />
                  </div>
                )}

                {/* 2. PDF */}
                {fileType === 'pdf' && previewUrl && (
                  <iframe
                    src={`${previewUrl}#toolbar=1`}
                    title={`${file.name} - Full Preview`}
                    className="w-full h-full border-none bg-[#1f1f23]"
                  />
                )}

                {/* 3. TXT */}
                {fileType === 'txt' && (
                  <div className="w-full h-full p-4 sm:p-6 overflow-y-auto flex justify-center bg-[#0c0c0e]">
                    <div className="bg-white text-[#18181b] p-6 sm:p-8 rounded-md max-w-4xl w-full min-h-full shadow-2xl text-xs sm:text-sm leading-relaxed overflow-x-hidden">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs sm:text-sm text-[#18181b] m-0">
                        {txtContent ?? 'Loading text preview…'}
                      </pre>
                    </div>
                  </div>
                )}

                {/* 4. DOCX */}
                {fileType === 'docx' && (
                  <div className="w-full h-full p-4 sm:p-6 overflow-y-auto flex justify-center bg-[#0c0c0e]">
                    {docxLoading ? (
                      <div className="flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)] h-full">
                        <Loader2 size={24} className="animate-spin text-[var(--accent-red)]" />
                        <span className="text-sm">Converting document preview…</span>
                      </div>
                    ) : docxError || !docxHtml ? (
                      <div className="flex flex-col items-center justify-center text-center h-full">
                        <p className="text-sm text-[var(--text-secondary)]">Preview not available for this format.</p>
                      </div>
                    ) : (
                      <div
                        className="bg-white text-[#18181b] p-6 sm:p-8 rounded-md max-w-4xl w-full min-h-full shadow-2xl text-xs sm:text-sm leading-relaxed overflow-x-hidden break-words"
                        dangerouslySetInnerHTML={{ __html: docxHtml }}
                      />
                    )}
                  </div>
                )}

                {/* 5. Unsupported */}
                {fileType === 'unsupported' && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 rounded-xl bg-[#18181b] border border-[var(--border)] inline-flex items-center justify-center text-[var(--accent-red)] mb-4">
                      <FileText size={32} />
                    </div>
                    <h4 className="text-base font-semibold text-white mb-1 break-all max-w-md">
                      {file.name}
                    </h4>
                    <p className="text-sm text-[var(--text-muted)] mb-3">
                      {formatSize(file.size)} • {extBadge}
                    </p>
                    <div className="text-xs text-[var(--text-secondary)] bg-white/5 border border-[var(--border)] px-3 py-1.5 rounded">
                      Preview not available for this format. You can still analyze it.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default FilePreview
