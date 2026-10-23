/**
 * Server-side resume text extractor.
 * Supports text PDFs, DOCX, TXT, and image resumes (PNG, JPG, JPEG, WEBP, etc.)
 * Image text extraction uses Google Gemini Vision via the existing Gemini client.
 */

import {
  generateWithRetry,
  getFriendlyErrorMessage,
  sanitizeForLogging,
  GEMINI_MODEL,
  GEMINI_FALLBACK_MODEL,
} from './gemini'

export { GEMINI_MODEL, GEMINI_FALLBACK_MODEL }
export type LoggerMessage = { status: string; progress: number }

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

export interface ExtractResult {
  text: string
  pageCount?: number
}

export async function extractResumeText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractResult> {
  if (buffer.length === 0) {
    throw new Error('The uploaded file is empty.')
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File is too large. Maximum allowed size is 5 MB.')
  }

  const ext = fileName.split('.').pop()?.toLowerCase()

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return extractPdf(buffer)
  }

  if (ext === 'docx' || mimeType.includes('wordprocessingml')) {
    return extractDocx(buffer)
  }

  if (ext === 'txt' || mimeType === 'text/plain') {
    return validateText(buffer.toString('utf8'))
  }

  if (
    ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff'].includes(ext ?? '') ||
    mimeType.startsWith('image/')
  ) {
    return extractImage(buffer, mimeType, fileName)
  }

  if (ext === 'doc' || mimeType === 'application/msword') {
    throw new Error(
      'Legacy DOC files are not supported reliably yet. Please save the document as DOCX or PDF and upload it again.'
    )
  }

  throw new Error(
    'Unsupported file type. Please upload a PDF, DOCX, TXT, PNG, JPG, JPEG, WEBP, BMP, or TIFF file.'
  )
}

function validateText(value: string): ExtractResult {
  const text = value.trim()

  if (
    !text ||
    text.toUpperCase() === 'NONE' ||
    text.length < 50 ||
    text.toLowerCase().includes('contains no text') ||
    text.toLowerCase().includes('no text or other discernible content')
  ) {
    throw new Error('Could not find enough readable resume text in this file.')
  }

  return { text }
}

async function extractPdf(buffer: Buffer): Promise<ExtractResult> {
  try {
    // pdf-parse v2 uses the PDFParse class API.
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })

    try {
      const result = await parser.getText()
      const text = result.text?.trim()

      if (!text || text.length < 50) {
        throw new Error(
          'This PDF contains little or no selectable text. It appears to be a scanned document or image-only PDF. OCR for scanned PDFs is not yet supported; please upload your resume in DOCX, TXT, or as an image file (PNG, JPG, WEBP).'
        )
      }

      return {
        text,
        pageCount: result.total,
      }
    } finally {
      await parser.destroy()
    }
  } catch (err) {
    console.error('[PDF] Extraction error:', err)
    if (
      err instanceof Error &&
      (err.message.includes('selectable text') ||
        err.message.includes('scanned document') ||
        err.message.includes('readable resume text'))
    ) {
      throw err
    }

    const detail = err instanceof Error ? `: ${err.message}` : ''
    throw new Error(
      `Failed to read this PDF${detail}. Make sure it is not corrupted or password-protected.`
    )
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractResult> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return validateText(result.value ?? '')
  } catch (err) {
    console.error('[DOCX] Error extracting Word document:', err)
    if (err instanceof Error && err.message.includes('readable resume text')) {
      throw err
    }
    const detail = err instanceof Error ? `: ${err.message}` : ''
    throw new Error(
      `Failed to read this Word document${detail}. Please make sure it is a valid DOCX file.`
    )
  }
}

async function extractImage(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractResult> {
  const startTime = Date.now()
  let resolvedMime = mimeType
  const ext = fileName.split('.').pop()?.toLowerCase()

  if (!resolvedMime || resolvedMime === 'application/octet-stream') {
    if (ext === 'png') resolvedMime = 'image/png'
    else if (ext === 'webp') resolvedMime = 'image/webp'
    else resolvedMime = 'image/jpeg'
  } else if (resolvedMime === 'image/jpg') {
    resolvedMime = 'image/jpeg'
  }

  console.log(
    `[Upload OCR] Starting image text extraction via Gemini Vision (${resolvedMime}, ${Math.round(buffer.length / 1024)} KB)...`
  )

  try {
    const base64Data = buffer.toString('base64')
    const prompt =
      'Extract and transcribe all text from this resume image accurately, completely, and in reading order. ' +
      'Preserve all sections, headings, contact details, work experience, education, skills, bullet points, dates, and metrics. ' +
      'Output ONLY the raw extracted resume text, without any added conversational commentary, markdown wrappers, or explanations. ' +
      'If the image contains no readable text, output ONLY the word: NONE'

    const result = await generateWithRetry(
      {
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: resolvedMime,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      },
      undefined,
      {
        maxRetriesPerModel: 1,
        attemptTimeoutMs: 15_000,
        totalTimeoutMs: 25_000,
      }
    )

    const text = result.text?.trim() ?? ''
    const duration = Date.now() - startTime
    console.log(
      `[Upload OCR] Completed in ${duration}ms using ${result.modelUsed} (${text.length} chars extracted).`
    )

    return validateText(text)
  } catch (err: unknown) {
    const duration = Date.now() - startTime
    console.error(`[Upload OCR] Failed after ${duration}ms:`, sanitizeForLogging(err))
    if (err instanceof Error && err.message.includes('readable resume text')) {
      throw err
    }
    const friendly = getFriendlyErrorMessage(err)
    throw new Error(`Failed to extract text from image resume: ${friendly}`)
  }
}
