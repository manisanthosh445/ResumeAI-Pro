import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: 'Resume ID is required.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. You must be logged in to delete a resume.' },
        { status: 401 }
      )
    }

    // Verify resume exists and belongs to the authenticated user
    const { data: resume, error: fetchError } = await supabase
      .from('resumes')
      .select('id, user_id, file_name')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('[DELETE /api/resumes/[id]] Supabase fetch error:', fetchError)
      return NextResponse.json(
        { error: `Database error: ${fetchError.message}` },
        { status: 500 }
      )
    }

    if (!resume) {
      return NextResponse.json(
        { error: 'Resume not found or you do not have permission to delete it.' },
        { status: 404 }
      )
    }

    // Defensive deletion of child records in order, in case ON DELETE CASCADE is missing
    // 1. Delete associated analyses
    const { error: analysesError } = await supabase
      .from('analyses')
      .delete()
      .eq('resume_id', id)

    if (analysesError) {
      console.error('[DELETE /api/resumes/[id]] Failed to delete analyses:', analysesError)
      return NextResponse.json(
        { error: `Failed to delete analyses: ${analysesError.message}` },
        { status: 500 }
      )
    }

    // 2. Delete associated study guides
    const { error: studyGuidesError } = await supabase
      .from('study_guides')
      .delete()
      .eq('resume_id', id)

    if (studyGuidesError) {
      console.error('[DELETE /api/resumes/[id]] Failed to delete study guides:', studyGuidesError)
      return NextResponse.json(
        { error: `Failed to delete study guides: ${studyGuidesError.message}` },
        { status: 500 }
      )
    }

    // 3. Delete any resume files stored in Supabase Storage if present
    try {
      const storageBuckets = ['resumes', 'resume_files']
      for (const bucket of storageBuckets) {
        const potentialPaths = [
          `${user.id}/${id}`,
          `${user.id}/${resume.file_name}`,
          `${id}`,
          `${id}/${resume.file_name}`,
        ]
        await supabase.storage.from(bucket).remove(potentialPaths)
      }
    } catch {
      // Storage buckets may not exist or storage may not be used; safely ignore
    }

    // 4. Delete the resume row itself, enforcing user_id ownership
    const { error: deleteError } = await supabase
      .from('resumes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('[DELETE /api/resumes/[id]] Failed to delete resume:', deleteError)
      return NextResponse.json(
        { error: `Failed to delete resume: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Resume deleted successfully.',
    })
  } catch (err: unknown) {
    console.error('[DELETE /api/resumes/[id]] Unexpected error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
