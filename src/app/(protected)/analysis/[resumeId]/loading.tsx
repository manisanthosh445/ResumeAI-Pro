import React from 'react'

export default function AnalysisLoading() {
  return (
    <div className="flex flex-col gap-8 w-full animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <div className="h-4 w-28 bg-[#1e1e22] rounded-full" />
          <div className="h-9 w-64 bg-[#1e1e22] rounded-md" />
          <div className="h-4 w-80 bg-[#161618] rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-[#1e1e22] rounded-md" />
          <div className="h-10 w-28 bg-[#1e1e22] rounded-md" />
        </div>
      </div>

      {/* Top Grid: Score Ring + Summary Skeleton */}
      <div className="card grid grid-cols-1 md:grid-cols-3 gap-6 p-6 items-center">
        <div className="flex justify-center items-center">
          <div className="w-40 h-40 rounded-full bg-white/[0.06]" />
        </div>
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="space-y-2">
            <div className="h-3.5 w-32 bg-white/[0.08] rounded-full" />
            <div className="h-4 w-full bg-white/[0.04] rounded-full" />
            <div className="h-4 w-3/4 bg-white/[0.04] rounded-full" />
          </div>
          <div className="space-y-2 mt-2">
            <div className="h-3.5 w-32 bg-white/[0.08] rounded-full" />
            <div className="h-4 w-full bg-white/[0.04] rounded-full" />
            <div className="h-4 w-4/5 bg-white/[0.04] rounded-full" />
          </div>
        </div>
      </div>

      {/* 2 Strengths & Improvements Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 h-48 space-y-3">
          <div className="h-5 w-36 bg-white/[0.08] rounded-full" />
          <div className="h-4 w-full bg-white/[0.04] rounded-full" />
          <div className="h-4 w-5/6 bg-white/[0.04] rounded-full" />
          <div className="h-4 w-4/6 bg-white/[0.04] rounded-full" />
        </div>
        <div className="card p-6 h-48 space-y-3">
          <div className="h-5 w-36 bg-white/[0.08] rounded-full" />
          <div className="h-4 w-full bg-white/[0.04] rounded-full" />
          <div className="h-4 w-5/6 bg-white/[0.04] rounded-full" />
          <div className="h-4 w-4/6 bg-white/[0.04] rounded-full" />
        </div>
      </div>

      {/* Section Breakdown Skeleton */}
      <div className="card p-6 space-y-4">
        <div className="h-5 w-44 bg-white/[0.08] rounded-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-7 bg-white/[0.04] rounded-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
