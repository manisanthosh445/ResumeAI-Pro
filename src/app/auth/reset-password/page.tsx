'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'
import { getFriendlyAuthErrorMessage, cleanOtpCode } from '@/lib/auth-errors'
import {
  Lock,
  Eye,
  EyeOff,
  Mail,
  AlertCircle,
  CheckCircle,
  Loader2,
  KeyRound,
  ArrowLeft,
} from 'lucide-react'

function calculatePasswordStrength(pass: string): { label: string; score: number; color: string } {
  if (!pass) return { label: 'Empty', score: 0, color: 'var(--text-muted)' }
  let score = 0
  if (pass.length >= 8) score += 1
  if (pass.length >= 12) score += 1
  if (/[0-9]/.test(pass)) score += 1
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1
  if (/[^A-Za-z0-9]/.test(pass)) score += 1

  if (score <= 2) return { label: 'Weak (add numbers/symbols)', score: 1, color: '#f87171' }
  if (score <= 4) return { label: 'Good', score: 2, color: '#fbbf24' }
  return { label: 'Strong', score: 3, color: '#4ade80' }
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get('email') || ''

  const [hasSession, setHasSession] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Check if user is already authenticated via recovery link from /auth/callback
  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session) {
          setHasSession(true)
        }
      } catch {
        // no active session
      } finally {
        setCheckingSession(false)
      }
    }
    checkAuth()
  }, [])

  const strength = calculatePasswordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      // If user does not have an active recovery session, verify the 6-digit code first
      if (!hasSession) {
        const cleanCode = cleanOtpCode(code)
        if (cleanCode.length !== 6) {
          setError('Please enter the 6-digit verification code from your email.')
          setLoading(false)
          return
        }

        const cleanEmail = email.trim().toLowerCase()
        if (!cleanEmail) {
          setError('Please enter your email address.')
          setLoading(false)
          return
        }

        const { error: otpError } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: 'recovery',
        })

        if (otpError) {
          console.error('[AUTH] Recovery OTP verification failed:', {
            message: otpError.message,
            status: otpError.status,
            code: otpError.code,
          })
          const friendly = getFriendlyAuthErrorMessage(otpError)
          setError(friendly.message)
          setLoading(false)
          return
        }
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.')
        setLoading(false)
        return
      }

      setSuccess(true)
      // Sign out to enforce the clean two-step sign-in with the new password
      await supabase.auth.signOut()

      setTimeout(() => {
        router.push('/auth/login')
      }, 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-red)', margin: '0 auto' }} />
      </div>
    )
  }

  return (
    <div className="card" style={{ width: '100%', maxWidth: 440, padding: '2.25rem' }}>
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
          Set new password
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {hasSession
            ? 'Enter your new secure password below'
            : 'Enter the 6-digit code from your email and your new password'}
        </p>
      </div>

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
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '1rem',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '6px',
              color: '#4ade80',
              fontSize: '0.875rem',
            }}
          >
            <CheckCircle size={18} style={{ flexShrink: 0 }} />
            <span>Password updated successfully! Redirecting to sign in…</span>
          </div>

          <Link href="/auth/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Sign in now &rarr;
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {!hasSession && (
            <>
              <div>
                <label
                  htmlFor="reset-email"
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
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="input"
                    style={{ paddingLeft: '2.25rem' }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reset-code"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}
                >
                  6-digit reset code
                </label>
                <div style={{ position: 'relative' }}>
                  <KeyRound
                    size={16}
                    style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    required
                    className="input"
                    style={{ paddingLeft: '2.25rem', letterSpacing: '0.2em', fontWeight: 700 }}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="new-password"
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}
            >
              New password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                className="input"
                style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
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
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {password.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Strength:</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
                <div style={{ width: '100%', height: 4, background: '#1f1f23', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(strength.score / 3) * 100}%`,
                      height: '100%',
                      background: strength.color,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}
            >
              Confirm new password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                minLength={8}
                className="input"
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || password.length < 8 || password !== confirmPassword}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.5rem' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Updating password…</span>
              </>
            ) : (
              <span>Save &amp; Update Password</span>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <Link href="/auth/login" className="btn btn-ghost" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <ArrowLeft size={14} />
              <span>Back to Sign in</span>
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
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
          <Link href="/auth/login" style={{ color: 'var(--brand-red)', fontWeight: 600 }}>
            Sign in
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
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  )
}
