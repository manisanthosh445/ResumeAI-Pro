'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle,
  Loader2,
  LogIn,
  RefreshCw,
} from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const customMessage = searchParams.get('message')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const urlErr = searchParams.get('error')
  const isVerifiedParam = searchParams.get('verified') === 'true' || searchParams.get('confirmed') === 'true'

  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    if (urlErr === 'auth_callback_failed') {
      return 'Verification link is invalid or has expired. Please sign in below.'
    }
    return null
  })
  const [successNotice, setSuccessNotice] = useState<string | null>(() => {
    if (customMessage) return customMessage
    if (isVerifiedParam) return 'Your account is ready! Please sign in.'
    return null
  })
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessNotice(null)
    setUnverifiedEmail(null)
    setResendSuccess(false)
    setLoading(true)

    try {
      const supabase = createClient()
      const cleanEmail = email.trim().toLowerCase()

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })

      if (signInError) {
        const msg = (signInError.message || '').toLowerCase()
        const code = (signInError as { code?: string }).code

        // Unverified account — show helpful message with resend option
        if (
          msg.includes('not confirmed') ||
          msg.includes('email not confirmed') ||
          code === 'email_not_confirmed'
        ) {
          setUnverifiedEmail(cleanEmail)
          setError(
            'Your email address has not been verified yet. Please check your inbox for a verification email, or request a new one below.'
          )
          setLoading(false)
          return
        }

        if (msg.includes('invalid') || msg.includes('credentials') || signInError.status === 400) {
          setError('Invalid email or password. Please try again.')
        } else {
          setError('Failed to sign in. Please try again.')
        }
        setLoading(false)
        return
      }

      if (data?.session || data?.user) {
        router.push(redirectTo)
        router.refresh()
      } else {
        setError('Failed to establish session. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Unable to connect to the authentication server. Please try again.')
      setLoading(false)
    }
  }

  async function handleResendVerification() {
    if (!unverifiedEmail || resendLoading) return
    setResendLoading(true)
    setError(null)
    setResendSuccess(false)

    try {
      const res = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail, type: 'signup' }),
      })

      const data = await res.json().catch(() => ({})) as { error?: string }

      if (!res.ok) {
        setError(data.error || 'Failed to resend verification email. Please try again.')
      } else {
        setResendSuccess(true)
      }
    } catch {
      setError('Network error. Could not resend verification email.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="card" style={{ width: '100%', maxWidth: 440, padding: '2.25rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
          Welcome back
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Sign in to access your dashboard and saved resumes
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            padding: '0.875rem',
            background: 'rgba(225, 29, 46, 0.08)',
            border: '1px solid rgba(225, 29, 46, 0.3)',
            borderRadius: '6px',
            color: 'var(--accent-red)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span>{error}</span>
            {unverifiedEmail && !resendSuccess && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'none',
                  border: '1px solid rgba(225, 29, 46, 0.4)',
                  borderRadius: '4px',
                  color: 'var(--accent-red)',
                  cursor: resendLoading ? 'not-allowed' : 'pointer',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  width: 'fit-content',
                }}
              >
                {resendLoading ? (
                  <><Loader2 size={12} className="animate-spin" /> Sending&hellip;</>
                ) : (
                  <><RefreshCw size={12} /> Resend verification email</>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Resend success */}
      {resendSuccess && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.875rem',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '6px',
            color: '#4ade80',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
          }}
        >
          <CheckCircle size={16} style={{ flexShrink: 0 }} />
          <span>Verification email sent! Check your inbox and follow the instructions.</span>
        </div>
      )}

      {/* Success Notice */}
      {successNotice && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            padding: '0.875rem',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '6px',
            color: '#4ade80',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
          }}
        >
          <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Email */}
        <div>
          <label
            htmlFor="login-email"
            style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}
          >
            Email address
          </label>
          <div style={{ position: 'relative' }}>
            <Mail
              size={16}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
              className="input"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
            <label
              htmlFor="login-password"
              style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}
            >
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              style={{ fontSize: '0.75rem', color: 'var(--accent-red)', textDecoration: 'none' }}
            >
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <Lock
              size={16}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              className="input"
              style={{ paddingLeft: '2.25rem', paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.25rem' }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Signing in&hellip;</span>
            </>
          ) : (
            <>
              <LogIn size={16} />
              <span>Sign in</span>
            </>
          )}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" style={{ color: 'var(--accent-red)', fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 2rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Link href="/">
          <Logo size="sm" />
        </Link>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" style={{ color: 'var(--brand-red)', fontWeight: 600 }}>
            Sign up
          </Link>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
        }}
      >
        <Suspense fallback={<div className="card" style={{ width: '100%', maxWidth: 440, height: 320 }} />}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  )
}
