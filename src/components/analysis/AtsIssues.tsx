'use client'

import { AlertTriangle, AlertCircle, Info } from 'lucide-react'

interface AtsIssue {
  severity: 'high' | 'medium' | 'low'
  section: string
  issue: string
  fix: string
}

interface AtsIssuesProps {
  issues: AtsIssue[]
}

export function AtsIssues({ issues }: AtsIssuesProps) {
  if (issues.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
        }}
      >
        No critical ATS issues detected.
      </div>
    )
  }

  const sorted = [...issues].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {sorted.map((item, i) => {
        const isHigh = item.severity === 'high'
        const isMed = item.severity === 'medium'
        const Icon = isHigh ? AlertTriangle : isMed ? AlertCircle : Info

        const iconColor = isHigh ? 'var(--ios-red)' : isMed ? 'var(--ios-orange)' : 'var(--ios-blue)'
        const badgeBg = isHigh ? 'rgba(255, 69, 58, 0.15)' : isMed ? 'rgba(255, 159, 10, 0.15)' : 'rgba(10, 132, 255, 0.15)'
        const badgeBorder = isHigh ? 'rgba(255, 69, 58, 0.35)' : isMed ? 'rgba(255, 159, 10, 0.35)' : 'rgba(10, 132, 255, 0.35)'
        const badgeColor = isHigh ? 'var(--ios-red)' : isMed ? 'var(--ios-orange)' : 'var(--ios-blue)'

        return (
          <div
            key={i}
            style={{
              padding: '1rem',
              borderRadius: '16px',
              border: `1px solid ${isHigh ? 'rgba(255, 69, 58, 0.3)' : 'var(--border)'}`,
              background: isHigh ? 'rgba(255, 69, 58, 0.05)' : 'var(--bg-glass-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <Icon
                  size={16}
                  style={{ color: iconColor, flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {item.issue}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  background: badgeBg,
                  border: `1px solid ${badgeBorder}`,
                  color: badgeColor,
                  flexShrink: 0,
                }}
              >
                {item.severity}
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Recommended Fix:</strong> {item.fix}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default AtsIssues
