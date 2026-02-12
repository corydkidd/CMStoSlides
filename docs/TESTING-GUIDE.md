# Multi-Tenant Platform Testing Guide

## Overview

This guide covers end-to-end testing for the multi-tenant regulatory intelligence platform with two organizations: Jayson Team (CMS→PPTX) and Catalyst Healthcare Consulting (FDA→PDF memos).

## Pre-Testing Checklist

### Database
- [ ] All migrations applied successfully
- [ ] Two organizations exist: `jayson-team` and `catalyst`
- [ ] Agencies seeded: CMS and FDA
- [ ] Organization-agency subscriptions created
- [ ] Sample clients exist for Catalyst

### Environment
- [ ] ANTHROPIC_API_KEY configured
- [ ] CRON_SECRET configured
- [ ] Database connection working
- [ ] NextAuth configured with Authentik

### Deployment
- [ ] Application deployed to production
- [ ] Vercel cron jobs configured
- [ ] Cloudflare DNS pointing to deployment

## Test Scenarios

### Scenario 1: Jayson Team - Federal Register Monitoring

**Objective**: Verify CMS document detection and PowerPoint generation

1. **Trigger Manual Check**
   ```bash
   curl -X POST https://cms.advientadvisors.com/api/cron/check-regulatory-sources \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

2. **Verify Document Detection**
   - Check database: `SELECT * FROM regulatory_documents WHERE agency_id = 'cms' ORDER BY detected_at DESC LIMIT 5;`
   - Should see recent CMS Federal Register documents
   - Source should be 'federal_register'

3. **Verify Document Routing**
   - Check: `SELECT * FROM document_outputs WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'jayson-team') ORDER BY created_at DESC LIMIT 5;`
   - Should see document_outputs for Jayson's org
   - Output type should be 'pptx'
   - Status should be 'pending' or 'awaiting_approval'

4. **Test PowerPoint Generation**
   - Login as Jayson's user
   - Navigate to /dashboard/documents
   - Click "Generate Base" on a document
   - Wait for generation (may take 2-3 minutes)
   - Verify status changes to 'complete'
   - Download and open PPTX file
   - Verify: Title slide, content slides, proper formatting

**Expected Results**:
- ✓ Documents appear in dashboard
- ✓ Generate button works
- ✓ PPTX downloads successfully
- ✓ Content is readable and well-formatted

---

### Scenario 2: Catalyst - FDA Newsroom RSS Monitoring

**Objective**: Verify FDA RSS feed monitoring and memo generation

1. **Trigger RSS Check**
   ```bash
   curl -X POST https://cms.advientadvisors.com/api/cron/check-regulatory-sources \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

2. **Verify RSS Document Detection**
   - Check: `SELECT * FROM regulatory_documents WHERE agency_id = 'fda' AND source = 'newsroom_rss' ORDER BY detected_at DESC LIMIT 5;`
   - Should see FDA press releases
   - feed_name should be populated

3. **Verify Routing to Catalyst**
   - Check: `SELECT * FROM document_outputs WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'catalyst') ORDER BY created_at DESC LIMIT 5;`
   - Output type should be 'memo_pdf'

4. **Test Base Memo Generation**
   - Login as Nancy (Catalyst user)
   - Navigate to /dashboard/documents
   - Click "Generate Base" on an FDA document
   - Wait for Opus generation (2-3 minutes)
   - Verify status = 'complete'
   - Click "View Base" to download PDF
   - Verify: Catalyst branding, logo, proper sections

**Expected Results**:
- ✓ FDA newsroom items detected
- ✓ Base memo generates with Opus
- ✓ PDF has Catalyst branding
- ✓ Markdown properly formatted
- ✓ All sections present (Exec Summary, Key Changes, etc.)

---

### Scenario 3: Client Customization (Haiku)

**Objective**: Verify client-specific memo generation

1. **Verify Clients Exist**
   ```sql
   SELECT * FROM clients WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'catalyst');
   ```

2. **Generate Client Memos**
   - Login as Nancy
   - Navigate to /dashboard/documents
   - Find a document with completed base memo
   - Click "Select Clients →"
   - Search for "Biotech"
   - Select 2-3 clients
   - Note estimated cost
   - Click "Generate X Memos"
   - Wait for Haiku customization

3. **Verify Client Outputs**
   - Check: `SELECT * FROM client_outputs WHERE status = 'complete' ORDER BY created_at DESC LIMIT 5;`
   - Verify selected_for_generation = true
   - Verify model_used contains 'haiku'

4. **Download and Compare**
   - Download base memo
   - Download client-specific memo for "Sample Biotech Client"
   - Compare:
     - Base should be generic
     - Client version should mention client name
     - Client version should reference CAR-T therapy (focus area)
     - Client version should have tailored recommendations

**Expected Results**:
- ✓ Client selector shows all clients
- ✓ Search/filter works
- ✓ Cost estimation accurate (~$0.02/client)
- ✓ Haiku customization completes
- ✓ Client-specific memos noticeably tailored
- ✓ Download links work

---

### Scenario 4: Cost Tracking

**Objective**: Verify token usage and cost tracking

1. **Check Token Usage**
   ```sql
   SELECT
     output_type,
     model_used,
     AVG(tokens_input) as avg_input,
     AVG(tokens_output) as avg_output,
     COUNT(*) as count
   FROM document_outputs
   WHERE status = 'complete'
   GROUP BY output_type, model_used;
   ```

2. **Verify Expected Ranges**
   - Base memo (Opus): ~40-60K input, ~1-2K output
   - Client memo (Haiku): ~3-5K input, ~1-2K output

3. **Calculate Costs**
   - Opus: ($5 * input_tokens + $25 * output_tokens) / 1,000,000
   - Haiku: ($1 * input_tokens + $5 * output_tokens) / 1,000,000

**Expected Results**:
- ✓ Token counts logged correctly
- ✓ Opus costs ~$0.20-0.30 per base memo
- ✓ Haiku costs ~$0.01-0.03 per client memo
- ✓ 88-97% savings vs single-model approach

---

### Scenario 5: Multi-Source Deduplication

**Objective**: Verify documents aren't duplicated

1. **Run Monitor Twice**
   ```bash
   # First run
   curl -X POST ... /api/cron/check-regulatory-sources ...

   # Second run (immediate)
   curl -X POST ... /api/cron/check-regulatory-sources ...
   ```

2. **Check for Duplicates**
   ```sql
   SELECT external_id, COUNT(*) as count
   FROM regulatory_documents
   GROUP BY source, external_id
   HAVING COUNT(*) > 1;
   ```

**Expected Results**:
- ✓ No duplicate external_ids
- ✓ Unique constraint working
- ✓ Second run skips existing documents

---

### Scenario 6: Organization Isolation

**Objective**: Verify organizations can't see each other's data

1. **Login as Jayson**
   - Visit /dashboard/documents
   - Should only see CMS documents
   - Should not see any FDA documents

2. **Login as Nancy**
   - Visit /dashboard/documents
   - Should only see FDA documents
   - Should not see any CMS documents

3. **Try Direct API Access**
   ```bash
   # As Jayson, try to access Catalyst client
   curl https://cms.advientadvisors.com/api/clients \
     -H "Cookie: next-auth.session-token=JAYSON_TOKEN"
   ```

**Expected Results**:
- ✓ Each org sees only their subscribed agencies
- ✓ Jayson cannot access Catalyst clients
- ✓ Nancy cannot access Jayson's outputs
- ✓ RLS policies enforced correctly

---

## Performance Tests

### Document Processing Time
- [ ] Base PPTX generation: < 3 minutes
- [ ] Base PDF memo (Opus): < 3 minutes
- [ ] Client memo (Haiku): < 1 minute per client
- [ ] Batch of 10 clients: < 10 minutes

### Cron Job Performance
- [ ] check-regulatory-sources: < 2 minutes
- [ ] Handles 100+ documents without timeout
- [ ] Memory usage acceptable

## Known Issues / Edge Cases

### 1. PDF Extraction Failures
- Some PDFs may have poor text extraction
- Test with various FR document types

### 2. RSS Feed Variations
- FDA feeds may have different structures
- Monitor for parsing errors

### 3. Concurrent Generation
- Multiple users generating simultaneously
- Database locking issues?

### 4. Large Documents
- Very long regulatory documents (>100 pages)
- May exceed token limits
- Consider chunking strategy

## Rollback Plan

If critical issues found:

1. **Disable Cron Jobs**
   ```bash
   # Comment out crons in vercel.json
   # Redeploy
   ```

2. **Revert to Previous Version**
   ```bash
   git revert HEAD
   git push
   ```

3. **Database Rollback**
   - Keep old tables (federal_register_documents) until stable
   - Can migrate back if needed

## Success Criteria

Platform is production-ready when:
- ✓ All test scenarios pass
- ✓ Both organizations functioning independently
- ✓ Cost tracking accurate
- ✓ No data leakage between orgs
- ✓ Performance within acceptable ranges
- ✓ Error handling graceful
- ✓ User acceptance from Jayson and Nancy

## Post-Launch Monitoring

### Week 1
- [ ] Check daily for cron job failures
- [ ] Monitor API costs via Anthropic dashboard
- [ ] Review error logs
- [ ] Gather user feedback

### Week 2-4
- [ ] Analyze token usage patterns
- [ ] Optimize prompt lengths if needed
- [ ] Add more clients as requested
- [ ] Consider additional agencies (HHS, etc.)

---

## Quick Test Commands

```bash
# Check database status
docker exec -i cms-converter-db-local psql -U cms_converter -d cms_converter -c "
  SELECT
    o.name as org,
    COUNT(DISTINCT rd.id) as docs,
    COUNT(DISTINCT do.id) as outputs
  FROM organizations o
  LEFT JOIN organization_agencies oa ON oa.organization_id = o.id
  LEFT JOIN regulatory_documents rd ON rd.agency_id = oa.agency_id
  LEFT JOIN document_outputs do ON do.organization_id = o.id
  GROUP BY o.name;
"

# Trigger cron manually
curl -X POST http://localhost:3000/api/cron/check-regulatory-sources \
  -H "Authorization: Bearer $CRON_SECRET"

# Check recent documents
docker exec -i cms-converter-db-local psql -U cms_converter -d cms_converter -c "
  SELECT source, agency_id, title, detected_at
  FROM regulatory_documents
  ORDER BY detected_at DESC
  LIMIT 10;
"
```
