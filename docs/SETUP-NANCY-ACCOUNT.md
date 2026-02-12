# Setup Nancy's User Account for Catalyst

## Overview

This guide creates a user account for Nancy Myers (Catalyst Healthcare Consulting) and links it to the Catalyst organization.

## Prerequisites

- Nancy has been invited to Authentik
- Nancy has logged in at least once to create her Authentik profile
- Catalyst organization exists in database

## Step 1: Verify Catalyst Organization

```sql
-- Connect to database
docker exec -i cms-converter-db-local psql -U cms_converter -d cms_converter

-- Check Catalyst organization exists
SELECT id, name, slug, output_type, has_clients
FROM organizations
WHERE slug = 'catalyst';
```

Expected output:
```
id | name | slug | output_type | has_clients
---+------+------+-------------+------------
[UUID] | Catalyst Healthcare Consulting | catalyst | memo_pdf | true
```

## Step 2: Have Nancy Sign In

1. Send Nancy the application URL: `https://cms.advientadvisors.com`
2. She should click "Sign in with Sumis Partners"
3. She'll be redirected to Authentik
4. After successful auth, she'll be redirected back
5. A User record will be auto-created in the database

## Step 3: Link Nancy to Catalyst Organization

```sql
-- Find Nancy's user record (replace email as needed)
SELECT id, email, name, "authentikId", "organizationId", role
FROM "User"
WHERE email LIKE '%nancy%' OR email LIKE '%catalysthcc%';

-- Update Nancy's user to link to Catalyst
UPDATE "User"
SET
  "organizationId" = (SELECT id::text FROM organizations WHERE slug = 'catalyst'),
  role = 'admin'
WHERE email = 'nancy@catalysthcc.com';  -- Replace with actual email

-- Verify the update
SELECT
  u.id,
  u.email,
  u.name,
  u.role,
  o.name as organization_name,
  o.slug as organization_slug
FROM "User" u
LEFT JOIN organizations o ON o.id::text = u."organizationId"
WHERE u.email LIKE '%nancy%';
```

Expected output:
```
id | email | name | role | organization_name | organization_slug
---+-------+------+------+-------------------+------------------
[id] | nancy@... | Nancy Myers | admin | Catalyst Healthcare Consulting | catalyst
```

## Step 4: Verify Access

1. Have Nancy sign out and sign in again
2. Her session should now include organization data
3. She should be able to access:
   - `/dashboard/documents` - FDA documents
   - `/dashboard/clients` - Client management

## Step 5: Test Functionality

### Test 1: View Documents
```sql
-- Nancy should only see FDA documents
-- Verify from her perspective
SELECT COUNT(*)
FROM regulatory_documents
WHERE agency_id IN (
  SELECT agency_id FROM organization_agencies
  WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'catalyst')
);
```

### Test 2: View Clients
```sql
-- Check clients for Catalyst
SELECT id, name, industry, is_active
FROM clients
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'catalyst')
ORDER BY name;
```

### Test 3: Generate Memo
1. Nancy navigates to `/dashboard/documents`
2. Finds an FDA document
3. Clicks "Generate Base"
4. Waits for Opus generation
5. Downloads and reviews base memo PDF
6. Clicks "Select Clients"
7. Selects sample clients
8. Generates client-specific memos
9. Downloads and compares

## Alternative: Create User Manually (if not using Authentik)

If Nancy needs to be created manually without Authentik:

```sql
-- Generate a unique authentikId (in production, this comes from Authentik)
INSERT INTO "User" (
  id,
  email,
  name,
  "authentikId",
  "isAdmin",
  "isActive",
  "organizationId",
  role,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  'nancy@catalysthcc.com',
  'Nancy Myers',
  'manual-nancy-' || gen_random_uuid()::text,
  false,
  true,
  (SELECT id::text FROM organizations WHERE slug = 'catalyst'),
  'admin',
  NOW(),
  NOW()
);
```

**Note**: This manual approach bypasses Authentik. For production, always use proper SSO.

## Verification Checklist

After setup, verify:

- [ ] Nancy can sign in successfully
- [ ] Nancy's session includes organization data
- [ ] Nancy sees only FDA documents (not CMS)
- [ ] Nancy can access `/dashboard/clients`
- [ ] Nancy can create/edit clients
- [ ] Nancy can generate base memos
- [ ] Nancy can select clients and generate customized memos
- [ ] Downloaded PDFs have Catalyst branding
- [ ] Cost estimates display correctly

## Troubleshooting

### Issue: Nancy sees no documents
```sql
-- Check organization-agency subscriptions
SELECT * FROM organization_agencies
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'catalyst');

-- Should show: FDA subscription with federal_register_enabled and newsroom_enabled = true
```

### Issue: Nancy can't access /dashboard/clients
```sql
-- Check has_clients flag
SELECT has_clients FROM organizations WHERE slug = 'catalyst';
-- Should be: true
```

### Issue: Client selector shows no clients
```sql
-- Check active clients
SELECT COUNT(*) FROM clients
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'catalyst')
AND is_active = true;

-- If 0, create sample clients using seed script
```

### Issue: PDF doesn't have branding
```sql
-- Check branding configuration
SELECT branding FROM organizations WHERE slug = 'catalyst';

-- Should include:
-- {
--   "company_name": "Catalyst Healthcare Consulting",
--   "logo_url": "https://cdn.prod.website-files.com/...",
--   "primary_color": "#1a1a2e",
--   "secondary_color": "#e94560"
-- }
```

## Security Notes

1. **Never share database credentials** with Nancy or clients
2. **Always use Authentik SSO** for authentication in production
3. **Verify RLS policies** prevent cross-organization data access
4. **Monitor API costs** as Nancy starts using the system
5. **Set up alerts** for unusual token usage

## Next Steps

After Nancy's account is active:

1. Schedule training session to walk through:
   - Document monitoring workflow
   - Client management
   - Memo generation and customization
   - Cost management

2. Gather feedback on:
   - UI/UX improvements
   - Additional clients to add
   - Custom memo sections needed
   - Other agencies to monitor (if any)

3. Monitor usage for first month:
   - Number of documents processed
   - Client memo generation patterns
   - Token usage and costs
   - Any errors or issues

---

## Quick Commands Reference

```bash
# Connect to database
docker exec -i cms-converter-db-local psql -U cms_converter -d cms_converter

# Check Nancy's user
SELECT * FROM "User" WHERE email LIKE '%nancy%';

# Check Nancy's organization
SELECT u.email, o.name FROM "User" u JOIN organizations o ON o.id::text = u."organizationId" WHERE u.email LIKE '%nancy%';

# Check Catalyst clients
SELECT COUNT(*) FROM clients WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'catalyst');

# Check recent FDA documents
SELECT title, publication_date FROM regulatory_documents WHERE agency_id = 'fda' ORDER BY publication_date DESC LIMIT 5;
```
