-- ─────────────────────────────────────────────────────────────────────────────
-- ResumeAI Pro — Supabase Schema & Auth Setup
-- Safe to run more than once in Supabase SQL Editor (Dashboard → SQL Editor)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  target_role TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure email column exists if profiles table was already created prior
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- Auto-create / sync profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = CASE 
      WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name 
      ELSE public.profiles.full_name 
    END,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill profiles for existing users if any were missed
INSERT INTO public.profiles (id, full_name, email)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', ''), 
  email
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email;

-- ─── resumes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resumes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  raw_text    TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── analyses ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analyses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id      UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_score  SMALLINT NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  section_scores JSONB NOT NULL DEFAULT '{}',
  feedback       JSONB NOT NULL DEFAULT '[]',
  ats_issues     JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure user_id column exists if table was previously created without it
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── study_guides (optional table) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_guides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id   UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain      TEXT NOT NULL,
  summary     TEXT NOT NULL,
  topics      JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_guides ENABLE ROW LEVEL SECURITY;

-- profiles: users can select and update their own profile row
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- resumes: users can only access and delete their own uploaded resumes
DROP POLICY IF EXISTS "resumes_select_own" ON public.resumes;
CREATE POLICY "resumes_select_own" ON public.resumes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "resumes_own" ON public.resumes;
CREATE POLICY "resumes_own" ON public.resumes
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "resumes_delete_own" ON public.resumes;
CREATE POLICY "resumes_delete_own" ON public.resumes
  FOR DELETE USING (auth.uid() = user_id);

-- analyses: users can select, insert, update and delete analyses for their resumes
DROP POLICY IF EXISTS "analyses_insert_own" ON public.analyses;
DROP POLICY IF EXISTS "analyses_select_own" ON public.analyses;
DROP POLICY IF EXISTS "analyses_update_own" ON public.analyses;
DROP POLICY IF EXISTS "analyses_delete_own" ON public.analyses;
DROP POLICY IF EXISTS "analyses_own" ON public.analyses;

CREATE POLICY "analyses_insert_own" ON public.analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "analyses_select_own" ON public.analyses
  FOR SELECT USING (
    auth.uid() = user_id OR
    resume_id IN (
      SELECT id FROM public.resumes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "analyses_update_own" ON public.analyses
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "analyses_delete_own" ON public.analyses
  FOR DELETE USING (
    auth.uid() = user_id OR
    resume_id IN (
      SELECT id FROM public.resumes WHERE user_id = auth.uid()
    )
  );

-- study_guides: users can only access and delete their own study guides
DROP POLICY IF EXISTS "study_guides_own" ON public.study_guides;
CREATE POLICY "study_guides_own" ON public.study_guides
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_guides_delete_own" ON public.study_guides;
CREATE POLICY "study_guides_delete_own" ON public.study_guides
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_resumes_user_id       ON public.resumes (user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_resume_id    ON public.analyses (resume_id);
CREATE INDEX IF NOT EXISTS idx_study_guides_user_id  ON public.study_guides (user_id);

-- ─── trending_jobs_cache ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trending_jobs_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country     TEXT NOT NULL DEFAULT 'India',
  jobs_data   JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trending_jobs_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trending_jobs_cache_select" ON public.trending_jobs_cache;
CREATE POLICY "trending_jobs_cache_select" ON public.trending_jobs_cache
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "trending_jobs_cache_insert" ON public.trending_jobs_cache;
CREATE POLICY "trending_jobs_cache_insert" ON public.trending_jobs_cache
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_trending_jobs_cache_country_created_at
  ON public.trending_jobs_cache (country, created_at DESC);

-- ─── study_plans (jsonb content format) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id   UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_plans_select_own" ON public.study_plans;
CREATE POLICY "study_plans_select_own" ON public.study_plans
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_plans_insert_own" ON public.study_plans;
CREATE POLICY "study_plans_insert_own" ON public.study_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_plans_update_own" ON public.study_plans;
CREATE POLICY "study_plans_update_own" ON public.study_plans
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_plans_delete_own" ON public.study_plans;
CREATE POLICY "study_plans_delete_own" ON public.study_plans
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_study_plans_resume_id ON public.study_plans (resume_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_user_id   ON public.study_plans (user_id);

-- ─── job_recommendations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_recommendations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id   UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_recommendations_select_own" ON public.job_recommendations;
CREATE POLICY "job_recommendations_select_own" ON public.job_recommendations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_recommendations_insert_own" ON public.job_recommendations;
CREATE POLICY "job_recommendations_insert_own" ON public.job_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_recommendations_update_own" ON public.job_recommendations;
CREATE POLICY "job_recommendations_update_own" ON public.job_recommendations
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_recommendations_delete_own" ON public.job_recommendations;
CREATE POLICY "job_recommendations_delete_own" ON public.job_recommendations
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_job_recommendations_resume_id ON public.job_recommendations (resume_id);
CREATE INDEX IF NOT EXISTS idx_job_recommendations_user_id   ON public.job_recommendations (user_id);

-- ─── mock_tests ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mock_tests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id   UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mock_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mock_tests_select_own" ON public.mock_tests;
CREATE POLICY "mock_tests_select_own" ON public.mock_tests
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mock_tests_insert_own" ON public.mock_tests;
CREATE POLICY "mock_tests_insert_own" ON public.mock_tests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mock_tests_update_own" ON public.mock_tests;
CREATE POLICY "mock_tests_update_own" ON public.mock_tests
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mock_tests_delete_own" ON public.mock_tests;
CREATE POLICY "mock_tests_delete_own" ON public.mock_tests
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mock_tests_resume_id ON public.mock_tests (resume_id);
CREATE INDEX IF NOT EXISTS idx_mock_tests_user_id   ON public.mock_tests (user_id);

-- ─── mock_test_attempts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mock_test_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_id       UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  score           INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 10,
  total           INTEGER,
  percentage      INTEGER,
  weak_topics     JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure total_questions and total columns exist if table was previously created with either
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'mock_test_attempts' AND column_name = 'total_questions'
  ) THEN
    ALTER TABLE public.mock_test_attempts ADD COLUMN total_questions INTEGER DEFAULT 10;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'mock_test_attempts' AND column_name = 'total'
  ) THEN
    ALTER TABLE public.mock_test_attempts ADD COLUMN total INTEGER;
  END IF;
END $$;

ALTER TABLE public.mock_test_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mock_test_attempts_select_own" ON public.mock_test_attempts;
CREATE POLICY "mock_test_attempts_select_own" ON public.mock_test_attempts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mock_test_attempts_insert_own" ON public.mock_test_attempts;
CREATE POLICY "mock_test_attempts_insert_own" ON public.mock_test_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mock_test_attempts_update_own" ON public.mock_test_attempts;
CREATE POLICY "mock_test_attempts_update_own" ON public.mock_test_attempts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mock_test_attempts_delete_own" ON public.mock_test_attempts;
CREATE POLICY "mock_test_attempts_delete_own" ON public.mock_test_attempts
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mock_test_attempts_resume_id ON public.mock_test_attempts (resume_id);
CREATE INDEX IF NOT EXISTS idx_mock_test_attempts_user_id   ON public.mock_test_attempts (user_id);

