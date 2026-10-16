export interface MockQuestion {
  id: number
  topic: string
  question: string
  options: string[]
  correct_index: number
  explanation: string
}

export interface ValidatedMockTest {
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  questions: MockQuestion[]
}

export const mockTestResponseSchema = {
  type: 'OBJECT',
  properties: {
    difficulty: { type: 'STRING' },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'INTEGER' },
          topic: { type: 'STRING' },
          question: { type: 'STRING' },
          options: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          correct_index: { type: 'INTEGER' },
          explanation: { type: 'STRING' },
        },
        required: ['id', 'topic', 'question', 'options', 'correct_index', 'explanation'],
      },
    },
  },
  required: ['difficulty', 'questions'],
}

export function buildMockTestPrompt(
  resumeText: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
): { system: string; user: string } {
  const system = `You are a Principal Engineering Interviewer at a top technology company.
Your task is to generate a realistic, rigorous technical multiple-choice mock test based strictly on the skills, technologies, and experience described in the candidate's resume.

Instructions:
1. Return ONLY a single valid JSON object. No markdown, no prose, no code fences.
2. Generate exactly 10 questions tailored to the specified difficulty: "${difficulty}".
3. Each question must have exactly 4 options.
4. "correct_index" must be an integer between 0 and 3 indicating the index of the correct option.`

  const user = `Generate a 10-question multiple-choice technical interview test for difficulty level: ${difficulty.toUpperCase()}.

RESUME TEXT:
---
${resumeText.slice(0, 10000)}
---

Return EXACTLY this JSON structure:
{
  "difficulty": "${difficulty}",
  "questions": [
    {
      "id": 1,
      "topic": "<Specific skill or concept name, e.g. React Performance, SQL Indexing, Python Concurrency>",
      "question": "<Clear, concrete technical interview question>",
      "options": [
        "<Option A>",
        "<Option B>",
        "<Option C>",
        "<Option D>"
      ],
      "correct_index": 0,
      "explanation": "<1-2 sentence concise explanation of why this answer is correct>"
    }
  ]
}`

  return { system, user }
}

export function validateMockTestResponse(raw: unknown, expectedDifficulty: 'beginner' | 'intermediate' | 'advanced'): ValidatedMockTest | null {
  if (typeof raw !== 'object' || raw === null) return null

  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.questions) || obj.questions.length === 0) return null

  const questions: MockQuestion[] = []

  for (let idx = 0; idx < obj.questions.length; idx++) {
    const q = obj.questions[idx] as Record<string, unknown>
    if (!q || typeof q !== 'object') continue

    const options = Array.isArray(q.options)
      ? q.options.map((opt) => String(opt).trim()).filter((opt) => opt.length > 0)
      : []

    if (options.length < 2) continue

    const correct_index = Math.max(0, Math.min(options.length - 1, Number(q.correct_index) || 0))

    questions.push({
      id: idx + 1,
      topic: String(q.topic ?? 'General Engineering').trim(),
      question: String(q.question ?? `Technical Question ${idx + 1}`).trim(),
      options: options.slice(0, 4),
      correct_index,
      explanation: String(q.explanation ?? 'Correct technical solution based on standard best practices.').trim(),
    })

    if (questions.length === 10) break
  }

  if (questions.length === 0) return null

  return {
    difficulty: expectedDifficulty,
    questions,
  }
}
