import React from 'react'

export default function TrendingJobsLoading() {
  return (
    <div className="flex flex-col gap-8 w-full animate-pulse">
      <div className="flex flex-col gap-2.5">
        <div className="h-4 w-32 bg-[#1e1e22] rounded-full" />
        <div className="h-9 w-64 bg-[#1e1e22] rounded-md" />
        <div className="h-4 w-96 max-w-full bg-[#161618] rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card p-6 bg-[#121214] border border-[#222226] rounded-lg h-64 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-5 w-40 bg-[#1e1e22] rounded" />
              <div className="h-4 w-28 bg-[#161618] rounded" />
              <div className="h-3.5 w-full bg-[#161618] rounded" />
            </div>
            <div className="h-8 w-28 bg-[#1e1e22] rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
