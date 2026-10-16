import { createClient } from '@/lib/supabase/server'
import {
  buildMockTestPrompt,
  validateMockTestResponse,
  mockTestResponseSchema,
} from '@/lib/mock-test-prompt'
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

    // 1. Fetch saved mock test
    const { data: testRow } = await supabase
      .from('mock_tests')
      .select('content, created_at')
      .eq('resume_id', resumeId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 2. Fetch latest test attempt if available
    const { data: latestAttempt } = await supabase
      .from('mock_test_attempts')
      .select('score, total, percentage, weak_topics, answers, created_at')
      .eq('resume_id', resumeId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (testRow?.content) {
      const content = testRow.content as { difficulty?: string; questions?: unknown[] }
      return NextResponse.json({
        success: true,
        saved: true,
        difficulty: content.difficulty || 'intermediate',
        questions: content.questions || [],
        latestAttempt: latestAttempt || null,
      })
    }

    return NextResponse.json({
      success: true,
      saved: false,
      data: null,
      latestAttempt: latestAttempt || null,
    })
  } catch (err) {
    logServerError('MOCK_TEST_GET', err)
    return NextResponse.json({ error: 'Failed to fetch saved mock test.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    try {
      getGeminiApiKey()
    } catch (keyErr) {
      logServerError('MOCK-TEST', keyErr)
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
      console.error('[MOCK-TEST] Supabase Auth Error / Unauthorized:', authError?.message || 'No user session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      resumeId?: string
      difficulty?: 'beginner' | 'intermediate' | 'advanced'
      regenerate?: boolean
    }
    const { resumeId, regenerate } = body
    const difficulty = body.difficulty || 'intermediate'

    if (!resumeId) {
      console.error('[MOCK-TEST] Validation failed: resumeId is missing from request body')
      return NextResponse.json({ error: 'resumeId is required.' }, { status: 400 })
    }

    // Check if saved mock test exists unless forcing regenerate
    if (!regenerate) {
      const { data: existingTest } = await supabase
        .from('mock_tests')
        .select('content')
        .eq('resume_id', resumeId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingTest?.content) {
        const content = existingTest.content as { difficulty?: string; questions?: unknown[] }
        return NextResponse.json({
          success: true,
          saved: true,
          difficulty: content.difficulty || difficulty,
          questions: content.questions || [],
        })
      }
    }

    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('id, raw_text, user_id')
      .eq('id', resumeId)
      .single()

    if (resumeError) {
      console.error('[MOCK-TEST] Supabase error fetching resume:', {
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
      console.error('[MOCK-TEST] Resume not found for id:', resumeId)
      return NextResponse.json({ error: 'Resume not found.' }, { status: 404 })
    }

    if (resume.user_id !== user.id) {
      console.error('[MOCK-TEST] Security violation: User does not own resume', {
        userId: user.id,
        ownerId: resume.user_id,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!resume.raw_text || resume.raw_text.trim().length === 0) {
      console.error('[MOCK-TEST] Resume has empty extracted text for id:', resumeId)
      return NextResponse.json(
        { error: 'Resume contains no readable text. Please re-upload your resume.' },
        { status: 400 }
      )
    }

    const { system, user: userPrompt } = buildMockTestPrompt(resume.raw_text, difficulty)

    // Generate and validate mock test with automatic retry, schema enforcement, and model fallback
    const validated = await generateJsonWithRetry(
      {
        contents: [{ role: 'user', parts: [{ text: `${system}\n\n${userPrompt}` }] }],
        config: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      },
      (parsed) => validateMockTestResponse(parsed, difficulty),
      'MOCK-TEST',
      mockTestResponseSchema
    )

    // Save to mock_tests table
    try {
      if (regenerate) {
        await supabase
          .from('mock_tests')
          .delete()
          .eq('resume_id', resumeId)
          .eq('user_id', user.id)
      }

      await supabase.from('mock_tests').insert({
        resume_id: resumeId,
        user_id: user.id,
        content: {
          difficulty: validated.difficulty,
          questions: validated.questions,
        },
      })
    } catch (saveErr) {
      console.warn('[MOCK-TEST] Note on saving mock test to database:', saveErr)
    }

    return NextResponse.json({
      success: true,
      ...validated,
    })
  } catch (err: unknown) {
    logServerError('MOCK-TEST', err)
    const friendly = getFriendlyErrorMessage(err)
    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}
