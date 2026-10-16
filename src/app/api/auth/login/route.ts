import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      password?: string
    }

    const email = body.email?.trim().toLowerCase()
    const password = body.password

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    const ip = getClientIp(request.headers)
    const ipCheck = checkRateLimit(`login:ip:${ip}`, 5, 15 * 60 * 1000)
    const emailCheck = checkRateLimit(`login:email:${email}`, 5, 15 * 60 * 1000)

    if (!ipCheck.allowed || !emailCheck.allowed) {
      const resetIn = Math.max(ipCheck.resetInSec, emailCheck.resetInSec)
      const minutes = Math.ceil(resetIn / 60)
      console.warn(`[AUTH] Rate limit exceeded for login: ip=${ip}, email=${email}`)
      return NextResponse.json(
        {
          error: `Too many login attempts. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`,
        },
        { status: 429 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[AUTH] Supabase configuration missing')
      return NextResponse.json(
        { error: 'Server authentication configuration missing.' },
        { status: 500 }
      )
    }

    // Ephemeral client that NEVER persists sessions or sets browser cookies
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Step 1: Verify credentials on server
    const { data: signInData, error: signInError } =
      await tempClient.auth.signInWithPassword({
        email,
        password,
      })

    if (signInError || !signInData.user) {
      console.warn(`[AUTH] Invalid credentials attempt for email: ${email}`)
      // Generic message to avoid credential enumeration
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    // Step 2: Trigger 6-digit email OTP. The session from step 1 is discarded immediately.
    const { error: otpError } = await tempClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    })

    if (otpError) {
      console.error('[AUTH] signInWithOtp failed:', otpError.message)
      if (otpError.message?.toLowerCase().includes('rate') || otpError.status === 429) {
        return NextResponse.json(
          { error: 'Too many verification code requests. Please wait a moment and try again.' },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to send verification code. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email.',
    })
  } catch (err) {
    console.error('[AUTH] Unexpected login route error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
