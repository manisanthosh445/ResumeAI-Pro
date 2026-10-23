import { createClient } from '@/lib/supabase/server'
import { extractResumeText } from '@/lib/extract-resume'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File is too large. Maximum allowed size is 5 MB.' },
        { status: 400 }
      )
    }

    console.log(`[Upload] Processing "${file.name}" (${file.type || 'unknown type'}, ${Math.round(file.size / 1024)} KB)`)

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract text
    const extractStartTime = Date.now()
    const { text, pageCount } = await extractResumeText(buffer, file.type, file.name)
    const extractDuration = Date.now() - extractStartTime
    console.log(`[Upload] Extracted ${text.length} chars from "${file.name}" in ${extractDuration}ms`)

    // Store in Supabase
    const dbStartTime = Date.now()
    const { data: resume, error: insertError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        file_name: file.name,
        raw_text: text,
      })
      .select('id')
      .single()

    const dbDuration = Date.now() - dbStartTime

    if (insertError || !resume) {
      console.error('[Upload] Resume DB insert error:', insertError?.message || insertError)
      return NextResponse.json({ error: 'Failed to save resume to database.' }, { status: 500 })
    }

    const totalDuration = Date.now() - startTime
    console.log(`[Upload] Completed upload for resumeId=${resume.id} in ${totalDuration}ms (db: ${dbDuration}ms)`)

    return NextResponse.json({
      resumeId: resume.id,
      fileName: file.name,
      charCount: text.length,
      pageCount: pageCount ?? null,
      preview: text.slice(0, 500),
    })
  } catch (err) {
    const totalDuration = Date.now() - startTime
    console.error(`[Upload] Failed after ${totalDuration}ms:`, err instanceof Error ? err.message : String(err))
    const message = err instanceof Error ? err.message : 'An unexpected error occurred during resume processing.'

    // Classify error status for appropriate HTTP reporting
    let status = 400
    if (message.includes('AI service is busy') || message.includes('503')) {
      status = 503
    } else if (message.includes('AI key problem') || message.includes('GEMINI_API_KEY')) {
      status = 500
    } else if (message.includes('502') || message.includes('invalid response')) {
      status = 502
    }

    return NextResponse.json({ error: message }, { status })
  }
}
