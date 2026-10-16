'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Loader2 } from 'lucide-react'

interface ReAnalyzeButtonProps {
  resumeId: string
}

export function ReAnalyzeButton({ resumeId }: ReAnalyzeButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRegenerate = async () => {
    if (!resumeId || loading) return
    setLoading(true)
    setError(null)

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

      router.refresh()
    } catch (err) {
      console.error('Re-analysis failed:', err)
      setError(err instanceof Error ? err.message : 'Error re-analyzing')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={loading}
        className="btn btn-secondary"
        style={{
          fontSize: '0.8rem',
          gap: '0.4rem',
          padding: '0.45rem 0.85rem',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
        title="Force Gemini to re-analyze this resume and overwrite previous score"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent-red)' }} />
            <span>Regenerating Analysis…</span>
          </>
        ) : (
          <>
            <RotateCcw size={14} style={{ color: 'var(--accent-red)' }} />
            <span>Regenerate Analysis</span>
          </>
        )}
      </button>
      {error && (
        <span style={{ fontSize: '0.7rem', color: 'var(--accent-red)' }}>
          {error}
        </span>
      )}
    </div>
  )
}
