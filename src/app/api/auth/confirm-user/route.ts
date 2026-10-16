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
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const ip = getClientIp(request.headers)
    const limit = checkRateLimit(`confirm-user:${ip}`, 10, 15 * 60 * 1000)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Config missing' }, { status: 500 })
    }

    // Verify credentials first using anon client
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { error: signInError } = await tempClient.auth.signInWithPassword({
      email,
      password,
    })

    // If credentials are valid, signInError will either be null or 'Email not confirmed'
    const msg = (signInError?.message || '').toLowerCase()
    const isUnconfirmed = msg.includes('not confirmed') || (signInError as { code?: string })?.code === 'email_not_confirmed'

    if (!signInError || isUnconfirmed) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      const { data: list } = await adminClient.auth.admin.listUsers()
      const user = list?.users?.find((u) => u.email?.toLowerCase() === email)

      if (user) {
        await adminClient.auth.admin.updateUserById(user.id, { email_confirm: true })
        return NextResponse.json({ success: true })
      }
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  } catch (err) {
    console.error('[AUTH] Auto-confirm error:', err)
    return NextResponse.json({ error: 'Failed to auto-confirm user' }, { status: 500 })
  }
}
