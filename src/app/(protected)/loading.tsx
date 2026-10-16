export default function ProtectedLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto py-8 flex flex-col gap-6 animate-pulse">
      <div className="h-7 w-48 bg-[var(--border)] rounded-full mb-1" />
      <div className="h-4 w-72 bg-[var(--border)] rounded mb-4" />
      <div className="card h-64 p-8 flex flex-col items-center justify-center gap-4">
        <div className="w-20 h-20 rounded-full bg-[var(--border)]" />
        <div className="w-52 h-5 bg-[var(--border)] rounded" />
        <div className="w-72 h-3.5 bg-[var(--border)] rounded" />
      </div>
    </div>
  )
}
