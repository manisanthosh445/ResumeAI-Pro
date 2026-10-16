export interface JobRole {
  title: string
  description: string
  match_percentage: number
  match_reason: string
  matched_skills: string[]
  skill_gaps: string[]
  experience_level: 'Internship' | 'Fresher' | 'Junior'
  salary_range: string
}

export interface ValidatedJobRecommendations {
  strongest_area: string
  top_unlocking_skills: string[]
  summary: string
  roles: JobRole[]
}

export const jobRecommendationsResponseSchema = {
  type: 'OBJECT',
  properties: {
    strongest_area: { type: 'STRING' },
    top_unlocking_skills: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    summary: { type: 'STRING' },
    roles: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          match_percentage: { type: 'INTEGER' },
          match_reason: { type: 'STRING' },
          matched_skills: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          skill_gaps: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          experience_level: { type: 'STRING' },
          salary_range: { type: 'STRING' },
        },
        required: [
          'title',
          'description',
          'match_percentage',
          'match_reason',
          'matched_skills',
          'skill_gaps',
          'experience_level',
          'salary_range',
        ],
      },
    },
  },
  required: ['strongest_area', 'top_unlocking_skills', 'summary', 'roles'],
}

export function buildJobsPrompt(
  resumeText: string,
  analysisContext?: string
): { system: string; user: string } {
  const system = `You are a talent acquisition specialist and career advisor specializing in technical and entry-level recruiting.
Your task is to analyze a candidate's resume and recommend realistic job roles tailored to their existing skills, education, projects, and genuine experience level.

CRITICAL INSTRUCTIONS:
1. Return ONLY a single valid JSON object matching the requested schema. No prose, no markdown, no code fences.
2. The candidate is likely a student, fresher, or early-career professional. Tailor all recommendations to realistic entry-level roles, internships, and fresher-friendly opportunities (Internship / Fresher / Junior).
3. Do NOT invent specific company names, employers, active job openings, or hyperlinks.
4. Base all matched skills and skill gaps strictly on the resume content. Be honest and realistic about the match percentage (0-100).
5. For salary_range, provide ONLY a broad, clearly labeled estimate in INR for India (e.g., "₹3.5L - ₹6.0L/yr (Est.)", "₹15,000 - ₹30,000/mo (Internship Est.)", or "Varies by employer"). NEVER present it as exact or guaranteed.
6. Identify the candidate's strongest overall area and exactly 3 high-impact skills that would unlock the highest number of additional roles.`

  const analysisClause = analysisContext
    ? `\n\nADDITIONAL RESUME ANALYSIS CONTEXT:\n${analysisContext.slice(0, 3000)}\n`
    : ''

  const user = `Analyze this resume text and recommend 6 to 8 matching job roles (ordered from highest match to growth opportunities):

RESUME TEXT:
---
${resumeText.slice(0, 10000)}
---${analysisClause}

Return EXACTLY this JSON structure:
{
  "strongest_area": "<Single primary technical strength or domain, e.g., Frontend React Engineering, Python Data Scripting, Cloud Infrastructure>",
  "top_unlocking_skills": [
    "<High-value skill 1 that unlocks more jobs>",
    "<High-value skill 2 that unlocks more jobs>",
    "<High-value skill 3 that unlocks more jobs>"
  ],
  "summary": "<2-sentence executive summary of the candidate's employment readiness and which job trajectories offer the highest immediate potential>",
  "roles": [
    {
      "title": "<Standard Industry Job Title, e.g., Graduate Software Engineer, Junior Frontend Developer, Python Developer Intern>",
      "description": "<Clear one-line description of what this role does in production environments>",
      "match_percentage": <Integer between 0 and 100>,
      "match_reason": "<1-2 sentence concise reason explaining why the candidate matches this role>",
      "matched_skills": [
        "<Skill present on resume 1>",
        "<Skill present on resume 2>"
      ],
      "skill_gaps": [
        "<Missing or required skill to improve 1>",
        "<Missing or required skill to improve 2>"
      ],
      "experience_level": "<Must be exactly one of: Internship, Fresher, or Junior>",
      "salary_range": "<Broad estimated range in INR, e.g. ₹3.5L - ₹5.5L/yr (Est.) or ₹20k/mo (Internship Est.)>"
    }
  ]
}`

  return { system, user }
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num))
}

export function validateJobRecommendationsResponse(raw: unknown): ValidatedJobRecommendations | null {
  if (typeof raw !== 'object' || raw === null) return null

  const obj = raw as Record<string, unknown>

  const strongest_area =
    typeof obj.strongest_area === 'string' && obj.strongest_area.trim().length > 0
      ? obj.strongest_area.trim()
      : 'Core Software Development'

  const top_unlocking_skills = Array.isArray(obj.top_unlocking_skills)
    ? obj.top_unlocking_skills
        .map((s) => String(s).trim())
        .filter((s) => s.length > 0)
        .slice(0, 3)
    : ['System Architecture', 'Database Optimization', 'Cloud Deployment']

  while (top_unlocking_skills.length < 3) {
    top_unlocking_skills.push('Automated Testing')
  }

  const summary =
    typeof obj.summary === 'string' && obj.summary.trim().length > 0
      ? obj.summary.trim()
      : 'Analysis of entry-level and junior job roles aligned with your technical capabilities.'

  if (!Array.isArray(obj.roles) || obj.roles.length === 0) {
    return null
  }

  const roles: JobRole[] = obj.roles.slice(0, 8).map((item, idx) => {
    const r = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>

    let expLevel: 'Internship' | 'Fresher' | 'Junior' = 'Fresher'
    const rawLevel = String(r.experience_level ?? '').trim().toLowerCase()
    if (rawLevel.includes('intern')) {
      expLevel = 'Internship'
    } else if (rawLevel.includes('junior') || rawLevel.includes('jr') || rawLevel.includes('associate')) {
      expLevel = 'Junior'
    } else {
      expLevel = 'Fresher'
    }

    const matched_skills = Array.isArray(r.matched_skills)
      ? r.matched_skills.map((s) => String(s).trim()).filter((s) => s.length > 0)
      : []

    const skill_gaps = Array.isArray(r.skill_gaps)
      ? r.skill_gaps.map((s) => String(s).trim()).filter((s) => s.length > 0)
      : []

    const match_percentage = clamp(Number(r.match_percentage) || 50, 0, 100)

    return {
      title: String(r.title ?? `Recommended Role ${idx + 1}`).trim(),
      description: String(r.description ?? 'Technical engineering role aligned with your skill set.').trim(),
      match_percentage,
      match_reason: String(r.match_reason ?? 'Skills and experience profile show strong potential for this role.').trim(),
      matched_skills: matched_skills.slice(0, 8),
      skill_gaps: skill_gaps.slice(0, 8),
      experience_level: expLevel,
      salary_range: String(r.salary_range ?? '₹3.5L - ₹6.0L/yr (Est.)').trim(),
    }
  })

  return {
    strongest_area,
    top_unlocking_skills,
    summary,
    roles,
  }
}
