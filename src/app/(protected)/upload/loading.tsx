import React from 'react'

export default function UploadLoading() {
  return (
    <div className="flex flex-col gap-8 w-full animate-pulse">
      <div className="flex flex-col gap-2.5">
        <div className="h-4 w-32 bg-[#1e1e22] rounded-full" />
        <div className="h-9 w-64 bg-[#1e1e22] rounded-md" />
        <div className="h-4 w-96 max-w-full bg-[#161618] rounded" />
      </div>
      <div className="card p-12 bg-[#121214] border border-[#222226] rounded-[28px] w-full min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#1e1e22]" />
        <div className="h-5 w-48 bg-[#1e1e22] rounded" />
        <div className="h-4 w-64 bg-[#161618] rounded" />
      </div>
    </div>
  )
}
