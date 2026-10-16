/**
 * Server-side resume text extractor.
 * Supports text PDFs, DOCX, TXT, and image resumes through OCR via Tesseract.js.
 */

import { createWorker, type Worker, type LoggerMessage } from 'tesseract.js'
import { GEMINI_MODEL, GEMINI_FALLBACK_MODEL } from './gemini'

export { GEMINI_MODEL, GEMINI_FALLBACK_MODEL, createWorker }
export type { LoggerMessage }

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_OCR_WORKERS = 2

export interface ExtractResult {
  text: string
  pageCount?: number
}

/**
 * Concurrency-safe worker pool for Tesseract.js OCR.
 * - Creates workers lazily up to MAX_OCR_WORKERS.
 * - Reuses idle workers instead of spawning a new worker per image.
 * - Queues concurrent requests safely so shared worker state is never corrupted.
 * - Safely terminates and replaces broken workers if recognition throws.
 */
class TesseractWorkerPool {
  private workers: Worker[] = []
  private idleWorkers: Worker[] = []
  private queue: Array<{
    resolve: (worker: Worker) => void
    reject: (err: unknown) => void
  }> = []
  private isTerminating = false

  async acquire(): Promise<Worker> {
    if (this.isTerminating) {
      throw new Error('OCR worker pool has been terminated.')
    }

    // 1. Reuse an existing idle worker
    const idle = this.idleWorkers.pop()
    if (idle) {
      return idle
    }

    // 2. Initialize a new worker on demand if under the concurrency limit
    if (this.workers.length < MAX_OCR_WORKERS) {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', undefined, {
        logger: (m: { status: string; progress: number }): void => {
          if (process.env.DEBUG_OCR === 'true') {
            console.log(`[OCR Logger] ${m.status}: ${Math.round((m.progress || 0) * 100)}%`)
          }
        },
      })
      this.workers.push(worker)
      return worker
    }

    // 3. Queue request until an active worker is released
    return new Promise<Worker>((resolve, reject) => {
      this.queue.push({ resolve, reject })
    })
  }

  release(worker: Worker): void {
    if (this.isTerminating) {
      worker.terminate().catch((err) => console.error('[OCR Pool] Worker termination error:', err))
      return
    }

    const next = this.queue.shift()
    if (next) {
      next.resolve(worker)
    } else {
      this.idleWorkers.push(worker)
    }
  }

  async destroyWorker(worker: Worker): Promise<void> {
    const workerIdx = this.workers.indexOf(worker)
    if (workerIdx !== -1) {
      this.workers.splice(workerIdx, 1)
    }
    const idleIdx = this.idleWorkers.indexOf(worker)
    if (idleIdx !== -1) {
      this.idleWorkers.splice(idleIdx, 1)
    }

    try {
      await worker.terminate()
    } catch (err) {
      console.error('[OCR Pool] Error terminating unhealthy worker:', err)
    }
  }

  async terminateAll(): Promise<void> {
    this.isTerminating = true
    while (this.queue.length > 0) {
      const pending = this.queue.shift()
      pending?.reject(new Error('OCR worker pool terminated.'))
    }
    const currentWorkers = [...this.workers]
    this.workers = []
    this.idleWorkers = []
    await Promise.all(
      currentWorkers.map((w) =>
        w.terminate().catch((err) => console.error('[OCR Pool] Error during shutdown:', err))
      )
    )
  }
}

// Global singleton worker pool for the Node.js server runtime
const ocrPool = new TesseractWorkerPool()

// Register graceful teardown on process exit
if (typeof process !== 'undefined') {
  process.once('beforeExit', () => {
    ocrPool.terminateAll().catch(() => {})
  })
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
    return extractImage(buffer)
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

  if (text.length < 50) {
    throw new Error(
      'Could not find enough readable resume text in this file.'
    )
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

async function extractImage(buffer: Buffer): Promise<ExtractResult> {
  let worker: Worker | null = null
  try {
    worker = await ocrPool.acquire()
    const result = await worker.recognize(buffer)
    const text = result.data.text?.trim() ?? ''
    return validateText(text)
  } catch (err: unknown) {
    if (worker) {
      // If recognition threw an unhandled error, the worker's internal state may be corrupted.
      // Terminate and discard this worker so future OCR jobs get a fresh instance.
      await ocrPool.destroyWorker(worker)
      worker = null
    }

    console.error('[Image OCR] Recognition failed:', err)
    if (err instanceof Error && err.message.includes('readable resume text')) {
      throw err
    }

    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to extract text from image: ${detail}`)
  } finally {
    if (worker) {
      ocrPool.release(worker)
    }
  }
}
