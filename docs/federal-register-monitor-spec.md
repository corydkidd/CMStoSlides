# Federal Register Auto-Monitor for CMS Documents

## Implementation Specification for Claude Code

**Version**: 1.0  
**Date**: December 29, 2025  
**Author**: Cory Kidd / Advient Advisors  
**Related**: CMS Document to PowerPoint Converter (existing app)

---

## 1. Overview

### Purpose

Extend the existing CMS Document to PowerPoint Converter with automated monitoring of the Federal Register API. When CMS publishes new documents, the system automatically downloads the PDF and queues it for conversion, eliminating Jayson's need to manually watch for new publications.

### User Story

> As Jayson, I want new CMS Federal Register documents to be automatically detected and converted to presentation decks, so that I have client-ready materials within minutes of publication without manual monitoring.

### Scope

- Poll Federal Register API every 15 minutes for new CMS documents
- Track documents we've seen to avoid duplicates
- Auto-download PDFs and queue for conversion using existing pipeline
- Initialize with the 5 most recent CMS documents on first run
- Provide dashboard visibility into monitored documents

---

## 2. Technical Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     FEDERAL REGISTER MONITOR                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Vercel Cron Job                            │ │
│  │               (Every 15 minutes)                            │ │
│  │                                                             │ │
│  │    /api/cron/check-federal-register                         │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │                                    │
│                             ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Federal Register API                           │ │
│  │                                                             │ │
│  │  GET /api/v1/documents.json                                 │ │
│  │    ?conditions[agencies][]=centers-for-medicare-...         │ │
│  │    &order=newest                                            │ │
│  │    &per_page=20                                             │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │                                    │
│                             ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            Document Tracker (Supabase)                      │ │
│  │                                                             │ │
│  │  For each document returned:                                │ │
│  │    1. Check if document_number exists in our table          │ │
│  │    2. If NEW: Insert record, download PDF, queue job        │ │
│  │    3. If EXISTS: Skip (already processed)                   │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │                                    │
│                             ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         Existing Conversion Pipeline                        │ │
│  │                                                             │ │
│  │  1. PDF stored in Supabase Storage                          │ │
│  │  2. conversion_jobs record created                          │ │
│  │  3. Processed by existing worker                            │ │
│  │  4. PPTX generated and stored                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Points

This feature integrates with the existing CMS Converter app:

| Existing Component | How We Use It |
|-------------------|---------------|
| `profiles` table | Link monitored docs to user (Jayson) |
| `conversion_jobs` table | Create job for each new FR document |
| Supabase Storage | Store downloaded PDFs in user's uploads folder |
| Processing worker | Existing cron processes queued jobs |
| User dashboard | Show FR-sourced conversions in history |

---

## 3. Database Schema

### New Table: `federal_register_documents`

```sql
-- Track Federal Register documents we've detected
CREATE TABLE public.federal_register_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Federal Register identifiers
  document_number TEXT UNIQUE NOT NULL,  -- e.g., "2025-22543"
  citation TEXT,                          -- e.g., "90 FR 57598"
  
  -- Document metadata
  title TEXT NOT NULL,
  document_type TEXT,                     -- RULE, PRORULE, NOTICE
  abstract TEXT,
  publication_date DATE NOT NULL,
  
  -- URLs
  pdf_url TEXT NOT NULL,                  -- govinfo.gov PDF URL
  html_url TEXT,                          -- federalregister.gov page
  
  -- Classification
  is_significant BOOLEAN DEFAULT FALSE,   -- E.O. 12866 significant
  agencies JSONB,                          -- Array of agency data
  
  -- Processing
  auto_process BOOLEAN DEFAULT TRUE,
  target_user_id UUID REFERENCES public.profiles(id),  -- Who to create deck for
  conversion_job_id UUID REFERENCES public.conversion_jobs(id),
  
  -- Tracking
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  pdf_downloaded_at TIMESTAMPTZ,
  processing_status TEXT DEFAULT 'pending',  -- pending, downloading, queued, processing, complete, failed, skipped
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fr_docs_document_number ON public.federal_register_documents(document_number);
CREATE INDEX idx_fr_docs_publication_date ON public.federal_register_documents(publication_date DESC);
CREATE INDEX idx_fr_docs_status ON public.federal_register_documents(processing_status);
CREATE INDEX idx_fr_docs_target_user ON public.federal_register_documents(target_user_id);

-- RLS Policies
ALTER TABLE public.federal_register_documents ENABLE ROW LEVEL SECURITY;

-- Admins can see all
CREATE POLICY "Admins can manage FR documents"
  ON public.federal_register_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Users can see their own targeted documents
CREATE POLICY "Users can view their FR documents"
  ON public.federal_register_documents FOR SELECT
  USING (target_user_id = auth.uid());
```

### New Table: `federal_register_settings`

```sql
-- Global settings for FR monitoring
CREATE TABLE public.federal_register_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Monitoring configuration
  is_enabled BOOLEAN DEFAULT TRUE,
  poll_interval_minutes INTEGER DEFAULT 15,
  
  -- What to monitor
  agency_slugs TEXT[] DEFAULT ARRAY['centers-for-medicare-medicaid-services'],
  document_types TEXT[] DEFAULT ARRAY['RULE', 'PRORULE', 'NOTICE'],
  only_significant BOOLEAN DEFAULT FALSE,
  
  -- Processing
  default_target_user_id UUID REFERENCES public.profiles(id),  -- Jayson's user ID
  auto_process_new BOOLEAN DEFAULT TRUE,
  
  -- State
  last_poll_at TIMESTAMPTZ,
  last_poll_status TEXT,
  last_poll_documents_found INTEGER,
  
  -- Initialization
  initialized BOOLEAN DEFAULT FALSE,  -- Have we done initial backfill?
  initial_document_count INTEGER DEFAULT 5,  -- How many to fetch on first run
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings (run once during migration)
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
);
```

---

## 4. API Endpoints

### 4.1 Cron Endpoint: Check Federal Register

**Endpoint**: `POST /api/cron/check-federal-register`

**Authentication**: Vercel Cron Secret

**Logic**:

```typescript
// /app/api/cron/check-federal-register/route.ts

import { createClient } from '@supabase/supabase-js';

const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1';

export async function POST(request: Request) {
  // 1. Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 2. Get settings
    const { data: settings } = await supabase
      .from('federal_register_settings')
      .select('*')
      .single();

    if (!settings?.is_enabled) {
      return Response.json({ message: 'Monitoring disabled' });
    }

    // 3. Determine how many documents to fetch
    const perPage = settings.initialized ? 20 : settings.initial_document_count;

    // 4. Build Federal Register API URL
    const params = new URLSearchParams();
    for (const agency of settings.agency_slugs) {
      params.append('conditions[agencies][]', agency);
    }
    for (const docType of settings.document_types) {
      params.append('conditions[type][]', docType);
    }
    if (settings.only_significant) {
      params.append('conditions[significant]', '1');
    }
    params.append('order', 'newest');
    params.append('per_page', perPage.toString());
    
    // Fields we need
    const fields = [
      'document_number', 'title', 'type', 'abstract',
      'publication_date', 'pdf_url', 'html_url', 'citation',
      'significant', 'agencies'
    ];
    for (const field of fields) {
      params.append('fields[]', field);
    }

    // 5. Fetch from Federal Register
    const response = await fetch(
      `${FEDERAL_REGISTER_API}/documents.json?${params.toString()}`
    );
    
    if (!response.ok) {
      throw new Error(`Federal Register API error: ${response.status}`);
    }

    const data = await response.json();
    const documents = data.results || [];

    // 6. Process each document
    let newCount = 0;
    let skippedCount = 0;

    for (const doc of documents) {
      // Check if we already have this document
      const { data: existing } = await supabase
        .from('federal_register_documents')
        .select('id')
        .eq('document_number', doc.document_number)
        .single();

      if (existing) {
        skippedCount++;
        continue;
      }

      // Insert new document
      const { data: newDoc, error: insertError } = await supabase
        .from('federal_register_documents')
        .insert({
          document_number: doc.document_number,
          citation: doc.citation,
          title: doc.title,
          document_type: doc.type,
          abstract: doc.abstract,
          publication_date: doc.publication_date,
          pdf_url: doc.pdf_url,
          html_url: doc.html_url,
          is_significant: doc.significant || false,
          agencies: doc.agencies,
          target_user_id: settings.default_target_user_id,
          auto_process: settings.auto_process_new,
          processing_status: settings.auto_process_new ? 'pending' : 'skipped'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting FR doc:', insertError);
        continue;
      }

      newCount++;

      // If auto-processing, queue for download and conversion
      if (settings.auto_process_new && newDoc) {
        await queueDocumentForProcessing(supabase, newDoc, settings);
      }
    }

    // 7. Update settings
    await supabase
      .from('federal_register_settings')
      .update({
        last_poll_at: new Date().toISOString(),
        last_poll_status: 'success',
        last_poll_documents_found: documents.length,
        initialized: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', settings.id);

    return Response.json({
      success: true,
      documents_checked: documents.length,
      new_documents: newCount,
      skipped_existing: skippedCount
    });

  } catch (error) {
    console.error('Federal Register check failed:', error);
    
    // Update settings with error
    await supabase
      .from('federal_register_settings')
      .update({
        last_poll_at: new Date().toISOString(),
        last_poll_status: `error: ${error.message}`,
        updated_at: new Date().toISOString()
      })
      .single();

    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function queueDocumentForProcessing(
  supabase: any,
  frDoc: any,
  settings: any
) {
  try {
    // Update status to downloading
    await supabase
      .from('federal_register_documents')
      .update({ processing_status: 'downloading' })
      .eq('id', frDoc.id);

    // Download PDF from Federal Register
    const pdfResponse = await fetch(frDoc.pdf_url);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
    }
    
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    // Generate filename
    const filename = `${frDoc.document_number}.pdf`;
    const storagePath = `${frDoc.target_user_id}/uploads/${Date.now()}_${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(storagePath, pdfBlob, {
        contentType: 'application/pdf'
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Update FR doc with download timestamp
    await supabase
      .from('federal_register_documents')
      .update({
        pdf_downloaded_at: new Date().toISOString(),
        processing_status: 'queued'
      })
      .eq('id', frDoc.id);

    // Create conversion job (uses existing pipeline)
    const { data: job, error: jobError } = await supabase
      .from('conversion_jobs')
      .insert({
        user_id: frDoc.target_user_id,
        status: 'pending',
        input_filename: filename,
        input_path: storagePath,
        input_size_bytes: pdfBuffer.byteLength,
        // Add metadata to link back to FR document
        metadata: {
          source: 'federal_register',
          federal_register_id: frDoc.id,
          document_number: frDoc.document_number,
          citation: frDoc.citation
        }
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Job creation failed: ${jobError.message}`);
    }

    // Link job to FR document
    await supabase
      .from('federal_register_documents')
      .update({
        conversion_job_id: job.id,
        processing_status: 'processing'
      })
      .eq('id', frDoc.id);

  } catch (error) {
    console.error('Error processing FR document:', error);
    
    await supabase
      .from('federal_register_documents')
      .update({
        processing_status: 'failed',
        error_message: error.message
      })
      .eq('id', frDoc.id);
  }
}
```

### 4.2 Admin Endpoints

**Get FR Monitor Status**
```
GET /api/admin/federal-register/status
```

Returns current settings and recent activity.

**Update FR Monitor Settings**
```
PATCH /api/admin/federal-register/settings
```

Update monitoring configuration.

**Trigger Manual Check**
```
POST /api/admin/federal-register/check-now
```

Manually trigger a Federal Register check (for testing).

**Reprocess Document**
```
POST /api/admin/federal-register/documents/[id]/reprocess
```

Re-queue a failed or skipped document.

---

## 5. Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/check-federal-register",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/process-jobs",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

**Note**: The `*/15 * * * *` schedule requires Vercel Pro plan. For Hobby plan, use `0 * * * *` (hourly) instead.

---

## 6. Database Migration

### Migration File: `20251229_federal_register_monitor.sql`

```sql
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
```

---

## 7. UI Components

### 7.1 Admin Dashboard Addition

Add a "Federal Register Monitor" section to the admin dashboard:

```
┌─────────────────────────────────────────────────────────────────┐
│  Federal Register Monitor                              [Settings]│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Status: ● Active                    Last Check: 2 minutes ago   │
│  Documents Found: 268 (2025)         New Today: 0                │
│                                                                  │
│  ──────────────────────────────────────────────────────────────  │
│                                                                  │
│  Recent Documents                                   [Check Now]  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📄 2025-22543                              Dec 10, 2025    │ │
│  │ IOTA Model Performance Year 2 Proposed Rule                │ │
│  │ Status: ✓ Complete                         [View Deck]     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📄 2025-21767                              Dec 02, 2025    │ │
│  │ CY 2026 Home Health PPS Rate Update                        │ │
│  │ Status: ✓ Complete                         [View Deck]     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📄 2025-20907                              Nov 25, 2025    │ │
│  │ Hospital Outpatient PPS and ASC Payment Systems            │ │
│  │ Status: ⏳ Processing...                   [View Progress] │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 User Dashboard Enhancement

For Jayson's dashboard, show FR-sourced documents with special badge:

```
┌─────────────────────────────────────────────────────────────────┐
│  Recent Conversions                                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📄 2025-22543.pdf                    [FR Auto] ✓ Complete  │ │
│  │ IOTA Model Performance Year 2 Proposed Rule                │ │
│  │ Federal Register: 90 FR 57598 • Dec 10, 2025               │ │
│  │                                              [Download ↓]  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📄 custom-upload.pdf                         ✓ Complete    │ │
│  │ Manual Upload                                               │ │
│  │ Dec 09, 2025                                [Download ↓]   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Configuration

### Environment Variables

Add to `.env.local` and Vercel:

```bash
# Existing
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
CRON_SECRET=

# No new env vars required - Federal Register API needs no key
```

### Post-Deployment Setup

After deploying, run these steps:

1. **Run database migration** (creates tables)

2. **Create Jayson's user account** if not already exists

3. **Update settings with Jayson's user ID**:
```sql
UPDATE federal_register_settings 
SET default_target_user_id = 'JAYSON_UUID_HERE'
WHERE id = (SELECT id FROM federal_register_settings LIMIT 1);
```

4. **Trigger initial check** to fetch first 5 documents:
```bash
curl -X POST https://your-app.vercel.app/api/cron/check-federal-register \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 9. Testing Checklist

### Unit Tests

- [ ] Federal Register API response parsing
- [ ] Duplicate document detection
- [ ] PDF download and storage
- [ ] Conversion job creation with metadata
- [ ] Settings CRUD operations

### Integration Tests

- [ ] Full flow: API → Storage → Job Queue → Conversion
- [ ] Cron endpoint authentication
- [ ] RLS policies (user can only see their documents)
- [ ] Admin can see all documents

### Manual Testing

- [ ] First run fetches 5 most recent CMS documents
- [ ] Subsequent runs only fetch new documents
- [ ] Downloaded PDFs are valid and complete
- [ ] Generated decks match existing converter quality
- [ ] Dashboard shows FR-sourced documents correctly
- [ ] "Check Now" button works in admin panel

---

## 10. Monitoring & Alerts

### Logging

Log these events for debugging:

```typescript
console.log('[FR Monitor] Poll started');
console.log('[FR Monitor] Found X documents, Y new');
console.log('[FR Monitor] Downloaded PDF for doc: XXXX-XXXXX');
console.log('[FR Monitor] Created job: UUID');
console.error('[FR Monitor] Error: message');
```

### Health Checks

The settings table tracks:
- `last_poll_at` - When we last checked
- `last_poll_status` - Success or error message
- `last_poll_documents_found` - How many docs API returned

Add alert if:
- No successful poll in 2 hours
- Error rate > 3 consecutive failures
- Document download failures

---

## 11. Future Enhancements (Out of Scope)

These are noted for future consideration but not part of this implementation:

- **Public Inspection monitoring** - Get documents 1-2 days before publication
- **Email notifications** - Alert Jayson when new deck is ready
- **Document type filtering** - Let Jayson choose which types to monitor
- **Multiple users** - Different users monitoring different agencies
- **Significance filtering** - Only process "significant" rules
- **Webhook support** - Notify external systems when decks ready

---

## 12. Files to Create/Modify

### New Files

```
/app/api/cron/check-federal-register/route.ts
/app/api/admin/federal-register/status/route.ts
/app/api/admin/federal-register/settings/route.ts
/app/api/admin/federal-register/check-now/route.ts
/app/api/admin/federal-register/documents/[id]/reprocess/route.ts
/components/admin/FederalRegisterMonitor.tsx
/components/admin/FRDocumentList.tsx
/lib/federal-register.ts  (API client utilities)
/supabase/migrations/20251229_federal_register_monitor.sql
```

### Modified Files

```
/vercel.json  (add cron job)
/app/admin/page.tsx  (add FR monitor section)
/components/dashboard/ConversionHistory.tsx  (add FR badge)
/types/database.ts  (add new table types)
```

---

## 13. Implementation Order

1. **Database first**: Run migration to create tables
2. **API client**: Create `/lib/federal-register.ts` with fetch utilities
3. **Cron endpoint**: Implement `/api/cron/check-federal-register`
4. **Test manually**: Trigger cron to verify it works
5. **Admin UI**: Add monitor section to admin dashboard
6. **User UI**: Add FR badge to conversion history
7. **Deploy**: Push to Vercel with cron configuration
8. **Configure**: Set Jayson's user ID in settings
9. **Verify**: Confirm automatic processing works end-to-end

---

## Appendix A: Federal Register API Reference

### Base URL
```
https://www.federalregister.gov/api/v1
```

### Documents Endpoint
```
GET /documents.json
```

### Key Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `conditions[agencies][]` | string | Agency slug (repeatable) |
| `conditions[type][]` | string | RULE, PRORULE, NOTICE, PRESDOCU |
| `conditions[significant]` | 0/1 | E.O. 12866 significant only |
| `conditions[publication_date][gte]` | date | Published on/after |
| `conditions[publication_date][lte]` | date | Published on/before |
| `order` | string | `newest` or `oldest` |
| `per_page` | int | Results per page (max 1000) |
| `page` | int | Page number |
| `fields[]` | string | Fields to return (repeatable) |

### Agency Slug for CMS
```
centers-for-medicare-medicaid-services
```

### Example Response

```json
{
  "count": 5915,
  "results": [
    {
      "document_number": "2025-22543",
      "citation": "90 FR 57598",
      "title": "Medicare Program; Increasing Organ Transplant Access...",
      "type": "PRORULE",
      "abstract": "This proposed rule would update and revise...",
      "publication_date": "2025-12-10",
      "pdf_url": "https://www.govinfo.gov/content/pkg/FR-2025-12-10/pdf/2025-22543.pdf",
      "html_url": "https://www.federalregister.gov/documents/2025/12/10/2025-22543/...",
      "significant": true,
      "agencies": [
        {
          "name": "Centers for Medicare & Medicaid Services",
          "slug": "centers-for-medicare-medicaid-services",
          "parent_id": 190
        }
      ]
    }
  ]
}
```

---

*End of Specification*
