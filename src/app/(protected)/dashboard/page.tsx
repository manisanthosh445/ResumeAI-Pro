import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Upload,
  BookOpen,
  Briefcase,
  HelpCircle,
  ArrowRight,
  AlertCircle,
  Award,
  CheckCircle2,
  FileText,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import DashboardGreeting from '@/components/DashboardGreeting'
import { RecentResumesList } from '@/components/dashboard/RecentResumesList'
import { TrendingCourses } from '@/components/dashboard/TrendingCourses'

// Force dynamic server rendering on every request with zero cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Authenticate user on server, redirect immediately if missing
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  let firstName = 'there'
  let queryError: string | null = null
  let resumes: Array<{ id: string; file_name: string; uploaded_at: string; score?: number | null }> = []
  let latestScore: number | null = null
  let totalUploadedCount = 0
  let latestMockAttempt: { score: number; total: number; percentage: number; created_at: string } | null = null

  try {
    // 2. Fetch profile, total resume count, recent resumes, and latest mock test attempt in parallel
    const [
      { data: profile, error: profileError },
      { count: resumeCount, error: countError },
      { data: resumeData, error: resumesError },
      { data: mockAttemptData, error: mockError },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('resumes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('resumes')
        .select('id, file_name, uploaded_at')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(5),
      supabase
        .from('mock_test_attempts')
        .select('score, total, total_questions, percentage, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  if (profileError) {
      console.error('[DASHBOARD] Profile fetch error:', {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
      })
    } else if (profile?.full_name?.trim()) {
      firstName = profile.full_name.trim().split(/\s+/)[0]
    }

    if (countError) {
      console.error('[DASHBOARD] Resumes count query error:', {
        message: countError.message,
        code: countError.code,
        details: countError.details,
        hint: countError.hint,
      })
      queryError = countError.message || 'Error fetching total resumes count'
    } else {
      totalUploadedCount = resumeCount ?? 0
    }

    if (mockError) {
      console.error('[DASHBOARD] Mock test attempt query error:', {
        message: mockError.message,
        code: mockError.code,
        details: mockError.details,
        hint: mockError.hint,
      })
      latestMockAttempt = null
    } else if (mockAttemptData) {
      const totalCount = Number(mockAttemptData.total_questions ?? mockAttemptData.total ?? 10)
      const scoreCount = Number(mockAttemptData.score ?? 0)
      const pct = mockAttemptData.percentage !== undefined && mockAttemptData.percentage !== null
        ? Number(mockAttemptData.percentage)
        : (totalCount > 0 ? Math.round((scoreCount / totalCount) * 100) : 0)

      latestMockAttempt = {
        score: scoreCount,
        total: totalCount,
        percentage: pct,
        created_at: mockAttemptData.created_at,
      }
    }

    if (resumesError) {
      console.error('[DASHBOARD] Resumes list query error:', {
        message: resumesError.message,
        code: resumesError.code,
        details: resumesError.details,
        hint: resumesError.hint,
      })
      queryError = queryError || resumesError.message || 'Error fetching resumes'
    } else if (resumeData && resumeData.length > 0) {
      // 3. Query latest analyses for these resumes
      const resumeIds = resumeData.map((r) => r.id)
      const { data: analyses, error: analysesError } = await supabase
        .from('analyses')
        .select('resume_id, overall_score, created_at')
        .in('resume_id', resumeIds)
        .order('created_at', { ascending: false })

      if (analysesError) {
        console.error('[DASHBOARD] Analyses query error:', {
          message: analysesError.message,
          code: analysesError.code,
          details: analysesError.details,
          hint: analysesError.hint,
        })
        queryError = queryError || analysesError.message || 'Error fetching analysis scores'
      }

      const scoreMap = new Map<string, number>()
      analyses?.forEach((a) => {
        if (!scoreMap.has(a.resume_id)) {
          scoreMap.set(a.resume_id, a.overall_score)
        }
      })

      resumes = resumeData.map((r) => ({
        id: r.id,
        file_name: r.file_name,
        uploaded_at: r.uploaded_at,
        score: scoreMap.get(r.id) ?? null,
      }))

      latestScore = resumes[0]?.score ?? null
      if (latestScore === null) {
        const anyScoreResume = resumes.find((r) => r.score !== null && r.score !== undefined)
        if (anyScoreResume) {
          latestScore = anyScoreResume.score ?? null
        }
      }
    }
  } catch (err) {
    console.error('[DASHBOARD] Unexpected server error fetching dashboard data:', err)
    queryError = err instanceof Error ? err.message : 'Failed to load dashboard data.'
  }

  const features = [
    {
      href: '/upload',
      title: 'Analyze Resume',
      desc: 'Upload a resume (PDF, DOCX, TXT, or Image) for ATS scoring, strengths, and targeted improvement areas.',
      icon: Upload,
      buttonText: 'Upload Resume',
    },
    {
      href: '/study',
      title: 'Study Resources',
      desc: 'Explore curated learning topics, concepts to master, and recommended resource platforms based on your resume.',
      icon: BookOpen,
      buttonText: 'View Study Guide',
    },
    {
      href: '/jobs',
      title: 'Job Recommendations',
      desc: 'Discover entry-level and junior job roles matching your resume, with skill gap analysis and direct job board search links.',
      icon: Briefcase,
      buttonText: 'Find Job Matches',
    },
    {
      href: '/mock-test',
      title: 'Interview Mock Test',
      desc: latestMockAttempt
        ? `Last Score: ${latestMockAttempt.score}/${latestMockAttempt.total} (${latestMockAttempt.percentage}%). Take an AI-generated multiple-choice technical test tailored to your resume skills.`
        : 'Take an AI-generated multiple-choice technical test tailored to your resume skills with weak topic analysis.',
      icon: HelpCircle,
      buttonText: 'Start Mock Test',
      badge: latestMockAttempt ? `${latestMockAttempt.percentage}% Last Score` : undefined,
    },
  ]

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* 1. PageHeader with greeting & live date card */}
      <DashboardGreeting name={firstName} />

      {/* Query Error Alert if database fetch fails */}
      {queryError && (
        <div className="flex items-center gap-2.5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-[var(--ios-red)] text-xs font-medium">
          <AlertCircle size={16} className="shrink-0" />
          <span>Notice: {queryError}</span>
        </div>
      )}

      {/* 2. Quick Overview Cards: 4 equal cards in grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Latest Resume Score */}
        <div className="card p-6 flex flex-col justify-between">
          <span className="text-[0.72rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            LATEST RESUME SCORE
          </span>
          <div className="flex items-baseline gap-1.5 mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] leading-none">
              {latestScore !== null ? `${latestScore}` : '—'}
            </span>
            {latestScore !== null && (
              <span className="text-xs text-[var(--text-muted)]">/ 100</span>
            )}
          </div>
        </div>

        {/* Mock Test Last Score */}
        <div className="card p-6 flex flex-col justify-between">
          <span className="text-[0.72rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            MOCK TEST LAST SCORE
          </span>
          <div className="flex items-baseline gap-1.5 mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] leading-none">
              {latestMockAttempt !== null ? `${latestMockAttempt.percentage}%` : '—'}
            </span>
            {latestMockAttempt !== null && (
              <span className="text-xs text-[var(--text-muted)]">
                ({latestMockAttempt.score}/{latestMockAttempt.total})
              </span>
            )}
          </div>
        </div>

        {/* Uploaded Resumes */}
        <div className="card p-6 flex flex-col justify-between">
          <span className="text-[0.72rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            UPLOADED RESUMES
          </span>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] leading-none">
              {totalUploadedCount}
            </span>
          </div>
        </div>

        {/* ATS Target Benchmark Card */}
        <div className="card p-6 flex flex-col justify-between">
          <span className="text-[0.72rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            ATS TARGET BENCHMARK
          </span>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] leading-none">
              85+
            </span>
            <span className="text-xs text-[var(--brand-red)] font-semibold tracking-wide">
              Top 10% Goal
            </span>
          </div>
        </div>
      </div>

      {/* 3. Section: Trending Courses */}
      <TrendingCourses />

      {/* 4. Section: Core Tools */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)] m-0">
          Core Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {features.map((feat) => {
            const Icon = feat.icon
            return (
              <div
                key={feat.title}
                className="card p-6 flex flex-col justify-between hover:border-[var(--brand-red)]/45 transition-all duration-200"
              >
                <div className="flex flex-col flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-[var(--bg-glass-subtle)] border border-[var(--border)] flex items-center justify-center text-[var(--brand-red)] mb-4 shadow-[inset_1px_1px_0_var(--card-inset-highlight)]">
                    <Icon size={20} />
                  </div>
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <h3 className="text-base font-bold text-[var(--text-primary)] m-0 truncate">
                      {feat.title}
                    </h3>
                    {feat.badge && (
                      <span className="text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full bg-[var(--brand-red)]/15 border border-[var(--brand-red)]/35 text-[var(--brand-red)] whitespace-nowrap shadow-[inset_0_1px_0_var(--card-inset-highlight)] shrink-0">
                        {feat.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-6 flex-1">
                    {feat.desc}
                  </p>
                </div>
                <div className="mt-auto pt-2">
                  <Link
                    href={feat.href}
                    prefetch={true}
                    className="btn btn-primary h-11 w-full inline-flex items-center justify-center gap-2 text-xs font-bold"
                  >
                    <span>{feat.buttonText}</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 5. Section: Recent Resumes List */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)] m-0">
          Recent Resumes
        </h2>
        <RecentResumesList initialResumes={resumes} />
      </div>
    </div>
  )
}
