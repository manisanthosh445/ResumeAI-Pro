/**
 * Helper to map Supabase auth errors to clean, friendly user messages.
 * Never leaks raw JSON or sensitive system details.
 */

export interface FriendlyAuthResult {
  message: string
  isAlreadyVerified: boolean
  isExpired: boolean
  isRateLimited: boolean
}

export function cleanOtpCode(code: string, maxLength = 8): string {
  return code.replace(/\D/g, '').trim().slice(0, maxLength)
}

export function getFriendlyAuthErrorMessage(error: unknown): FriendlyAuthResult {
  if (!error) {
    return {
      message: 'An unexpected error occurred. Please try again.',
      isAlreadyVerified: false,
      isExpired: false,
      isRateLimited: false,
    }
  }

  const err = error as { message?: string; status?: number; code?: string; name?: string }
  const rawMsg = (err.message || '').toLowerCase()
  const status = err.status

  // 1. Already verified / confirmed / previously used code or user
  if (
    rawMsg.includes('already confirmed') ||
    rawMsg.includes('already verified') ||
    rawMsg.includes('user already confirmed') ||
    rawMsg.includes('email is already confirmed') ||
    rawMsg.includes('already been used') ||
    rawMsg.includes('token has already been used') ||
    rawMsg.includes('token was already used') ||
    rawMsg.includes('token is already used') ||
    err.code === 'email_already_confirmed'
  ) {
    return {
      message: 'This code was already used or your account is already verified. Please sign in.',
      isAlreadyVerified: true,
      isExpired: false,
      isRateLimited: false,
    }
  }

  // 2. Too many attempts / rate limited
  if (
    status === 429 ||
    rawMsg.includes('rate') ||
    rawMsg.includes('too many') ||
    rawMsg.includes('security purposes') ||
    rawMsg.includes('over_email_send_rate_limit') ||
    err.code === 'over_email_send_rate_limit'
  ) {
    return {
      message: 'Too many attempts. Please wait a few minutes before trying again.',
      isAlreadyVerified: false,
      isExpired: false,
      isRateLimited: true,
    }
  }

  // 3. Email not confirmed
  if (
    rawMsg.includes('email not confirmed') ||
    rawMsg.includes('not confirmed') ||
    err.code === 'email_not_confirmed'
  ) {
    return {
      message: 'Your email has not been confirmed yet.',
      isAlreadyVerified: false,
      isExpired: false,
      isRateLimited: false,
    }
  }

  // 4. Truly / explicitly expired code (only when specifically stating expired, without "invalid")
  if (
    !rawMsg.includes('invalid') &&
    (rawMsg.includes('token has expired') ||
     rawMsg.includes('code has expired') ||
     rawMsg.includes('token is expired') ||
     rawMsg === 'otp expired')
  ) {
    return {
      message: 'This verification code has expired. Please request a new one.',
      isAlreadyVerified: false,
      isExpired: true,
      isRateLimited: false,
    }
  }

  // 5. Invalid / Incorrect / Expired-or-Invalid (Supabase GoTrue default response for unverified tokens)
  if (
    rawMsg.includes('invalid') ||
    rawMsg.includes('incorrect') ||
    rawMsg.includes('does not match') ||
    rawMsg.includes('token not found') ||
    rawMsg.includes('bad_jwt') ||
    rawMsg.includes('wrong') ||
    rawMsg.includes('expired or is invalid') ||
    rawMsg.includes('invalid or has expired') ||
    rawMsg.includes('expired or invalid') ||
    err.code === 'validation_failed' ||
    err.code === 'otp_expired'
  ) {
    return {
      message: 'Invalid verification code. Please check your code or request a new one.',
      isAlreadyVerified: false,
      isExpired: false,
      isRateLimited: false,
    }
  }

  // 7. Network error
  if (
    rawMsg.includes('network') ||
    rawMsg.includes('fetch') ||
    rawMsg.includes('failed to fetch') ||
    err.name === 'TypeError'
  ) {
    return {
      message: 'Network error. Please check your connection and try again.',
      isAlreadyVerified: false,
      isExpired: false,
      isRateLimited: false,
    }
  }

  // Generic fallback
  return {
    message: 'Unable to verify code. Please check the code or request a new one.',
    isAlreadyVerified: false,
    isExpired: false,
    isRateLimited: false,
  }
}
