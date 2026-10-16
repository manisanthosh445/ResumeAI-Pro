'use client'

import React, { useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  BookOpen,
  Briefcase,
  TrendingUp,
  HelpCircle,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/study', label: 'Study', icon: BookOpen },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/trending-jobs', label: 'Trends', icon: TrendingUp },
  { href: '/mock-test', label: 'Help', icon: HelpCircle },
] as const

interface SidebarProps {
  userEmail?: string | null
  userName?: string | null
}

export function Sidebar({ userEmail, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    startTransition(() => {
      router.push('/auth/login')
      router.refresh()
    })
  }

  const initial = (userName?.trim() || userEmail?.trim())
    ? (userName?.trim() || userEmail?.trim())!.charAt(0).toUpperCase()
    : 'P'

  return (
    <aside
      className="fixed left-3 sm:left-4 top-3 sm:top-4 bottom-3 sm:bottom-4 z-50 w-14 sm:w-16 bg-[#0c0c0f]/80 backdrop-blur-2xl border border-white/[0.08] rounded-[28px] sm:rounded-[36px] shadow-[0_12px_40px_rgba(0,0,0,0.55)] flex flex-col items-center justify-between py-4 sm:py-5 px-1.5 select-none"
      aria-label="Application navigation dock"
    >
      {/* 1. Top Brand Dot Indicator */}
      <div className="flex flex-col items-center">
        <Link
          href="/dashboard"
          prefetch={true}
          aria-label="ResumeAI Dashboard"
          className="w-10 h-10 rounded-2xl bg-[var(--brand-red)]/15 border border-[var(--brand-red)]/40 flex items-center justify-center hover:scale-105 transition-transform duration-150 shadow-[0_0_14px_rgba(255,59,48,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-red)]"
        >
          <span className="w-3 h-3 rounded-full bg-[var(--brand-red)] shadow-[0_0_8px_rgba(255,59,48,0.9)]" />
        </Link>
      </div>

      {/* 2. Middle Navigation Icons Stack */}
      <nav className="flex flex-col items-center gap-3 sm:gap-4 my-auto" aria-label="Main menu">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

          return (
            <div key={href} className="relative group flex items-center justify-center">
              <Link
                href={href}
                prefetch={true}
                aria-label={label}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-red)] ${
                  isActive
                    ? 'bg-[var(--brand-red)]/15 text-[var(--brand-red)] border border-[var(--brand-red)]/50 shadow-[inset_0_1px_0_var(--card-inset-highlight),0_0_16px_rgba(255,59,48,0.35)] scale-105'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] border border-transparent'
                }`}
              >
                <Icon
                  size={19}
                  strokeWidth={isActive ? 2.3 : 1.75}
                  className="transition-transform duration-150 ease-out group-hover:scale-110 shrink-0"
                  aria-hidden="true"
                />
              </Link>

              {/* Tooltip on right */}
              <div
                role="tooltip"
                className="absolute left-[calc(100%+12px)] z-50 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121216]/95 backdrop-blur-md border border-[var(--border)] shadow-[var(--card-shadow)] whitespace-nowrap text-xs font-semibold text-[var(--text-primary)] tracking-wide"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: isActive ? 'var(--brand-red)' : 'var(--text-muted)' }}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </div>
            </div>
          )
        })}
      </nav>

      {/* 3. Bottom Items: User Avatar Chip & Sign Out */}
      <div className="flex flex-col items-center gap-2.5">
        {/* User Avatar Circle */}
        <div className="relative group flex items-center justify-center">
          <div
            tabIndex={0}
            role="button"
            aria-label={`Signed in as ${userName || userEmail || 'User'}`}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--brand-red)] to-[var(--brand-red-dark)] text-white font-extrabold text-xs select-none border border-white/40 shadow-[0_0_12px_rgba(255,59,48,0.4)] flex items-center justify-center shrink-0 cursor-default"
          >
            {initial}
          </div>

          {/* User Name Tooltip on right */}
          <div
            role="tooltip"
            className="absolute left-[calc(100%+12px)] z-50 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121216]/95 backdrop-blur-md border border-[var(--border)] shadow-[var(--card-shadow)] whitespace-nowrap text-xs font-semibold text-[var(--text-primary)] tracking-wide"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-red)] shrink-0" aria-hidden="true" />
            <span>{userName || userEmail || 'User'}</span>
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="relative group flex items-center justify-center">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            aria-label="Sign Out"
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--brand-red)] hover:bg-[var(--brand-red)]/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-red)] disabled:opacity-50 cursor-pointer"
          >
            <LogOut
              size={18}
              strokeWidth={1.8}
              className="transition-transform duration-150 ease-out group-hover:scale-110"
              aria-hidden="true"
            />
          </button>

          {/* Sign Out Tooltip on right */}
          <div
            role="tooltip"
            className="absolute left-[calc(100%+12px)] z-50 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121216]/95 backdrop-blur-md border border-[var(--border)] shadow-[var(--card-shadow)] whitespace-nowrap text-xs font-semibold text-[var(--text-primary)] tracking-wide"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-red)] shrink-0" aria-hidden="true" />
            <span>Sign Out</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar

