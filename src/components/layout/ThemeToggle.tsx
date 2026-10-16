'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const isLight = document.documentElement.classList.contains('light')
    setTheme(isLight ? 'light' : 'dark')
  }, [])

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)

    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
      document.documentElement.setAttribute('data-theme', 'light')
      document.documentElement.style.colorScheme = 'light'
      try {
        localStorage.setItem('resumeai-theme', 'light')
      } catch {}
    } else {
      document.documentElement.classList.remove('light')
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
      document.documentElement.style.colorScheme = 'dark'
      try {
        localStorage.setItem('resumeai-theme', 'dark')
      } catch {}
    }
  }, [theme])

  return (
    <div className={`relative group flex items-center justify-center h-full ${className}`}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.08] dark:hover:bg-white/[0.08] light:hover:bg-black/[0.05] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-red)] cursor-pointer"
      >
        {mounted && theme === 'light' ? (
          <Moon
            size={18}
            strokeWidth={1.8}
            className="transition-transform duration-150 ease-out group-hover:scale-110 text-[var(--brand-red)]"
            aria-hidden="true"
          />
        ) : (
          <Sun
            size={19}
            strokeWidth={1.8}
            className="transition-transform duration-150 ease-out group-hover:scale-110 text-[var(--brand-red)]"
            aria-hidden="true"
          />
        )}
      </button>

      {/* Tooltip */}
      <div
        role="tooltip"
        className="dock-pill absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--dock-tooltip-bg)] backdrop-blur-md border border-[var(--border)] shadow-[var(--card-shadow)] whitespace-nowrap text-[0.7rem] font-semibold text-[var(--text-primary)] tracking-wide pointer-events-none"
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--brand-red)]"
          aria-hidden="true"
        />
        <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
      </div>
    </div>
  )
}

export default ThemeToggle
