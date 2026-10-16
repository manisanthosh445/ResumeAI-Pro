'use client'

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Clock,
  X,
} from 'lucide-react'
import type { ValidatedMockTest } from '@/lib/mock-test-prompt'
import { ResumePicker, type ResumePickerItem } from '@/components/resume/ResumePicker'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

type Difficulty = 'beginner' | 'intermediate' | 'advanced'

interface PastAttemptItem {
  id: string
  score: number
  total: number
  percentage: number
  created_at: string
  weak_topics?: string[]
}

function MockTestContent() {
  const searchParams = useSearchParams()
  const initialResumeId = searchParams.get('resume') || searchParams.get('resumeId')

  const [resumes, setResumes] = useState<ResumePickerItem[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState<string>(initialResumeId || '')
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate')
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previousAttempt, setPreviousAttempt] = useState<{
    score: number
    total: number
    percentage: number
    created_at?: string
  } | null>(null)

  // Past attempts modal state
  const [pastAttempts, setPastAttempts] = useState<PastAttemptItem[]>([])
  const [showAttemptsModal, setShowAttemptsModal] = useState(false)
  const [loadingAttempts, setLoadingAttempts] = useState(false)

  // Confirmation modal states
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [showRetakeConfirm, setShowRetakeConfirm] = useState(false)

  // Test state
  const [test, setTest] = useState<ValidatedMockTest | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  // Fetch user resumes with analysis scores
  useEffect(() => {
    let active = true
    async function fetchResumes() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !active) return

        const { data, error: resumesErr } = await supabase
          .from('resumes')
          .select('id, file_name, uploaded_at')
          .eq('user_id', user.id)
          .order('uploaded_at', { ascending: false })

        if (resumesErr) {
          console.error('[MOCK-TEST] Resumes fetch error:', resumesErr.message)
        }

        if (active && data && data.length > 0) {
          const resumeIds = data.map((r) => r.id)
          const { data: analyses, error: analysesErr } = await supabase
            .from('analyses')
            .select('resume_id, overall_score, created_at')
            .in('resume_id', resumeIds)
            .order('created_at', { ascending: false })

          if (analysesErr) {
            console.error('[MOCK-TEST] Analyses fetch error:', analysesErr.message)
          }

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
        console.error('[MOCK-TEST] Failed to load resumes:', err)
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

  // Check for existing saved test in localStorage or Supabase
  useEffect(() => {
    if (!selectedResumeId) {
      setTest(null)
      setAnswers({})
      setSubmitted(false)
      setPreviousAttempt(null)
      return
    }

    let active = true
    setLoadingSaved(true)
    setError(null)
    setAnswers({})
    setSubmitted(false)

    // Load active answers from localStorage
    try {
      const storedAnswers = localStorage.getItem(`resumeai_test_answers_${selectedResumeId}`)
      if (storedAnswers) {
        setAnswers(JSON.parse(storedAnswers))
      }
    } catch {
      // ignore
    }

    // Check localStorage cached test first
    try {
      const cachedTest = localStorage.getItem(`resumeai_mock_test_${selectedResumeId}`)
      if (cachedTest) {
        const parsed = JSON.parse(cachedTest)
        if (parsed?.questions?.length > 0 && active) {
          setTest(parsed)
        }
      }
    } catch {
      // ignore
    }

    // Query Supabase for latest mock test attempt and saved test questions
    async function fetchSavedData() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !active) return

        // Fetch latest attempt for this resume
        const { data: attemptData, error: attemptErr } = await supabase
          .from('mock_test_attempts')
          .select('score, total, total_questions, percentage, created_at')
          .eq('resume_id', selectedResumeId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (attemptErr) {
          console.warn('[MOCK-TEST] Failed to fetch latest attempt:', attemptErr.message)
        } else if (attemptData && active) {
          const totalQ = Number(attemptData.total_questions ?? attemptData.total ?? 10)
          const scoreQ = Number(attemptData.score ?? 0)
          const pct = attemptData.percentage !== undefined && attemptData.percentage !== null
            ? Number(attemptData.percentage)
            : (totalQ > 0 ? Math.round((scoreQ / totalQ) * 100) : 0)

          setPreviousAttempt({
            score: scoreQ,
            total: totalQ,
            percentage: pct,
            created_at: attemptData.created_at,
          })
        } else if (active) {
          setPreviousAttempt(null)
        }

        // Fetch saved mock test questions if not already cached
        const { data: savedTest, error: testErr } = await supabase
          .from('mock_tests')
          .select('questions, difficulty')
          .eq('resume_id', selectedResumeId)
          .maybeSingle()

        if (testErr) {
          console.warn('[MOCK-TEST] Failed to fetch saved test:', testErr.message)
        } else if (savedTest && savedTest.questions && active) {
          const loaded: ValidatedMockTest = {
            questions: savedTest.questions,
            difficulty: (savedTest.difficulty as Difficulty) || 'intermediate',
          }
          setTest(loaded)
          if (savedTest.difficulty) setDifficulty(savedTest.difficulty as Difficulty)
          try {
            localStorage.setItem(`resumeai_mock_test_${selectedResumeId}`, JSON.stringify(loaded))
          } catch {}
        }
      } catch (err) {
        console.error('[MOCK-TEST] Error checking saved data:', err)
      } finally {
        if (active) setLoadingSaved(false)
      }
    }

    fetchSavedData()
    return () => { active = false }
  }, [selectedResumeId])

  // Load past attempts for modal
  const handleOpenAttemptsModal = async () => {
    if (!selectedResumeId) return
    setShowAttemptsModal(true)
    setLoadingAttempts(true)

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('mock_test_attempts')
        .select('id, score, total, total_questions, percentage, created_at, weak_topics')
        .eq('resume_id', selectedResumeId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (err) {
        console.error('[MOCK-TEST] Error fetching attempts:', err.message)
      } else if (data) {
        setPastAttempts(
          data.map((item) => {
            const totalQ = Number(item.total_questions ?? item.total ?? 10)
            const scoreQ = Number(item.score ?? 0)
            const pct = item.percentage !== undefined && item.percentage !== null
              ? Number(item.percentage)
              : (totalQ > 0 ? Math.round((scoreQ / totalQ) * 100) : 0)

            return {
              id: item.id,
              score: scoreQ,
              total: totalQ,
              percentage: pct,
              created_at: item.created_at,
              weak_topics: item.weak_topics,
            }
          })
        )
      }
    } catch (e) {
      console.error('[MOCK-TEST] Failed to load attempts history:', e)
    } finally {
      setLoadingAttempts(false)
    }
  }

  // Generate / Regenerate questions
  const handleStartTest = async (forceRegenerate = false) => {
    if (!selectedResumeId) return

    setGenerating(true)
    setError(null)
    setAnswers({})
    setSubmitted(false)
    setCurrentIndex(0)

    try {
      const res = await fetch('/api/mock-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: selectedResumeId,
          difficulty,
          force: forceRegenerate,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate technical mock test.')
      }

      setTest(data)
      try {
        localStorage.setItem(`resumeai_mock_test_${selectedResumeId}`, JSON.stringify(data))
        localStorage.removeItem(`resumeai_test_answers_${selectedResumeId}`)
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // Answer selection
  const handleSelectOption = (questionIdx: number, optionIdx: number) => {
    if (submitted) return
    const updated = { ...answers, [questionIdx]: optionIdx }
    setAnswers(updated)
    if (selectedResumeId) {
      try {
        localStorage.setItem(`resumeai_test_answers_${selectedResumeId}`, JSON.stringify(updated))
      } catch {
        // ignore
      }
    }
  }

  // Submit test and save attempt to DB
  const handleSubmitTest = async () => {
    if (!test || !selectedResumeId) return
    setSubmitted(true)

    // Calculate score
    let correct = 0
    const weakList: string[] = []

    test.questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_index) {
        correct++
      } else if (q.topic) {
        if (!weakList.includes(q.topic)) weakList.push(q.topic)
      }
    })

    const total = test.questions.length
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0

    // Save to database
    try {
      await fetch('/api/mock-test', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: selectedResumeId,
          score: correct,
          total,
          percentage: pct,
          weakTopics: weakList,
        }),
      })

      setPreviousAttempt({
        score: correct,
        total,
        percentage: pct,
        created_at: new Date().toISOString(),
      })
    } catch (e) {
      console.warn('[MOCK-TEST] Failed to record test attempt:', e)
    }
  }

  const handleRetake = () => {
    setAnswers({})
    setSubmitted(false)
    setCurrentIndex(0)
    if (selectedResumeId) {
      try {
        localStorage.removeItem(`resumeai_test_answers_${selectedResumeId}`)
      } catch {
        // ignore
      }
    }
    setShowRetakeConfirm(false)
  }

  const totalQuestions = test?.questions?.length || 0
  const answeredCount = Object.keys(answers).length
  const correctCount = test && submitted
    ? test.questions.filter((q, i) => answers[i] === q.correct_index).length
    : 0
  const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

  const weakTopics = useMemo(() => {
    if (!test || !submitted) return []
    const set = new Set<string>()
    test.questions.forEach((q, i) => {
      if (answers[i] !== q.correct_index && q.topic) {
        set.add(q.topic)
      }
    })
    return Array.from(set)
  }, [test, submitted, answers])

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* 1. Shared PageHeader with Actions on Right */}
      <PageHeader
        badge="TECHNICAL EVALUATION"
        title="Interview Mock Test"
        subtitle="AI-generated technical multiple-choice assessments tailored to the specific skills, libraries, and frameworks on your resume."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenAttemptsModal}
              disabled={!selectedResumeId}
              className="btn btn-secondary h-10 px-4 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              title="View past test scores and history"
            >
              <Clock size={14} />
              <span>Past Attempts</span>
            </button>

            {test && !submitted && (
              <button
                type="button"
                onClick={() => {
                  if (answeredCount > 0) setShowRetakeConfirm(true)
                  else handleRetake()
                }}
                className="btn btn-secondary h-10 px-4 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                title="Reset and take this test again"
              >
                <RotateCcw size={14} />
                <span>Retake test</span>
              </button>
            )}
          </div>
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
              if (test) {
                setShowRegenConfirm(true)
              } else {
                handleStartTest(false)
              }
            }}
            disabled={generating || !selectedResumeId}
            className="btn btn-primary h-11 px-5 inline-flex items-center justify-center gap-2 text-xs font-bold shrink-0 cursor-pointer"
          >
            {generating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Generating test…</span>
              </>
            ) : (
              <>
                <HelpCircle size={15} />
                <span>{test ? 'Regenerate Questions' : 'Start Mock Test'}</span>
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
            onClick={() => handleStartTest()}
            disabled={generating || !selectedResumeId}
            className="btn btn-secondary h-8 px-3 text-xs cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading Skeleton while fetching saved test */}
      {loadingSaved && !generating && (
        <div className="card p-6 flex flex-col gap-4 animate-pulse">
          <div className="h-5 w-48 bg-[var(--border)] rounded" />
          <div className="h-4 w-72 bg-[var(--border)] rounded" />
          <div className="h-40 bg-[var(--bg-glass-subtle)] rounded-xl border border-[var(--border)]" />
        </div>
      )}

      {/* Configuration Card (visible when no test is active or when re-configuring) */}
      {!test && !loadingSaved && (
        <div className="card p-6 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Select Difficulty:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['beginner', 'intermediate', 'advanced'] as Difficulty[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`p-3.5 rounded-2xl text-xs font-bold capitalize transition-colors duration-150 border cursor-pointer ${
                    difficulty === level
                      ? 'border-[var(--ios-blue)] bg-[var(--ios-blue)]/15 text-[var(--ios-blue)] shadow-[inset_0_1px_0_var(--card-inset-highlight)]'
                      : 'border-[var(--border)] bg-[var(--bg-glass-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Previous Attempt Summary if available */}
          {previousAttempt && (
            <div className="p-4 rounded-2xl bg-[var(--bg-glass-subtle)] border border-[var(--border)] flex items-center justify-between gap-4">
              <div>
                <span className="text-xs text-[var(--text-muted)] block">Previous Attempt Score:</span>
                <span className="text-xl font-extrabold text-[var(--text-primary)]">
                  {previousAttempt.score}/{previousAttempt.total} ({previousAttempt.percentage}%)
                </span>
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {previousAttempt.created_at
                  ? new Date(previousAttempt.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Recent attempt'}
              </span>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => handleStartTest(false)}
              disabled={generating || !selectedResumeId}
              className="btn btn-primary h-11 px-6 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Generating test…</span>
                </>
              ) : (
                <>
                  <HelpCircle size={16} />
                  <span>Generate Technical Questions</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Generating State */}
      {generating && (
        <div className="card p-10 text-center flex flex-col items-center justify-center gap-4">
          <Loader2 size={32} className="animate-spin text-[var(--ios-blue)]" />
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1.5">
              Generating Technical Questions with Gemini AI…
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Crafting questions and realistic distractors tailored to your resume skills.
            </p>
          </div>
        </div>
      )}

      {/* Active Test Interface */}
      {test && !generating && !submitted && (
        <div className="flex flex-col gap-6">
          {/* Progress Header */}
          <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--ios-blue)]">
                Question {currentIndex + 1} of {totalQuestions}
              </span>
              <span className="text-xs text-[var(--text-muted)] ml-3">
                Topic: {test.questions[currentIndex]?.topic}
              </span>
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Answered: <strong className="text-[var(--text-primary)]">{answeredCount}</strong> / {totalQuestions}
            </div>
          </div>

          {/* Question Card */}
          <div className="card p-6 flex flex-col gap-6">
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] leading-relaxed m-0">
              {test.questions[currentIndex]?.question}
            </h2>

            {/* Options */}
            <div className="flex flex-col gap-3">
              {test.questions[currentIndex]?.options.map((opt, optIdx) => {
                const isSelected = answers[currentIndex] === optIdx
                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelectOption(currentIndex, optIdx)}
                    className={`p-4 rounded-2xl text-left text-xs sm:text-sm font-medium transition-all duration-150 flex items-center justify-between gap-3 border cursor-pointer ${
                      isSelected
                        ? 'border-[var(--ios-blue)] bg-[var(--ios-blue)]/15 text-[var(--text-primary)] shadow-[inset_0_1px_0_var(--card-inset-highlight)]'
                        : 'border-[var(--border)] bg-[var(--bg-glass-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{opt}</span>
                    <span className="w-5 h-5 rounded-full border border-[var(--border)] flex items-center justify-center shrink-0 text-xs">
                      {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-[var(--ios-blue)]" />}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="btn btn-secondary h-10 px-4 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Previous</span>
              </button>

              {currentIndex < totalQuestions - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  className="btn btn-secondary h-10 px-4 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitTest}
                  disabled={answeredCount === 0}
                  className="btn btn-primary h-10 px-5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>Submit Test</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submitted Test Results */}
      {test && submitted && (
        <div className="flex flex-col gap-6">
          {/* Result Summary Card */}
          <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-4 border-l-[var(--ios-blue)]">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--ios-blue)] block mb-1">
                Assessment Complete
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] m-0">
                Score: {correctCount} / {totalQuestions} ({scorePercentage}%)
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 mb-0">
                {scorePercentage >= 70
                  ? 'Strong technical understanding demonstrated across evaluated domains.'
                  : 'Review the explanations and recommended study areas below to strengthen readiness.'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleRetake}
                className="btn btn-secondary h-10 px-4 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Retake Test</span>
              </button>
              <Link
                href={`/study?resume=${selectedResumeId}`}
                prefetch={true}
                className="btn btn-primary h-10 px-4 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <BookOpen size={14} />
                <span>Study Resources</span>
              </Link>
            </div>
          </div>

          {/* Weak Topics to Review */}
          {weakTopics.length > 0 && (
            <div className="card p-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">
                Identified Weak Topics to Focus On:
              </h3>
              <div className="flex flex-wrap gap-2">
                {weakTopics.map((topic: string, i: number) => (
                  <span
                    key={i}
                    className="text-xs font-semibold text-[var(--ios-orange)] bg-[var(--ios-orange)]/15 px-3 py-1 rounded-full border border-[var(--ios-orange)]/30"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Question Review */}
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Question Review</h3>
            <div className="flex flex-col gap-4">
              {test.questions.map((q, qIdx) => {
                const userAns = answers[qIdx]
                const isCorrect = userAns === q.correct_index

                return (
                  <div
                    key={qIdx}
                    className={`card p-5 flex flex-col gap-3 border ${
                      isCorrect ? 'border-[var(--border)]' : 'border-red-500/30 bg-red-500/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm font-bold text-[var(--text-primary)] m-0">
                        {qIdx + 1}. {q.question}
                      </h4>
                      {isCorrect ? (
                        <span className="text-xs font-bold text-[var(--ios-green)] shrink-0 inline-flex items-center gap-1">
                          <CheckCircle2 size={15} /> Correct
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[var(--ios-red)] shrink-0 inline-flex items-center gap-1">
                          <XCircle size={15} /> Incorrect
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {q.options.map((opt, optIdx) => {
                        const wasChosen = userAns === optIdx
                        const isRight = q.correct_index === optIdx

                        let optStyle = 'bg-[var(--bg-glass-subtle)] border-[var(--border)] text-[var(--text-muted)]'
                        if (isRight) optStyle = 'bg-white/10 border-white/40 text-[var(--text-primary)] font-semibold shadow-[inset_0_1px_0_var(--card-inset-highlight)]'
                        if (wasChosen && !isRight) optStyle = 'bg-[var(--brand-red)]/15 border-[var(--brand-red)]/40 text-[var(--brand-red)] font-semibold'

                        return (
                          <div
                            key={optIdx}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${optStyle}`}
                          >
                            <span>{opt}</span>
                            {isRight && (
                              <span className="text-[0.65rem] uppercase font-bold text-[var(--text-primary)]">
                                Correct Answer
                              </span>
                            )}
                            {wasChosen && !isRight && (
                              <span className="text-[0.65rem] uppercase font-bold text-[var(--brand-red)]">
                                Your Choice
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="p-3 bg-[var(--bg-glass-subtle)] rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] mt-1">
                      <strong className="text-[var(--text-primary)]">Explanation:</strong> {q.explanation}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Past Attempts Modal */}
      {showAttemptsModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg glass rounded-[28px] p-6 shadow-[var(--card-shadow)] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-[var(--ios-blue)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)] m-0">Past Mock Test Attempts</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAttemptsModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {loadingAttempts ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-[var(--ios-blue)]" />
                <span>Loading past attempts…</span>
              </div>
            ) : pastAttempts.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                No past attempts recorded for this resume yet.
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto flex flex-col gap-3">
                {pastAttempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="p-3.5 rounded-2xl bg-[var(--bg-glass-subtle)] border border-[var(--border)] flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {attempt.score}/{attempt.total} ({attempt.percentage}%)
                        </span>
                        <span
                          className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${
                            attempt.percentage >= 70
                              ? 'bg-[var(--brand-red)]/20 text-white border border-[var(--brand-red)]/50'
                              : 'bg-[var(--brand-red-deep)]/25 text-[var(--brand-red-bright)] border border-[var(--brand-red-deep)]/40'
                          }`}
                        >
                          {attempt.percentage >= 70 ? 'Passed' : 'Needs Practice'}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] mt-1 block">
                        {new Date(attempt.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {attempt.weak_topics && attempt.weak_topics.length > 0 && (
                      <span className="text-[0.7rem] text-[var(--text-muted)] max-w-[140px] truncate text-right">
                        Weak: {attempt.weak_topics.join(', ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowAttemptsModal(false)}
                className="btn btn-secondary h-10 px-4 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal for Retake Test */}
      <ConfirmModal
        isOpen={showRetakeConfirm}
        title="Retake Mock Test"
        description="Are you sure you want to reset your current answers and restart this test from question 1?"
        confirmText="Retake"
        cancelText="Cancel"
        isDestructive={false}
        isLoading={false}
        onConfirm={handleRetake}
        onCancel={() => setShowRetakeConfirm(false)}
      />

      {/* Confirm Modal for Regenerate Questions */}
      <ConfirmModal
        isOpen={showRegenConfirm}
        title="Regenerate Questions"
        description="Regenerating will craft a brand-new set of 10 technical questions using Gemini AI and overwrite your current mock test. Do you wish to continue?"
        confirmText="Regenerate"
        cancelText="Cancel"
        isDestructive={false}
        isLoading={generating}
        onConfirm={() => {
          setShowRegenConfirm(false)
          handleStartTest(true)
        }}
        onCancel={() => {
          if (!generating) setShowRegenConfirm(false)
        }}
      />
    </div>
  )
}

export default function MockTestPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-[var(--text-muted)]">Loading mock test…</div>}>
      <MockTestContent />
    </Suspense>
  )
}
