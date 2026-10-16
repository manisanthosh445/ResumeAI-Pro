'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { Mail, AlertCircle, CheckCircle, Loader2, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Failed to send password reset instructions. Please try again.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.')
    } finally {
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
          Remember your password?{' '}
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
          <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
              Reset your password
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Enter your registered email address and we will send you password reset instructions.
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

          {submitted ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.625rem',
                  padding: '1rem',
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '6px',
                  color: '#4ade80',
                  fontSize: '0.875rem',
                  textAlign: 'left',
                }}
              >
                <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  If an account exists for <strong>{email}</strong>, a password reset link and code has been sent. Please check your inbox and spam folder.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Link
                  href={`/auth/reset-password?email=${encodeURIComponent(email)}`}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Enter reset code &rarr;
                </Link>

                <Link
                  href="/auth/login"
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Sign in</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label
                  htmlFor="forgot-email"
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
                    id="forgot-email"
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

              <button
                type="submit"
                disabled={loading || !email}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.25rem' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sending instructions…</span>
                  </>
                ) : (
                  <span>Send reset instructions &rarr;</span>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                <Link
                  href="/auth/login"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Sign in</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
