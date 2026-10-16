/**
 * Builds the Gemini system + user prompt for resume analysis.
 * Returns a structured JSON schema that Gemini must follow exactly.
 */
export function buildAnalysisPrompt(resumeText: string, targetRole?: string | null): {
  system: string
  user: string
} {
  const system = `You are an expert ATS (Applicant Tracking System) analyst and senior technical recruiter.
Your task is to analyze a resume and return ONLY a valid JSON object — no markdown formatting, no code fences. The JSON must strictly conform to the schema provided.
Be rigorous, specific, and honest. Provide concrete strengths and actionable areas for improvement.`

  const targetRoleClause = targetRole
    ? `The candidate is targeting the role: **${targetRole}**. Tailor all feedback and suggestions to maximize fit for this specific role.`
    : ''

  const user = `Analyze the following resume and return a single JSON object. ${targetRoleClause}

RESUME TEXT:
---
${resumeText.slice(0, 12000)}
---

Return EXACTLY this JSON structure:
{
  "summary": "<2-3 sentence executive summary of the candidate profile, current level, and primary domain>",
  "overall_score": <integer 0-100>,
  "score_rationale": "<1-2 sentence explanation of the overall score>",
  "strengths": [
    "<concrete strength 1>",
    "<concrete strength 2>",
    "<concrete strength 3>"
  ],
  "areas_for_improvement": [
    "<concrete area for improvement 1>",
    "<concrete area for improvement 2>",
    "<concrete area for improvement 3>"
  ],
  "section_scores": {
    "skills": <integer 0-100>,
    "education": <integer 0-100>,
    "experience": <integer 0-100>,
    "projects": <integer 0-100>,
    "formatting": <integer 0-100>,
    "grammar": <integer 0-100>
  },
  "ats_issues": [
    {
      "severity": "high" | "medium" | "low",
      "section": "<section name>",
      "issue": "<specific, concrete ATS problem>",
      "fix": "<exactly what to change, including example text where applicable>"
    }
  ],
  "feedback": [
    {
      "section": "Skills" | "Education" | "Experience" | "Projects" | "Formatting" | "Grammar",
      "score": <integer 0-100>,
      "summary": "<2-3 sentence overall assessment of this section>",
      "suggestions": [
        {
          "section": "<same section>",
          "original": "<exact text from the resume, or description of the problem>",
          "rewritten": "<improved version>",
          "rationale": "<why this improves the score>"
        }
      ]
    }
  ]
}`

  return { system, user }
}

/**
 * Defensively parses a Gemini response that may contain JSON wrapped in prose or code fences.
 */
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
 * Validates and normalises the raw Gemini JSON into our typed shape.
 * Returns null if the shape is fundamentally wrong.
 */
export function validateAnalysisResponse(raw: unknown): ValidatedAnalysis | null {
  if (typeof raw !== 'object' || raw === null) return null

  const obj = raw as Record<string, unknown>

  const overall_score = clamp(Number(obj.overall_score), 0, 100)
  if (isNaN(overall_score)) return null

  const summary = typeof obj.summary === 'string' && obj.summary.trim().length > 0
    ? obj.summary.trim()
    : 'Professional resume evaluated for ATS compatibility and technical interview readiness.'

  const score_rationale = typeof obj.score_rationale === 'string' && obj.score_rationale.trim().length > 0
    ? obj.score_rationale.trim()
    : `Overall evaluation based on industry benchmarks and ATS parsing criteria.`

  const strengths = Array.isArray(obj.strengths)
    ? obj.strengths.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : []

  const areas_for_improvement = Array.isArray(obj.areas_for_improvement)
    ? obj.areas_for_improvement.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    : []

  const ss = (obj.section_scores ?? {}) as Record<string, unknown>
  const section_scores = {
    skills:     clamp(Number(ss.skills ?? 50), 0, 100),
    education:  clamp(Number(ss.education ?? 50), 0, 100),
    experience: clamp(Number(ss.experience ?? 50), 0, 100),
    projects:   clamp(Number(ss.projects ?? 50), 0, 100),
    formatting: clamp(Number(ss.formatting ?? 50), 0, 100),
    grammar:    clamp(Number(ss.grammar ?? 50), 0, 100),
  }

  const ats_issues = Array.isArray(obj.ats_issues)
    ? obj.ats_issues.slice(0, 10).map((item: unknown) => {
        const i = item as Record<string, unknown>
        return {
          severity: (['high', 'medium', 'low'].includes(String(i.severity)) ? i.severity : 'medium') as 'high' | 'medium' | 'low',
          section:  String(i.section ?? 'General'),
          issue:    String(i.issue ?? ''),
          fix:      String(i.fix ?? ''),
        }
      })
    : []

  const feedback = Array.isArray(obj.feedback)
    ? obj.feedback.slice(0, 8).map((item: unknown) => {
        const f = item as Record<string, unknown>
        const suggestions = Array.isArray(f.suggestions)
          ? f.suggestions.slice(0, 5).map((s: unknown) => {
              const sg = s as Record<string, unknown>
              return {
                section:   String(sg.section ?? f.section ?? ''),
                original:  String(sg.original ?? ''),
                rewritten: String(sg.rewritten ?? ''),
                rationale: String(sg.rationale ?? ''),
              }
            })
          : []

        return {
          section:     String(f.section ?? ''),
          score:       clamp(Number(f.score ?? 50), 0, 100),
          summary:     String(f.summary ?? ''),
          suggestions,
        }
      })
    : []

  return {
    summary,
    overall_score,
    score_rationale,
    strengths,
    areas_for_improvement,
    section_scores,
    ats_issues,
    feedback,
  }
}

function clamp(n: number, min: number, max: number): number {
  if (isNaN(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

export interface ValidatedAnalysis {
  summary: string
  overall_score: number
  score_rationale: string
  strengths: string[]
  areas_for_improvement: string[]
  section_scores: {
    skills: number
    education: number
    experience: number
    projects: number
    formatting: number
    grammar: number
  }
  ats_issues: Array<{
    severity: 'high' | 'medium' | 'low'
    section: string
    issue: string
    fix: string
  }>
  feedback: Array<{
    section: string
    score: number
    summary: string
    suggestions: Array<{
      section: string
      original: string
      rewritten: string
      rationale: string
    }>
  }>
}
