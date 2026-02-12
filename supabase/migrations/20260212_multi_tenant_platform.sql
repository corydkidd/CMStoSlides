-- ============================================
-- Multi-Tenant Regulatory Intelligence Platform
-- Date: 2026-02-12
-- ============================================

-- ============================================
-- 1. CREATE AGENCIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.agencies (
  id TEXT PRIMARY KEY,  -- 'cms', 'fda', etc.
  name TEXT NOT NULL,
  federal_register_slug TEXT NOT NULL,
  newsroom_feeds JSONB DEFAULT '[]',  -- Array of {url, name, type, enabled}
  document_types TEXT[] DEFAULT ARRAY['RULE', 'PRORULE', 'NOTICE'],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CREATE ORGANIZATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,

  -- Output configuration
  output_type TEXT NOT NULL DEFAULT 'pptx',  -- 'pptx' | 'memo_pdf'

  -- Branding (for memo_pdf orgs)
  branding JSONB DEFAULT '{}',
  -- Structure: {
  --   logo_url: string,
  --   primary_color: '#hex',
  --   secondary_color: '#hex',
  --   company_name: string,
  --   tagline: string
  -- }

  -- Model configuration
  model_config JSONB DEFAULT '{
    "base_model": "claude-sonnet-4-5-20250929",
    "customization_model": "claude-haiku-4-5-20251001"
  }',

  -- Feature flags
  has_clients BOOLEAN DEFAULT FALSE,  -- Does this org use client customization?
  auto_process BOOLEAN DEFAULT FALSE, -- Auto-generate on new docs?

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. CREATE ORGANIZATION-AGENCIES JUNCTION
-- ============================================

CREATE TABLE IF NOT EXISTS public.organization_agencies (
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE CASCADE,

  -- Per-org agency settings
  federal_register_enabled BOOLEAN DEFAULT TRUE,
  newsroom_enabled BOOLEAN DEFAULT TRUE,
  document_types TEXT[],  -- Override agency defaults, or NULL to use agency defaults

  PRIMARY KEY (organization_id, agency_id)
);

-- ============================================
-- 4. EXTEND PROFILES TABLE
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';  -- 'admin' | 'member'

CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);

-- ============================================
-- 5. CREATE CLIENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,

  -- Context for AI customization (the "lens")
  context TEXT NOT NULL,

  -- Optional additional context
  industry TEXT,
  focus_areas TEXT[],

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(organization_id);

-- ============================================
-- 6. CREATE REGULATORY DOCUMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.regulatory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  source TEXT NOT NULL,  -- 'federal_register' | 'newsroom_rss'
  agency_id TEXT NOT NULL REFERENCES public.agencies(id),

  -- Unique identifier (depends on source)
  external_id TEXT NOT NULL,  -- document_number for FR, guid for RSS

  -- Document metadata
  title TEXT NOT NULL,
  abstract TEXT,
  publication_date DATE,

  -- URLs
  source_url TEXT,  -- federalregister.gov page or FDA page
  pdf_url TEXT,     -- Direct PDF link if available

  -- Federal Register specific
  citation TEXT,           -- e.g., "91 FR 12345"
  document_type TEXT,      -- RULE, PRORULE, NOTICE
  is_significant BOOLEAN,

  -- Newsroom specific
  feed_name TEXT,          -- Which RSS feed this came from

  -- Tracking
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  content_hash TEXT,       -- For detecting updates to same document

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_reg_docs_agency ON public.regulatory_documents(agency_id);
CREATE INDEX IF NOT EXISTS idx_reg_docs_date ON public.regulatory_documents(publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_reg_docs_detected ON public.regulatory_documents(detected_at DESC);

-- ============================================
-- 7. CREATE DOCUMENT OUTPUTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.document_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  regulatory_document_id UUID NOT NULL REFERENCES public.regulatory_documents(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),

  -- Output type and location
  output_type TEXT NOT NULL,  -- 'pptx' | 'memo_pdf'
  output_path TEXT,           -- Supabase storage path

  -- Processing
  status TEXT DEFAULT 'pending',  -- pending, processing, complete, failed
  error_message TEXT,

  -- For memos: the base (non-customized) version
  is_base_output BOOLEAN DEFAULT TRUE,

  -- Tracking
  model_used TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(regulatory_document_id, organization_id, is_base_output)
);

CREATE INDEX IF NOT EXISTS idx_doc_outputs_org ON public.document_outputs(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_outputs_status ON public.document_outputs(status);

-- ============================================
-- 8. CREATE CLIENT OUTPUTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.client_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  document_output_id UUID NOT NULL REFERENCES public.document_outputs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  -- Output location
  output_path TEXT,

  -- Processing
  status TEXT DEFAULT 'pending',  -- pending, selected, processing, complete, failed, skipped
  error_message TEXT,

  -- Selection workflow
  selected_for_generation BOOLEAN DEFAULT FALSE,
  selected_by UUID REFERENCES public.profiles(id),
  selected_at TIMESTAMPTZ,

  -- Tracking
  model_used TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(document_output_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_outputs_status ON public.client_outputs(status);
CREATE INDEX IF NOT EXISTS idx_client_outputs_client ON public.client_outputs(client_id);

-- ============================================
-- 9. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_outputs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. CREATE RLS POLICIES
-- ============================================

-- Organizations: Users see own org
CREATE POLICY "Users see own org" ON public.organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Organizations: Admins see all
CREATE POLICY "Admins see all orgs" ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Clients: Users see own org clients
CREATE POLICY "Users see own org clients" ON public.clients FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Regulatory documents: Users see documents for subscribed agencies
CREATE POLICY "Users see relevant regulatory docs" ON public.regulatory_documents FOR SELECT
  USING (
    agency_id IN (
      SELECT oa.agency_id
      FROM public.organization_agencies oa
      JOIN public.profiles p ON p.organization_id = oa.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- Document outputs: Users see own org outputs
CREATE POLICY "Users see own org outputs" ON public.document_outputs FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Client outputs: Users see outputs for their org's documents
CREATE POLICY "Users see own client outputs" ON public.client_outputs FOR ALL
  USING (
    document_output_id IN (
      SELECT id FROM public.document_outputs
      WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Service role policies (for cron jobs)
CREATE POLICY "Service role can manage regulatory docs" ON public.regulatory_documents FOR ALL
  USING (true);

CREATE POLICY "Service role can manage outputs" ON public.document_outputs FOR ALL
  USING (true);

CREATE POLICY "Service role can manage client outputs" ON public.client_outputs FOR ALL
  USING (true);

-- ============================================
-- 11. INSERT INITIAL AGENCIES
-- ============================================

INSERT INTO public.agencies (id, name, federal_register_slug, newsroom_feeds) VALUES
('cms', 'Centers for Medicare & Medicaid Services',
 'centers-for-medicare-medicaid-services',
 '[{"url": "https://www.cms.gov/newsroom", "name": "CMS Newsroom", "type": "scrape", "enabled": true}]'
),
('fda', 'Food and Drug Administration',
 'food-and-drug-administration',
 '[
   {"url": "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml", "name": "Press Releases", "type": "rss", "enabled": true},
   {"url": "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml", "name": "Drugs Updates", "type": "rss", "enabled": true},
   {"url": "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/biologics/rss.xml", "name": "Biologics Updates", "type": "rss", "enabled": true}
 ]'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 12. CREATE TRIGGER FUNCTIONS
-- ============================================

-- Trigger to update updated_at on organizations
CREATE TRIGGER set_updated_at_organizations
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to update updated_at on clients
CREATE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 13. MIGRATION HELPER VIEWS
-- ============================================

-- View to show organization summary (useful for admin dashboard)
CREATE OR REPLACE VIEW public.organization_summary AS
SELECT
  o.id,
  o.name,
  o.slug,
  o.output_type,
  o.has_clients,
  COUNT(DISTINCT p.id) as user_count,
  COUNT(DISTINCT c.id) as client_count,
  COUNT(DISTINCT do2.id) as document_count,
  COUNT(DISTINCT co.id) as output_count
FROM public.organizations o
LEFT JOIN public.profiles p ON p.organization_id = o.id
LEFT JOIN public.clients c ON c.organization_id = o.id AND c.is_active = TRUE
LEFT JOIN public.document_outputs do2 ON do2.organization_id = o.id
LEFT JOIN public.client_outputs co ON co.document_output_id = do2.id
GROUP BY o.id, o.name, o.slug, o.output_type, o.has_clients;

-- ============================================
-- NOTES FOR POST-MIGRATION
-- ============================================

-- After running this migration, you need to:
-- 1. Create organization records for Jayson and Catalyst
-- 2. Link existing users to their organizations
-- 3. Migrate federal_register_documents to regulatory_documents
-- 4. Run the seed script (see next file)
