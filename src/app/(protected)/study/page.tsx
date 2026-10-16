'use client'

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpen,
  ExternalLink,
  Loader2,
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Target,
  Sparkles,
  RotateCcw,
  FileText,
  Lightbulb,
  Copy,
} from 'lucide-react'
import type { ValidatedStudyGuide, StudyTopic } from '@/lib/study-prompt'
import { ResumePicker, type ResumePickerItem } from '@/components/resume/ResumePicker'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

function StudyContent() {
  const searchParams = useSearchParams()
  const initialResumeId = searchParams.get('resume') || searchParams.get('resumeId')

  const [resumes, setResumes] = useState<ResumePickerItem[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState<string>(initialResumeId || '')
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [guide, setGuide] = useState<ValidatedStudyGuide | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({})
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch user resumes with analysis scores
  useEffect(() => {
    let active = true
    async function fetchResumes() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !active) return

        const { data } = await supabase
          .from('resumes')
          .select('id, file_name, uploaded_at')
          .eq('user_id', user.id)
          .order('uploaded_at', { ascending: false })

        if (active && data && data.length > 0) {
          const resumeIds = data.map((r) => r.id)
          const { data: analyses } = await supabase
            .from('analyses')
            .select('resume_id, overall_score, created_at')
            .in('resume_id', resumeIds)
            .order('created_at', { ascending: false })

          const scoreMap = new Map<string, number>()
          analyses?.forEach((a) => {
            if (!scoreMap.has(a.resume_id)) {
              scoreMap.set(a.resume_id, a.overall_score)
            }
          })

          const enriched: ResumePickerItem[] = data.map((r) => ({
            id: r.id,
            file_name: r.file_name,
            uploaded_at: r.uploaded_at,
            created_at: r.uploaded_at,
            score: scoreMap.get(r.id) ?? null,
          }))

          setResumes(enriched)
          if (!selectedResumeId) {
            setSelectedResumeId(enriched[0].id)
            window.history.replaceState(null, '', `?resume=${enriched[0].id}`)
          }
        }
      } catch (err) {
        console.error('Failed to load resumes:', err)
      } finally {
        if (active) setLoadingResumes(false)
      }
    }
    fetchResumes()
    return () => { active = false }
  }, [selectedResumeId])

  const handleSelectResume = useCallback((id: string) => {
    setSelectedResumeId(id)
    window.history.replaceState(null, '', `?resume=${id}`)
  }, [])

  // Check for saved study guide in localStorage and Supabase
  useEffect(() => {
    if (!selectedResumeId) {
      setGuide(null)
      return
    }

    let active = true
    setLoadingSaved(true)
    setError(null)

    // Load completed steps from localStorage
    try {
      const stored = localStorage.getItem(`resumeai_study_completed_${selectedResumeId}`)
      if (stored) {
        setCompletedSteps(JSON.parse(stored))
      } else {
        setCompletedSteps({})
      }
    } catch {
      setCompletedSteps({})
    }

    // Check localStorage cache first
    try {
      const cached = localStorage.getItem(`resumeai_study_${selectedResumeId}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.topics?.length > 0 && active) {
          setGuide(parsed)
          setLoadingSaved(false)
          return
        }
      }
    } catch {
      // ignore
    }

    // Fetch from Supabase
    async function loadSavedFromDb() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data, error: dbErr } = await supabase
          .from('study_guides')
          .select('domain, summary, topics')
          .eq('resume_id', selectedResumeId)
          .maybeSingle()

        if (!active) return

        if (dbErr) {
          console.warn('[STUDY] Failed to fetch saved study guide:', dbErr.message)
        } else if (data && data.topics) {
          const loadedGuide: ValidatedStudyGuide = {
            domain: data.domain || 'Software Development',
            summary: data.summary || '',
            topics: data.topics as StudyTopic[],
          }
          setGuide(loadedGuide)
          try {
            localStorage.setItem(`resumeai_study_${selectedResumeId}`, JSON.stringify(loadedGuide))
          } catch {}
        } else {
          setGuide(null)
        }
      } catch (err) {
        console.error('[STUDY] Error checking saved guide:', err)
      } finally {
        if (active) setLoadingSaved(false)
      }
    }

    loadSavedFromDb()
    return () => { active = false }
  }, [selectedResumeId])

  const handleToggleStep = useCallback(
    (stepNum: number) => {
      setCompletedSteps((prev) => {
        const updated = { ...prev, [stepNum]: !prev[stepNum] }
        if (selectedResumeId) {
          try {
            localStorage.setItem(
              `resumeai_study_completed_${selectedResumeId}`,
              JSON.stringify(updated)
            )
          } catch (e) {
            console.warn('Failed to save completed steps to localStorage:', e)
          }
        }
        return updated
      })
    },
    [selectedResumeId]
  )

  const handleGenerate = useCallback(async (targetResumeId?: string, forceRegenerate = false) => {
    const rId = targetResumeId || selectedResumeId
    if (!rId) return

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: rId, force: forceRegenerate }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate study guide.')
      }

      try {
        localStorage.setItem(`resumeai_study_${rId}`, JSON.stringify(data))
      } catch {
        // ignore
      }

      setGuide({
        domain: data.domain || 'Software Development',
        summary: data.summary || '',
        topics: data.topics,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }, [selectedResumeId])

  // Computed statistics
  const topicsCount = guide?.topics?.length || 0
  const completedCount = useMemo(() => {
    if (!guide?.topics) return 0
    return guide.topics.filter((t) => completedSteps[t.step]).length
  }, [guide, completedSteps])

  const progressPercent = topicsCount > 0 ? Math.round((completedCount / topicsCount) * 100) : 0

  // Category & skill gaps analysis
  const categoriesWithCounts = useMemo(() => {
    if (!guide?.topics) return []
    const map = new Map<string, number>()
    guide.topics.forEach((t) => {
      const cat = t.category?.trim() || 'Core Engineering'
      map.set(cat, (map.get(cat) || 0) + 1)
    })
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [guide])

  const skillGapsCount = categoriesWithCounts.length || (topicsCount > 0 ? Math.min(topicsCount, 5) : 0)

  // Estimated study duration
  const estStudyTime = useMemo(() => {
    if (topicsCount === 0) return '0 hrs'
    const totalHours = Math.round(topicsCount * 3.5)
    if (totalHours >= 20) {
      const weeks = Math.ceil(totalHours / 10)
      return `${weeks} ${weeks === 1 ? 'wk' : 'wks'}`
    }
    return `${totalHours} hrs`
  }, [topicsCount])

  const handleCopyPlan = () => {
    if (!guide?.topics) return
    const lines = [
      `Study Plan: ${guide.domain || 'Software Development'}`,
      guide.summary ? `Summary: ${guide.summary}` : '',
      '',
      ...guide.topics.map(
        (t) =>
          `Step ${t.step}: ${t.title} (${t.category})\nOverview: ${t.explanation}\nRecommended: ${t.resource_name}\n`
      ),
    ].filter(Boolean)
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleResetProgress = () => {
    setCompletedSteps({})
    if (selectedResumeId) {
      try {
        localStorage.removeItem(`resumeai_study_completed_${selectedResumeId}`)
      } catch (e) {
        console.warn('Failed to clear progress:', e)
      }
    }
    setShowResetConfirm(false)
  }

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* 1. Shared PageHeader with Useful Actions on Right */}
      <PageHeader
        badge="AI CURRICULUM"
        title="Study Resources & Curriculum"
        subtitle="Concepts and topics tailored to your resume's skills and identified gaps, with a suggested learning order."
        actions={
          guide && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleCopyPlan}
                className="btn btn-secondary h-10 px-4 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                title="Copy full curriculum as text"
              >
                {copied ? <Check size={14} className="text-[var(--ios-green)]" /> : <Copy size={14} />}
                <span>{copied ? 'Copied plan!' : 'Copy plan'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="btn btn-secondary h-10 px-4 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                title="Reset completion checkboxes"
              >
                <RotateCcw size={14} />
                <span>Reset progress</span>
              </button>
            </div>
          )
        }
      />

      {/* 2. Full-width ResumePicker Bar below PageHeader */}
      <ResumePicker
        resumes={resumes}
        selectedId={selectedResumeId}
        onSelect={handleSelectResume}
        action={
          <button
            type="button"
            onClick={() => {
              if (guide) {
                setShowRegenConfirm(true)
              } else {
                handleGenerate(selectedResumeId, false)
              }
            }}
            disabled={generating || !selectedResumeId}
            className="btn btn-primary h-11 px-5 inline-flex items-center justify-center gap-2 text-xs font-bold shrink-0 cursor-pointer"
          >
            {generating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>{guide ? 'Regenerate Study Guide' : 'Generate Study Guide'}</span>
              </>
            )}
          </button>
        }
      />

      {/* Error Alert */}
      {error && (
        <div className="flex items-center justify-between gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-[var(--ios-red)] text-xs font-medium flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={generating || !selectedResumeId}
            className="btn btn-secondary text-xs h-8 px-3 cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {/* 2. Stats Strip: grid-cols-2 lg:grid-cols-4 gap-4, equal height and width */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Topics to Learn */}
        <div className="card p-5 flex flex-col justify-between h-[112px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Topics to Learn</span>
            <BookOpen size={16} className="text-[var(--ios-blue)] shrink-0" />
          </div>
          <div className="mt-3 flex items-baseline">
            <span className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-none">
              {topicsCount}
            </span>
          </div>
        </div>

        {/* Skill Gaps */}
        <div className="card p-5 flex flex-col justify-between h-[112px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Skill Gaps</span>
            <Target size={16} className="text-[var(--ios-purple)] shrink-0" />
          </div>
          <div className="mt-3 flex items-baseline">
            <span className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-none">
              {skillGapsCount}
            </span>
          </div>
        </div>

        {/* Est. Study Time */}
        <div className="card p-5 flex flex-col justify-between h-[112px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Est. Study Time</span>
            <Clock size={16} className="text-[var(--ios-orange)] shrink-0" />
          </div>
          <div className="mt-3 flex items-baseline">
            <span className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-none">
              {estStudyTime}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="card p-5 flex flex-col justify-between h-[112px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Progress</span>
            <CheckCircle2 size={16} className="text-[var(--ios-green)] shrink-0" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-none">
              {progressPercent}%
            </span>
            {topicsCount > 0 && (
              <span className="text-xs text-[var(--text-muted)] font-medium leading-none">
                ({completedCount}/{topicsCount})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Short Skeleton State while fetching saved guide on load */}
      {loadingSaved && !generating && (
        <div className="card p-8 flex flex-col gap-4 animate-pulse">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="h-4 w-40 bg-[var(--border)] rounded" />
            <div className="h-4 w-20 bg-[var(--border)] rounded" />
          </div>
          <div className="space-y-3">
            <div className="h-20 bg-[var(--bg-glass-subtle)] rounded-xl border border-[var(--border)]" />
            <div className="h-20 bg-[var(--bg-glass-subtle)] rounded-xl border border-[var(--border)]" />
            <div className="h-20 bg-[var(--bg-glass-subtle)] rounded-xl border border-[var(--border)]" />
          </div>
        </div>
      )}

      {/* 3. Empty State Card */}
      {!guide && !generating && !loadingSaved && (
        <div className="card p-10 sm:p-14 text-center flex flex-col items-center justify-center border-dashed border-[var(--border)]">
          <div className="w-14 h-14 rounded-full bg-[var(--bg-glass-subtle)] border border-[var(--border)] flex items-center justify-center text-[var(--ios-blue)] mb-4">
            <Sparkles size={24} />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] mt-2">
            Generate Your Tailored Study Roadmap
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-xl mx-auto mt-2 leading-relaxed text-center">
            Extract targeted technical topics, curated documentation, and a structured curriculum based on your resume&apos;s identified skill gaps.
          </p>
          <div className="mt-6">
            {resumes.length > 0 ? (
              <button
                onClick={() => handleGenerate()}
                disabled={generating || !selectedResumeId}
                className="btn btn-primary px-6 py-2.5 text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <BookOpen size={16} />
                <span>Generate Study Guide</span>
              </button>
            ) : (
              <Link href="/upload" prefetch={true} className="btn btn-primary px-6 py-2.5 text-sm inline-flex items-center gap-2">
                <span>Upload a resume</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Loading Skeleton State while generating */}
      {generating && (
        <div className="card p-10 text-center flex flex-col items-center justify-center gap-4">
          <Loader2 size={32} className="animate-spin text-[var(--ios-blue)]" />
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1.5">
              Designing Your Curriculum with Gemini AI…
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Analyzing technical gaps and structuring your ordered learning roadmap.
            </p>
          </div>
        </div>
      )}

      {/* 4 & 5. Learning Roadmap Timeline & Skill Gaps Panel */}
      {guide && !generating && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Roadmap: Vertical Timeline (8 Cols on Large Screens) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ios-blue)]">
                  Step-by-Step Learning Order
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  ({guide.topics.length} steps)
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleGenerate(undefined, true)}
                disabled={generating}
                className="btn btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Regenerate</span>
              </button>
            </div>

            {guide.topics.length === 0 ? (
              <div className="card p-6 text-center text-sm text-[var(--text-muted)]">
                No topics generated for this resume. Click Regenerate to try again.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {guide.topics.map((topic: StudyTopic, index: number) => {
                  const stepNum = topic.step || index + 1
                  const isDone = Boolean(completedSteps[stepNum])
                  const priority = stepNum <= 3 ? 'High' : stepNum <= 6 ? 'Medium' : 'Low'
                  const isLast = index === guide.topics.length - 1

                  const primaryQuery = topic.search_query || `${topic.title} tutorial`
                  const docsQuery = `${topic.title} documentation guide`
                  const videoQuery = `${topic.title} tutorial crash course`

                  return (
                    <div key={stepNum} className="flex items-stretch gap-3 sm:gap-4">
                      {/* Step Indicator with Vertical Line */}
                      <div className="flex flex-col items-center shrink-0 w-8 sm:w-9">
                        <button
                          type="button"
                          onClick={() => handleToggleStep(stepNum)}
                          title={isDone ? 'Mark as incomplete' : 'Mark as done'}
                          aria-label={isDone ? 'Mark as incomplete' : 'Mark as done'}
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors duration-150 cursor-pointer z-10 border-2 ${
                            isDone
                              ? 'bg-[var(--ios-blue)] text-white border-transparent shadow-md'
                              : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--ios-blue)] hover:bg-[var(--ios-blue)]/15'
                          }`}
                        >
                          {isDone ? (
                            <Check size={16} strokeWidth={3} />
                          ) : (
                            <span className="text-xs sm:text-sm font-extrabold">{stepNum}</span>
                          )}
                        </button>
                        {!isLast && (
                          <div className="w-0.5 grow bg-[var(--ios-blue)]/25 my-1 min-h-[30px]" />
                        )}
                      </div>

                      {/* Step Card */}
                      <div
                        className="card p-4 sm:p-5 flex-1 min-w-0 transition-all duration-150 flex flex-col justify-between"
                        style={{
                          backgroundColor: isDone ? 'var(--bg-glass-subtle)' : 'var(--bg-card)',
                          opacity: isDone ? 0.75 : 1,
                        }}
                      >
                        {/* Header: Title, Priority, Category, and Checkbox */}
                        <div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[var(--border)]">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <h3
                                className={`text-sm sm:text-base font-bold transition-colors duration-150 ${
                                  isDone
                                    ? 'line-through text-[var(--text-muted)]'
                                    : 'text-[var(--text-primary)]'
                                }`}
                              >
                                {topic.title}
                              </h3>

                              {/* Priority Pill */}
                              {priority === 'High' ? (
                                <span className="text-[0.65rem] font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--ios-orange)]/15 border border-[var(--ios-orange)]/30 text-[var(--ios-orange)] uppercase">
                                  High Priority
                                </span>
                              ) : (
                                <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-glass-subtle)] border border-[var(--border)] text-[var(--text-secondary)] uppercase">
                                  {priority} Priority
                                </span>
                              )}

                              {/* Category Badge */}
                              <span className="text-[0.68rem] text-[var(--text-muted)] font-medium bg-[var(--bg-glass-subtle)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                                {topic.category || 'Core'}
                              </span>
                            </div>

                            {/* Mark as done Checkbox */}
                            <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer select-none shrink-0">
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => handleToggleStep(stepNum)}
                                className="accent-[var(--ios-blue)] w-4 h-4 rounded cursor-pointer"
                              />
                              <span className={isDone ? 'text-[var(--ios-blue)] font-semibold' : ''}>
                                {isDone ? 'Completed' : 'Mark as done'}
                              </span>
                            </label>
                          </div>

                          {/* Explanation */}
                          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed my-2.5">
                            {topic.explanation}
                          </p>
                        </div>

                        {/* Resource Links as Small Chips */}
                        <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-[var(--border)] mt-1">
                          <span className="text-[0.7rem] text-[var(--text-muted)] font-medium shrink-0">
                            Resources:
                          </span>

                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(primaryQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-glass-subtle)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-medium transition-colors"
                          >
                            <BookOpen size={11} className="text-[var(--ios-blue)]" />
                            <span>{topic.resource_name || 'Official Documentation'}</span>
                            <ExternalLink size={10} className="text-[var(--text-muted)]" />
                          </a>

                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(docsQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-glass-subtle)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            <span>Documentation</span>
                            <ExternalLink size={10} className="text-[var(--text-muted)]" />
                          </a>

                          <a
                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(videoQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-glass-subtle)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            <span>Video Walkthrough</span>
                            <ExternalLink size={10} className="text-[var(--text-muted)]" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right: Skill Gaps Panel (4 cols) */}
          <div className="lg:col-span-4 sticky top-6 flex flex-col gap-6">
            {/* Domain & Focus Card */}
            <div className="card p-5 border-l-4 border-l-[var(--ios-blue)]">
              <span className="text-[0.68rem] font-extrabold uppercase tracking-wider text-[var(--ios-blue)] block mb-1">
                Curriculum Focus
              </span>
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">
                {guide.domain}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                {guide.summary}
              </p>
              <button
                type="button"
                onClick={() => handleGenerate(undefined, true)}
                disabled={generating}
                className="btn btn-secondary w-full text-xs py-2 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Regenerate Curriculum</span>
              </button>
            </div>

            {/* Identified Skill Gaps by Category */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Identified Skill Gaps
                </h3>
                <span className="text-xs text-[var(--ios-blue)] font-semibold">
                  {categoriesWithCounts.length} areas
                </span>
              </div>

              <div className="space-y-2">
                {categoriesWithCounts.map(({ name, count }) => {
                  const catTopics = guide.topics.filter(
                    (t) => (t.category?.trim() || 'Core Engineering') === name
                  )
                  const catCompleted = catTopics.filter((t) => completedSteps[t.step]).length

                  return (
                    <div
                      key={name}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-glass-subtle)] border border-[var(--border)] text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--ios-blue)] shrink-0" />
                        <span className="font-medium text-[var(--text-primary)] truncate">{name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[0.7rem] text-[var(--text-muted)]">
                          {catCompleted}/{count} done
                        </span>
                        {catCompleted === count && count > 0 && (
                          <Check size={12} className="text-[var(--ios-green)]" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Practical Study Strategy Tip Card */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2 text-[var(--text-primary)] font-semibold text-xs">
                <Lightbulb size={14} className="text-[var(--ios-orange)]" />
                <span>Recommended Study Strategy</span>
              </div>
              <ul className="text-xs text-[var(--text-secondary)] space-y-2 list-disc pl-4 leading-normal">
                <li>Follow the sequence: early steps provide the base for later topics.</li>
                <li>Spend 25–40 minutes reviewing documentation for each concept.</li>
                <li>Implement a minimal code example to solidify technical interview readiness.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal for Reset Progress */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Study Progress"
        description="Are you sure you want to uncheck all completed steps? This will reset your study progress for this resume."
        confirmText="Reset Progress"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={false}
        onConfirm={handleResetProgress}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Confirm Modal for Regenerate Guide */}
      <ConfirmModal
        isOpen={showRegenConfirm}
        title="Regenerate Study Guide"
        description="Regenerating will craft a fresh curriculum using Gemini AI and overwrite your current study plan. Do you wish to continue?"
        confirmText="Regenerate"
        cancelText="Cancel"
        isDestructive={false}
        isLoading={generating}
        onConfirm={() => {
          setShowRegenConfirm(false)
          handleGenerate(selectedResumeId, true)
        }}
        onCancel={() => {
          if (!generating) setShowRegenConfirm(false)
        }}
      />
    </div>
  )
}

export default function StudyPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading study resources…</div>}>
      <StudyContent />
    </Suspense>
  )
}
