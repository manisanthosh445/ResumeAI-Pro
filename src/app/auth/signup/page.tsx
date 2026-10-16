'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

function SignUpContent() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false)

  const strength = calculatePasswordStrength(password)

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsAlreadyRegistered(false)

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setLoading(true)

    try {
      const cleanEmail = email.trim().toLowerCase()
      const cleanName = fullName.trim()

      // 1. Create user on server with email pre-confirmed (no OTP needed)
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          password,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Failed to create account. Please try again.')
        if (res.status === 409 || data.error?.toLowerCase().includes('already exists')) {
          setIsAlreadyRegistered(true)
        }
        setLoading(false)
        return
      }

      // 2. Immediately sign in to establish browser session and cookies
      const supabase = createClient()
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })

      if (signInErr) {
        console.error('[AUTH] Immediate signin error after signup:', signInErr)
        // If signin fails, forward to login
        router.push('/auth/login?message=Account+created.+Please+sign+in.')
        return
      }

      // 3. Navigate directly to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('[AUTH] Unexpected signup submit error:', err)
      setError('Network error. Please check your connection and try again.')
      setLoading(false)
    }
  }

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
          Already have an account?{' '}
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
        <div className="card" style={{ width: '100%', maxWidth: 440, padding: '2.25rem' }}>
          {/* Header */}
          <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
              Create your account
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Get started with ATS resume analysis and interview prep
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
              <div>
                <span>{error}</span>
                {isAlreadyRegistered && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <Link
                      href="/auth/login"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        color: '#ffffff',
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
          )}

          {/* Sign Up Form */}
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Full Name */}
            <div>
              <label
                htmlFor="signup-name"
                style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}
              >
                Full name
              </label>
              <div style={{ position: 'relative' }}>
                <User
                  size={16}
                  style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
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

            {/* Email Address */}
            <div>
              <label
                htmlFor="signup-email"
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
              <label
                htmlFor="signup-password"
                style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
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

              {/* Password strength indicator */}
              {password && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Strength</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: strength.color }}>{strength.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '3px', height: '4px' }}>
                    <div
                      style={{
                        flex: 1,
                        borderRadius: '2px',
                        background: strength.score >= 1 ? strength.color : 'var(--border)',
                        transition: 'background 0.2s',
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        borderRadius: '2px',
                        background: strength.score >= 2 ? strength.color : 'var(--border)',
                        transition: 'background 0.2s',
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        borderRadius: '2px',
                        background: strength.score >= 3 ? strength.color : 'var(--border)',
                        transition: 'background 0.2s',
                      }}
                    />
                  </div>
                </div>
              )}
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Must be at least 8 characters. Include numbers and symbols for better security.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || password.length < 8}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.5rem' }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Creating account…</span>
                </>
              ) : (
                <span>Create account &rarr;</span>
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
      </main>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-base)' }} />}>
      <SignUpContent />
    </Suspense>
  )
}
