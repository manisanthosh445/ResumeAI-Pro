import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const rawNext = searchParams.get('next')

  let next = '/dashboard'
  if (type === 'recovery') {
    next = '/auth/reset-password'
  }

  // Prevent open redirect attacks: only allow valid relative paths
  if (
    rawNext &&
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.startsWith('/\\') &&
    !rawNext.includes(':')
  ) {
    next = rawNext
  }

  const supabase = await createClient()

  // Format A: PKCE code exchange (?code=...)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[AUTH] Exchange code for session failed:', {
      message: error.message,
      status: error.status,
      code: error.code,
    })
  }

  // Format B: Token hash verification (?token_hash=...&type=...)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[AUTH] verifyOtp with token_hash failed:', {
      message: error.message,
      status: error.status,
      code: error.code,
    })
  }

  // Fallback: Check if an active session is already established
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
