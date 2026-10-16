'use client'

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Briefcase,
  ExternalLink,
  Loader2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react'
import type { ValidatedJobRecommendations, JobRole } from '@/lib/jobs-prompt'
import { ResumePicker, type ResumePickerItem } from '@/components/resume/ResumePicker'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

function JobsContent() {
  const searchParams = useSearchParams()
  const initialResumeId = searchParams.get('resume') || searchParams.get('resumeId')

  const [resumes, setResumes] = useState<ResumePickerItem[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState<string>(initialResumeId || '')
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [data, setData] = useState<ValidatedJobRecommendations | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedJobKeys, setSavedJobKeys] = useState<string[]>([])
  const [filterSavedOnly, setFilterSavedOnly] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)

  // Load saved jobs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('resumeai_saved_jobs')
      if (stored) {
        setSavedJobKeys(JSON.parse(stored))
      }
    } catch (e) {
      console.warn('Failed to load saved jobs from localStorage:', e)
    }
  }, [])

  const toggleSaveJob = (roleTitle: string) => {
    setSavedJobKeys((prev) => {
      const exists = prev.includes(roleTitle)
      const updated = exists ? prev.filter((t) => t !== roleTitle) : [...prev, roleTitle]
      try {
        localStorage.setItem('resumeai_saved_jobs', JSON.stringify(updated))
      } catch (e) {
        console.warn('Failed to save jobs to localStorage:', e)
      }
      return updated
    })
  }

  // Fetch user resumes with analysis scores
  useEffect(() => {
    let active = true
    async function fetchResumes() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || !active) return

        const { data: resumeList, error: resumeErr } = await supabase
          .from('resumes')
          .select('id, file_name, uploaded_at')
          .eq('user_id', user.id)
          .order('uploaded_at', { ascending: false })

        if (resumeErr) {
          console.error('[JOBS] Resumes fetch error:', resumeErr.message)
        }

        if (active && resumeList && resumeList.length > 0) {
          const resumeIds = resumeList.map((r) => r.id)
          const { data: analyses, error: analysisErr } = await supabase
            .from('analyses')
            .select('resume_id, overall_score, created_at')
            .in('resume_id', resumeIds)
            .order('created_at', { ascending: false })

          if (analysisErr) {
            console.error('[JOBS] Analyses fetch error:', analysisErr.message)
          }

          const scoreMap = new Map<string, number>()
          analyses?.forEach((a) => {
            if (!scoreMap.has(a.resume_id)) {
              scoreMap.set(a.resume_id, a.overall_score)
            }
          })

          const enriched: ResumePickerItem[] = resumeList.map((r) => ({
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
        console.error('[JOBS] Failed to load resumes:', err)
      } finally {
        if (active) setLoadingResumes(false)
      }
    }
    fetchResumes()
    return () => {
      active = false
    }
  }, [selectedResumeId])

  const handleSelectResume = useCallback((id: string) => {
    setSelectedResumeId(id)
    window.history.replaceState(null, '', `?resume=${id}`)
  }, [])

  // Check for saved job recommendations in localStorage and Supabase
  useEffect(() => {
    if (!selectedResumeId) {
      setData(null)
      return
    }

    let active = true
    setLoadingSaved(true)
    setError(null)

    // Check localStorage cache first
    try {
      const cached = localStorage.getItem(`resumeai_jobs_${selectedResumeId}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.roles?.length > 0 && active) {
          setData(parsed)
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
        const { data: dbData, error: dbErr } = await supabase
          .from('job_recommendations')
          .select('strongest_area, top_unlocking_skills, summary, roles')
          .eq('resume_id', selectedResumeId)
          .maybeSingle()

        if (!active) return

        if (dbErr) {
          console.warn('[JOBS] Failed to fetch saved jobs:', dbErr.message)
        } else if (dbData && dbData.roles) {
          const loaded: ValidatedJobRecommendations = {
            strongest_area: dbData.strongest_area || '',
            top_unlocking_skills: dbData.top_unlocking_skills || [],
            summary: dbData.summary || '',
            roles: dbData.roles as JobRole[],
          }
          setData(loaded)
          try {
            localStorage.setItem(`resumeai_jobs_${selectedResumeId}`, JSON.stringify(loaded))
          } catch {}
        } else {
          setData(null)
        }
      } catch (err) {
        console.error('[JOBS] Error checking saved jobs:', err)
      } finally {
        if (active) setLoadingSaved(false)
      }
    }

    loadSavedFromDb()
    return () => {
      active = false
    }
  }, [selectedResumeId])

  const handleGenerate = useCallback(
    async (targetResumeId?: string, forceRegenerate = false) => {
      const rId = targetResumeId || selectedResumeId
      if (!rId) return

      setGenerating(true)
      setError(null)

      try {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeId: rId, force: forceRegenerate }),
        })

        const resultData = await res.json()

        if (!res.ok) {
          throw new Error(resultData.error || 'Failed to generate job matches.')
        }

        try {
          localStorage.setItem(`resumeai_jobs_${rId}`, JSON.stringify(resultData))
        } catch {
          // ignore
        }

        setData(resultData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      } finally {
        setGenerating(false)
      }
    },
    [selectedResumeId]
  )

  const displayedRoles = useMemo(() => {
    if (!data?.roles) return []
    if (!filterSavedOnly) return data.roles
    return data.roles.filter((r) => savedJobKeys.includes(r.title))
  }, [data, filterSavedOnly, savedJobKeys])

  const savedCount = useMemo(() => {
    if (!data?.roles) return 0
    return data.roles.filter((r) => savedJobKeys.includes(r.title)).length
  }, [data, savedJobKeys])

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* 1. Shared PageHeader */}
      <PageHeader
        badge="OPPORTUNITY MATCHING"
        title="Job Recommendations"
        subtitle="Identified entry-level software roles matching your verified skills, with direct search links and skill gap unlocks."
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
              if (data) {
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
                <span>{data ? 'Regenerate Matches' : 'Find Job Matches'}</span>
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

      {/* Loading Skeleton while checking saved jobs on initial load */}
      {loadingSaved && !generating && (
        <div className="card p-6 flex flex-col gap-4 animate-pulse">
          <div className="h-5 w-48 bg-[var(--border)] rounded" />
          <div className="h-4 w-72 bg-[var(--border)] rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
            <div className="h-48 bg-[var(--bg-glass-subtle)] rounded-2xl border border-[var(--border)]" />
            <div className="h-48 bg-[var(--bg-glass-subtle)] rounded-2xl border border-[var(--border)]" />
            <div className="h-48 bg-[var(--bg-glass-subtle)] rounded-2xl border border-[var(--border)]" />
          </div>
        </div>
      )}

      {/* Generating State */}
      {generating && (
        <div className="card p-10 text-center flex flex-col items-center justify-center gap-4">
          <Loader2 size={32} className="animate-spin text-[var(--ios-blue)]" />
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1.5">
              Analyzing Roles with Gemini AI…
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Matching your verified skills to current entry-level software openings in India.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!data && !generating && !loadingSaved && (
        <div className="card p-10 sm:p-14 text-center flex flex-col items-center justify-center border-dashed border-[var(--border)]">
          <div className="w-14 h-14 rounded-full bg-[var(--bg-glass-subtle)] border border-[var(--border)] flex items-center justify-center text-[var(--ios-blue)] mb-4">
            <Briefcase size={24} />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-2">
            No Job Recommendations Yet
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-6 leading-relaxed">
            Run an AI matching pass against your resume to uncover aligned engineering roles, entry-level tracks, and critical skill unlockers.
          </p>
          {resumes.length > 0 ? (
            <button
              onClick={() => handleGenerate()}
              disabled={generating || !selectedResumeId}
              className="btn btn-primary h-11 px-6 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Briefcase size={16} />
              <span>Find Job Matches</span>
            </button>
          ) : (
            <Link href="/upload" prefetch={true} className="btn btn-primary h-11 px-6 text-xs font-bold inline-flex items-center gap-2">
              <span>Upload a Resume</span>
            </Link>
          )}
        </div>
      )}

      {/* Results Content */}
      {data && !generating && (
        <div className="flex flex-col gap-6 w-full">
          {/* Overview Card: Strongest Area & Top Unlocking Skills */}
          <div className="card p-6 flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--ios-blue)] flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>Strongest Area</span>
                </span>
                <p className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-1">
                  {data.strongest_area || 'Technical Problem Solving'}
                </p>
              </div>

              <div>
                <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--ios-purple)] flex items-center gap-1.5">
                  <TrendingUp size={14} />
                  <span>Top Skills to Unlock More Roles</span>
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(data.top_unlocking_skills || []).map((skill, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-glass-subtle)] px-2.5 py-1 rounded-full border border-[var(--border)]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed m-0 pt-4 border-t border-[var(--border)]">
              {data.summary}
            </p>
          </div>

          {/* Filter Bar with Saved Chip */}
          <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterSavedOnly(false)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  !filterSavedOnly
                    ? 'btn-primary'
                    : 'btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                All Matches ({data.roles.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterSavedOnly(true)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 inline-flex items-center gap-1.5 cursor-pointer ${
                  filterSavedOnly
                    ? 'btn-primary'
                    : 'btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Bookmark size={13} />
                <span>Saved ({savedCount})</span>
              </button>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              Showing {displayedRoles.length} of {data.roles.length} roles
            </span>
          </div>

          {/* Grid of Recommended Job Roles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedRoles.length === 0 ? (
              <div className="col-span-full card p-8 text-center text-xs text-[var(--text-muted)]">
                {filterSavedOnly
                  ? 'No saved jobs yet. Click the bookmark icon on any role to save it.'
                  : 'No matching job roles found for this resume.'}
              </div>
            ) : (
              displayedRoles.map((role: JobRole, index: number) => {
                const matchPct = Math.max(0, Math.min(100, Number(role.match_percentage) || 50))
                const roleTitle = role.title || `Job Role ${index + 1}`
                const isSaved = savedJobKeys.includes(roleTitle)

                const linkedInUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(roleTitle)}`
                const naukriUrl = `https://www.naukri.com/jobs-in-india?keyword=${encodeURIComponent(roleTitle)}`

                return (
                  <div
                    key={index}
                    className="card p-5 sm:p-6 flex flex-col justify-between gap-4 transition-all duration-200 hover:border-[var(--ios-blue)]/40"
                  >
                    {/* Role Header with Save Bookmark Button */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-bold text-[var(--text-primary)] truncate m-0" title={roleTitle}>
                            {roleTitle}
                          </h3>
                          <p className="text-xs text-[var(--text-muted)] mt-1 mb-0 line-clamp-2">
                            {role.description || 'Entry-level engineering role.'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[0.65rem] font-bold uppercase text-[var(--text-secondary)] bg-[var(--bg-glass-subtle)] px-2.5 py-0.5 rounded-full border border-[var(--border)]">
                            {role.experience_level || 'Fresher'}
                          </span>

                          {/* Save Bookmark Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleSaveJob(roleTitle)}
                            aria-label={isSaved ? `Unsave ${roleTitle}` : `Save ${roleTitle}`}
                            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                              isSaved
                                ? 'text-[var(--ios-blue)] bg-[var(--ios-blue)]/15 border border-[var(--ios-blue)]/30'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.08]'
                            }`}
                            title={isSaved ? 'Remove from saved' : 'Save job bookmark'}
                          >
                            {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Match Score & Progress Bar */}
                      <div className="mt-4">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">
                            Resume Match
                          </span>
                          <span className="text-xs font-bold text-[var(--ios-blue)]">
                            {matchPct}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[var(--bg-glass-subtle)] overflow-hidden border border-[var(--border)]">
                          <div
                            className="h-full bg-gradient-to-r from-[var(--ios-blue)] to-[var(--ios-purple)] rounded-full transition-[width] duration-300 ease-out"
                            style={{ width: `${matchPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Matching Skills */}
                      <div className="mt-4">
                        <span className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                          Matching Skills:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {role.matched_skills && role.matched_skills.length > 0 ? (
                            role.matched_skills.map((skill, sIdx) => (
                              <span
                                key={sIdx}
                                className="text-[0.68rem] font-semibold text-[var(--text-primary)] bg-[var(--bg-glass-subtle)] px-2.5 py-0.5 rounded-full border border-[var(--border)]"
                              >
                                ✓ {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">
                              Foundational profile match
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Skill Gaps */}
                      <div className="mt-3">
                        <span className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                          Skills to Improve:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {role.skill_gaps && role.skill_gaps.length > 0 ? (
                            role.skill_gaps.map((gap, gIdx) => (
                              <span
                                key={gIdx}
                                className="text-[0.68rem] font-semibold text-[var(--ios-orange)] bg-[var(--ios-orange)]/15 px-2.5 py-0.5 rounded-full border border-[var(--ios-orange)]/30"
                              >
                                + {gap}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">No major gaps</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Salary Estimate + Search Links */}
                    <div className="flex flex-col gap-3 pt-3 border-t border-[var(--border)] mt-auto">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)] uppercase text-[0.65rem] font-bold">
                          Est. Range:
                        </span>
                        <span className="text-[var(--text-primary)] font-bold">
                          {role.salary_range || 'Varies by employer'}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <a
                          href={linkedInUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary h-9 px-3 text-xs font-semibold flex-1 inline-flex items-center justify-center gap-1.5"
                        >
                          <span>LinkedIn</span>
                          <ExternalLink size={12} />
                        </a>
                        <a
                          href={naukriUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary h-9 px-3 text-xs font-semibold flex-1 inline-flex items-center justify-center gap-1.5"
                        >
                          <span>Naukri</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Confirm Modal for Regenerate */}
      <ConfirmModal
        isOpen={showRegenConfirm}
        title="Regenerate Job Matches"
        description="Regenerating will craft fresh job recommendations using Gemini AI and overwrite your current role matches. Do you wish to continue?"
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

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-[var(--text-muted)]">Loading job recommendations…</div>}>
      <JobsContent />
    </Suspense>
  )
}
