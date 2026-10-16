import { createClient } from '@/lib/supabase/server'
import { extractResumeText } from '@/lib/extract-resume'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
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

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract text
    const { text, pageCount } = await extractResumeText(buffer, file.type, file.name)

    // Store in Supabase
    const { data: resume, error: insertError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        file_name: file.name,
        raw_text: text,
      })
      .select('id')
      .single()

    if (insertError || !resume) {
      console.error('Resume insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save resume.' }, { status: 500 })
    }

    return NextResponse.json({
      resumeId: resume.id,
      fileName: file.name,
      charCount: text.length,
      pageCount: pageCount ?? null,
      preview: text.slice(0, 500),
    })
  } catch (err) {
    console.error('[Upload Route] Extraction or processing error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
