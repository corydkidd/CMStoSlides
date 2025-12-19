-- ============================================
-- CMS Converter Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  template_path TEXT, -- Path to user's PPTX template in storage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Description documents (user-specific transformation instructions)
CREATE TABLE IF NOT EXISTS public.description_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- Markdown/text instructions for Claude
  version INTEGER DEFAULT 1,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) -- Admin who created it
);

-- Conversion jobs
CREATE TABLE IF NOT EXISTS public.conversion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, complete, failed

  -- Input
  input_filename TEXT NOT NULL,
  input_path TEXT NOT NULL, -- Supabase Storage path
  input_size_bytes BIGINT,

  -- Processing
  extracted_text TEXT, -- Full text from PDF (for debugging/reprocessing)
  description_doc_id UUID REFERENCES public.description_documents(id),
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,

  -- Output
  output_filename TEXT,
  output_path TEXT, -- Supabase Storage path
  output_size_bytes BIGINT,

  -- Errors
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON public.conversion_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.conversion_jobs(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_description_docs_user ON public.description_documents(user_id, is_current);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.description_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can insert profiles
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- DESCRIPTION DOCUMENTS POLICIES
-- ============================================

-- Users can view their own description documents
CREATE POLICY "Users can view own description documents"
  ON public.description_documents FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all description documents
CREATE POLICY "Admins can view all description documents"
  ON public.description_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can insert description documents
CREATE POLICY "Admins can insert description documents"
  ON public.description_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update description documents
CREATE POLICY "Admins can update description documents"
  ON public.description_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================
-- CONVERSION JOBS POLICIES
-- ============================================

-- Users can view their own jobs
CREATE POLICY "Users can view own jobs"
  ON public.conversion_jobs FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own jobs
CREATE POLICY "Users can insert own jobs"
  ON public.conversion_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view all jobs
CREATE POLICY "Admins can view all jobs"
  ON public.conversion_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update all jobs
CREATE POLICY "Admins can update all jobs"
  ON public.conversion_jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Service role can update jobs (for cron processing)
CREATE POLICY "Service role can update jobs"
  ON public.conversion_jobs FOR UPDATE
  USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to handle new user creation (trigger on auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_description_documents
  BEFORE UPDATE ON public.description_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_conversion_jobs
  BEFORE UPDATE ON public.conversion_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
