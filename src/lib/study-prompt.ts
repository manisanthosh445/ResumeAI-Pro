export interface StudyTopic {
  step: number
  title: string
  category: string
  explanation: string
  resource_name: string
  search_query: string
}

export interface ValidatedStudyGuide {
  domain: string
  summary: string
  topics: StudyTopic[]
}

export const studyGuideResponseSchema = {
  type: 'OBJECT',
  properties: {
    domain: { type: 'STRING' },
    summary: { type: 'STRING' },
    topics: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          step: { type: 'INTEGER' },
          title: { type: 'STRING' },
          category: { type: 'STRING' },
          explanation: { type: 'STRING' },
          resource_name: { type: 'STRING' },
          search_query: { type: 'STRING' },
        },
        required: ['step', 'title', 'category', 'explanation', 'resource_name', 'search_query'],
      },
    },
  },
  required: ['domain', 'summary', 'topics'],
}

export function buildStudyPrompt(
  resumeText: string,
  analysisContext?: string
): { system: string; user: string } {
  const system = `You are a technical curriculum designer and senior engineering mentor.
Your task is to analyze a candidate's resume skills and skill gaps, then return an ordered study roadmap of related concepts to learn.

CRITICAL INSTRUCTIONS:
1. Return ONLY a valid JSON object matching the requested schema. No prose, no markdown, no code fences.
2. DO NOT invent specific URLs or web hyperlinks. Do NOT output http or https links. Only provide well-known resource names (e.g., "Official Documentation", "MDN Web Docs", "freeCodeCamp", "GeeksforGeeks", "NPTEL", "Coursera", "AWS Docs") and realistic Google search queries.
3. Organize the topics into a clear suggested learning order, moving from foundational core concepts to intermediate architecture, databases, system design, testing, and production engineering.
4. For each topic, provide a concise 2-3 sentence explanation explaining what the concept is and why mastering it bridges technical gaps in interviews and production work.`

  const gapsClause = analysisContext
    ? `\n\nCANDIDATE ANALYSIS & IDENTIFIED GAPS:\n${analysisContext.slice(0, 3000)}\n`
    : ''

  const user = `Analyze this resume text and generate 6 to 10 structured study topics in a suggested learning order (from foundational to advanced):

RESUME TEXT:
---
${resumeText.slice(0, 10000)}
---${gapsClause}

Return EXACTLY this JSON structure:
{
  "domain": "<primary technical domain, e.g. Full-Stack Web Development, Backend Systems, Cloud & DevOps, Machine Learning>",
  "summary": "<2-sentence explanation of the candidate's current skill profile and why studying these topics bridges their career gaps>",
  "topics": [
    {
      "step": 1,
      "title": "<Topic / Concept Title>",
      "category": "<Category e.g. Core Language, Architecture, Database, DevOps, Testing, Security>",
      "explanation": "<2-3 sentence explanation of the concept and why it matters for technical interviews and production work>",
      "resource_name": "<Well-known resource name, e.g. MDN Web Docs, Official Docs, freeCodeCamp, GeeksforGeeks, NPTEL>",
      "search_query": "<Precise search query to find this resource, e.g. React server components tutorial MDN freeCodeCamp>"
    }
  ]
}`

  return { system, user }
}

export function validateStudyGuideResponse(raw: unknown): ValidatedStudyGuide | null {
  if (typeof raw !== 'object' || raw === null) return null

  const obj = raw as Record<string, unknown>
  const domain =
    typeof obj.domain === 'string' && obj.domain.trim().length > 0
      ? obj.domain.trim()
      : 'Technical Engineering'

  const summary =
    typeof obj.summary === 'string' && obj.summary.trim().length > 0
      ? obj.summary.trim()
      : 'Curated concepts and topics recommended based on your resume skill analysis.'

  if (!Array.isArray(obj.topics) || obj.topics.length === 0) {
    return null
  }

  const topics: StudyTopic[] = obj.topics.slice(0, 12).map((item, idx) => {
    const t = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    // Clean any accidentally generated URLs from resource_name or search_query
    let resourceName = String(t.resource_name ?? 'Official Documentation / freeCodeCamp').trim()
    let searchQuery = String(t.search_query ?? `${t.title ?? 'topic'} tutorial`).trim()
    resourceName = resourceName.replace(/https?:\/\/\S+/gi, '').trim()
    searchQuery = searchQuery.replace(/https?:\/\/\S+/gi, '').trim()

    return {
      step: Number(t.step) || idx + 1,
      title: String(t.title ?? `Core Topic ${idx + 1}`).trim(),
      category: String(t.category ?? 'Engineering').trim(),
      explanation: String(t.explanation ?? 'Core concept essential for technical proficiency.').trim(),
      resource_name: resourceName || 'Official Documentation',
      search_query: searchQuery || `${t.title ?? 'topic'} tutorial`,
    }
  })

  return { domain, summary, topics }
}
