'use client'

import React, { useEffect } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

export interface ConfirmModalProps {
  isOpen: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isLoading, onCancel])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md glass rounded-[28px] p-6 sm:p-7 shadow-[var(--card-shadow)] animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              backgroundColor: 'rgba(255, 59, 48, 0.15)',
              border: '1px solid rgba(255, 59, 48, 0.40)',
              color: 'var(--brand-red)',
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] leading-snug">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="btn btn-secondary text-xs h-10 px-4"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`btn text-xs h-10 px-4 inline-flex items-center gap-1.5 ${
              isDestructive
                ? 'bg-[var(--brand-red)] hover:bg-[var(--brand-red-bright)] text-white border-0 shadow-[0_4px_16px_rgba(255,59,48,0.40)]'
                : 'btn-primary'
            }`}
          >
            {isLoading && <Loader2 size={13} className="animate-spin" />}
            <span>{isLoading ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
