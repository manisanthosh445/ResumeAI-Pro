import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string
    }

    const email = body.email?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required.' },
        { status: 400 }
      )
    }

    const ip = getClientIp(request.headers)
    const ipCheck = checkRateLimit(`forgot:ip:${ip}`, 5, 15 * 60 * 1000)
    const emailCheck = checkRateLimit(`forgot:email:${email}`, 5, 15 * 60 * 1000)

    if (!ipCheck.allowed || !emailCheck.allowed) {
      const resetIn = Math.max(ipCheck.resetInSec, emailCheck.resetInSec)
      const minutes = Math.ceil(resetIn / 60)
      return NextResponse.json(
        {
          error: `Too many password reset requests. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`,
        },
        { status: 429 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server authentication configuration missing.' },
        { status: 500 }
      )
    }

    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const origin = request.nextUrl.origin
    const { error } = await tempClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
    })

    if (error) {
      console.warn('[AUTH] resetPasswordForEmail notice:', error.message)
    }

    // Always return the same response so whether the email exists is not revealed
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, password reset instructions have been sent.',
    })
  } catch (err) {
    console.error('[AUTH] Unexpected forgot-password route error:', err)
    return NextResponse.json(
      { error: 'Failed to process password reset request. Please try again.' },
      { status: 500 }
    )
  }
}
