import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/auth/verify-signup
 * Verifies the signup OTP. On success, ensures the profile row exists in public.profiles.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      token?: string
    }

    const email = body.email?.trim().toLowerCase()
    const token = body.token?.replace(/\D/g, '').trim()

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and verification code are required.' },
        { status: 400 }
      )
    }

    if (token.length < 6) {
      return NextResponse.json(
        { error: 'Please enter a valid verification code.' },
        { status: 400 }
      )
    }

    const ip = getClientIp(request.headers)
    const limit = checkRateLimit(`verify-signup:${ip}`, 10, 15 * 60 * 1000)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please wait a few minutes.' },
        { status: 429 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server authentication configuration missing.' },
        { status: 500 }
      )
    }

    // Verify OTP using anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: verifyData, error: verifyError } = await anonClient.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    })

    if (verifyError) {
      console.warn('[AUTH] Signup OTP verify failed:', verifyError.message)
      const msg = (verifyError.message || '').toLowerCase()

      if (msg.includes('already confirmed') || msg.includes('already verified')) {
        return NextResponse.json(
          { error: 'Your account is already verified. Please sign in.', alreadyVerified: true },
          { status: 400 }
        )
      }
      if (msg.includes('rate') || verifyError.status === 429) {
        return NextResponse.json(
          { error: 'Too many attempts. Please wait a few minutes before trying again.' },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: 'Invalid or expired verification code. Please check your code or request a new one.' },
        { status: 400 }
      )
    }

    const userId = verifyData?.user?.id
    const userMeta = verifyData?.user?.user_metadata
    const fullName = (userMeta?.full_name as string) || ''

    // Upsert the profile row via admin client to ensure full_name is correct.
    // The DB trigger on auth.users INSERT handles creation but we upsert to be safe.
    if (userId) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      const { error: upsertError } = await adminClient
        .from('profiles')
        .upsert(
          { id: userId, full_name: fullName, email },
          { onConflict: 'id' }
        )

      if (upsertError) {
        console.warn('[AUTH] Profile upsert after OTP verify failed:', upsertError.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully.',
    })
  } catch (err) {
    console.error('[AUTH] Unexpected verify-signup error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
