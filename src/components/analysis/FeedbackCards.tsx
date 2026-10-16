'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Suggestion {
  section: string
  original: string
  rewritten: string
  rationale: string
}

interface FeedbackSection {
  section: string
  score: number
  summary: string
  suggestions: Suggestion[]
}

interface FeedbackCardsProps {
  feedback: FeedbackSection[]
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  return (
    <div
      style={{
        borderRadius: '14px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        background: 'var(--bg-glass-subtle)',
      }}
    >
      {suggestion.original && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255, 69, 58, 0.04)',
          }}
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ios-red)', display: 'block', marginBottom: '0.25rem' }}>
            Original
          </span>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {suggestion.original}
          </p>
        </div>
      )}

      {suggestion.rewritten && (
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'rgba(48, 209, 88, 0.04)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ios-green)', display: 'block', marginBottom: '0.25rem' }}>
            Suggested Rewrite
          </span>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
            {suggestion.rewritten}
          </p>
        </div>
      )}

      {suggestion.rationale && (
        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-glass-subtle)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Why this works:</strong> {suggestion.rationale}
          </p>
        </div>
      )}
    </div>
  )
}

function SectionCard({ section }: { section: FeedbackSection }) {
  const [expanded, setExpanded] = useState(true)

  const scoreBadgeClass =
    section.score >= 80
      ? 'score-badge score-badge-high'
      : section.score >= 50
      ? 'score-badge score-badge-mid'
      : 'score-badge score-badge-low'

  return (
    <div
      style={{
        borderRadius: '20px',
        border: '1px solid var(--card-border)',
        background: 'var(--bg-card)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>
            {section.section}
          </span>
          <span className={scoreBadgeClass}>
            {section.score}%
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '0.75rem' }}>
            {section.suggestions.length} {section.suggestions.length === 1 ? 'tip' : 'tips'}
          </span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border)' }}>
          {section.summary && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '1rem 0' }}>
              {section.summary}
            </p>
          )}

          {section.suggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {section.suggestions.map((s, i) => (
                <SuggestionCard key={i} suggestion={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function FeedbackCards({ feedback }: FeedbackCardsProps) {
  if (feedback.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {feedback.map((f, i) => (
        <SectionCard key={i} section={f} />
      ))}
    </div>
  )
}

export default FeedbackCards
