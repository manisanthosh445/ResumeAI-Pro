import React from 'react'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8 w-full animate-pulse">
      {/* Top Greeting & Date Widget Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div className="flex flex-col gap-2.5">
          <div className="h-4 w-24 bg-[#1e1e22] rounded-full" />
          <div className="h-9 w-64 sm:w-80 bg-[#1e1e22] rounded-md" />
          <div className="h-4 w-72 sm:w-96 bg-[#161618] rounded" />
        </div>
        <div className="card h-24 w-60 bg-[#121214] border border-[#222226] rounded-lg shrink-0" />
      </div>

      {/* 3 Metric Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 bg-[#121214] border border-[#222226] rounded-lg h-36 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-[#1e1e22] rounded" />
              <div className="h-8 w-8 bg-[#1e1e22] rounded-md" />
            </div>
            <div className="h-8 w-16 bg-[#1e1e22] rounded" />
            <div className="h-3 w-40 bg-[#161618] rounded" />
          </div>
        ))}
      </div>

      {/* Two Column Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6 bg-[#121214] border border-[#222226] rounded-lg min-h-[300px] flex flex-col gap-4">
          <div className="h-5 w-40 bg-[#1e1e22] rounded" />
          <div className="h-4 w-60 bg-[#161618] rounded" />
          <div className="space-y-3 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[#161618] rounded-md" />
            ))}
          </div>
        </div>
        <div className="card p-6 bg-[#121214] border border-[#222226] rounded-lg min-h-[300px] flex flex-col gap-4">
          <div className="h-5 w-40 bg-[#1e1e22] rounded" />
          <div className="h-4 w-60 bg-[#161618] rounded" />
          <div className="space-y-3 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[#161618] rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
