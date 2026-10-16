'use client'

import React, { useState, useEffect, memo } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'

interface DashboardGreetingProps {
  name: string
}

function getGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 21) return 'Good evening'
  return 'Good night'
}

/**
 * Isolated live clock component.
 * Only this component re-renders on the clock tick, preventing DashboardGreeting
 * and the rest of the tree from re-rendering.
 */
const LiveDateBadge = memo(function LiveDateBadge() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  useEffect(() => {
    setCurrentTime(new Date())
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  if (!currentTime) {
    return (
      <div
        className="glass shrink-0 h-[88px] w-[210px] rounded-[24px]"
        aria-hidden="true"
      />
    )
  }

  const weekday = currentTime
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toUpperCase()
  const dayNumber = currentTime.toLocaleDateString('en-US', { day: 'numeric' })
  const month = currentTime.toLocaleDateString('en-US', { month: 'long' })
  const year = currentTime.toLocaleDateString('en-US', { year: 'numeric' })
  const monthYear = `${month} ${year}`

  const timeStr = currentTime
    .toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .toUpperCase()

  return (
    <div className="glass shrink-0 flex items-center gap-4 py-3 px-5 rounded-[24px]">
      <span
        className="text-5xl md:text-6xl font-black text-[var(--text-primary)] leading-none tracking-tight"
        style={{
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {dayNumber}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[var(--brand-red)] text-xs font-extrabold tracking-wider uppercase leading-tight">
          {weekday}
        </span>
        <span className="text-[var(--text-secondary)] text-xs font-medium leading-tight">
          {monthYear}
        </span>
        <div className="inline-flex items-center gap-1.5 mt-0.5 text-[0.7rem] font-medium text-[var(--text-primary)] leading-tight">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-red)] shrink-0 shadow-[0_0_8px_rgba(255,59,48,0.7)]" />
          <span>{timeStr}</span>
        </div>
      </div>
    </div>
  )
})

export const DashboardGreeting = memo(function DashboardGreeting({ name }: DashboardGreetingProps) {
  const greeting = getGreeting(new Date())
  const displayName = name?.trim() ? name.trim() : 'there'

  return (
    <PageHeader
      badge="OVERVIEW"
      title={
        <>
          {greeting},{' '}
          <span className="text-[var(--brand-red)]">{displayName}</span>
        </>
      }
      subtitle="Your central hub for resume optimization, job matching, and technical interview prep."
      actions={<LiveDateBadge />}
    />
  )
})

export default DashboardGreeting
