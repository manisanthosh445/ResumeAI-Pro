import { createClient, getCachedUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import type { ValidatedAnalysis } from '@/lib/analysis-prompt'
import { PageHeader } from '@/components/layout/PageHeader'
import { AnalysisHeaderActions } from '@/components/analysis/AnalysisHeaderActions'
import { UnsavedAnalysisFallback } from '@/components/analysis/UnsavedAnalysisFallback'

const ScoreRing = dynamic(() => import('@/components/analysis/ScoreRing').then((m) => m.ScoreRing), { ssr: true })
const SectionBars = dynamic(() => import('@/components/analysis/SectionBars').then((m) => m.SectionBars), { ssr: true })
const AtsIssues = dynamic(() => import('@/components/analysis/AtsIssues').then((m) => m.AtsIssues), { ssr: true })
const FeedbackCards = dynamic(() => import('@/components/analysis/FeedbackCards').then((m) => m.FeedbackCards), { ssr: true })

interface PageProps {
  params: Promise<{ resumeId: string }>
}

export default async function AnalysisPage({ params }: PageProps) {
  const { resumeId } = await params
  const supabase = await createClient()

  let user = null
  let resume: { id: string; file_name: string; uploaded_at: string } | null = null
  let analysis: {
    overall_score: number
    section_scores: unknown
    ats_issues: unknown
    feedback: unknown
    created_at: string
  } | null = null
  let queryError: string | null = null

  try {
    user = await getCachedUser()

    const [resumeRes, analysisRes] = await Promise.all([
      supabase
        .from('resumes')
        .select('id, file_name, uploaded_at')
        .eq('id', resumeId)
        .maybeSingle(),
      supabase
        .from('analyses')
        .select('overall_score, section_scores, ats_issues, feedback, created_at')
        .eq('resume_id', resumeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (resumeRes.error) {
      console.error('[ANALYSIS] Resume fetch error:', {
        message: resumeRes.error.message,
        code: resumeRes.error.code,
      })
      queryError = resumeRes.error.message
    } else {
      resume = resumeRes.data
    }

    if (analysisRes.error) {
      console.error('[ANALYSIS] Analysis fetch error:', {
        message: analysisRes.error.message,
        code: analysisRes.error.code,
      })
    } else {
      analysis = analysisRes.data
    }
  } catch (err) {
    console.error('[ANALYSIS] Unexpected error loading analysis:', err)
    queryError = err instanceof Error ? err.message : 'Failed to load analysis'
  }

  if (!user || (!resume && !queryError)) notFound()

  const fileName = resume?.file_name || 'Resume'
  const uploadedDate = resume?.uploaded_at
    ? new Date(resume.uploaded_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently uploaded'

  const hasAnalysis = Boolean(analysis)

  const sectionScoresData = (analysis?.section_scores ?? {}) as Record<string, unknown>
  const summary = (sectionScoresData.summary as string) || 'Executive evaluation of candidate qualifications and resume ATS compatibility.'
  const scoreRationale = (sectionScoresData.score_rationale as string) || 'Score computed from weighted sections: experience, skills, formatting, and education.'
  const strengths = (sectionScoresData.strengths as string[]) || []
  const areasForImprovement = (sectionScoresData.areas_for_improvement as string[]) || []

  const typedAnalysis = hasAnalysis
    ? {
        overall_score: analysis!.overall_score,
        section_scores: analysis!.section_scores as ValidatedAnalysis['section_scores'],
        ats_issues: (analysis!.ats_issues ?? []) as ValidatedAnalysis['ats_issues'],
        feedback: (analysis!.feedback ?? []) as ValidatedAnalysis['feedback'],
      }
    : null

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* 1. Universal PageHeader with Actions on Right */}
      <PageHeader
        badge="ATS AUDIT"
        title={fileName}
        subtitle={`Uploaded on ${uploadedDate} · Comprehensive ATS compatibility audit and tailored recruiter feedback`}
        actions={
          <AnalysisHeaderActions
            resumeId={resumeId}
            fileName={fileName}
          />
        }
      />

      {queryError && (
        <div className="flex items-center gap-2.5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-[var(--ios-red)] text-xs">
          <AlertCircle size={16} className="shrink-0" />
          <span>Error loading data: {queryError}</span>
        </div>
      )}

      {typedAnalysis ? (
        <div className="flex flex-col gap-8 w-full">
          {/* Top Grid: Overall Score Ring + Summary & Explanation */}
          <div className="card grid grid-cols-1 md:grid-cols-3 gap-6 p-6 items-center">
            <div className="flex justify-center items-center">
              <ScoreRing score={typedAnalysis.overall_score} size={165} />
            </div>

            <div className="md:col-span-2 flex flex-col gap-4">
              <div>
                <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--ios-blue)] block mb-1">
                  Score Explanation
                </span>
                <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                  {scoreRationale}
                </p>
              </div>

              <div>
                <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                  Profile Summary
                </span>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                  {summary}
                </p>
              </div>
            </div>
          </div>

          {/* Strengths & Areas to Improve Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="card p-6 sm:p-7 flex flex-col justify-between hover:border-[var(--ios-green)]/35 transition-all">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--ios-green)]/15 border border-[var(--ios-green)]/30 flex items-center justify-center text-[var(--ios-green)] shrink-0 shadow-[inset_1px_1px_0_var(--card-inset-highlight)]">
                    <CheckCircle2 size={16} />
                  </div>
                  <h2 className="text-base font-bold text-[var(--text-primary)] m-0">Key Strengths</h2>
                </div>
                {strengths.length > 0 ? (
                  <ul className="flex flex-col gap-2.5 pl-0 mt-3 list-none">
                    {strengths.map((item, i) => (
                      <li key={i} className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed flex items-start gap-2">
                        <span className="text-[var(--ios-green)] font-bold text-base leading-none">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    Clear technical background with relevant experience documented.
                  </p>
                )}
              </div>
            </div>

            {/* Areas for Improvement */}
            <div className="card p-6 sm:p-7 flex flex-col justify-between hover:border-[var(--ios-orange)]/35 transition-all">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--ios-orange)]/15 border border-[var(--ios-orange)]/30 flex items-center justify-center text-[var(--ios-orange)] shrink-0 shadow-[inset_1px_1px_0_var(--card-inset-highlight)]">
                    <AlertTriangle size={16} />
                  </div>
                  <h2 className="text-base font-bold text-[var(--text-primary)] m-0">Areas to Improve</h2>
                </div>
                {areasForImprovement.length > 0 ? (
                  <ul className="flex flex-col gap-2.5 pl-0 mt-3 list-none">
                    {areasForImprovement.map((item, i) => (
                      <li key={i} className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed flex items-start gap-2">
                        <span className="text-[var(--ios-orange)] font-bold text-base leading-none">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    Quantify achievements with business metrics and align keywords with job descriptions.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section Score Breakdown */}
          <div className="card p-6">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">
              Section Breakdown
            </h2>
            <SectionBars scores={typedAnalysis.section_scores} />
          </div>

          {/* ATS Issues */}
          {typedAnalysis.ats_issues.length > 0 && (
            <div className="card p-6">
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">
                ATS Compatibility Issues
              </h2>
              <AtsIssues issues={typedAnalysis.ats_issues} />
            </div>
          )}

          {/* Detailed Section Feedback */}
          {typedAnalysis.feedback.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Section-wise Recommendations
              </h2>
              <FeedbackCards feedback={typedAnalysis.feedback} />
            </div>
          )}
        </div>
      ) : (
        <UnsavedAnalysisFallback resumeId={resumeId} />
      )}
    </div>
  )
}
