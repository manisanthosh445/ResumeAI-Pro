'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react'
import { ScoreRing } from '@/components/analysis/ScoreRing'
import { SectionBars } from '@/components/analysis/SectionBars'
import { AtsIssues } from '@/components/analysis/AtsIssues'
import { FeedbackCards } from '@/components/analysis/FeedbackCards'
import type { ValidatedAnalysis } from '@/lib/analysis-prompt'

interface UnsavedAnalysisFallbackProps {
  resumeId: string
}

export function UnsavedAnalysisFallback({ resumeId }: UnsavedAnalysisFallbackProps) {
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<ValidatedAnalysis | null>(null)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = sessionStorage.getItem(`unsaved_analysis_${resumeId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed.overall_score === 'number') {
          setData(parsed)
        }
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [resumeId])

  if (!mounted) {
    return (
      <div className="card p-10 text-center flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-[var(--text-secondary)]">Loading resume analysis…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="card p-10 text-center flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          This resume has not been analyzed yet.
        </p>
        <Link
          href="/upload"
          className="btn btn-primary h-11 px-5 inline-flex items-center justify-center text-xs font-bold"
        >
          Analyze Resume Now
        </Link>
      </div>
    )
  }

  const sectionScores = (data.section_scores || {}) as ValidatedAnalysis['section_scores']
  const summary = data.summary || 'Executive evaluation of candidate qualifications and resume ATS compatibility.'
  const scoreRationale = data.score_rationale || 'Score computed from weighted sections: experience, skills, formatting, and education.'
  const strengths = data.strengths || []
  const areasForImprovement = data.areas_for_improvement || []
  const atsIssues = data.ats_issues || []
  const feedback = data.feedback || []

  return (
    <div className="flex flex-col gap-8">
      {/* Clear Warning Banner for Unsaved Analysis */}
      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs sm:text-sm font-medium">
        <AlertTriangle size={18} className="shrink-0 text-amber-400 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-amber-200">Unsaved Analysis (Temporary Preview)</span>
          <span className="text-amber-300/80 text-xs leading-relaxed">
            This analysis was generated successfully by AI, but could not be saved to your database. Your full scores and recommendations are displayed below for this session.
          </span>
        </div>
      </div>

      {/* Top Grid: Overall Score Ring + Summary & Explanation */}
      <div className="card grid grid-cols-1 md:grid-cols-3 gap-6 p-6 items-center">
        <div className="flex justify-center items-center">
          <ScoreRing score={data.overall_score} size={165} />
        </div>

        <div className="md:col-span-2 flex flex-col gap-4">
          <div>
            <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--accent-red)] block mb-1">
              Score Explanation
            </span>
            <p className="text-sm font-semibold text-white leading-relaxed">
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
        <div className="card p-6 border-l-4 border-l-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={18} className="text-white shrink-0" />
              <h2 className="text-base font-bold text-white m-0">Key Strengths</h2>
            </div>
            {strengths.length > 0 ? (
              <ul className="flex flex-col gap-2.5 pl-0 mt-3 list-none">
                {strengths.map((item, i) => (
                  <li key={i} className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed flex items-start gap-2">
                    <span className="text-[var(--accent-red)] font-bold text-base leading-none">•</span>
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
        <div className="card p-6 border-l-4 border-l-[var(--accent-red)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-[var(--accent-red)] shrink-0" />
              <h2 className="text-base font-bold text-white m-0">Areas to Improve</h2>
            </div>
            {areasForImprovement.length > 0 ? (
              <ul className="flex flex-col gap-2.5 pl-0 mt-3 list-none">
                {areasForImprovement.map((item, i) => (
                  <li key={i} className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed flex items-start gap-2">
                    <span className="text-[var(--accent-red)] font-bold text-base leading-none">•</span>
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
        <h2 className="text-base font-bold text-white mb-4">
          Section Breakdown
        </h2>
        <SectionBars scores={sectionScores} />
      </div>

      {/* ATS Issues */}
      {atsIssues.length > 0 && (
        <div className="card p-6">
          <h2 className="text-base font-bold text-white mb-4">
            ATS Compatibility Issues
          </h2>
          <AtsIssues issues={atsIssues} />
        </div>
      )}

      {/* Detailed Section Feedback */}
      {feedback.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-white">
            Section-wise Recommendations
          </h2>
          <FeedbackCards feedback={feedback} />
        </div>
      )}
    </div>
  )
}
