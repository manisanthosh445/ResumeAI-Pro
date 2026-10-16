'use client'

import React from 'react'

interface ScoreRingProps {
  score: number // 0-100
  size?: number
  label?: string
}

export function ScoreRing({ score, size = 160, label = 'ATS Score' }: ScoreRingProps) {
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - score / 100)
  const center = size / 2

  // Score tier color matching specification (Red / White / Gray family):
  // 80+ = #FF5247 (bright red), 50-79 = #FF3B30 (brand red), < 50 = #B3141C (deep red)
  const strokeColor = score >= 80 ? 'var(--brand-red-bright)' : score >= 50 ? 'var(--brand-red)' : 'var(--brand-red-deep)'
  const shadowColor = score >= 80 ? 'rgba(255, 82, 71, 0.45)' : score >= 50 ? 'rgba(255, 59, 48, 0.40)' : 'rgba(179, 20, 28, 0.40)'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track background */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          {/* Progress fill */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              filter: `drop-shadow(0 0 8px ${shadowColor})`,
            }}
          />
        </svg>

        {/* Center score */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: '2.5rem',
              fontWeight: 900,
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            {score}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            / 100
          </span>
        </div>
      </div>

      <span
        style={{
          marginTop: '0.75rem',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export default ScoreRing
