import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      fullName?: string
      email?: string
      password?: string
    }

    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const fullName = body.fullName?.trim() || ''

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    if (!fullName) {
      return NextResponse.json(
        { error: 'Full name is required.' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      )
    }

    const ip = getClientIp(request.headers)
    const ipCheck = checkRateLimit(`signup:ip:${ip}`, 10, 15 * 60 * 1000)
    const emailCheck = checkRateLimit(`signup:email:${email}`, 5, 15 * 60 * 1000)

    if (!ipCheck.allowed || !emailCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please wait a few minutes before trying again.' },
        { status: 429 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
      console.error('[AUTH] Supabase configuration missing for signup')
      return NextResponse.json(
        { error: 'Server authentication configuration missing.' },
        { status: 500 }
      )
    }

    // Use admin client to check if a confirmed user with this email already exists
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: listData } = await adminClient.auth.admin.listUsers()
    const existingUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === email
    )

    if (existingUser?.email_confirmed_at) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Sign in instead.', alreadyExists: true },
        { status: 409 }
      )
    }

    // Use the anon client so Supabase sends a real confirmation OTP email.
    // We do NOT pass email_confirm:true — the user must verify via OTP.
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (signUpError) {
      console.warn(`[AUTH] Signup failed for ${email}:`, signUpError.message)
      const msg = (signUpError.message || '').toLowerCase()
      if (
        msg.includes('already') ||
        msg.includes('exists') ||
        signUpError.status === 422 ||
        (signUpError as { code?: string }).code === 'email_exists' ||
        (signUpError as { code?: string }).code === 'user_already_exists'
      ) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Sign in instead.', alreadyExists: true },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: signUpError.message || 'Failed to create account. Please try again.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      userId: signUpData.user?.id,
      requiresOtp: true,
    })
  } catch (err) {
    console.error('[AUTH] Unexpected signup route error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
