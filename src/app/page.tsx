import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { Upload, BookOpen, HelpCircle, ArrowRight } from 'lucide-react'
import { isSupabaseConfigured } from '@/lib/supabase/is-configured'

export default async function HomePage() {
  if (isSupabaseConfigured()) {
    const { getCachedUser } = await import('@/lib/supabase/server')
    const { redirect } = await import('next/navigation')
    const user = await getCachedUser()
    if (user) redirect('/dashboard')
  }

  const features = [
    {
      icon: Upload,
      title: 'Resume Analysis',
      desc: 'Upload PDF, DOCX, TXT, or images. Get an accurate 0–100 ATS readiness score, summary, key strengths, and concrete areas to improve.',
    },
    {
      icon: BookOpen,
      title: 'Study Resources',
      desc: 'Bridge resume skill gaps with tailored concepts to study, organized learning order, and verified resource queries for official documentation and freeCodeCamp.',
    },
    {
      icon: HelpCircle,
      title: 'Interview Mock Test',
      desc: 'Generate interactive 10-question technical multiple-choice assessments from your resume skills with selectable difficulty and weak-area diagnosis.',
    },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col">
      {/* Navigation */}
      <nav
        className="w-full border-b border-[var(--border)] glass sticky top-0 z-50 rounded-none border-t-0 border-x-0"
      >
        <div className="w-full max-w-7xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <Link href="/auth/login" prefetch={true} className="btn btn-ghost text-xs">
              Sign In
            </Link>
            <Link href="/auth/signup" prefetch={true} className="btn btn-primary text-xs">
              Create Account
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Landing Content Container */}
      <main className="w-full max-w-7xl mx-auto px-6 md:px-10 pt-12 pb-40 flex-1 flex flex-col items-center">
        {/* Hero Section */}
        <section className="py-10 sm:py-16 text-center w-full max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--brand-red)]/15 border border-[var(--brand-red)]/35 text-[0.75rem] font-bold text-[var(--brand-red)] mb-6 uppercase tracking-wider shadow-[inset_0_1px_0_var(--card-inset-highlight)]">
            Powered by Google Gemini
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-[var(--text-primary)] mb-5">
            Elevate your resume.{' '}
            <span className="bg-gradient-to-r from-[var(--brand-red)] to-[var(--brand-red-bright)] bg-clip-text text-transparent">
              Ace your interview.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed max-w-2xl mx-auto mb-8">
            Instant ATS compatibility scoring, structured study roadmaps, and adaptive technical mock tests generated directly from your experience.
          </p>

          <div className="flex justify-center gap-4 flex-wrap">
            <Link href="/auth/signup" prefetch={true} className="btn btn-primary text-sm h-11 px-6">
              <span>Create Account</span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/auth/login" prefetch={true} className="btn btn-secondary text-sm h-11 px-6">
              <span>Sign In</span>
            </Link>
          </div>
        </section>

        {/* 3 Core Features */}
        <section className="w-full pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feat) => {
              const Icon = feat.icon
              return (
                <div
                  key={feat.title}
                  className="card p-7 flex flex-col justify-between hover:border-[var(--brand-red)]/45 transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[var(--bg-glass-subtle)] border border-[var(--border)] flex items-center justify-center text-[var(--brand-red)] mb-5 shadow-[inset_1px_1px_0_var(--card-inset-highlight)]">
                    <Icon size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[var(--border)] py-8 text-center text-xs text-[var(--text-muted)] w-full">
        <div className="w-full max-w-7xl mx-auto px-6 md:px-10">
          <p>&copy; {new Date().getFullYear()} ResumeAI Pro. Built with Next.js, Supabase, and Google Gemini.</p>
        </div>
      </footer>
    </div>
  )
}

