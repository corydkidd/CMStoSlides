-- Migration: Add Federal Register monitoring
-- Date: 2025-12-29

-- 1. Create federal_register_documents table
CREATE TABLE IF NOT EXISTS public.federal_register_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number TEXT UNIQUE NOT NULL,
  citation TEXT,
  title TEXT NOT NULL,
  document_type TEXT,
  abstract TEXT,
  publication_date DATE NOT NULL,
  pdf_url TEXT NOT NULL,
  html_url TEXT,
  is_significant BOOLEAN DEFAULT FALSE,
  agencies JSONB,
  auto_process BOOLEAN DEFAULT TRUE,
  target_user_id UUID REFERENCES public.profiles(id),
  conversion_job_id UUID REFERENCES public.conversion_jobs(id),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  pdf_downloaded_at TIMESTAMPTZ,
  processing_status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_fr_docs_document_number
  ON public.federal_register_documents(document_number);
CREATE INDEX IF NOT EXISTS idx_fr_docs_publication_date
  ON public.federal_register_documents(publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_fr_docs_status
  ON public.federal_register_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_fr_docs_target_user
  ON public.federal_register_documents(target_user_id);

-- 3. Enable RLS
ALTER TABLE public.federal_register_documents ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
CREATE POLICY "Admins can manage FR documents"
  ON public.federal_register_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Users can view their FR documents"
  ON public.federal_register_documents FOR SELECT
  USING (target_user_id = auth.uid());

-- 5. Create settings table
CREATE TABLE IF NOT EXISTS public.federal_register_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN DEFAULT TRUE,
  poll_interval_minutes INTEGER DEFAULT 15,
  agency_slugs TEXT[] DEFAULT ARRAY['centers-for-medicare-medicaid-services'],
  document_types TEXT[] DEFAULT ARRAY['RULE', 'PRORULE', 'NOTICE'],
  only_significant BOOLEAN DEFAULT FALSE,
  default_target_user_id UUID REFERENCES public.profiles(id),
  auto_process_new BOOLEAN DEFAULT TRUE,
  last_poll_at TIMESTAMPTZ,
  last_poll_status TEXT,
  last_poll_documents_found INTEGER,
  initialized BOOLEAN DEFAULT FALSE,
  initial_document_count INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Insert default settings
-- NOTE: Replace 'JAYSON_USER_ID' with actual UUID after user is created
INSERT INTO public.federal_register_settings (
  is_enabled,
  agency_slugs,
  document_types,
  only_significant,
  auto_process_new,
  initial_document_count
) VALUES (
  TRUE,
  ARRAY['centers-for-medicare-medicaid-services'],
  ARRAY['RULE', 'PRORULE', 'NOTICE'],
  FALSE,
  TRUE,
  5
) ON CONFLICT DO NOTHING;

-- 7. Add metadata column to conversion_jobs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversion_jobs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.conversion_jobs ADD COLUMN metadata JSONB;
  END IF;
END $$;
