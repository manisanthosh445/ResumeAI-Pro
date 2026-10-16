import { createClient } from '@/lib/supabase/server'
import {
  buildStudyPrompt,
  validateStudyGuideResponse,
  studyGuideResponseSchema,
} from '@/lib/study-prompt'
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

    // 1. Try study_plans (content jsonb format)
    const { data: plan } = await supabase
      .from('study_plans')
      .select('content, created_at')
      .eq('resume_id', resumeId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (plan?.content) {
      const content = plan.content as { domain?: string; summary?: string; topics?: unknown[] }
      return NextResponse.json({
        success: true,
        saved: true,
        domain: content.domain || 'Software Development',
        summary: content.summary || '',
        topics: content.topics || [],
      })
    }

    // 2. Fallback to study_guides table
    const { data: guide } = await supabase
      .from('study_guides')
      .select('domain, summary, topics, created_at')
      .eq('resume_id', resumeId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (guide) {
      return NextResponse.json({
        success: true,
        saved: true,
        domain: guide.domain,
        summary: guide.summary,
        topics: guide.topics,
      })
    }

    return NextResponse.json({
      success: true,
      saved: false,
      data: null,
    })
  } catch (err) {
    logServerError('STUDY_GET', err)
    return NextResponse.json({ error: 'Failed to fetch saved study guide.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    try {
      getGeminiApiKey()
    } catch (keyErr) {
      logServerError('STUDY', keyErr)
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
      console.error('[STUDY] Supabase Auth Error / Unauthorized:', authError?.message || 'No user session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      resumeId?: string
      regenerate?: boolean
    }
    const { resumeId, regenerate } = body

    if (!resumeId) {
      console.error('[STUDY] Validation failed: resumeId is missing from request body')
      return NextResponse.json({ error: 'resumeId is required.' }, { status: 400 })
    }

    // If not forcing regenerate, check if saved result already exists
    if (!regenerate) {
      // 1. Check study_plans
      const { data: existingPlan } = await supabase
        .from('study_plans')
        .select('content')
        .eq('resume_id', resumeId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingPlan?.content) {
        const content = existingPlan.content as { domain?: string; summary?: string; topics?: unknown[] }
        return NextResponse.json({
          success: true,
          saved: true,
          domain: content.domain || 'Software Development',
          summary: content.summary || '',
          topics: content.topics || [],
        })
      }

      // 2. Check study_guides
      const { data: existingGuide } = await supabase
        .from('study_guides')
        .select('domain, summary, topics')
        .eq('resume_id', resumeId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingGuide) {
        return NextResponse.json({
          success: true,
          saved: true,
          domain: existingGuide.domain,
          summary: existingGuide.summary,
          topics: existingGuide.topics,
        })
      }
    }

    // Fetch resume
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('id, raw_text, user_id')
      .eq('id', resumeId)
      .single()

    if (resumeError) {
      console.error('[STUDY] Supabase error fetching resume:', {
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
      console.error('[STUDY] Resume not found for id:', resumeId)
      return NextResponse.json({ error: 'Resume not found.' }, { status: 404 })
    }

    if (resume.user_id !== user.id) {
      console.error('[STUDY] Security violation: User does not own resume', {
        userId: user.id,
        ownerId: resume.user_id,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!resume.raw_text || resume.raw_text.trim().length === 0) {
      console.error('[STUDY] Resume has empty extracted text for id:', resumeId)
      return NextResponse.json(
        { error: 'Resume contains no readable text. Please re-upload your resume.' },
        { status: 400 }
      )
    }

    // Optionally retrieve analysis data to personalize gaps if available
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
        console.warn('[STUDY] Note: Failed to fetch previous analysis data:', aErr.message)
      } else if (analysis) {
        analysisContext = JSON.stringify({
          scores: analysis.section_scores,
          ats_issues: analysis.ats_issues,
          feedback: analysis.feedback,
        })
      }
    } catch (analysisFetchErr) {
      console.warn('[STUDY] Note: analysis query encountered error:', analysisFetchErr)
    }

    const { system, user: userPrompt } = buildStudyPrompt(resume.raw_text, analysisContext)

    // Generate and validate study guide with automatic retry, schema enforcement, and model fallback
    const validated = await generateJsonWithRetry(
      {
        contents: [{ role: 'user', parts: [{ text: `${system}\n\n${userPrompt}` }] }],
        config: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      },
      validateStudyGuideResponse,
      'STUDY',
      studyGuideResponseSchema
    )

    // Save/persist into study_plans (content jsonb) and study_guides
    try {
      // If regenerating, delete prior plan for this resume/user so only latest exists
      if (regenerate) {
        await supabase.from('study_plans').delete().eq('resume_id', resumeId).eq('user_id', user.id)
        await supabase.from('study_guides').delete().eq('resume_id', resumeId).eq('user_id', user.id)
      }

      await Promise.allSettled([
        supabase.from('study_plans').insert({
          resume_id: resumeId,
          user_id: user.id,
          content: {
            domain: validated.domain,
            summary: validated.summary,
            topics: validated.topics,
          },
        }),
        supabase.from('study_guides').insert({
          resume_id: resumeId,
          user_id: user.id,
          domain: validated.domain,
          summary: validated.summary,
          topics: validated.topics,
        }),
      ])
    } catch (saveErr) {
      console.warn('[STUDY] Note on saving study guide to database:', saveErr)
    }

    return NextResponse.json({
      success: true,
      ...validated,
    })
  } catch (err: unknown) {
    logServerError('STUDY', err)
    const friendly = getFriendlyErrorMessage(err)
    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}
