'use client'

import { useState, Suspense, useRef } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  AlertCircle,
  Loader2,
  CheckCircle,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Send,
} from 'lucide-react'

function calculatePasswordStrength(pass: string): { label: string; score: number; color: string } {
  if (!pass) return { label: 'Empty', score: 0, color: 'var(--text-muted)' }
  let score = 0
  if (pass.length >= 8) score += 1
  if (pass.length >= 12) score += 1
  if (/[0-9]/.test(pass)) score += 1
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1
  if (/[^A-Za-z0-9]/.test(pass)) score += 1
  if (score <= 2) return { label: 'Weak', score: 1, color: '#f87171' }
  if (score <= 4) return { label: 'Good', score: 2, color: '#fbbf24' }
  return { label: 'Strong', score: 3, color: '#4ade80' }
}

type Stage = 'form' | 'otp' | 'success'

const COOLDOWN_SECS = 60

function SignUpContent() {
  // ── Stage ──────────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>('form')

  // ── Form state ─────────────────────────────────────────────────────────────
  const [fullName, setFullName]         = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)

  // ── OTP state ──────────────────────────────────────────────────────────────
  const [otp, setOtp]         = useState('')
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false)

  const strength = calculatePasswordStrength(password)

  // ── Cooldown timer ─────────────────────────────────────────────────────────
  function startCooldown() {
    setCooldown(COOLDOWN_SECS)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  // ── Step 1: Validate form & send OTP ───────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsAlreadyRegistered(false)

    const cleanName = fullName.trim()
    if (!cleanName) { setError('Please enter your full name.'); return }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(email.trim())) { setError('Please enter a valid email address.'); return }

    if (password.length < 8) { setError('Password must be at least 8 characters long.'); return }

    if (password !== confirmPassword) { setError('Passwords do not match. Please check and try again.'); return }

    setLoading(true)
    try {
      const cleanEmail = email.trim().toLowerCase()
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: cleanName, email: cleanEmail, password }),
      })

      const data = await res.json().catch(() => ({})) as {
        error?: string
        alreadyExists?: boolean
        requiresOtp?: boolean
      }

      if (!res.ok) {
        setError(data.error || 'Failed to create account. Please try again.')
        if (data.alreadyExists) setIsAlreadyRegistered(true)
        return
      }

      startCooldown()
      setStage('otp')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Verify OTP ─────────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanOtp = otp.replace(/\D/g, '').trim()
    if (cleanOtp.length < 6) {
      setError('Please enter the complete verification code from your email.')
      return
    }

    setLoading(true)
    try {
      const cleanEmail = email.trim().toLowerCase()
      const res = await fetch('/api/auth/verify-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, token: cleanOtp }),
      })

      const data = await res.json().catch(() => ({})) as {
        error?: string
        alreadyVerified?: boolean
        success?: boolean
      }

      if (!res.ok) {
        setError(
          data.alreadyVerified
            ? 'Your account is already verified. You can sign in now.'
            : (data.error || 'Verification failed. Please try again.')
        )
        return
      }

      setStage('success')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  async function handleResend() {
    if (cooldown > 0 || loading) return
    setError(null)
    setLoading(true)
    try {
      const cleanEmail = email.trim().toLowerCase()
      const res = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, type: 'signup' }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setError(data.error || 'Failed to resend code. Please try again.')
      } else {
        setOtp('')
        startCooldown()
      }
    } catch {
      setError('Network error. Could not resend code.')
    } finally {
      setLoading(false)
    }
  }

  // ── Shared styles ──────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = { width: '100%', maxWidth: 440, padding: '2.25rem' }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '0.375rem',
  }

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
  }

  const toggleBtnStyle: React.CSSProperties = {
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
  }

  function ErrorBanner({ msg }: { msg: string }) {
    return (
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
        <div>
          <span>{msg}</span>
          {isAlreadyRegistered && (
            <div style={{ marginTop: '0.5rem' }}>
              <Link
                href="/auth/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: '#fff',
                  background: 'var(--accent-red)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Sign in here &rarr;
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Stage: success ─────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="card" style={cardStyle}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(74, 222, 128, 0.1)',
              border: '1px solid rgba(74, 222, 128, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CheckCircle size={28} color="#4ade80" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
              Email verified!
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Your account has been created and verified successfully. You can now sign in.
            </p>
          </div>
          <Link
            href="/auth/login"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
          >
            Sign in to your account &rarr;
          </Link>
        </div>
      </div>
    )
  }

  // ── Stage: OTP verification ────────────────────────────────────────────────
  if (stage === 'otp') {
    return (
      <div className="card" style={cardStyle}>
        <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(225, 29, 46, 0.1)',
              border: '1px solid rgba(225, 29, 46, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <ShieldCheck size={22} color="var(--accent-red)" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
            Check your email
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            A verification code was sent to{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
            Enter it below to complete your registration.
          </p>
        </div>

        {error && <ErrorBanner msg={error} />}

        <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label htmlFor="otp-code" style={labelStyle}>Verification code</label>
            <input
              id="otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Enter code from email"
              required
              className="input"
              style={{ textAlign: 'center', letterSpacing: '0.25em', fontWeight: 700, fontSize: '1.1rem' }}
              autoFocus
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Enter the numeric code from the verification email.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || otp.replace(/\D/g, '').length < 6}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /><span>Verifying&hellip;</span></>
            ) : (
              <span>Verify &amp; Create Account</span>
            )}
          </button>
        </form>

        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || loading}
            style={{
              background: 'none', border: 'none', padding: 0,
              cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
              color: cooldown > 0 ? 'var(--text-muted)' : 'var(--accent-red)',
              fontSize: '0.85rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '0.375rem',
            }}
          >
            <RefreshCw size={14} />
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>

          <button
            type="button"
            onClick={() => { setStage('form'); setError(null); setOtp('') }}
            style={{
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              display: 'flex', alignItems: 'center', gap: '0.375rem',
            }}
          >
            <ArrowLeft size={14} /><span>Back to sign up form</span>
          </button>
        </div>
      </div>
    )
  }

  // ── Stage: registration form ───────────────────────────────────────────────
  return (
    <div className="card" style={cardStyle}>
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
          Create your account
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Fill in your details, then we&apos;ll send an OTP to verify your email.
        </p>
      </div>

      {error && <ErrorBanner msg={error} />}

      <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

        {/* Full Name */}
        <div>
          <label htmlFor="signup-name" style={labelStyle}>Full name</label>
          <div style={{ position: 'relative' }}>
            <User size={16} style={iconStyle} />
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              required
              className="input"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="signup-email" style={labelStyle}>Email address</label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={iconStyle} />
            <input
              id="signup-email"
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
          <label htmlFor="signup-password" style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={iconStyle} />
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
              minLength={8}
              className="input"
              style={{ paddingLeft: '2.25rem', paddingRight: '2.5rem' }}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={toggleBtnStyle} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Strength meter */}
          {password && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Strength</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: strength.color }}>{strength.label}</span>
              </div>
              <div style={{ display: 'flex', gap: '3px', height: '4px' }}>
                <div style={{ flex: 1, borderRadius: '2px', background: strength.score >= 1 ? strength.color : 'var(--border)', transition: 'background 0.2s' }} />
                <div style={{ flex: 1, borderRadius: '2px', background: strength.score >= 2 ? strength.color : 'var(--border)', transition: 'background 0.2s' }} />
                <div style={{ flex: 1, borderRadius: '2px', background: strength.score >= 3 ? strength.color : 'var(--border)', transition: 'background 0.2s' }} />
              </div>
            </div>
          )}
          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
            At least 8 characters with numbers and symbols.
          </span>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="signup-confirm" style={labelStyle}>Confirm password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={iconStyle} />
            <input
              id="signup-confirm"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              minLength={8}
              className="input"
              style={{
                paddingLeft: '2.25rem',
                paddingRight: '2.5rem',
                borderColor: confirmPassword && confirmPassword !== password
                  ? 'rgba(225, 29, 46, 0.6)'
                  : undefined,
              }}
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={toggleBtnStyle} aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}>
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== password && (
            <span style={{ display: 'block', fontSize: '0.72rem', color: '#f87171', marginTop: '0.3rem' }}>
              Passwords do not match.
            </span>
          )}
          {confirmPassword && confirmPassword === password && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', color: '#4ade80', marginTop: '0.3rem' }}>
              <CheckCircle size={12} /> Passwords match.
            </span>
          )}
        </div>

        {/* Send OTP button */}
        <button
          type="submit"
          disabled={loading || password.length < 8 || password !== confirmPassword}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.25rem' }}
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /><span>Sending OTP&hellip;</span></>
          ) : (
            <><Send size={15} /><span>Send OTP</span></>
          )}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: 'var(--brand-red)', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 2rem', borderBottom: '1px solid var(--border)',
        }}
      >
        <Link href="/"><Logo size="sm" /></Link>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: 'var(--brand-red)', fontWeight: 600 }}>Sign in</Link>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-base)' }} />}>
          <SignUpContent />
        </Suspense>
      </main>
    </div>
  )
}
