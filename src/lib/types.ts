export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          target_role: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          target_role?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          target_role?: string | null
          created_at?: string
        }
      }
      resumes: {
        Row: {
          id: string
          user_id: string
          file_name: string
          raw_text: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          raw_text: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          raw_text?: string
          uploaded_at?: string
        }
      }
      analyses: {
        Row: {
          id: string
          resume_id: string
          overall_score: number
          section_scores: Json
          feedback: Json
          ats_issues: Json
          created_at: string
        }
        Insert: {
          id?: string
          resume_id: string
          overall_score: number
          section_scores: Json
          feedback: Json
          ats_issues: Json
          created_at?: string
        }
        Update: {
          id?: string
          resume_id?: string
          overall_score?: number
          section_scores?: Json
          feedback?: Json
          ats_issues?: Json
          created_at?: string
        }
      }
    }
  }
}

// ─── Application-level types ─────────────────────────────────────────────────

export interface SectionScores {
  skills: number
  education: number
  experience: number
  projects: number
  formatting: number
  grammar: number
}

export interface AtsIssue {
  severity: 'high' | 'medium' | 'low'
  section: string
  issue: string
  fix: string
}

export interface ImprovementSuggestion {
  section: string
  original: string
  rewritten: string
  rationale: string
}

export interface SectionFeedback {
  section: string
  score: number
  summary: string
  suggestions: ImprovementSuggestion[]
}

export interface ResumeAnalysis {
  overall_score: number
  section_scores: SectionScores
  ats_issues: AtsIssue[]
  feedback: SectionFeedback[]
}

export interface StudyTopic {
  step: number
  title: string
  category: string
  explanation: string
  resource_name: string
  search_query: string
}

export interface MockQuestion {
  id: number
  topic: string
  question: string
  options: string[]
  correct_index: number
  explanation: string
}

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

export interface JobRecommendations {
  strongest_area: string
  top_unlocking_skills: string[]
  summary: string
  roles: JobRole[]
}
