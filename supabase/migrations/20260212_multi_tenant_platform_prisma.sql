-- ============================================
-- Multi-Tenant Regulatory Intelligence Platform (Prisma Version)
-- Date: 2026-02-12
-- Adapted for Prisma schema (no RLS, uses User table)
-- ============================================

-- ============================================
-- 1. EXTEND USER TABLE
-- ============================================

-- Add organization and role to existing User table
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';  -- 'admin' | 'member'

-- Index for organization lookups
CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId");

-- ============================================
-- 2. ADD TRIGGERS FOR NEW TABLES
-- ============================================

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to organizations
CREATE TRIGGER set_updated_at_organizations
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply triggers to clients
CREATE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. ADD FOREIGN KEY CONSTRAINT
-- ============================================

-- Add foreign key from User to organizations
-- (Can't add if data doesn't match, so we'll add it after seeding)
-- ALTER TABLE "User"
--   ADD CONSTRAINT "User_organizationId_fkey"
--   FOREIGN KEY ("organizationId") REFERENCES organizations(id);

-- ============================================
-- 4. CREATE HELPER VIEWS
-- ============================================

-- View to show organization summary (useful for admin dashboard)
CREATE OR REPLACE VIEW organization_summary AS
SELECT
  o.id,
  o.name,
  o.slug,
  o.output_type,
  o.has_clients,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT c.id) as client_count,
  COUNT(DISTINCT do2.id) as document_count,
  COUNT(DISTINCT co.id) as output_count
FROM organizations o
LEFT JOIN "User" u ON u."organizationId" = o.id::text
LEFT JOIN clients c ON c.organization_id = o.id AND c.is_active = TRUE
LEFT JOIN document_outputs do2 ON do2.organization_id = o.id
LEFT JOIN client_outputs co ON co.document_output_id = do2.id
GROUP BY o.id, o.name, o.slug, o.output_type, o.has_clients;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show newly created tables
SELECT 'Tables created:' as status,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'agencies',
    'organizations',
    'organization_agencies',
    'clients',
    'regulatory_documents',
    'document_outputs',
    'client_outputs'
  )
ORDER BY tablename;

-- Show table counts
SELECT 'agencies' as table_name, COUNT(*) as count FROM agencies
UNION ALL
SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'regulatory_documents', COUNT(*) FROM regulatory_documents
UNION ALL
SELECT 'document_outputs', COUNT(*) FROM document_outputs
UNION ALL
SELECT 'client_outputs', COUNT(*) FROM client_outputs;
