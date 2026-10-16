'use client'

import React from 'react'

export interface PageHeaderProps {
  badge?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  badge,
  title,
  subtitle,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6 w-full ${className}`}>
      <div className="flex-1 min-w-0 w-full">
        {badge && (
          <div className="mb-2.5">
            <span className="inline-flex items-center text-[0.68rem] font-bold tracking-wider px-3 py-0.5 rounded-full text-[var(--brand-red)] uppercase border border-[var(--brand-red)]/30 bg-[var(--brand-red)]/10 shadow-[inset_0_1px_0_var(--card-inset-highlight)]">
              {badge}
            </span>
          </div>
        )}
        <h1 className="page-title text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] m-0">
          {title}
        </h1>
        {subtitle && (
          <p className="page-subtitle text-xs sm:text-sm text-[var(--text-secondary)] mt-2 leading-relaxed max-w-3xl">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="mt-2 lg:mt-0 flex flex-wrap items-center gap-3 shrink-0 self-start">
          {actions}
        </div>
      )}
    </div>
  )
}

export default PageHeader
