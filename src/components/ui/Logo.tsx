import React from 'react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const iconSizes = { sm: 26, md: 32, lg: 40 }
  const textSizes = { sm: '1rem', md: '1.15rem', lg: '1.35rem' }

  const boxSize = iconSizes[size]

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.625rem', userSelect: 'none' }}>
      {/* Clean iOS geometric badge with accent indicator dot */}
      <div
        style={{
          width: boxSize,
          height: boxSize,
          borderRadius: '10px',
          background: 'var(--bg-card)',
          border: '1px solid var(--card-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
          boxShadow: 'inset 0 1px 0 var(--card-inset-highlight)',
        }}
        aria-label="ResumeAI Pro"
      >
        <span
          style={{
            width: size === 'sm' ? 8 : 10,
            height: size === 'sm' ? 8 : 10,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-red) 0%, var(--brand-red-dark) 100%)',
            boxShadow: '0 0 8px rgba(255, 59, 48, 0.70)',
          }}
        />
      </div>

      {showText && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
          <span
            style={{
              fontSize: textSizes[size],
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              lineHeight: 1.1,
            }}
          >
            RESUME
          </span>
          <span
            style={{
              fontSize: textSizes[size],
              fontWeight: 800,
              color: 'var(--brand-red)',
              lineHeight: 1.1,
            }}
          >
            AI
          </span>
        </div>
      )}
    </div>
  )
}

export default Logo
