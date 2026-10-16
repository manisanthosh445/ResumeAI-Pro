'use client'

import { useState, memo } from 'react'
import Link from 'next/link'
import { FileText, Trash2 } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

export interface ResumeItem {
  id: string
  file_name: string
  uploaded_at: string
  score?: number | null
}

interface RecentResumeRowProps {
  resume: ResumeItem
  onDeleted: (id: string) => void
  onError?: (msg: string) => void
}

export const RecentResumeRow = memo(function RecentResumeRow({
  resume,
  onDeleted,
  onError,
}: RecentResumeRowProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleDelete() {
    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const res = await fetch(`/api/resumes/${resume.id}`, {
        method: 'DELETE',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const errorText = data?.error || 'Failed to delete resume.'
        setErrorMessage(errorText)
        if (onError) onError(errorText)
        setIsDeleting(false)
        return
      }

      // Successful delete
      setShowConfirm(false)
      setIsDeleting(false)
      onDeleted(resume.id)
    } catch (err: unknown) {
      const errorText =
        err instanceof Error ? err.message : 'Network error deleting resume.'
      setErrorMessage(errorText)
      if (onError) onError(errorText)
      setIsDeleting(false)
    }
  }

  const dateObj = new Date(resume.uploaded_at)
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const formattedTime = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const formattedDateTime = `${formattedDate} · ${formattedTime}`

  const scoreBadgeClass =
    resume.score !== null && resume.score !== undefined
      ? resume.score >= 80
        ? 'score-badge score-badge-high'
        : resume.score >= 50
        ? 'score-badge score-badge-mid'
        : 'score-badge score-badge-low'
      : 'score-badge score-badge-none'

  return (
    <>
      <div className="card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all duration-200 hover:border-[var(--brand-red)]/45 w-full">
        {/* Left: Document icon + File Name + Upload Date & Time */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-2xl bg-[var(--bg-glass-subtle)] border border-[var(--border)] flex items-center justify-center text-[var(--brand-red)] shrink-0 shadow-[inset_1px_1px_0_var(--card-inset-highlight)]">
            <FileText size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h4
              title={resume.file_name}
              className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate block m-0"
            >
              {resume.file_name}
            </h4>
            <span className="text-xs text-[var(--text-muted)] mt-0.5 block truncate">
              Uploaded {formattedDateTime}
            </span>
          </div>
        </div>

        {/* Right: Badge in fixed-width slot, 12px gap, then pill buttons */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap shrink-0 justify-start sm:justify-end">
          {/* Fixed-width vertically centered score badge slot with 12px gap */}
          <div className="w-[96px] shrink-0 flex items-center justify-center mr-3">
            <span className={`${scoreBadgeClass} w-full text-center justify-center`}>
              {resume.score !== null && resume.score !== undefined ? `${resume.score}/100` : 'Unanalyzed'}
            </span>
          </div>

          {/* Action pill buttons + circular delete icon */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Link
              href={`/analysis/${resume.id}`}
              prefetch={true}
              className="btn btn-secondary h-8 px-3 text-xs font-semibold whitespace-nowrap inline-flex items-center justify-center"
            >
              Analysis
            </Link>
            <Link
              href={`/study?resume=${resume.id}`}
              prefetch={true}
              className="btn btn-secondary h-8 px-3 text-xs font-semibold whitespace-nowrap inline-flex items-center justify-center"
            >
              Study
            </Link>
            <Link
              href={`/jobs?resume=${resume.id}`}
              prefetch={true}
              className="btn btn-secondary h-8 px-3 text-xs font-semibold whitespace-nowrap inline-flex items-center justify-center"
            >
              Jobs
            </Link>
            <Link
              href={`/mock-test?resume=${resume.id}`}
              prefetch={true}
              className="btn btn-secondary h-8 px-3 text-xs font-semibold whitespace-nowrap inline-flex items-center justify-center"
            >
              Mock Test
            </Link>

            {/* Delete Icon Button (Circular centered Trash2 icon with aria-label) */}
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null)
                setShowConfirm(true)
              }}
              title="Delete resume"
              aria-label={`Delete resume ${resume.file_name}`}
              className="btn-icon btn-secondary text-[var(--text-muted)] hover:text-[var(--brand-red)] hover:border-[var(--brand-red)]/40 hover:bg-[var(--brand-red)]/10 transition-colors cursor-pointer"
            >
              <Trash2 size={14} className="shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        title="Delete Resume"
        description={
          errorMessage
            ? `Error: ${errorMessage}`
            : `Are you sure you want to delete "${resume.file_name}"? This will permanently erase the resume and all associated analyses, study guides, and test scores.`
        }
        confirmText="Delete Resume"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!isDeleting) {
            setShowConfirm(false)
            setErrorMessage(null)
          }
        }}
      />
    </>
  )
})

export default RecentResumeRow
