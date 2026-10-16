'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import { RecentResumeRow, ResumeItem } from './RecentResumeRow'

interface RecentResumesListProps {
  initialResumes: ResumeItem[]
}

export function RecentResumesList({ initialResumes }: RecentResumesListProps) {
  const router = useRouter()
  const [resumes, setResumes] = useState<ResumeItem[]>(initialResumes)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  // Keep state in sync if server props update (e.g. after router.refresh())
  useEffect(() => {
    setResumes(initialResumes)
  }, [initialResumes])

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 3500)
  }, [])

  const handleDeleted = useCallback((deletedId: string) => {
    // 1. Remove the row from the list immediately
    setResumes((prev) => prev.filter((r) => r.id !== deletedId))

    // 2. Show toast
    showToast('Resume deleted', 'success')

    // 3. Call router.refresh() to update server-rendered overview stats
    router.refresh()
  }, [router, showToast])

  const handleError = useCallback((errorMessage: string) => {
    showToast(errorMessage, 'error')
  }, [showToast])

  return (
    <div className="w-full">
      {/* Toast Notification positioned safely above bottom dock */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-4 sm:right-6 glass px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-[var(--text-primary)] shadow-[var(--card-shadow)] z-[99999] animate-in fade-in slide-in-from-bottom-2 duration-150"
          style={{
            borderColor: toast.type === 'success' ? 'rgba(48, 209, 88, 0.4)' : 'rgba(255, 69, 58, 0.4)',
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="text-[var(--ios-green)] shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-[var(--ios-red)] shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Resumes List or Empty State */}
      {resumes.length > 0 ? (
        <div className="flex flex-col gap-3 w-full">
          {resumes.map((r) => (
            <RecentResumeRow
              key={r.id}
              resume={r}
              onDeleted={handleDeleted}
              onError={handleError}
            />
          ))}
        </div>
      ) : (
        <div
          className="card text-center p-8 sm:p-12 border-dashed border-[var(--card-border)] flex flex-col items-center justify-center w-full"
        >
          <p
            className="text-[var(--text-secondary)] text-sm mb-4"
          >
            No resumes yet
          </p>
          <Link href="/upload" prefetch={true} className="btn btn-primary">
            <Upload size={16} />
            <span>Upload Resume</span>
          </Link>
        </div>
      )}
    </div>
  )
}

export default RecentResumesList
