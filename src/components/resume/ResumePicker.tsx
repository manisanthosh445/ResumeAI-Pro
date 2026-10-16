'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { FileText, Pencil, Check, Upload, ChevronDown, Trash2 } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

export interface ResumePickerItem {
  id: string
  file_name: string
  created_at?: string
  uploaded_at?: string
  score?: number | null
}

export interface ResumePickerProps {
  resumes: ResumePickerItem[]
  selectedId: string
  onSelect: (id: string) => void
  onUploadNew?: () => void
  action?: React.ReactNode
  onDeleteResume?: (id: string) => void
  className?: string
}

export function ResumePicker({
  resumes,
  selectedId,
  onSelect,
  onUploadNew,
  action,
  onDeleteResume,
  className = '',
}: ResumePickerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [deleteTarget, setDeleteTarget] = useState<ResumePickerItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Sort newest first
  const sortedResumes = React.useMemo(() => {
    return [...resumes].sort((a, b) => {
      const dateA = new Date(a.uploaded_at || a.created_at || 0).getTime()
      const dateB = new Date(b.uploaded_at || b.created_at || 0).getTime()
      return dateB - dateA
    })
  }, [resumes])

  const selectedResume = sortedResumes.find((r) => r.id === selectedId) || sortedResumes[0]

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  // Reset focus when opening
  useEffect(() => {
    if (isOpen) {
      const idx = sortedResumes.findIndex((r) => r.id === selectedResume?.id)
      setFocusedIndex(idx >= 0 ? idx : 0)
    }
  }, [isOpen, sortedResumes, selectedResume])

  const handleSelectResume = useCallback(
    (id: string) => {
      onSelect(id)
      setIsOpen(false)
      try {
        const params = new URLSearchParams(searchParams?.toString() || '')
        params.set('resume', id)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      } catch {
        // ignore navigation errors
      }
    },
    [onSelect, searchParams, pathname, router]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((prev) => (prev < sortedResumes.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : sortedResumes.length - 1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < sortedResumes.length) {
          handleSelectResume(sortedResumes[focusedIndex].id)
        }
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]')
      const targetItem = items[focusedIndex] as HTMLElement
      if (targetItem) {
        targetItem.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [focusedIndex, isOpen])

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/resumes/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete resume.')
      }

      const deletedId = deleteTarget.id
      const remaining = sortedResumes.filter((r) => r.id !== deletedId)

      if (onDeleteResume) {
        onDeleteResume(deletedId)
      }

      // If we deleted the active resume, switch to the newest remaining one
      if (selectedResume?.id === deletedId) {
        if (remaining.length > 0) {
          const nextResume = remaining[0]
          onSelect(nextResume.id)
          try {
            const params = new URLSearchParams(searchParams?.toString() || '')
            params.set('resume', nextResume.id)
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
          } catch {
            // ignore
          }
        } else {
          onSelect('')
          try {
            const params = new URLSearchParams(searchParams?.toString() || '')
            params.delete('resume')
            const q = params.toString()
            router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
          } catch {
            // ignore
          }
        }
      }

      setDeleteTarget(null)
      setIsDeleting(false)
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting resume.'
      setDeleteError(msg)
      setIsDeleting(false)
    }
  }

  // Empty state if user has no resumes
  if (!resumes || resumes.length === 0) {
    return (
      <div
        className={`card flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-dashed border-[var(--border)] gap-4 w-full ${className}`}
        style={{ minHeight: '74px' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[var(--bg-glass-subtle)] border border-[var(--border)] flex items-center justify-center text-[var(--brand-red)] shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">No resumes uploaded</h4>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Upload a resume to unlock analysis, study guides, and mock tests.
            </p>
          </div>
        </div>
        <Link
          href="/upload"
          prefetch={true}
          className="btn btn-primary h-11 px-5 inline-flex items-center justify-center gap-2 shrink-0 text-xs font-bold"
        >
          <Upload size={15} />
          <span>Upload Resume</span>
        </Link>
      </div>
    )
  }

  const rawDate = selectedResume?.uploaded_at || selectedResume?.created_at
  const formattedDate = rawDate
    ? new Date(rawDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently uploaded'

  const scoreVal = selectedResume?.score

  return (
    <>
      <div
        ref={containerRef}
        className={`relative w-full ${className}`}
        onKeyDown={handleKeyDown}
      >
        {/* Full-width Bar Layout (stacked on mobile, row on lg, gap-4, p-4) */}
        <div
          className="card flex flex-col lg:flex-row lg:items-center lg:justify-between p-4 sm:p-5 gap-4 transition-all duration-200 w-full"
          style={{
            borderColor: isOpen ? 'var(--brand-red)' : undefined,
          }}
        >
          {/* Left: Document icon + file name + upload date + score pill */}
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-[var(--bg-glass-subtle)] border border-[var(--border)] flex items-center justify-center text-[var(--brand-red)] shrink-0 shadow-[inset_1px_1px_0_var(--card-inset-highlight)]">
              <FileText size={22} />
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="font-bold text-[var(--text-primary)] text-sm sm:text-base truncate block"
                title={selectedResume?.file_name}
              >
                {selectedResume?.file_name}
              </span>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-[var(--text-muted)]">
                  Uploaded {formattedDate}
                </span>

                <span className="text-[var(--text-muted)] opacity-40 text-xs">•</span>

                {/* Score Pill */}
                {scoreVal !== null && scoreVal !== undefined ? (
                  <span
                    className={
                      scoreVal >= 80
                        ? 'score-badge score-badge-high'
                        : scoreVal >= 50
                        ? 'score-badge score-badge-mid'
                        : 'score-badge score-badge-low'
                    }
                  >
                    {scoreVal}/100
                  </span>
                ) : (
                  <span className="score-badge score-badge-none">
                    Unanalyzed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Button group - Change Resume (outlined) + Primary Action */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              className="btn btn-secondary h-11 px-5 text-xs font-semibold inline-flex items-center justify-center gap-2 flex-1 sm:flex-initial transition-all duration-150"
              style={{
                borderColor: isOpen ? 'var(--brand-red)' : undefined,
                color: 'var(--text-primary)',
              }}
            >
              <Pencil size={14} className="text-[var(--brand-red)]" />
              <span>Change resume</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 text-[var(--text-muted)] ${
                  isOpen ? 'rotate-180 text-[var(--brand-red)]' : ''
                }`}
              />
            </button>

            {action && <div className="flex-1 sm:flex-initial [&>button]:h-11 [&>button]:w-full [&>button]:sm:w-auto [&>a]:h-11 [&>a]:w-full [&>a]:sm:w-auto">{action}</div>}
          </div>
        </div>

        {/* Dropdown Panel under the bar (full width, high z-index, liquid glass bg, shadow) */}
        {isOpen && (
          <div
            ref={listRef}
            role="listbox"
            aria-label="Select resume"
            className="absolute left-0 right-0 top-full mt-2 z-50 glass rounded-[24px] overflow-hidden shadow-[var(--card-shadow)] animate-in fade-in zoom-in-95 duration-150 bg-[var(--dock-tooltip-bg)]"
          >
            <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)] bg-[var(--bg-glass-subtle)]">
              <span className="font-bold uppercase tracking-wider text-[0.65rem] text-[var(--text-secondary)]">
                Your Resumes ({sortedResumes.length})
              </span>
              <span className="text-[0.68rem] text-[var(--text-muted)]">Sorted newest first</span>
            </div>

            {/* List of resumes */}
            <div className="max-h-[320px] overflow-y-auto divide-y divide-[var(--border)]">
              {sortedResumes.map((resume, idx) => {
                const isSelected = resume.id === selectedResume?.id
                const isFocused = idx === focusedIndex
                const itemDate = resume.uploaded_at || resume.created_at
                const itemFormattedDate = itemDate
                  ? new Date(itemDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Recent'

                const itemScoreClass =
                  resume.score !== null && resume.score !== undefined
                    ? resume.score >= 80
                      ? 'score-badge score-badge-high'
                      : resume.score >= 50
                      ? 'score-badge score-badge-mid'
                      : 'score-badge score-badge-low'
                    : 'score-badge score-badge-none'

                return (
                  <div
                    key={resume.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectResume(resume.id)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--bg-card-hover)] border-l-4 border-l-[var(--brand-red)]'
                        : isFocused
                        ? 'bg-[var(--bg-glass-subtle)]'
                        : 'hover:bg-[var(--bg-glass-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 mr-3 flex-1">
                      <FileText
                        size={18}
                        className={isSelected ? 'text-[var(--brand-red)] shrink-0' : 'text-[var(--text-muted)] shrink-0'}
                      />
                      <div className="flex flex-col min-w-0">
                        <span
                          className={`text-sm font-semibold truncate ${
                            isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {resume.file_name}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] mt-0.5">
                          Uploaded {itemFormattedDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Score pill */}
                      {resume.score !== null && resume.score !== undefined ? (
                        <span className={itemScoreClass}>
                          {resume.score}/100
                        </span>
                      ) : (
                        <span className="score-badge score-badge-none">
                          —
                        </span>
                      )}

                      {/* Check icon for selected */}
                      {isSelected ? (
                        <div
                          className="w-5 h-5 rounded-full bg-[var(--brand-red)] flex items-center justify-center text-white shrink-0"
                        >
                          <Check size={12} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-5 h-5 shrink-0" />
                      )}

                      {/* Trash button to delete resume */}
                      <button
                        type="button"
                        aria-label={`Delete ${resume.file_name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(resume)
                        }}
                        className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--brand-red)] hover:bg-[var(--brand-red)]/10 transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Upload new resume row */}
            <div className="border-t border-[var(--border)] p-2 bg-[var(--bg-glass-subtle)]">
              {onUploadNew ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    onUploadNew()
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-[var(--brand-red)] hover:bg-white/[0.08] dark:hover:bg-white/[0.08] light:hover:bg-black/[0.05] rounded-xl transition-colors cursor-pointer"
                >
                  <Upload size={14} />
                  <span>Upload new resume</span>
                </button>
              ) : (
                <Link
                  href="/upload"
                  prefetch={true}
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-[var(--brand-red)] hover:bg-white/[0.08] dark:hover:bg-white/[0.08] light:hover:bg-black/[0.05] rounded-xl transition-colors cursor-pointer"
                >
                  <Upload size={14} />
                  <span>Upload new resume</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Resume"
        description={
          deleteError
            ? `Error: ${deleteError}`
            : `Are you sure you want to delete "${deleteTarget?.file_name}"? This action cannot be undone and will permanently remove all associated analyses, study guides, and mock test scores.`
        }
        confirmText="Delete Resume"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      />
    </>
  )
}

export default ResumePicker
