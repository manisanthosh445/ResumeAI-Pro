import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * This endpoint is intentionally disabled.
 * Auto-confirming users without OTP verification is a security vulnerability.
 * Users must verify their email via the OTP sent by Supabase during signup.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is no longer available.' },
    { status: 410 }
  )
}
