# CMS Proposed Rule → PowerPoint Conversion Pipeline

## Overview

Build the core conversion pipeline that takes CMS proposed rules (PDFs from Federal Register) and converts them into PowerPoint presentations in Jayson's style. The Federal Register monitor and job queue already exist — this implements the actual processing.

## What Already Exists

- **Federal Register monitor** (`/api/cron/check-federal-register`) — polls API, downloads PDFs, creates `conversion_jobs` with status `pending`
- **Supabase tables**: `conversion_jobs`, `description_documents`, `profiles`, `federal_register_documents`, `federal_register_settings`
- **Supabase Storage**: buckets for `uploads` and `outputs`
- **Dashboard** (`/dashboard`) — shows jobs with status, has upload UI
- **Admin panel** (`/admin`) — user management, FR monitor settings
- **Auth** — Supabase Auth with SSO

## What Needs to Be Built

### 1. Job Processing Endpoint

Create `/api/process/route.ts` (or `/api/cron/process-jobs/route.ts`) that:
1. Claims a `pending` job (update status to `processing`)
2. Downloads the PDF from Supabase Storage
3. Extracts text from the PDF
4. Sends text + description document to Claude API
5. Generates PPTX from Claude's structured response
6. Uploads PPTX to Supabase Storage (`outputs/` bucket)
7. Updates job status to `complete` with output path

### 2. PDF Text Extraction

- Use `pdf-parse` (already in package.json if not, add it)
- Federal Register PDFs are native digital (selectable text)
- Handle multi-column layouts (common in Federal Register)
- Store extracted text in `conversion_jobs.extracted_text`

### 3. Claude API Processing

Use the Anthropic API (key in `ANTHROPIC_API_KEY` env var).

**System prompt structure:**
```
You are a regulatory document analyst. Transform this CMS Federal Register proposed rule into a structured PowerPoint presentation.

## Transformation Instructions
{description_document_content}

## Output Format
Return valid JSON with this structure:
{
  "slides": [
    {
      "slide_type": "title" | "content" | "section" | "two_column" | "summary",
      "title": "Slide title",
      "subtitle": "Optional subtitle",
      "content": [
        {"type": "bullet", "text": "...", "level": 0},
        {"type": "bullet", "text": "...", "level": 1},
        {"type": "note", "text": "Speaker note"}
      ]
    }
  ],
  "metadata": {
    "document_title": "...",
    "citation": "...",
    "publication_date": "...",
    "comment_deadline": "...",
    "key_topics": ["..."]
  }
}
```

**Model**: claude-sonnet-4-20250514
**Max tokens**: 16000 (these are long documents producing many slides)
**Handle**: Large documents may need to be chunked or summarized first

### 4. PPTX Generation

Use `pptxgenjs` (Node.js library) to generate presentations.

**Slide types to implement:**
- **title**: Title slide with document name, citation, date
- **section**: Section divider with section name
- **content**: Standard bullet point slide (support nested bullets via `level`)
- **two_column**: Side-by-side comparison (for before/after rule changes)
- **summary**: Key takeaways / action items

**Styling (Jayson's style — professional healthcare consulting):**
- Clean, corporate look
- Navy blue headers (#1B3A5C)
- White background
- Body text in dark gray (#333333)
- Accent color: teal (#0D7C8C)
- Font: Calibri or Arial
- Title slides: larger font, centered
- Content slides: left-aligned bullets with clear hierarchy
- Slide numbers in footer
- "Source: CMS Federal Register [citation]" footer on content slides
- Max 6 bullets per slide

### 5. Description Document

If no description document exists for the user yet, use the default one from the spec (Appendix A in cms-pptx-converter-spec.md). The description document content is in the `description_documents` table linked to the user.

Fetch it like:
```sql
SELECT content FROM description_documents 
WHERE user_id = :userId AND is_current = true
ORDER BY version DESC LIMIT 1
```

If none found, use the default embedded in the code.

### 6. Processing Trigger

Add a cron-compatible endpoint that can be called to process pending jobs. The flow:
1. Query for oldest `pending` job
2. Process it (extract → Claude → PPTX)
3. Return result

Also wire this up so the `/dashboard` upload flow triggers processing (either immediately via server action or by setting status to `pending` and letting cron pick it up).

### 7. Download Endpoint

Create `/api/jobs/[id]/download/route.ts` that:
1. Verifies user owns the job (or is admin)
2. Generates a signed URL from Supabase Storage for the output PPTX
3. Returns the signed URL or redirects to it

### 8. Dashboard Updates

Update the dashboard (`/dashboard/DashboardClient.tsx`) to:
- Show real processing status (poll for updates while `processing`)
- Add download button when job is `complete`
- Show error message when job is `failed`
- Show document metadata (title, citation) from Federal Register data

## Environment Variables Needed

```
ANTHROPIC_API_KEY=          # Claude API key
CRON_SECRET=                # For securing cron endpoints
NEXT_PUBLIC_SUPABASE_URL=   # Already exists
SUPABASE_SERVICE_ROLE_KEY=  # Already exists
```

## Dependencies to Add

```bash
npm install pdf-parse pptxgenjs @anthropic-ai/sdk
```

## Implementation Order

1. Install dependencies
2. Build PDF extraction utility (`lib/pdf-extract.ts`)
3. Build Claude processing utility (`lib/claude-processor.ts`)
4. Build PPTX generation utility (`lib/pptx-generator.ts`)
5. Build job processor that chains them together (`lib/job-processor.ts`)
6. Create processing API endpoint
7. Create download API endpoint
8. Update dashboard with download + status polling
9. Test end-to-end with a real Federal Register document
10. Commit after each step

## Testing

Test with these real Federal Register documents:
- `2025-21456` — Medicare Advantage CY2027 proposed rule (136 pages)
- `2025-22543` — IOTA Model proposed rule (36 pages)

The PDFs are available at:
- https://www.govinfo.gov/content/pkg/FR-2025-11-28/pdf/2025-21456.pdf
- https://www.govinfo.gov/content/pkg/FR-2025-12-11/pdf/2025-22543.pdf

## IMPORTANT
- Do NOT run docker compose build/up
- Just write the code
- After each major step, commit with a descriptive message
- When completely finished, run: `clawdbot gateway wake --text "Done: CMS conversion pipeline complete" --mode now`
