import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logServerError } from '@/lib/gemini'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      resumeId?: string
      score?: number
      total?: number
      percentage?: number
      weak_topics?: string[]
      answers?: Record<string, number>
    }

    const { resumeId, score, total, percentage, weak_topics, answers } = body

    if (!resumeId || score === undefined || total === undefined) {
      return NextResponse.json({ error: 'Missing required attempt fields.' }, { status: 400 })
    }

    const computedPercentage = percentage ?? (total > 0 ? Math.round((score / total) * 100) : 0)

    const { data: attempt, error: insertError } = await supabase
      .from('mock_test_attempts')
      .insert({
        resume_id: resumeId,
        user_id: user.id,
        score,
        total,
        total_questions: total,
        percentage: computedPercentage,
        weak_topics: Array.isArray(weak_topics) ? weak_topics : [],
        answers: answers || {},
      })
      .select('id, created_at')
      .single()

    if (insertError) {
      console.warn('[MOCK_TEST_ATTEMPT] Failed to save attempt to Supabase:', insertError)
      return NextResponse.json({ error: 'Failed to record attempt.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      attemptId: attempt?.id,
    })
  } catch (err) {
    logServerError('MOCK_TEST_ATTEMPT', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
