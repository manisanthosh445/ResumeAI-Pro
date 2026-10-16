import { GoogleGenAI } from '@google/genai'

export function extractJSON(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim())
      } catch {
        // continue
      }
    }

    const braceStart = raw.indexOf('{')
    const braceEnd = raw.lastIndexOf('}')
    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(raw.slice(braceStart, braceEnd + 1))
      } catch {
        // continue
      }
    }

    throw new Error('Could not extract valid JSON from Gemini response')
  }
}

/**
 * Single source of truth for Gemini models across the entire application.
 * Primary: gemini-3.5-flash-lite (high availability, fast, reliable)
 * Fallback 1: gemini-3.5-flash
 * Fallback 2: gemini-3.8-flash
 * Fallback 3: gemini-flash-latest
 */
export const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
] as const

export const GEMINI_MODEL = GEMINI_MODELS[0]
export const GEMINI_FALLBACK_MODEL = GEMINI_MODELS[1]

export function getGeminiApiKey(): string {
  const rawKey = process.env.GEMINI_API_KEY?.trim()
  if (!rawKey || rawKey === 'your_gemini_api_key' || rawKey === 'your-gemini-api-key') {
    throw new Error('Gemini API key is not configured. Please set a valid GEMINI_API_KEY in .env.local.')
  }
  return rawKey
}

export function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() })
}

/**
 * Redacts any occurrence of the API key from log outputs.
 */
export function sanitizeForLogging(content: unknown): string {
  if (content === null || content === undefined) return ''
  let str: string
  if (typeof content === 'string') {
    str = content
  } else if (content instanceof Error) {
    const customProps = { ...content } as Record<string, unknown>
    const extra = Object.keys(customProps).length > 0 ? ` Extra: ${JSON.stringify(customProps)}` : ''
    str = `${content.name}: ${content.message}${extra}\n${content.stack || ''}`
  } else if (typeof content === 'object') {
    try {
      str = JSON.stringify(content, Object.getOwnPropertyNames(content))
    } catch {
      str = String(content)
    }
  } else {
    str = String(content)
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  let sanitized = str
  if (apiKey && apiKey.length > 5) {
    sanitized = sanitized.replaceAll(apiKey, '[REDACTED_API_KEY]')
  }
  return sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
}

export function logServerError(context: string, err: unknown) {
  console.error(`[${context}]`, sanitizeForLogging(err))
}

export function isNonRetryableError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  const status =
    (err as { status?: number; statusCode?: number }).status ??
    (err as { statusCode?: number }).statusCode

  if (status === 400 || status === 401 || status === 403) return true
  if (
    msg.includes('400') ||
    msg.includes('INVALID_ARGUMENT') ||
    msg.includes('401') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('API key') ||
    msg.includes('403') ||
    msg.includes('PERMISSION_DENIED')
  ) {
    return true
  }

  const lower = msg.toLowerCase()
  if (
    lower.includes('safety') ||
    lower.includes('blocked') ||
    lower.includes('finish_reason_safety')
  ) {
    return true
  }

  return false
}

export function isModelNotFoundError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  const status =
    (err as { status?: number; statusCode?: number }).status ??
    (err as { statusCode?: number }).statusCode

  if (status === 404) return true
  const lower = msg.toLowerCase()
  return (
    msg.includes('404') ||
    lower.includes('not found') ||
    lower.includes('not_found') ||
    lower.includes('no longer available') ||
    lower.includes('is not supported')
  )
}

export function isRetryableError(err: unknown): boolean {
  if (isNonRetryableError(err)) return false
  if (isModelNotFoundError(err)) return false

  const msg = err instanceof Error ? err.message : String(err)
  const status =
    (err as { status?: number; statusCode?: number }).status ??
    (err as { statusCode?: number }).statusCode

  if (status === 503 || status === 500 || status === 502 || status === 504 || status === 429) return true

  const lower = msg.toLowerCase()
  return (
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('429') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('internal') ||
    lower.includes('fetch failed') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('abort')
  )
}

export function getFriendlyErrorMessage(err: unknown): string {
  if (!err) return 'Something went wrong. Please try again.'

  const msg = err instanceof Error ? err.message : String(err)
  const status =
    (err as { status?: number; statusCode?: number }).status ??
    (err as { statusCode?: number }).statusCode
  const lower = msg.toLowerCase()

  // 1. Supabase / Postgres Database errors
  if (
    lower.includes('supabase') ||
    lower.includes('postgres') ||
    lower.includes('pgrst') ||
    lower.includes('database error') ||
    lower.includes('relation') ||
    lower.includes('column')
  ) {
    return 'Database error. Please check Supabase.'
  }

  // 2. Empty / missing resume text
  if (
    lower.includes('no resume text') ||
    lower.includes('no readable text') ||
    lower.includes('raw_text is empty') ||
    lower.includes('resume text is empty')
  ) {
    return 'Resume contains no readable text. Please re-upload your resume.'
  }

  // 3. AI Key problems (401, 403)
  if (
    status === 401 ||
    status === 403 ||
    msg.includes('401') ||
    msg.includes('403') ||
    lower.includes('unauthenticated') ||
    lower.includes('permission_denied') ||
    lower.includes('api key') ||
    lower.includes('gemini_api_key')
  ) {
    return 'AI key problem. Check GEMINI_API_KEY.'
  }

  // 4. Daily AI limit / Quota (429)
  if (
    status === 429 ||
    msg.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('too many requests')
  ) {
    return 'Daily AI limit reached. Please try again later.'
  }

  // 5. Invalid AI response format (502, JSON parse/validation)
  if (
    status === 502 ||
    msg.includes('502') ||
    lower.includes('invalid json') ||
    lower.includes('bad_gateway') ||
    lower.includes('rejected json') ||
    lower.includes('validator rejected') ||
    lower.includes('parse error')
  ) {
    return 'Received an invalid response from AI. Please try again.'
  }

  // 6. AI busy / Service unavailable (503, 500, 504, timeout)
  if (
    status === 503 ||
    status === 500 ||
    status === 504 ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('504') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('busy') ||
    lower.includes('internal') ||
    lower.includes('timeout') ||
    lower.includes('fetch failed') ||
    lower.includes('network')
  ) {
    return 'The AI service is busy right now. Please try again in a minute.'
  }

  // 7. Model not found (404)
  if (
    status === 404 ||
    msg.includes('404') ||
    lower.includes('not found') ||
    lower.includes('no longer available')
  ) {
    return 'AI model unavailable. Please update the model configuration.'
  }

  return 'Something went wrong. Please try again.'
}

function withTimeout<T>(promise: Promise<T>, ms: number, desc: string): Promise<T> {
  let timer: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${desc} timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface GenerateParams {
  contents: Array<{
    role?: string
    parts: Array<{
      text?: string
      inlineData?: {
        data: string
        mimeType: string
      }
    }>
  }>
  config?: {
    temperature?: number
    maxOutputTokens?: number
    responseMimeType?: string
    responseSchema?: Record<string, unknown>
  }
}

export interface GenerateResult {
  text?: string
  modelUsed: string
}

/**
 * Executes a Gemini generateContent call with timeout, exponential backoff retries,
 * and multi-model fallback across GEMINI_MODELS.
 */
export async function generateWithRetry(
  params: GenerateParams,
  client?: GoogleGenAI,
  options?: {
    maxRetriesPerModel?: number
    attemptTimeoutMs?: number
    totalTimeoutMs?: number
  }
): Promise<GenerateResult> {
  const ai = client || getGeminiClient()
  const maxRetries = options?.maxRetriesPerModel ?? 1
  const attemptTimeoutMs = options?.attemptTimeoutMs ?? 35_000
  const totalTimeoutMs = options?.totalTimeoutMs ?? 52_000

  const startTime = Date.now()
  let lastError: unknown = null

  for (let modelIndex = 0; modelIndex < GEMINI_MODELS.length; modelIndex++) {
    const model = GEMINI_MODELS[modelIndex]

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (Date.now() - startTime >= totalTimeoutMs) {
        logServerError('Gemini Timeout', new Error(`Total execution time exceeded ${totalTimeoutMs}ms limit.`))
        const timeoutErr = new Error('503 UNAVAILABLE: The AI service is busy right now. Please try again in a minute.')
        ;(timeoutErr as { status?: number }).status = 503
        throw timeoutErr
      }

      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: params.contents,
            config: params.config,
          }),
          attemptTimeoutMs,
          `Gemini request [${model}]`
        )

        return {
          text: response.text ?? '',
          modelUsed: model,
        }
      } catch (err: unknown) {
        lastError = err

        // Fail immediately on non-retryable errors
        if (isNonRetryableError(err)) {
          logServerError(`Gemini Non-Retryable Error [${model}]`, err)
          throw err
        }

        // 404 moves immediately to next fallback model without wasting retries
        if (isModelNotFoundError(err)) {
          console.warn(`[Gemini] Model "${model}" returned 404/not-found. Advancing to fallback model...`)
          break
        }

        if (!isRetryableError(err)) {
          logServerError(`Gemini Fatal Error [${model}]`, err)
          throw err
        }

        // Exhausted retries for this model: advance to next fallback model
        if (attempt >= maxRetries) {
          console.warn(
            `[Gemini] Model "${model}" exhausted ${maxRetries} retries with error: ${sanitizeForLogging(
              err
            )}. Advancing to fallback model...`
          )
          break
        }

        // Exponential backoff: ~1s, ~2s with jitter
        const baseDelay = Math.pow(2, attempt) * 1000
        const jitter = Math.floor(Math.random() * 300)
        const delay = baseDelay + jitter

        if (Date.now() - startTime + delay >= totalTimeoutMs) {
          logServerError('Gemini Timeout', new Error(`Total execution time would exceed ${totalTimeoutMs}ms limit.`))
          const timeoutErr = new Error('503 UNAVAILABLE: The AI service is busy right now. Please try again in a minute.')
          ;(timeoutErr as { status?: number }).status = 503
          throw timeoutErr
        }

        console.warn(
          `[Gemini] Model "${model}" attempt ${attempt + 1}/${maxRetries + 1} failed. Retrying in ${delay}ms... (Error: ${sanitizeForLogging(err)})`
        )
        await sleep(delay)
      }
    }
  }

  logServerError('Gemini All Models Exhausted', lastError)
  const exhaustedErr = lastError instanceof Error ? lastError : new Error('503 UNAVAILABLE: All AI models failed.')
  if (!(exhaustedErr as { status?: number }).status) {
    ;(exhaustedErr as { status?: number }).status = 503
  }
  throw exhaustedErr
}

/**
 * Safely generates, strips code fences, parses JSON, and validates structure.
 * Automatically retries generation once with stricter instruction if JSON is malformed.
 */
export async function generateJsonWithRetry<T>(
  params: GenerateParams,
  validator: (parsed: unknown) => T | null | false | undefined,
  contextName = 'Gemini JSON',
  responseSchema?: Record<string, unknown>
): Promise<T> {
  const jsonParams: GenerateParams = {
    ...params,
    config: {
      ...params.config,
      responseMimeType: 'application/json',
      ...(responseSchema ? { responseSchema } : {}),
    },
  }

  let lastValidationOrParseError: unknown = null

  for (let jsonAttempt = 0; jsonAttempt < 2; jsonAttempt++) {
    // If first attempt failed, append strict retry prompt instruction
    const currentParams: GenerateParams = jsonAttempt === 0
      ? jsonParams
      : {
          ...jsonParams,
          contents: jsonParams.contents.map((item, idx) => {
            if (idx === jsonParams.contents.length - 1 && Array.isArray(item.parts)) {
              return {
                ...item,
                parts: item.parts.map((p, pIdx) => {
                  if (pIdx === item.parts.length - 1 && typeof p.text === 'string') {
                    return {
                      ...p,
                      text: `${p.text}\n\nCRITICAL RETRY INSTRUCTION: Return ONLY a single valid JSON object matching the requested schema. Do NOT wrap in markdown code blocks or provide commentary.`,
                    }
                  }
                  return p
                }),
              }
            }
            return item
          }),
        }

    const result = await generateWithRetry(currentParams)
    const rawContent = result.text ?? ''

    const stripped = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    let parsed: unknown = null
    try {
      parsed = extractJSON(stripped)
    } catch {
      try {
        parsed = JSON.parse(stripped)
      } catch (parseErr) {
        lastValidationOrParseError = parseErr
        logServerError(`${contextName} Parse Error (attempt ${jsonAttempt + 1})`, parseErr)
      }
    }

    if (parsed) {
      const validated = validator(parsed)
      if (validated) {
        return validated as T
      }
      lastValidationOrParseError = new Error('Validator rejected JSON schema structure')
      logServerError(
        `${contextName} Validation Error (attempt ${jsonAttempt + 1})`,
        lastValidationOrParseError
      )
    }

    if (jsonAttempt === 0) {
      console.warn(`[${contextName}] JSON response was invalid or malformed on first attempt. Retrying generation once with stricter instruction...`)
      await sleep(500)
    }
  }

  logServerError(`${contextName} All JSON Attempts Failed`, lastValidationOrParseError)
  const invalidJsonErr = new Error('502 BAD_GATEWAY: Returned invalid JSON response format.')
  ;(invalidJsonErr as { status?: number }).status = 502
  throw invalidJsonErr
}

/**
 * Backward compatibility alias for generateWithRetry.
 */
export async function generateWithFallback(
  ai: GoogleGenAI,
  params: GenerateParams
): Promise<{ text?: string }> {
  return generateWithRetry(params, ai)
}
