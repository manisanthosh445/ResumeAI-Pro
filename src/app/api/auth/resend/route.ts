import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      type?: 'login' | 'signup'
    }

    const email = body.email?.trim().toLowerCase()
    const type = body.type || 'login'

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required.' },
        { status: 400 }
      )
    }

    const ip = getClientIp(request.headers)
    const ipCheck = checkRateLimit(`resend:ip:${ip}`, 5, 15 * 60 * 1000)
    const emailCheck = checkRateLimit(`resend:email:${email}`, 5, 15 * 60 * 1000)

    if (!ipCheck.allowed || !emailCheck.allowed) {
      const resetIn = Math.max(ipCheck.resetInSec, emailCheck.resetInSec)
      const minutes = Math.ceil(resetIn / 60)
      return NextResponse.json(
        {
          error: `Too many resend attempts. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before requesting another code.`,
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

    if (type === 'signup') {
      const { error } = await tempClient.auth.resend({
        type: 'signup',
        email,
      })
      if (error) {
        console.error('[AUTH] Resend signup code error:', {
          message: error.message,
          status: error.status,
          code: error.code,
        })
        const msg = error.message.toLowerCase()
        if (msg.includes('already confirmed') || msg.includes('already verified')) {
          return NextResponse.json(
            { error: 'Your email is already verified. Please sign in.' },
            { status: 400 }
          )
        }
        if (msg.includes('rate') || error.status === 429) {
          return NextResponse.json(
            { error: 'Too many attempts. Please wait a few minutes before trying again.' },
            { status: 429 }
          )
        }
      }
    } else {
      // Login OTP resend
      const { error } = await tempClient.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      })
      if (error) {
        console.error('[AUTH] Resend login OTP error:', {
          message: error.message,
          status: error.status,
          code: error.code,
        })
        const msg = error.message.toLowerCase()
        if (msg.includes('rate') || error.status === 429) {
          return NextResponse.json(
            { error: 'Too many attempts. Please wait a few minutes before trying again.' },
            { status: 429 }
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'A new code was sent. Use the newest email.',
    })
  } catch (err) {
    console.error('[AUTH] Unexpected resend error:', err)
    return NextResponse.json(
      { error: 'Failed to resend code. Please try again.' },
      { status: 500 }
    )
  }
}
