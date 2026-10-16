import { createClient } from '@/lib/supabase/server'
import { buildAnalysisPrompt, validateAnalysisResponse } from '@/lib/analysis-prompt'
import { NextRequest, NextResponse } from 'next/server'
import {
  generateJsonWithRetry,
  getFriendlyErrorMessage,
  logServerError,
  getGeminiApiKey,
} from '@/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const resumeId = searchParams.get('resumeId')

    if (!resumeId) {
      return NextResponse.json({ error: 'resumeId is required.' }, { status: 400 })
    }

    const { data: analysis, error: aErr } = await supabase
      .from('analyses')
      .select('id, overall_score, section_scores, feedback, ats_issues, created_at')
      .eq('resume_id', resumeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (aErr || !analysis) {
      return NextResponse.json({ saved: false, data: null })
    }

    const scores = (analysis.section_scores || {}) as Record<string, unknown>
    return NextResponse.json({
      saved: true,
      analysisId: analysis.id,
      overall_score: analysis.overall_score,
      summary: scores.summary || '',
      score_rationale: scores.score_rationale || '',
      strengths: scores.strengths || [],
      areas_for_improvement: scores.areas_for_improvement || [],
      section_scores: analysis.section_scores,
      ats_issues: analysis.ats_issues || [],
      feedback: analysis.feedback || [],
      created_at: analysis.created_at,
    })
  } catch (err) {
    logServerError('ANALYZE_GET', err)
    return NextResponse.json({ error: 'Failed to fetch saved analysis.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    try {
      getGeminiApiKey()
    } catch (keyErr) {
      logServerError('ANALYZE', keyErr)
      return NextResponse.json(
        { error: 'AI key problem. Check GEMINI_API_KEY.' },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[ANALYZE] Supabase Auth Error / Unauthorized:', authError?.message || 'No user session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      resumeId?: string
      regenerate?: boolean
    }
    const { resumeId, regenerate } = body

    if (!resumeId) {
      console.error('[ANALYZE] Validation failed: resumeId is missing from request body')
      return NextResponse.json({ error: 'resumeId is required.' }, { status: 400 })
    }

    // Check for existing saved analysis if not forcing regeneration
    if (!regenerate) {
      const { data: existingAnalysis } = await supabase
        .from('analyses')
        .select('id, overall_score, section_scores, feedback, ats_issues, created_at')
        .eq('resume_id', resumeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingAnalysis) {
        const scores = (existingAnalysis.section_scores || {}) as Record<string, unknown>
        return NextResponse.json({
          success: true,
          saved: true,
          analysisId: existingAnalysis.id,
          overall_score: existingAnalysis.overall_score,
          summary: scores.summary || '',
          score_rationale: scores.score_rationale || '',
          strengths: scores.strengths || [],
          areas_for_improvement: scores.areas_for_improvement || [],
          section_scores: existingAnalysis.section_scores,
          ats_issues: existingAnalysis.ats_issues || [],
          feedback: existingAnalysis.feedback || [],
          created_at: existingAnalysis.created_at,
        })
      }
    }

    // Fetch resume and profile in parallel
    const [{ data: resume, error: resumeError }, { data: profile, error: profileError }] = await Promise.all([
      supabase
        .from('resumes')
        .select('id, raw_text, user_id')
        .eq('id', resumeId)
        .single(),
      supabase
        .from('profiles')
        .select('target_role')
        .eq('id', user.id)
        .maybeSingle(),
    ])

    if (resumeError) {
      console.error('[ANALYZE] Supabase error fetching resume:', {
        message: resumeError.message,
        code: resumeError.code,
        details: resumeError.details,
        hint: resumeError.hint,
      })
      return NextResponse.json(
        { error: 'Database error fetching resume from Supabase.' },
        { status: 500 }
      )
    }

    if (!resume) {
      console.error('[ANALYZE] Resume not found for id:', resumeId)
      return NextResponse.json({ error: 'Resume not found.' }, { status: 404 })
    }

    if (resume.user_id !== user.id) {
      console.error('[ANALYZE] Security violation: User does not own resume', {
        userId: user.id,
        ownerId: resume.user_id,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!resume.raw_text || resume.raw_text.trim().length === 0) {
      console.error('[ANALYZE] Resume has empty extracted text for id:', resumeId)
      return NextResponse.json(
        { error: 'Resume contains no readable text. Please re-upload your resume.' },
        { status: 400 }
      )
    }

    if (profileError) {
      console.warn('[ANALYZE] Note: Failed to fetch profile target_role:', profileError.message)
    }

    const { system, user: userPrompt } = buildAnalysisPrompt(resume.raw_text, profile?.target_role)

    // Generate and validate JSON with automatic retry and model fallback
    const validated = await generateJsonWithRetry(
      {
        contents: [{ role: 'user', parts: [{ text: `${system}\n\n${userPrompt}` }] }],
        config: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      },
      validateAnalysisResponse,
      'ANALYZE'
    )

    // Helper to sanitize any JSON value, strip markdown fences if string, and remove undefined
    const sanitizeJsonValue = <T>(val: T, fallback: T): T => {
      if (val === undefined || val === null) return fallback
      if (typeof val === 'string') {
        const stripped = val.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim()
        try {
          return JSON.parse(stripped)
        } catch {
          return stripped as unknown as T
        }
      }
      try {
        return JSON.parse(JSON.stringify(val))
      } catch {
        return fallback
      }
    }

    // Ensure overall_score is an integer clamped 0-100
    const overallScore = Math.min(100, Math.max(0, Math.round(Number(validated.overall_score) || 0)))

    const cleanSectionScores = sanitizeJsonValue({
      skills: Math.min(100, Math.max(0, Math.round(Number(validated.section_scores?.skills ?? 50)))),
      education: Math.min(100, Math.max(0, Math.round(Number(validated.section_scores?.education ?? 50)))),
      experience: Math.min(100, Math.max(0, Math.round(Number(validated.section_scores?.experience ?? 50)))),
      projects: Math.min(100, Math.max(0, Math.round(Number(validated.section_scores?.projects ?? 50)))),
      formatting: Math.min(100, Math.max(0, Math.round(Number(validated.section_scores?.formatting ?? 50)))),
      grammar: Math.min(100, Math.max(0, Math.round(Number(validated.section_scores?.grammar ?? 50)))),
      summary: String(validated.summary || '').trim(),
      score_rationale: String(validated.score_rationale || '').trim(),
      strengths: Array.isArray(validated.strengths) ? validated.strengths.map(String) : [],
      areas_for_improvement: Array.isArray(validated.areas_for_improvement) ? validated.areas_for_improvement.map(String) : [],
    }, {})

    const cleanFeedback = sanitizeJsonValue(
      Array.isArray(validated.feedback)
        ? validated.feedback.map((f) => ({
            section: String(f.section || ''),
            score: Math.min(100, Math.max(0, Math.round(Number(f.score ?? 50)))),
            summary: String(f.summary || ''),
            suggestions: Array.isArray(f.suggestions)
              ? f.suggestions.map((s) => ({
                  section: String(s.section || ''),
                  original: String(s.original || ''),
                  rewritten: String(s.rewritten || ''),
                  rationale: String(s.rationale || ''),
                }))
              : [],
          }))
        : [],
      []
    )

    const cleanAtsIssues = sanitizeJsonValue(
      Array.isArray(validated.ats_issues)
        ? validated.ats_issues.map((i) => ({
            severity: (['high', 'medium', 'low'].includes(String(i.severity)) ? i.severity : 'medium') as 'high' | 'medium' | 'low',
            section: String(i.section || 'General'),
            issue: String(i.issue || ''),
            fix: String(i.fix || ''),
          }))
        : [],
      []
    )

    const insertPayload = {
      resume_id: resume.id,
      user_id: user.id,
      overall_score: overallScore,
      section_scores: cleanSectionScores,
      feedback: cleanFeedback,
      ats_issues: cleanAtsIssues,
    }

    const payloadKeys = Object.keys(insertPayload)
    console.log('[ANALYZE] Attempting insert into analyses with keys:', payloadKeys)

    // Store in analyses table
    const { data: analysis, error: insertError } = await supabase
      .from('analyses')
      .insert(insertPayload)
      .select('id')
      .single()

    if (insertError || !analysis) {
      console.error('[ANALYZE] Supabase error saving analysis:', {
        message: insertError?.message,
        code: insertError?.code,
        details: insertError?.details,
        hint: insertError?.hint,
        keys: payloadKeys,
      })

      // Gracefully return analysis even if database saving failed
      return NextResponse.json({
        success: true,
        saved: false,
        warning: 'Analysis generated successfully, but could not be saved to your database history.',
        analysisId: null,
        ...validated,
        overall_score: overallScore,
        section_scores: cleanSectionScores,
        feedback: cleanFeedback,
        ats_issues: cleanAtsIssues,
      })
    }

    return NextResponse.json({
      success: true,
      saved: true,
      analysisId: analysis.id,
      ...validated,
      overall_score: overallScore,
      section_scores: cleanSectionScores,
      feedback: cleanFeedback,
      ats_issues: cleanAtsIssues,
    })
  } catch (err: unknown) {
    logServerError('ANALYZE', err)
    const friendly = getFriendlyErrorMessage(err)
    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}
