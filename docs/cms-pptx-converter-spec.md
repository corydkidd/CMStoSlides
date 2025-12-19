# CMS Document to PowerPoint Converter

## Technical Specification for Claude Code Implementation

**Version**: 1.0  
**Date**: December 18, 2025  
**Author**: Cory Kidd / Advient Advisors  

---

## 1. Executive Summary

### Product Overview

A multi-tenant web application that transforms CMS (Center for Medicare and Medicaid Services) regulatory documents into client-ready PowerPoint presentations. Each user has a custom "description document" created during onboarding that defines their specific transformation requirements, enabling rapid turnaround (1-2 hours) of complex regulatory publications into polished presentation decks.

### Core Value Proposition

Healthcare consultants like Jason receive CMS Federal Register publications at 4 PM on Friday and need presentation decks for clients by end of day. This tool automates 80%+ of that work, using AI to interpret documents according to each user's bespoke presentation style.

### Key Users

- **End Users**: Healthcare consultants who transform regulatory documents into client presentations
- **Admin (Cory)**: Creates accounts, develops description documents, manages the platform

---

## 2. Functional Requirements

### 2.1 User Capabilities

**Upload & Process**
- Upload PDF documents (native digital PDFs with selectable text)
- System handles multi-column layouts common in Federal Register documents
- Asynchronous processing for large documents (hundreds of pages, tens of MB)
- Real-time status indication (processing/complete/failed)

**Download & Review**
- Download generated PPTX files
- Access repository of all previous conversions
- View metadata: original filename, generation date, file sizes

**Account**
- Login via SSO (reusing HTA authentication system)
- View/download personal conversion history
- No self-service account creation

### 2.2 Admin Capabilities

**User Management**
- Create new user accounts
- Enable/disable user accounts
- View all users and their activity

**Description Documents**
- Create description documents per user (stored in database)
- Edit/update description documents
- Version history (implicit via database timestamps)

**Templates**
- Upload user-specific PPTX templates to storage
- Associate templates with users
- Update templates as needed

**Monitoring**
- View processing queue and status
- Access to all conversions across users
- Error logs for failed conversions

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Frontend | Next.js 14+ (App Router) | Consistent with existing projects, excellent DX |
| Backend | Next.js API Routes + Server Actions | Unified codebase, easy deployment |
| Database | Supabase PostgreSQL | Existing ecosystem, RLS for multi-tenancy |
| Auth | Supabase Auth + SSO | Reuse from HTA project |
| File Storage | Supabase Storage | Integrated with RLS, sufficient for MVP scale |
| AI | Claude API (Anthropic) | Primary intelligence layer |
| Hosting | Vercel | Seamless Next.js deployment |
| Queue | Supabase Edge Functions OR Vercel Cron | Async job processing |

### 3.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  User Login  │  │   Upload     │  │  Conversion History  │  │
│  │    (SSO)     │  │  Dashboard   │  │     Repository       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Admin Panel                             │  │
│  │  • User Management  • Description Docs  • Templates       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER (Next.js)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ /api/upload │  │ /api/status │  │   /api/admin/*          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────────┐
│  SUPABASE        │  │  PROCESSING  │  │  CLAUDE API          │
│  ┌────────────┐  │  │    QUEUE     │  │                      │
│  │  Database  │  │  │              │  │  - PDF Interpretation│
│  │  - users   │  │  │  Jobs Table  │  │  - Content Mapping   │
│  │  - docs    │  │  │  + Worker    │  │  - PPTX Generation   │
│  │  - jobs    │  │  │              │  │    Instructions      │
│  └────────────┘  │  └──────────────┘  └──────────────────────┘
│  ┌────────────┐  │
│  │  Storage   │  │
│  │  - uploads │  │
│  │  - outputs │  │
│  │  - templates│ │
│  └────────────┘  │
└──────────────────┘
```

### 3.3 Processing Pipeline

```
1. UPLOAD
   User uploads PDF → Validate file → Store in Supabase Storage
   → Create job record (status: pending)

2. QUEUE PICKUP
   Worker polls for pending jobs → Claim job (status: processing)

3. PDF EXTRACTION
   Download PDF from storage → Extract full text using pdf-parse or similar
   → Handle multi-column layouts → Store extracted text

4. CLAUDE PROCESSING
   Retrieve user's description document from database
   Retrieve user's PPTX template info
   Send to Claude API:
     - Full PDF text
     - Description document (transformation rules)
     - Output format instructions
   → Receive structured slide content

5. PPTX GENERATION
   Load user's PPTX template
   Apply Claude's structured output to template
   Generate PPTX file using template-based workflow:
     - Duplicate template slides as needed
     - Replace placeholder content
     - Maintain user's branding/formatting
   → Save to Supabase Storage

6. COMPLETION
   Update job record (status: complete, output_path)
   → User sees completion on dashboard refresh
```

---

## 4. Database Schema

### 4.1 Tables

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
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
CREATE TABLE public.description_documents (
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
CREATE TABLE public.conversion_jobs (
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

-- Index for efficient queries
CREATE INDEX idx_jobs_user_status ON public.conversion_jobs(user_id, status);
CREATE INDEX idx_jobs_status ON public.conversion_jobs(status) WHERE status = 'pending';
```

### 4.2 Row Level Security

```sql
-- Users can only see their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Users can only see their own jobs
ALTER TABLE public.conversion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON public.conversion_jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own jobs"
  ON public.conversion_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can manage everything
CREATE POLICY "Admins can manage all jobs"
  ON public.conversion_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
```

---

## 5. File Storage Structure

```
supabase-storage/
├── uploads/
│   └── {user_id}/
│       └── {timestamp}_{original_filename}.pdf
├── outputs/
│   └── {user_id}/
│       └── {timestamp}_{generated_filename}.pptx
└── templates/
    └── {user_id}/
        └── template.pptx
```

### Storage Policies

- **uploads/**: User can upload to their own folder only
- **outputs/**: User can read from their own folder only
- **templates/**: Admin can write; users can read their own template

---

## 6. API Endpoints

### 6.1 User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload PDF for conversion |
| GET | `/api/jobs` | List user's conversion jobs |
| GET | `/api/jobs/[id]` | Get specific job status |
| GET | `/api/jobs/[id]/download` | Get signed URL for output download |

### 6.2 Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create new user |
| PATCH | `/api/admin/users/[id]` | Update user (enable/disable) |
| GET | `/api/admin/users/[id]/description` | Get user's description doc |
| PUT | `/api/admin/users/[id]/description` | Update description doc |
| POST | `/api/admin/users/[id]/template` | Upload user's PPTX template |
| GET | `/api/admin/jobs` | List all jobs (across users) |

### 6.3 Internal Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/internal/process` | Triggered by queue to process job |

---

## 7. Page Structure

### 7.1 User Pages

```
/                     → Redirect to /dashboard
/login                → SSO login page
/dashboard            → Main dashboard
  - Upload section (drag & drop PDF)
  - Current processing status
  - Recent conversions list
/history              → Full conversion history with search/filter
/history/[id]         → Individual conversion details + download
```

### 7.2 Admin Pages

```
/admin                → Admin dashboard
  - User count
  - Recent activity
  - Processing queue status
/admin/users          → User management
  - List all users
  - Create new user
  - View/edit user details
/admin/users/[id]     → Individual user
  - Edit description document
  - Upload/update template
  - View user's conversion history
/admin/jobs           → All jobs across users
  - Filter by status, user, date
  - View details/errors
```

---

## 8. Claude API Integration

### 8.1 Prompt Structure

```markdown
# System Prompt

You are a document transformation specialist. Your task is to convert 
regulatory document content into a structured PowerPoint presentation 
following the specific instructions provided.

## User-Specific Instructions
{description_document_content}

## Output Format
Return a JSON structure with the following format:
{
  "slides": [
    {
      "slide_type": "title" | "content" | "section" | "summary",
      "title": "Slide title text",
      "content": [
        {"type": "bullet", "text": "Bullet point text", "level": 0},
        {"type": "paragraph", "text": "Paragraph text"},
        {"type": "note", "text": "Speaker note text"}
      ]
    }
  ],
  "metadata": {
    "document_title": "Original document title",
    "document_date": "Publication date if found",
    "key_topics": ["topic1", "topic2"]
  }
}

# User Message

Please transform the following CMS document into a presentation:

---
{full_pdf_text}
---
```

### 8.2 Model Selection

- **Primary**: claude-sonnet-4-20250514 (balance of quality and speed)
- **Fallback**: Consider claude-3-haiku for very large documents if cost is a concern
- **Token limits**: May need to chunk very large documents (200+ pages)

### 8.3 Error Handling

- Retry on transient failures (rate limits, network)
- Store partial results if possible
- Log full error context for debugging
- User-friendly error messages in job status

---

## 9. PPTX Generation

### 9.1 Template-Based Approach

Since each user has a custom PPTX template, use the **template-based workflow** from the PPTX skill:

1. **Analyze template on first use**:
   - Extract template inventory (slide layouts, shapes, placeholders)
   - Store inventory in database for reference

2. **Generate presentation**:
   - Start with user's template
   - Duplicate slides based on slide_type mapping
   - Replace placeholder content using replace.py workflow
   - Preserve user's branding, colors, fonts

### 9.2 Slide Type Mapping

```javascript
const slideTypeMapping = {
  "title": 0,      // Title slide from template
  "section": 1,    // Section divider slide
  "content": 2,    // Standard content slide
  "summary": 3,    // Summary/conclusion slide
  // ... additional mappings based on template
};
```

### 9.3 Implementation Notes

- Use python-pptx or Node.js pptxgenjs based on template complexity
- For complex templates, use the OOXML approach (unpack/modify/repack)
- Store generated inventory to speed up subsequent generations
- Implement text overflow detection and handling

---

## 10. Async Processing

### 10.1 Queue Options

**Option A: Database Polling (Simpler)**
- Vercel Cron job runs every 30 seconds
- Queries for pending jobs
- Processes one job per invocation
- Suitable for low volume (< 100 jobs/day)

**Option B: Supabase Edge Functions + Webhooks (More Robust)**
- Database trigger on job insert
- Edge function picks up immediately
- Better for higher volume

### 10.2 Recommended: Database Polling for MVP

```typescript
// /api/cron/process-jobs (protected by Vercel cron secret)
export async function GET(request: Request) {
  // Verify cron secret
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Claim one pending job
  const { data: job } = await supabase
    .from('conversion_jobs')
    .update({ status: 'processing', processing_started_at: new Date() })
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .select()
    .single();
    
  if (!job) {
    return Response.json({ message: 'No pending jobs' });
  }
  
  try {
    // Process the job
    await processConversionJob(job);
    return Response.json({ success: true, job_id: job.id });
  } catch (error) {
    // Mark as failed
    await supabase
      .from('conversion_jobs')
      .update({ status: 'failed', error_message: error.message })
      .eq('id', job.id);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### 10.3 Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/process-jobs",
      "schedule": "*/1 * * * *"  // Every minute
    }
  ]
}
```

---

## 11. Security Considerations

### 11.1 Authentication & Authorization

- SSO via Supabase Auth (reuse HTA configuration)
- Session tokens stored in HTTP-only cookies
- Admin routes protected by is_admin check
- All API routes validate authenticated session

### 11.2 File Security

- Signed URLs for file downloads (expire after 1 hour)
- File uploads validated: PDF only, max size limit (50MB)
- RLS policies prevent cross-user file access

### 11.3 API Security

- Rate limiting on upload endpoint (10/minute per user)
- Input sanitization on all user-provided strings
- Claude API key stored in environment variables only
- Cron endpoint protected by secret

---

## 12. UI/UX Specifications

### 12.1 Dashboard (User)

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  CMS Converter                    [User Name ▼]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │         📄 Drop PDF here or click to upload         │   │
│  │                                                      │   │
│  │                    [Browse Files]                    │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Recent Conversions                            [View All →] │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📄 2025-22543.pdf                                  │   │
│  │  Processing... ████████░░░░  75%                    │   │
│  │  Started 2 minutes ago                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📄 2025-22101.pdf          ✓ Complete             │   │
│  │  Generated: IOTA_Model_Analysis.pptx                │   │
│  │  Dec 17, 2025 • 4:32 PM              [Download ↓]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📄 2025-21988.pdf          ✓ Complete             │   │
│  │  Generated: Medicare_Update_Summary.pptx            │   │
│  │  Dec 15, 2025 • 2:15 PM              [Download ↓]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Admin Panel

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  CMS Converter Admin              [Cory Kidd ▼]     │
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│  Dashboard    │  Users (5)                                  │
│  ─────────    │  ─────────────────────────────────────────  │
│  • Overview   │                                             │
│  • Users      │  [+ New User]                    [Search...] │
│  • Jobs       │                                             │
│               │  ┌─────────────────────────────────────────┐ │
│               │  │  Jason H.        jason@example.com     │ │
│               │  │  ✓ Active        12 conversions        │ │
│               │  │  Last active: Today                     │ │
│               │  │           [Edit] [Description] [Template]│ │
│               │  └─────────────────────────────────────────┘ │
│               │                                             │
│               │  ┌─────────────────────────────────────────┐ │
│               │  │  Sarah M.        sarah@example.com     │ │
│               │  │  ✓ Active        3 conversions         │ │
│               │  │  Last active: 2 days ago                │ │
│               │  │           [Edit] [Description] [Template]│ │
│               │  └─────────────────────────────────────────┘ │
│               │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

### 12.3 Design System

- **Framework**: Tailwind CSS + shadcn/ui components
- **Colors**: Neutral palette, professional appearance
- **Typography**: System fonts for performance
- **Responsive**: Desktop-first (primary use case), mobile functional

---

## 13. Development Phases

### Phase 1: Foundation (Week 1)

- [ ] Initialize Next.js project with Tailwind + shadcn/ui
- [ ] Set up Supabase project (database, auth, storage)
- [ ] Configure SSO authentication (reuse HTA config)
- [ ] Create database schema and RLS policies
- [ ] Implement basic user dashboard (no functionality)
- [ ] Implement basic admin panel structure

### Phase 2: Core Upload Flow (Week 2)

- [ ] PDF upload component with drag & drop
- [ ] File validation and storage integration
- [ ] Job creation in database
- [ ] Upload status tracking
- [ ] Basic file listing/history view

### Phase 3: Processing Pipeline (Week 3)

- [ ] PDF text extraction (handle multi-column)
- [ ] Claude API integration
- [ ] Prompt engineering with description documents
- [ ] Job queue implementation (cron-based)
- [ ] Status updates and error handling

### Phase 4: PPTX Generation (Week 4)

- [ ] Template analysis and inventory extraction
- [ ] Slide generation from Claude output
- [ ] Template-based content replacement
- [ ] Output storage and download links
- [ ] End-to-end testing with real documents

### Phase 5: Admin Features (Week 5)

- [ ] User creation flow
- [ ] Description document editor (text area)
- [ ] Template upload interface
- [ ] Jobs overview across users
- [ ] Activity monitoring

### Phase 6: Polish & Launch (Week 6)

- [ ] Error handling improvements
- [ ] Loading states and feedback
- [ ] Documentation for admin workflows
- [ ] Production deployment
- [ ] Onboard first user (Jason)

---

## 14. Testing Strategy

### 14.1 Test Cases

**Upload Flow**
- [ ] Valid PDF uploads successfully
- [ ] Invalid files rejected (non-PDF, oversized)
- [ ] Duplicate filename handling
- [ ] Concurrent uploads from same user

**Processing**
- [ ] Multi-column PDF extraction accurate
- [ ] Claude API handles large documents
- [ ] Failed jobs marked correctly
- [ ] Retry logic works on transient failures

**PPTX Generation**
- [ ] Template branding preserved
- [ ] Content fits in placeholders
- [ ] All slide types generate correctly
- [ ] Output file opens in PowerPoint

**Security**
- [ ] User cannot access other users' files
- [ ] Admin routes blocked for regular users
- [ ] Unauthenticated requests rejected
- [ ] Rate limiting prevents abuse

### 14.2 Test Documents

Use the provided example documents:
- `2025-22543.pdf` - Federal Register multi-column format
- `IOTA_Model_PY2_Proposed_Rule.pptx` - Expected output format

---

## 15. Monitoring & Observability

### 15.1 Key Metrics

- Job success rate (% complete vs failed)
- Average processing time
- Queue depth / wait time
- Claude API usage and costs
- Storage usage per user

### 15.2 Logging

- All API requests logged with user context
- Job state transitions logged
- Claude API calls logged (request/response summary)
- Errors logged with full stack trace

### 15.3 Alerts

- Job failure rate > 10% in 1 hour
- Queue depth > 50 jobs
- Processing time > 10 minutes
- Storage approaching limits

---

## 16. Future Considerations (Out of Scope for V1)

- **Iteration/refinement**: Chat interface to refine generated deck
- **Self-service description editing**: Let users tweak their own instructions
- **Team accounts**: Multiple users sharing description documents
- **Email notifications**: Alert when processing completes
- **Batch processing**: Upload multiple PDFs at once
- **Version history**: Keep all versions of generated outputs
- **Analytics**: Track which slide types are most used
- **API access**: Let users integrate programmatically

---

## 17. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# Vercel Cron
CRON_SECRET=

# Optional: Error tracking
SENTRY_DSN=
```

---

## 18. Deployment Checklist

- [ ] Supabase project created (production)
- [ ] Database schema migrated
- [ ] Storage buckets created with policies
- [ ] Environment variables configured in Vercel
- [ ] SSO authentication tested
- [ ] Cron job verified running
- [ ] First admin account created
- [ ] First user onboarded with description doc + template
- [ ] End-to-end conversion tested in production

---

## Appendix A: Example Description Document

```markdown
# Jason's CMS Document Transformation Rules

## Overview
Transform CMS Federal Register publications into executive summary presentations
for healthcare provider clients. Focus on actionable impacts, compliance deadlines,
and financial implications.

## Slide Structure

### Title Slide
- Use the official rule name as title
- Include Federal Register citation (Vol/No)
- Add publication date

### Executive Summary (1-2 slides)
- 3-5 key takeaways for healthcare executives
- Focus on "what this means for your organization"

### Timeline & Deadlines
- Extract all dates mentioned in the document
- Create a visual timeline if 3+ dates
- Highlight compliance deadlines in red

### Financial Impact
- Pull any dollar figures, percentages, or payment changes
- Present in clear bullet format
- Include comparison to current state when available

### Required Actions
- List specific compliance steps required
- Prioritize by deadline
- Group by department (Clinical, Finance, IT, etc.)

### Questions for Discussion
- Generate 3-5 strategic questions for client discussion
- Focus on organizational impact and decision points

## Formatting Preferences
- Maximum 6 bullets per slide
- Avoid jargon - translate CMS terminology
- Use direct quotes sparingly, only for critical regulatory language
- Include slide numbers
- Add "Source: CMS Federal Register [citation]" as footnote
```

---

## Appendix B: Sample Claude Output

```json
{
  "slides": [
    {
      "slide_type": "title",
      "title": "IOTA Model Performance Year 2 Proposed Rule",
      "content": [
        {"type": "paragraph", "text": "Federal Register Vol. 90, No. 236"},
        {"type": "paragraph", "text": "Published: December 10, 2025"},
        {"type": "note", "text": "This rule proposes changes to the Increasing Organ Transplant Access model for Performance Year 2."}
      ]
    },
    {
      "slide_type": "section",
      "title": "Executive Summary",
      "content": []
    },
    {
      "slide_type": "content",
      "title": "Key Takeaways",
      "content": [
        {"type": "bullet", "text": "Performance benchmarks adjusted for transplant volume", "level": 0},
        {"type": "bullet", "text": "New quality measures added for post-transplant outcomes", "level": 0},
        {"type": "bullet", "text": "Payment methodology updates effective January 2026", "level": 0},
        {"type": "bullet", "text": "Comment period closes February 8, 2026", "level": 0},
        {"type": "note", "text": "Emphasize the comment deadline - clients may want to submit feedback"}
      ]
    }
  ],
  "metadata": {
    "document_title": "Medicare Program; Increasing Organ Transplant Access (IOTA) Model Performance Year 2",
    "document_date": "December 10, 2025",
    "key_topics": ["organ transplant", "Medicare", "performance measures", "payment methodology"]
  }
}
```

---

*End of Specification*
