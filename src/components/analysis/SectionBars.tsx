'use client'

interface SectionBarsProps {
  scores: {
    skills: number
    education: number
    experience: number
    projects: number
    formatting: number
    grammar: number
  }
}

const SECTIONS = [
  { label: 'Experience', key: 'experience' as const },
  { label: 'Skills', key: 'skills' as const },
  { label: 'Formatting', key: 'formatting' as const },
  { label: 'Education', key: 'education' as const },
  { label: 'Projects', key: 'projects' as const },
  { label: 'Grammar', key: 'grammar' as const },
]

export function SectionBars({ scores }: SectionBarsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {SECTIONS.map(({ label, key }) => {
        const score = scores[key] ?? 50
        return (
          <div key={key}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.35rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {label}
              </span>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {score}%
              </span>
            </div>

            <div
              style={{
                height: 6,
                background: 'var(--border)',
                borderRadius: '9999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${score}%`,
                  background: 'linear-gradient(90deg, var(--brand-red) 0%, var(--brand-red-dark) 100%)',
                  borderRadius: '9999px',
                  transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default SectionBars
