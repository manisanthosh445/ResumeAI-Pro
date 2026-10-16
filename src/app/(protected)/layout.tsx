import { Sidebar } from '@/components/layout/Sidebar'
import { isSupabaseConfigured } from '@/lib/supabase/is-configured'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let userName: string | null = null
  let userEmail: string | null = null

  if (isSupabaseConfigured()) {
    const { getCachedUser, getCachedProfile } = await import('@/lib/supabase/server')
    const { redirect } = await import('next/navigation')
    const user = await getCachedUser()
    if (!user) {
      redirect('/auth/login')
      return null
    }

    userEmail = user.email ?? null
    const profile = await getCachedProfile(user.id)
    userName = profile?.full_name ?? null
  }

  return (
    <div className="app-layout-container">
      <Sidebar userEmail={userEmail} userName={userName} />
      <main className="app-main-content">
        <div className="w-full max-w-[1440px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

