import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGeminiClient, extractJSON } from '@/lib/gemini'

export const runtime = 'nodejs'

import {
  TrendingJob,
  TARGET_COUNTRY,
  FALLBACK_TRENDING_JOBS,
} from '@/types/trending-jobs'

export { TARGET_COUNTRY, FALLBACK_TRENDING_JOBS }
export type { TrendingJob }

// 24-hour cache duration
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000

// In-memory cache fallback in case Supabase table is not yet created
let memoryCache: {
  country: string
  jobs: TrendingJob[]
  timestamp: number
} | null = null

function validateTrendingJobs(data: unknown): TrendingJob[] | null {
  if (!data) return null
  let list: unknown = data

  if (typeof data === 'object' && data !== null && 'jobs' in (data as Record<string, unknown>)) {
    list = (data as Record<string, unknown>).jobs
  }

  if (!Array.isArray(list) || list.length === 0) return null

  const validated: TrendingJob[] = []
  for (const item of list) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof item.title === 'string' &&
      typeof item.category === 'string' &&
      typeof item.reason === 'string' &&
      Array.isArray(item.skills)
    ) {
      const demand =
        item.demandLevel === 'Very High' || item.demandLevel === 'High'
          ? item.demandLevel
          : 'High'
      const salary =
        typeof item.salaryRange === 'string' && item.salaryRange.trim()
          ? item.salaryRange
          : '₹4.5 - ₹8 LPA (est.)'

      validated.push({
        title: item.title.trim(),
        category: item.category.trim(),
        reason: item.reason.trim(),
        skills: item.skills.slice(0, 3).map((s: unknown) => String(s).trim()),
        demandLevel: demand,
        salaryRange: salary,
      })
    }
  }

  return validated.length >= 4 ? validated.slice(0, 8) : null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    // 1. Check database cache first
    let dbCacheRow: { jobs_data: unknown; created_at: string } | null = null
    try {
      const { data, error } = await supabase
        .from('trending_jobs_cache')
        .select('jobs_data, created_at')
        .eq('country', TARGET_COUNTRY)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        dbCacheRow = data
        const cacheAge = Date.now() - new Date(data.created_at).getTime()
        if (cacheAge < CACHE_DURATION_MS) {
          const validated = validateTrendingJobs(data.jobs_data)
          if (validated) {
            return NextResponse.json({
              success: true,
              country: TARGET_COUNTRY,
              jobs: validated,
              cached: true,
            })
          }
        }
      }
    } catch {
      // Supabase table may not exist yet, proceed to in-memory check
    }

    // 2. Check in-memory cache if DB cache was unavailable or fresh
    if (
      memoryCache &&
      memoryCache.country === TARGET_COUNTRY &&
      Date.now() - memoryCache.timestamp < CACHE_DURATION_MS
    ) {
      return NextResponse.json({
        success: true,
        country: TARGET_COUNTRY,
        jobs: memoryCache.jobs,
        cached: true,
      })
    }

    // 3. Cache expired or not found: Request fresh data from Gemini
    try {
      const ai = getGeminiClient()
      const prompt = `You are a career market research assistant. Provide exactly 8 currently trending and high-demand job roles for freshers and entry-level college graduates in ${TARGET_COUNTRY}.

Return ONLY a JSON array of 8 objects (wrapped in {"jobs": [...]}) with the following fields:
- "title": Job title (e.g. "Frontend Developer", "Data Analyst")
- "category": Category (e.g. "Software", "Data", "Cloud", "Design", "Cybersecurity")
- "reason": A concise one-line reason why freshers are actively hired in this role in ${TARGET_COUNTRY}
- "skills": Array of exactly 3 essential technical skills
- "demandLevel": Either "High" or "Very High"
- "salaryRange": Estimated entry-level fresher salary range in INR LPA with "(est.)" (e.g. "₹5 - ₹8 LPA (est.)")`

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      })

      const rawText = response.text || ''
      const parsed = extractJSON(rawText)
      const validatedJobs = validateTrendingJobs(parsed)

      if (validatedJobs && validatedJobs.length > 0) {
        // Save to in-memory cache
        memoryCache = {
          country: TARGET_COUNTRY,
          jobs: validatedJobs,
          timestamp: Date.now(),
        }

        // Save to Supabase table if available
        try {
          await supabase.from('trending_jobs_cache').insert({
            country: TARGET_COUNTRY,
            jobs_data: validatedJobs,
          })
        } catch {
          // Table may not exist yet
        }

        return NextResponse.json({
          success: true,
          country: TARGET_COUNTRY,
          jobs: validatedJobs,
          cached: false,
        })
      }
    } catch (geminiError: unknown) {
      console.warn('[TRENDING-JOBS] Gemini API error, serving fallback:', geminiError)
    }

    // 4. Fallback: If Gemini fails, return last known DB cache, memory cache, or hardcoded fallback
    if (dbCacheRow?.jobs_data) {
      const staleJobs = validateTrendingJobs(dbCacheRow.jobs_data)
      if (staleJobs) {
        return NextResponse.json({
          success: true,
          country: TARGET_COUNTRY,
          jobs: staleJobs,
          stale: true,
        })
      }
    }

    if (memoryCache?.jobs) {
      return NextResponse.json({
        success: true,
        country: TARGET_COUNTRY,
        jobs: memoryCache.jobs,
        stale: true,
      })
    }

    // Return guaranteed 8-item fallback
    return NextResponse.json({
      success: true,
      country: TARGET_COUNTRY,
      jobs: FALLBACK_TRENDING_JOBS,
      fallback: true,
    })
  } catch (err: unknown) {
    console.error('[TRENDING-JOBS] Unexpected error:', err)
    return NextResponse.json({
      success: true,
      country: TARGET_COUNTRY,
      jobs: FALLBACK_TRENDING_JOBS,
      fallback: true,
    })
  }
}
