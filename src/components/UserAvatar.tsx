import React from 'react'

export interface UserAvatarProps {
  email?: string | null
  size?: number
  className?: string
}

export function UserAvatar({ email, size = 40, className = '' }: UserAvatarProps) {
  const initial = email?.trim() ? email.trim().charAt(0).toUpperCase() : 'U'
  const fontSize = Math.max(12, Math.round(size * 0.4))

  return (
    <div
      className={className}
      aria-label={`User avatar ${initial}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--brand-red) 0%, var(--brand-red-dark) 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: `${fontSize}px`,
        lineHeight: 1,
        userSelect: 'none',
        border: '1.5px solid rgba(255, 255, 255, 0.25)',
        boxShadow: '0 0 12px rgba(255, 59, 48, 0.40)',
        flexShrink: 0,
      }}
    >
      <span>{initial}</span>
    </div>
  )
}

export default UserAvatar
