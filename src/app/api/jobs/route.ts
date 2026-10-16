import { createClient } from '@/lib/supabase/server'
import {
  buildJobsPrompt,
  validateJobRecommendationsResponse,
  jobRecommendationsResponseSchema,
} from '@/lib/jobs-prompt'
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

    const { data: rec } = await supabase
      .from('job_recommendations')
      .select('content, created_at')
      .eq('resume_id', resumeId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (rec?.content) {
      const content = rec.content as {
        strongest_area?: string
        top_unlocking_skills?: string[]
        summary?: string
        roles?: unknown[]
      }
      return NextResponse.json({
        success: true,
        saved: true,
        strongest_area: content.strongest_area || '',
        top_unlocking_skills: content.top_unlocking_skills || [],
        summary: content.summary || '',
        roles: content.roles || [],
      })
    }

    return NextResponse.json({
      success: true,
      saved: false,
      data: null,
    })
  } catch (err) {
    logServerError('JOBS_GET', err)
    return NextResponse.json({ error: 'Failed to fetch saved job recommendations.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    try {
      getGeminiApiKey()
    } catch (keyErr) {
      logServerError('JOBS', keyErr)
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
      console.error('[JOBS] Supabase Auth Error / Unauthorized:', authError?.message || 'No user session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      resumeId?: string
      regenerate?: boolean
    }
    const { resumeId, regenerate } = body

    if (!resumeId) {
      console.error('[JOBS] Validation failed: resumeId is missing from request body')
      return NextResponse.json({ error: 'resumeId is required.' }, { status: 400 })
    }

    // Check if saved result exists unless regenerating
    if (!regenerate) {
      const { data: existingRec } = await supabase
        .from('job_recommendations')
        .select('content')
        .eq('resume_id', resumeId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingRec?.content) {
        const content = existingRec.content as {
          strongest_area?: string
          top_unlocking_skills?: string[]
          summary?: string
          roles?: unknown[]
        }
        return NextResponse.json({
          success: true,
          saved: true,
          strongest_area: content.strongest_area || '',
          top_unlocking_skills: content.top_unlocking_skills || [],
          summary: content.summary || '',
          roles: content.roles || [],
        })
      }
    }

    // Fetch resume and verify ownership
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('id, raw_text, user_id')
      .eq('id', resumeId)
      .single()

    if (resumeError) {
      console.error('[JOBS] Supabase error fetching resume:', {
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
      console.error('[JOBS] Resume not found for id:', resumeId)
      return NextResponse.json({ error: 'Resume not found.' }, { status: 404 })
    }

    if (resume.user_id !== user.id) {
      console.error('[JOBS] Security violation: User does not own resume', {
        userId: user.id,
        ownerId: resume.user_id,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!resume.raw_text || resume.raw_text.trim().length === 0) {
      console.error('[JOBS] Resume has empty extracted text for id:', resumeId)
      return NextResponse.json(
        { error: 'Resume contains no readable text. Please re-upload your resume.' },
        { status: 400 }
      )
    }

    // Optionally retrieve analysis data to personalize recommendations
    let analysisContext: string | undefined
    try {
      const { data: analysis, error: aErr } = await supabase
        .from('analyses')
        .select('section_scores, ats_issues, feedback')
        .eq('resume_id', resumeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (aErr) {
        console.warn('[JOBS] Note: Failed to fetch previous analysis data:', aErr.message)
      } else if (analysis) {
        analysisContext = JSON.stringify({
          scores: analysis.section_scores,
          ats_issues: analysis.ats_issues,
          feedback: analysis.feedback,
        })
      }
    } catch (analysisFetchErr) {
      console.warn('[JOBS] Note: analysis query encountered error:', analysisFetchErr)
    }

    const { system, user: userPrompt } = buildJobsPrompt(resume.raw_text, analysisContext)

    // Generate and validate job recommendations with model fallback & schema enforcement
    const validated = await generateJsonWithRetry(
      {
        contents: [{ role: 'user', parts: [{ text: `${system}\n\n${userPrompt}` }] }],
        config: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      },
      validateJobRecommendationsResponse,
      'JOBS',
      jobRecommendationsResponseSchema
    )

    // Save to job_recommendations table
    try {
      if (regenerate) {
        await supabase
          .from('job_recommendations')
          .delete()
          .eq('resume_id', resumeId)
          .eq('user_id', user.id)
      }

      await supabase.from('job_recommendations').insert({
        resume_id: resumeId,
        user_id: user.id,
        content: {
          strongest_area: validated.strongest_area,
          top_unlocking_skills: validated.top_unlocking_skills,
          summary: validated.summary,
          roles: validated.roles,
        },
      })
    } catch (saveErr) {
      console.warn('[JOBS] Note on saving job recommendations to database:', saveErr)
    }

    return NextResponse.json({
      success: true,
      ...validated,
    })
  } catch (err: unknown) {
    logServerError('JOBS', err)
    const friendly = getFriendlyErrorMessage(err)
    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}
