'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, RotateCcw, Trash2, Loader2 } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface AnalysisHeaderActionsProps {
  resumeId: string
  fileName?: string
}

export function AnalysisHeaderActions({ resumeId, fileName = 'resume' }: AnalysisHeaderActionsProps) {
  const router = useRouter()
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const handleReAnalyze = async () => {
    setIsRegenerating(true)
    setErrorMessage(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, regenerate: true }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to re-analyze resume.')
      }

      if (data.saved === false) {
        try {
          sessionStorage.setItem(`unsaved_analysis_${resumeId}`, JSON.stringify(data))
        } catch {}
      } else {
        try {
          sessionStorage.removeItem(`unsaved_analysis_${resumeId}`)
        } catch {}
      }

      setShowRegenConfirm(false)
      setIsRegenerating(false)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error re-analyzing'
      setErrorMessage(msg)
      setIsRegenerating(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete resume.')
      }

      setShowDeleteConfirm(false)
      setIsDeleting(false)
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error deleting resume'
      setErrorMessage(msg)
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        {/* Back to dashboard */}
        <Link
          href="/dashboard"
          prefetch={true}
          className="btn btn-secondary h-10 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5"
          title="Back to dashboard"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </Link>

        {/* Download report (PDF) */}
        <button
          type="button"
          onClick={handlePrint}
          className="btn btn-secondary h-10 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          title="Print or Save PDF report"
        >
          <Download size={14} />
          <span>Download report (PDF)</span>
        </button>

        {/* Re-analyze */}
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null)
            setShowRegenConfirm(true)
          }}
          disabled={isRegenerating}
          className="btn btn-secondary h-10 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          title="Run fresh ATS analysis on this resume"
        >
          {isRegenerating ? (
            <Loader2 size={14} className="animate-spin text-[var(--brand-red)]" />
          ) : (
            <RotateCcw size={14} className="text-[var(--brand-red)]" />
          )}
          <span>Re-analyze</span>
        </button>

        {/* Delete resume */}
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null)
            setShowDeleteConfirm(true)
          }}
          disabled={isDeleting}
          aria-label="Delete resume"
          className="btn btn-secondary h-10 px-3 text-xs font-semibold inline-flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--ios-red)] hover:border-[var(--ios-red)]/40 hover:bg-red-500/10 transition-colors cursor-pointer"
          title="Delete resume"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>

      {errorMessage && (
        <div className="w-full text-right text-xs text-[var(--ios-red)] mt-1 font-medium">
          {errorMessage}
        </div>
      )}

      {/* Confirmation Dialog for Re-analyze */}
      <ConfirmModal
        isOpen={showRegenConfirm}
        title="Re-analyze Resume"
        description="Are you sure you want to run a new analysis? This will generate fresh ATS scores and suggestions, replacing previous findings."
        confirmText="Re-analyze"
        cancelText="Cancel"
        isDestructive={false}
        isLoading={isRegenerating}
        onConfirm={handleReAnalyze}
        onCancel={() => {
          if (!isRegenerating) setShowRegenConfirm(false)
        }}
      />

      {/* Confirmation Dialog for Delete */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Resume"
        description={`Are you sure you want to delete "${fileName}"? This will permanently erase this resume and its analysis.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!isDeleting) setShowDeleteConfirm(false)
        }}
      />
    </>
  )
}

export default AnalysisHeaderActions
