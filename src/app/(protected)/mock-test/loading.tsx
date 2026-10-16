import React from 'react'

export default function MockTestLoading() {
  return (
    <div className="flex flex-col gap-8 w-full animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2.5">
        <div className="h-4 w-28 bg-[var(--border)] rounded-full" />
        <div className="h-9 w-64 bg-[var(--border)] rounded-xl" />
        <div className="h-4 w-96 max-w-full bg-[var(--border)] rounded" />
      </div>

      {/* Setup / Quiz Container Skeleton */}
      <div className="card p-8 rounded-3xl max-w-3xl flex flex-col gap-6">
        <div className="h-6 w-48 bg-[var(--border)] rounded" />
        <div className="h-4 w-full bg-[var(--border)] rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-[var(--bg-glass-subtle)] rounded-2xl border border-[var(--border)]" />
          ))}
        </div>
        <div className="h-11 w-44 bg-[var(--border)] rounded-full mt-2" />
      </div>
    </div>
  )
}
