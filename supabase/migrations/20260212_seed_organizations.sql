-- ============================================
-- Seed Organizations and Migrate Existing Data
-- Date: 2026-02-12
-- Run this AFTER the main migration
-- ============================================

-- ============================================
-- 1. CREATE JAYSON'S ORGANIZATION
-- ============================================

INSERT INTO public.organizations (
  name,
  slug,
  output_type,
  has_clients,
  auto_process,
  model_config
) VALUES (
  'Jayson Team',
  'jayson-team',
  'pptx',
  FALSE,  -- No client customization
  TRUE,   -- Auto-process new documents
  '{"base_model": "claude-sonnet-4-5-20250929"}'
) ON CONFLICT (slug) DO NOTHING;

-- Link Jayson's org to CMS
INSERT INTO public.organization_agencies (
  organization_id,
  agency_id,
  federal_register_enabled,
  newsroom_enabled
)
SELECT
  o.id,
  'cms',
  TRUE,
  TRUE
FROM public.organizations o
WHERE o.slug = 'jayson-team'
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. CREATE CATALYST ORGANIZATION
-- ============================================

INSERT INTO public.organizations (
  name,
  slug,
  output_type,
  has_clients,
  auto_process,
  branding,
  model_config
) VALUES (
  'Catalyst Healthcare Consulting',
  'catalyst',
  'memo_pdf',
  TRUE,   -- Uses client customization
  FALSE,  -- Manual selection workflow
  '{
    "company_name": "Catalyst Healthcare Consulting",
    "tagline": "Igniting progress at the intersection of regulation, policy, and innovation",
    "logo_url": "https://cdn.prod.website-files.com/67ab1b028067c83763b0acf7/67ab1d6e783fcba64eb75481_gingi_logo.png",
    "primary_color": "#1a1a2e",
    "secondary_color": "#e94560",
    "accent_color": "#0f3460",
    "font_family": "Inter, sans-serif"
  }',
  '{
    "base_model": "claude-opus-4-5-20251101",
    "customization_model": "claude-haiku-4-5-20251001"
  }'
) ON CONFLICT (slug) DO NOTHING;

-- Link Catalyst to FDA
INSERT INTO public.organization_agencies (
  organization_id,
  agency_id,
  federal_register_enabled,
  newsroom_enabled
)
SELECT
  o.id,
  'fda',
  TRUE,
  TRUE
FROM public.organizations o
WHERE o.slug = 'catalyst'
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. MIGRATE EXISTING JAYSON USER
-- ============================================

-- Update existing user to link to Jayson's org
-- NOTE: Update the email to match actual user
UPDATE public.profiles
SET
  organization_id = (SELECT id FROM public.organizations WHERE slug = 'jayson-team'),
  role = 'admin'
WHERE email LIKE '%jayson%' OR email LIKE '%sumis%'
  AND organization_id IS NULL;

-- ============================================
-- 4. MIGRATE FEDERAL REGISTER DOCUMENTS
-- ============================================

-- Migrate existing federal_register_documents to new regulatory_documents table
INSERT INTO public.regulatory_documents (
  source,
  agency_id,
  external_id,
  title,
  abstract,
  publication_date,
  source_url,
  pdf_url,
  citation,
  document_type,
  is_significant,
  detected_at,
  created_at
)
SELECT
  'federal_register' as source,
  'cms' as agency_id,  -- Assume all existing docs are CMS
  document_number as external_id,
  title,
  abstract,
  publication_date,
  html_url as source_url,
  pdf_url,
  citation,
  document_type,
  is_significant,
  detected_at,
  created_at
FROM public.federal_register_documents
WHERE NOT EXISTS (
  SELECT 1 FROM public.regulatory_documents rd
  WHERE rd.source = 'federal_register'
    AND rd.external_id = federal_register_documents.document_number
);

-- ============================================
-- 5. CREATE DOCUMENT OUTPUTS FOR MIGRATED DOCS
-- ============================================

-- For each migrated document with a completed conversion job,
-- create a document_output record
INSERT INTO public.document_outputs (
  regulatory_document_id,
  organization_id,
  output_type,
  output_path,
  status,
  is_base_output,
  processing_started_at,
  processing_completed_at,
  created_at
)
SELECT
  rd.id as regulatory_document_id,
  (SELECT id FROM public.organizations WHERE slug = 'jayson-team') as organization_id,
  'pptx' as output_type,
  cj.output_path,
  CASE
    WHEN cj.status = 'complete' THEN 'complete'
    WHEN cj.status = 'failed' THEN 'failed'
    WHEN cj.status = 'processing' THEN 'processing'
    ELSE 'pending'
  END as status,
  TRUE as is_base_output,
  cj.processing_started_at,
  cj.processing_completed_at,
  cj.created_at
FROM public.federal_register_documents frd
JOIN public.regulatory_documents rd
  ON rd.source = 'federal_register'
  AND rd.external_id = frd.document_number
LEFT JOIN public.conversion_jobs cj
  ON cj.id = frd.conversion_job_id
WHERE cj.id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.document_outputs do2
    WHERE do2.regulatory_document_id = rd.id
      AND do2.organization_id = (SELECT id FROM public.organizations WHERE slug = 'jayson-team')
  );

-- ============================================
-- 6. CREATE SAMPLE CLIENTS FOR CATALYST
-- ============================================

-- Add a few sample clients for testing
-- Nancy can add real clients through the UI

INSERT INTO public.clients (
  organization_id,
  name,
  context,
  industry,
  focus_areas,
  is_active
)
SELECT
  o.id,
  'Sample Biotech Client',
  'A mid-size biotechnology company focused on CAR-T cell therapies for solid tumors. They have two products in Phase 2 trials and are particularly concerned about FDA guidance on manufacturing standards and accelerated approval pathways. Key decision makers are the VP of Regulatory Affairs and CMO.',
  'Biotechnology',
  ARRAY['CAR-T therapy', 'oncology', 'manufacturing', 'clinical trials'],
  TRUE
FROM public.organizations o
WHERE o.slug = 'catalyst'
ON CONFLICT DO NOTHING;

INSERT INTO public.clients (
  organization_id,
  name,
  context,
  industry,
  focus_areas,
  is_active
)
SELECT
  o.id,
  'Sample Pharma Manufacturer',
  'A pharmaceutical manufacturing company specializing in biosimilars. They are actively seeking FDA approvals for biosimilar versions of major biologics and are closely monitoring interchangeability guidance. Their primary concerns are manufacturing quality standards and competitive approval timelines.',
  'Pharmaceutical Manufacturing',
  ARRAY['biosimilars', 'manufacturing', 'quality systems', 'regulatory submissions'],
  TRUE
FROM public.organizations o
WHERE o.slug = 'catalyst'
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. VERIFICATION QUERIES
-- ============================================

-- These queries help verify the migration was successful

-- Check organizations
SELECT 'Organizations:', name, slug, output_type, has_clients
FROM public.organizations
ORDER BY name;

-- Check agency subscriptions
SELECT 'Agency Subscriptions:',
  o.name as org_name,
  oa.agency_id,
  oa.federal_register_enabled,
  oa.newsroom_enabled
FROM public.organization_agencies oa
JOIN public.organizations o ON o.id = oa.organization_id
ORDER BY o.name, oa.agency_id;

-- Check migrated documents
SELECT 'Migrated Documents:',
  COUNT(*) as total,
  source,
  agency_id
FROM public.regulatory_documents
GROUP BY source, agency_id;

-- Check document outputs
SELECT 'Document Outputs:',
  COUNT(*) as total,
  o.name as org_name,
  do2.status,
  do2.output_type
FROM public.document_outputs do2
JOIN public.organizations o ON o.id = do2.organization_id
GROUP BY o.name, do2.status, do2.output_type
ORDER BY o.name, do2.status;

-- Check clients
SELECT 'Clients:',
  o.name as org_name,
  COUNT(c.id) as client_count
FROM public.organizations o
LEFT JOIN public.clients c ON c.organization_id = o.id AND c.is_active = TRUE
GROUP BY o.name
ORDER BY o.name;
