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

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[AUTH] Supabase configuration missing for signup')
      return NextResponse.json(
        { error: 'Server authentication configuration missing.' },
        { status: 500 }
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Create user with email auto-confirmed so no OTP step is required
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    })

    if (createError) {
      console.warn(`[AUTH] Signup failed for ${email}:`, createError.message)
      const msg = (createError.message || '').toLowerCase()
      if (
        msg.includes('already') ||
        msg.includes('exists') ||
        createError.status === 422 ||
        (createError as { code?: string }).code === 'email_exists'
      ) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Sign in instead.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: createError.message || 'Failed to create account. Please try again.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      userId: createData.user?.id,
    })
  } catch (err) {
    console.error('[AUTH] Unexpected signup route error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
