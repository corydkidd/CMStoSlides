# Regulatory Intelligence Platform

## Multi-Tenant Architecture Specification

**Version**: 2.0  
**Date**: February 12, 2026  
**Author**: Cory Kidd / Advient Advisors  
**Evolution from**: Federal Register Monitor Spec v1.0

---

## 1. Executive Summary

This specification evolves the existing CMS Document to PowerPoint Converter into a multi-tenant **Regulatory Intelligence Platform** that monitors federal agencies and generates customized outputs for different client organizations.

### Key Changes from v1.0

| Aspect | v1.0 (Current) | v2.0 (New) |
|--------|---------------|------------|
| Users | Single user (Jayson) | Multiple organizations with teams |
| Agencies | CMS only (Federal Register) | Configurable: CMS, FDA, expandable |
| Sources | Federal Register API only | Federal Register + Agency Newsrooms |
| Output | PowerPoint only | PowerPoint OR Branded Memos |
| Customization | None | Client-specific lens for memos |
| Model | Single model | Two-tier: Opus (base) + Haiku (customization) |

### Initial Deployment

**Organization 1 - Jayson's Team:**
- Monitors: CMS (Federal Register + CMS Newsroom)
- Output: PowerPoint decks
- No client customization

**Organization 2 - Catalyst Healthcare Consulting (Nancy Myers):**
- Monitors: FDA (Federal Register + FDA Newsroom)
- Output: Branded PDF memos
- Client-specific customization (dozens of clients)

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    REGULATORY INTELLIGENCE PLATFORM                      │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      MONITORING LAYER                                ││
│  │                                                                      ││
│  │  ┌──────────────────┐    ┌──────────────────┐                       ││
│  │  │ Federal Register │    │  Agency Newsroom │                       ││
│  │  │       API        │    │   RSS Feeds      │                       ││
│  │  │                  │    │                  │                       ││
│  │  │  • CMS docs      │    │  • CMS Newsroom  │                       ││
│  │  │  • FDA docs      │    │  • FDA Press     │                       ││
│  │  │  • (expandable)  │    │  • FDA Drugs     │                       ││
│  │  └────────┬─────────┘    └────────┬─────────┘                       ││
│  │           │                       │                                  ││
│  │           └───────────┬───────────┘                                  ││
│  │                       ▼                                              ││
│  │              Document Detection                                      ││
│  │              & Deduplication                                         ││
│  └─────────────────────────┬───────────────────────────────────────────┘│
│                            │                                             │
│  ┌─────────────────────────▼───────────────────────────────────────────┐│
│  │                      PROCESSING LAYER                                ││
│  │                                                                      ││
│  │  ┌────────────────────────────────────────────────────────────────┐ ││
│  │  │                   Organization Router                          │ ││
│  │  │                                                                │ ││
│  │  │   CMS doc detected → Route to orgs monitoring CMS              │ ││
│  │  │   FDA doc detected → Route to orgs monitoring FDA              │ ││
│  │  └──────────────────────────┬─────────────────────────────────────┘ ││
│  │                             │                                        ││
│  │         ┌───────────────────┴───────────────────┐                   ││
│  │         ▼                                       ▼                   ││
│  │  ┌─────────────────────┐            ┌─────────────────────┐        ││
│  │  │  Jayson's Org       │            │  Catalyst (Nancy)   │        ││
│  │  │                     │            │                     │        ││
│  │  │  Output: PPTX       │            │  Output: PDF Memo   │        ││
│  │  │  Clients: None      │            │  Clients: 30+       │        ││
│  │  │  Model: Sonnet 4.5  │            │  Base: Opus 4.5     │        ││
│  │  │                     │            │  Custom: Haiku 4.5  │        ││
│  │  └─────────────────────┘            └─────────────────────┘        ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                        DATA LAYER                                    ││
│  │                                                                      ││
│  │  Organizations → Users → Clients (optional)                         ││
│  │  Agency Configs → Monitored Documents → Outputs                     ││
│  │  Templates → Branding Assets                                        ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Multi-Tenant Data Model

```
Organizations
├── id, name, slug
├── output_type: 'pptx' | 'memo_pdf'
├── branding (logo_url, primary_color, etc.)
├── model_config (base_model, customization_model)
│
├── Agency Subscriptions (many-to-many)
│   └── CMS, FDA, etc.
│
├── Users (one-to-many)
│   ├── Nancy (admin)
│   └── Team members
│
└── Clients (one-to-many, optional)
    ├── Client A (context paragraph)
    ├── Client B (context paragraph)
    └── ...

Agencies
├── id: 'cms', 'fda', etc.
├── name: 'Centers for Medicare & Medicaid Services'
├── federal_register_slug: 'centers-for-medicare-medicaid-services'
├── newsroom_feeds: [array of RSS URLs]
└── document_types: ['RULE', 'PRORULE', 'NOTICE']

Regulatory Documents (unified tracking)
├── id, source ('federal_register' | 'newsroom')
├── agency_id
├── document_number (FR) or guid (RSS)
├── title, abstract, publication_date
├── pdf_url or html_url
├── detected_at
│
└── Organization Outputs (one-to-many)
    ├── org_id, document_id
    ├── base_output_path (the Opus-generated base)
    │
    └── Client Outputs (one-to-many, for memo orgs)
        ├── client_id
        ├── output_path
        └── status
```

---

## 3. Agency Configuration

### 3.1 Supported Agencies (Initial)

#### CMS (Centers for Medicare & Medicaid Services)

**Federal Register:**
- Slug: `centers-for-medicare-medicaid-services`
- Document types: RULE, PRORULE, NOTICE

**Newsroom RSS Feeds:**
- Primary: Scrape from https://www.cms.gov/newsroom (no official RSS found)
- Alternative: Monitor HHS press room filtered for CMS

#### FDA (Food and Drug Administration)

**Federal Register:**
- Slug: `food-and-drug-administration`
- Document types: RULE, PRORULE, NOTICE

**Newsroom RSS Feeds:**
```
Press Releases:
https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml

What's New - Drugs:
https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml

What's New - Biologics:
https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/biologics/rss.xml

MedWatch Safety Alerts:
https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml
```

### 3.2 Agency Configuration Table

```sql
CREATE TABLE agencies (
  id TEXT PRIMARY KEY,  -- 'cms', 'fda', etc.
  name TEXT NOT NULL,
  federal_register_slug TEXT NOT NULL,
  newsroom_feeds JSONB DEFAULT '[]',  -- Array of {url, name, enabled}
  document_types TEXT[] DEFAULT ARRAY['RULE', 'PRORULE', 'NOTICE'],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial data
INSERT INTO agencies (id, name, federal_register_slug, newsroom_feeds) VALUES
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
);
```

---

## 4. Database Schema

### 4.1 Organizations

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- 'catalyst', 'jayson-team'
  
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

-- Junction table for agency subscriptions
CREATE TABLE organization_agencies (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agency_id TEXT REFERENCES agencies(id) ON DELETE CASCADE,
  
  -- Per-org agency settings
  federal_register_enabled BOOLEAN DEFAULT TRUE,
  newsroom_enabled BOOLEAN DEFAULT TRUE,
  document_types TEXT[],  -- Override agency defaults, or NULL to use agency defaults
  
  PRIMARY KEY (organization_id, agency_id)
);
```

### 4.2 Users (Enhanced)

```sql
-- Modify existing profiles table or create new
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';  -- 'admin' | 'member'

-- Index for org lookups
CREATE INDEX idx_profiles_org ON profiles(organization_id);
```

### 4.3 Clients (New)

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  
  -- Context for AI customization (the "lens")
  context TEXT NOT NULL,  -- Paragraph describing the client
  -- Example: "Acme Therapeutics is a mid-size biotech focused on CAR-T cell therapies 
  -- for solid tumors. They have two products in Phase 2 trials and are particularly 
  -- concerned about FDA guidance on manufacturing standards and accelerated approval 
  -- pathways. Key decision makers are the VP of Regulatory Affairs and CMO."
  
  -- Optional additional context
  industry TEXT,
  focus_areas TEXT[],  -- e.g., ['cell therapy', 'oncology', 'manufacturing']
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_org ON clients(organization_id);
```

### 4.4 Regulatory Documents (Unified)

```sql
CREATE TABLE regulatory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source TEXT NOT NULL,  -- 'federal_register' | 'newsroom_rss'
  agency_id TEXT NOT NULL REFERENCES agencies(id),
  
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

CREATE INDEX idx_reg_docs_agency ON regulatory_documents(agency_id);
CREATE INDEX idx_reg_docs_date ON regulatory_documents(publication_date DESC);
CREATE INDEX idx_reg_docs_detected ON regulatory_documents(detected_at DESC);
```

### 4.5 Document Outputs

```sql
-- Base outputs per organization (the Opus-generated version)
CREATE TABLE document_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  regulatory_document_id UUID NOT NULL REFERENCES regulatory_documents(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Output type and location
  output_type TEXT NOT NULL,  -- 'pptx' | 'memo_pdf'
  output_path TEXT,           -- Supabase storage path
  
  -- Processing
  status TEXT DEFAULT 'pending',  -- pending, processing, complete, failed
  error_message TEXT,
  
  -- For memos: the base (non-customized) version
  -- This is what Opus generates before client customization
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

-- Client-specific customized outputs (Haiku-generated)
CREATE TABLE client_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  document_output_id UUID NOT NULL REFERENCES document_outputs(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  
  -- Output location
  output_path TEXT,
  
  -- Processing
  status TEXT DEFAULT 'pending',  -- pending, selected, processing, complete, failed, skipped
  error_message TEXT,
  
  -- Selection workflow
  selected_for_generation BOOLEAN DEFAULT FALSE,  -- User selected this client
  selected_by UUID REFERENCES profiles(id),
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

CREATE INDEX idx_client_outputs_status ON client_outputs(status);
```

---

## 5. Monitoring Implementation

### 5.1 Unified Cron Job

```typescript
// /app/api/cron/check-regulatory-sources/route.ts

export async function POST(request: Request) {
  // 1. Verify cron secret
  
  // 2. Get all active agencies
  const { data: agencies } = await supabase
    .from('agencies')
    .select('*')
    .eq('is_active', true);
  
  // 3. For each agency, check both sources
  for (const agency of agencies) {
    // Check Federal Register
    await checkFederalRegister(agency);
    
    // Check newsroom feeds
    for (const feed of agency.newsroom_feeds) {
      if (feed.enabled) {
        if (feed.type === 'rss') {
          await checkRSSFeed(agency, feed);
        } else if (feed.type === 'scrape') {
          await checkNewsroomScrape(agency, feed);
        }
      }
    }
  }
  
  // 4. Route new documents to subscribed organizations
  await routeNewDocumentsToOrganizations();
}
```

### 5.2 Federal Register Check (Enhanced)

```typescript
async function checkFederalRegister(agency: Agency) {
  const params = new URLSearchParams();
  params.append('conditions[agencies][]', agency.federal_register_slug);
  
  for (const docType of agency.document_types) {
    params.append('conditions[type][]', docType);
  }
  
  params.append('order', 'newest');
  params.append('per_page', '20');
  
  // Fields
  const fields = ['document_number', 'title', 'type', 'abstract', 
                  'publication_date', 'pdf_url', 'html_url', 'citation', 'significant'];
  for (const field of fields) {
    params.append('fields[]', field);
  }
  
  const response = await fetch(
    `https://www.federalregister.gov/api/v1/documents.json?${params}`
  );
  
  const data = await response.json();
  
  for (const doc of data.results) {
    await upsertRegulatoryDocument({
      source: 'federal_register',
      agency_id: agency.id,
      external_id: doc.document_number,
      title: doc.title,
      abstract: doc.abstract,
      publication_date: doc.publication_date,
      source_url: doc.html_url,
      pdf_url: doc.pdf_url,
      citation: doc.citation,
      document_type: doc.type,
      is_significant: doc.significant
    });
  }
}
```

### 5.3 RSS Feed Check

```typescript
async function checkRSSFeed(agency: Agency, feed: FeedConfig) {
  const response = await fetch(feed.url);
  const xmlText = await response.text();
  
  // Parse RSS (using fast-xml-parser or similar)
  const parsed = parseRSS(xmlText);
  
  for (const item of parsed.items) {
    await upsertRegulatoryDocument({
      source: 'newsroom_rss',
      agency_id: agency.id,
      external_id: item.guid || item.link,  // Use guid or link as unique ID
      title: item.title,
      abstract: item.description,
      publication_date: new Date(item.pubDate),
      source_url: item.link,
      pdf_url: extractPdfUrl(item),  // Try to find PDF link in content
      feed_name: feed.name
    });
  }
}
```

### 5.4 Document Routing

```typescript
async function routeNewDocumentsToOrganizations() {
  // Find documents detected in last poll that haven't been routed
  const { data: newDocs } = await supabase
    .from('regulatory_documents')
    .select('*')
    .gte('detected_at', lastPollTime)
    .not('id', 'in', alreadyRoutedIds);
  
  for (const doc of newDocs) {
    // Find organizations subscribed to this agency
    const { data: subscriptions } = await supabase
      .from('organization_agencies')
      .select('organization_id, organizations(*)')
      .eq('agency_id', doc.agency_id);
    
    for (const sub of subscriptions) {
      // Create base output record
      await supabase.from('document_outputs').insert({
        regulatory_document_id: doc.id,
        organization_id: sub.organization_id,
        output_type: sub.organizations.output_type,
        status: 'pending'
      });
      
      // For memo orgs with clients, create client output placeholders
      if (sub.organizations.has_clients) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id')
          .eq('organization_id', sub.organization_id)
          .eq('is_active', true);
        
        for (const client of clients) {
          await supabase.from('client_outputs').insert({
            document_output_id: newOutputId,
            client_id: client.id,
            status: 'pending'  // Awaiting selection
          });
        }
      }
    }
  }
}
```

---

## 6. Output Generation

### 6.1 Two-Model Architecture for Memos

```
┌─────────────────────────────────────────────────────────────────┐
│              MEMO GENERATION PIPELINE                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ STEP 1: Base Memo Generation (Opus 4.5)                  │   │
│  │                                                          │   │
│  │ Input:                                                   │   │
│  │   • Full regulatory document (PDF text)                  │   │
│  │   • Organization context                                 │   │
│  │   • Memo template/structure                              │   │
│  │                                                          │   │
│  │ Output:                                                  │   │
│  │   • Comprehensive analysis memo                          │   │
│  │   • Key findings                                         │   │
│  │   • Implications summary                                 │   │
│  │   • Recommended actions                                  │   │
│  │                                                          │   │
│  │ Cost: ~$0.22 per document                                │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ STEP 2: Client Selection (User Interface)                │   │
│  │                                                          │   │
│  │ User sees list of clients with checkboxes                │   │
│  │ Selects which clients need customized memos              │   │
│  │ Can also "Select All" for demos                          │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ STEP 3: Client Customization (Haiku 4.5) - Per Client    │   │
│  │                                                          │   │
│  │ Input:                                                   │   │
│  │   • Base memo (from Step 1)                              │   │
│  │   • Client context paragraph                             │   │
│  │   • Customization instructions                           │   │
│  │                                                          │   │
│  │ Output:                                                  │   │
│  │   • Tailored memo with client-specific lens              │   │
│  │   • Highlighted relevance to client's situation          │   │
│  │   • Client-specific recommendations                      │   │
│  │                                                          │   │
│  │ Cost: ~$0.02 per client                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Cost Analysis

| Scenario | Opus Only | Two-Model | Savings |
|----------|-----------|-----------|---------|
| 1 doc, 30 clients | $6.82 | $0.82 | 88% |
| 15 docs/month, 30 clients | $102 | $12 | 88% |
| 15 docs/month, 10 clients selected | $102 | $3.50 | 97% |

**Pricing Used (Feb 2026):**
- Opus 4.5: $5/$25 per million tokens (input/output)
- Haiku 4.5: $1/$5 per million tokens (input/output)

### 6.3 Base Memo Generation

```typescript
async function generateBaseMemo(
  document: RegulatoryDocument,
  organization: Organization
): Promise<string> {
  const documentText = await extractPdfText(document.pdf_url);
  
  const systemPrompt = `You are a regulatory affairs expert creating executive briefing memos 
for ${organization.branding.company_name}. 

Your memos should be:
- Clear and actionable
- Focused on business implications
- Written for senior healthcare executives
- Structured with clear sections

Output format: Markdown that will be converted to a branded PDF.`;

  const userPrompt = `Analyze the following regulatory document and create an executive briefing memo.

DOCUMENT TITLE: ${document.title}
PUBLICATION DATE: ${document.publication_date}
DOCUMENT TYPE: ${document.document_type}
${document.citation ? `CITATION: ${document.citation}` : ''}

DOCUMENT TEXT:
${documentText}

Create a comprehensive memo with the following sections:
1. Executive Summary (2-3 sentences)
2. Key Changes/Announcements
3. Who Is Affected
4. Timeline and Effective Dates
5. Business Implications
6. Recommended Actions
7. Questions to Consider`;

  const response = await anthropic.messages.create({
    model: organization.model_config.base_model,  // claude-opus-4-5-...
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });
  
  return response.content[0].text;
}
```

### 6.4 Client Customization

```typescript
async function generateClientMemo(
  baseMemo: string,
  client: Client,
  document: RegulatoryDocument,
  organization: Organization
): Promise<string> {
  const systemPrompt = `You are customizing a regulatory briefing memo for a specific client.
Maintain the structure and key information, but tailor the analysis and recommendations
to be directly relevant to this client's situation.`;

  const userPrompt = `Here is a regulatory briefing memo:

${baseMemo}

---

Customize this memo for the following client:

CLIENT: ${client.name}
${client.industry ? `INDUSTRY: ${client.industry}` : ''}
${client.focus_areas?.length ? `FOCUS AREAS: ${client.focus_areas.join(', ')}` : ''}

CLIENT CONTEXT:
${client.context}

---

Rewrite the memo with:
1. Client-specific framing in the Executive Summary
2. Analysis of how each key change specifically affects THIS client
3. Tailored recommendations based on their situation
4. Highlighted sections most relevant to their focus areas

Keep the same overall structure but make it feel personalized for ${client.name}.`;

  const response = await anthropic.messages.create({
    model: organization.model_config.customization_model,  // claude-haiku-4-5-...
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });
  
  return response.content[0].text;
}
```

---

## 7. PDF Memo Generation

### 7.1 Catalyst Branding

Based on https://catalysthcc.com/:

```json
{
  "company_name": "Catalyst Healthcare Consulting",
  "tagline": "Igniting progress at the intersection of regulation, policy, and innovation",
  "logo_url": "https://cdn.prod.website-files.com/67ab1b028067c83763b0acf7/67ab1d6e783fcba64eb75481_gingi_logo.png",
  "primary_color": "#1a1a2e",
  "secondary_color": "#e94560",
  "accent_color": "#0f3460",
  "font_family": "Inter, sans-serif"
}
```

### 7.2 Memo PDF Template

```typescript
// Using @react-pdf/renderer or similar

const MemoTemplate = ({ memo, branding, client, document }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header with logo */}
      <View style={styles.header}>
        <Image src={branding.logo_url} style={styles.logo} />
        <Text style={styles.tagline}>{branding.tagline}</Text>
      </View>
      
      {/* Memo metadata */}
      <View style={styles.metadata}>
        <Text style={styles.title}>Regulatory Briefing</Text>
        <Text style={styles.documentTitle}>{document.title}</Text>
        {client && (
          <Text style={styles.preparedFor}>Prepared for: {client.name}</Text>
        )}
        <Text style={styles.date}>
          {document.publication_date} | {document.citation || document.document_type}
        </Text>
      </View>
      
      {/* Memo content (parsed from markdown) */}
      <View style={styles.content}>
        <MarkdownRenderer content={memo} />
      </View>
      
      {/* Footer */}
      <View style={styles.footer}>
        <Text>{branding.company_name}</Text>
        <Text>Confidential</Text>
      </View>
    </Page>
  </Document>
);
```

---

## 8. User Interface

### 8.1 Dashboard - Document List

```
┌─────────────────────────────────────────────────────────────────┐
│  Catalyst Healthcare Consulting                    Nancy Myers ▼│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Regulatory Documents                              [Settings ⚙]  │
│                                                                  │
│  Monitoring: FDA (Federal Register + Newsroom)                  │
│  Last checked: 2 minutes ago                                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📄 FDA Approves First Treatment for Menkes Disease         │ │
│  │    Source: FDA Press Release • Feb 12, 2026                │ │
│  │    Base memo: ✓ Ready                                      │ │
│  │    Client memos: 0 of 32 generated                         │ │
│  │                                                             │ │
│  │    [Generate Base Memo]  [Select Clients →]  [View Base]   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📄 2026-02156 - Biosimilar Interchangeability Guidance     │ │
│  │    Source: Federal Register (PRORULE) • Feb 10, 2026       │ │
│  │    91 FR 8234                                               │ │
│  │    Base memo: ✓ Ready                                      │ │
│  │    Client memos: 8 of 32 generated                         │ │
│  │                                                             │ │
│  │    [Select Clients →]  [View Base]  [Download All ↓]       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Client Selection Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Select Clients for Memo Generation                         ✕  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Document: Biosimilar Interchangeability Guidance               │
│  Estimated cost: $0.02 per client memo                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [✓] Select All (32 clients) - Est. $0.64                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Search clients: [________________]                             │
│                                                                  │
│  ☑ Acme Therapeutics                                            │
│    CAR-T cell therapies, oncology                               │
│                                                                  │
│  ☑ BioGenix Partners                                            │
│    Biosimilars, manufacturing                                   │
│                                                                  │
│  ☐ CellTech Innovations                                         │
│    Gene therapy, rare diseases                                  │
│                                                                  │
│  ☑ Derma Solutions Inc                                          │
│    Topical biologics, dermatology                               │
│                                                                  │
│  ... (28 more)                                                  │
│                                                                  │
│  Selected: 3 clients                                            │
│  Estimated cost: $0.06                                          │
│                                                                  │
│            [Cancel]  [Generate 3 Memos]                         │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Client Management

```
┌─────────────────────────────────────────────────────────────────┐
│  Clients                                          [+ Add Client]│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  32 active clients                                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Acme Therapeutics                              [Edit] [⋯]  │ │
│  │ Industry: Biotechnology                                    │ │
│  │ Focus: CAR-T cell therapies, oncology, solid tumors        │ │
│  │                                                             │ │
│  │ Context:                                                    │ │
│  │ Acme Therapeutics is a mid-size biotech focused on CAR-T   │ │
│  │ cell therapies for solid tumors. They have two products in │ │
│  │ Phase 2 trials and are particularly concerned about FDA    │ │
│  │ guidance on manufacturing standards and accelerated        │ │
│  │ approval pathways. Key decision makers are the VP of       │ │
│  │ Regulatory Affairs and CMO.                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ BioGenix Partners                              [Edit] [⋯]  │ │
│  │ Industry: Pharmaceutical Manufacturing                     │ │
│  │ Focus: Biosimilars, manufacturing, quality systems         │ │
│  │ ...                                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 Admin View (Cory)

```
┌─────────────────────────────────────────────────────────────────┐
│  Platform Admin                                    Cory Kidd ▼  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Organizations                                                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Jayson's Team                                              │ │
│  │ Agencies: CMS                                              │ │
│  │ Output: PowerPoint                                         │ │
│  │ Users: 1 | Documents: 47 | Outputs: 47                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Catalyst Healthcare Consulting                             │ │
│  │ Agencies: FDA                                              │ │
│  │ Output: PDF Memos (branded)                                │ │
│  │ Users: 1 | Clients: 32 | Documents: 12 | Outputs: 156      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ──────────────────────────────────────────────────────────────  │
│                                                                  │
│  System Status                                                  │
│                                                                  │
│  Federal Register Monitor: ● Active (last check: 3 min ago)    │
│  FDA Newsroom RSS: ● Active (last check: 3 min ago)            │
│  CMS Newsroom: ● Active (last check: 3 min ago)                │
│                                                                  │
│  API Costs (MTD): $18.42                                        │
│  Documents Processed: 23                                        │
│  Outputs Generated: 203                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. API Endpoints

### 9.1 Organization Endpoints

```
GET    /api/organizations                    # List (admin only)
POST   /api/organizations                    # Create (admin only)
GET    /api/organizations/[id]               # Get details
PATCH  /api/organizations/[id]               # Update settings
GET    /api/organizations/[id]/agencies      # Get agency subscriptions
PUT    /api/organizations/[id]/agencies      # Update subscriptions
```

### 9.2 Client Endpoints

```
GET    /api/clients                          # List for current org
POST   /api/clients                          # Create client
GET    /api/clients/[id]                     # Get client details
PATCH  /api/clients/[id]                     # Update client
DELETE /api/clients/[id]                     # Deactivate client
```

### 9.3 Document Endpoints

```
GET    /api/documents                        # List for current org
GET    /api/documents/[id]                   # Get document details
GET    /api/documents/[id]/outputs           # Get all outputs for doc
POST   /api/documents/[id]/generate-base     # Generate base output
POST   /api/documents/[id]/generate-clients  # Generate selected client outputs
        Body: { client_ids: ['uuid', 'uuid', ...] }
```

### 9.4 Output Endpoints

```
GET    /api/outputs/[id]                     # Get output details
GET    /api/outputs/[id]/download            # Download file
GET    /api/client-outputs/[id]/download     # Download client memo
```

### 9.5 Cron Endpoints

```
POST   /api/cron/check-regulatory-sources    # Main monitoring cron
POST   /api/cron/process-outputs             # Process pending outputs
```

---

## 10. Vercel Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/check-regulatory-sources",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/process-outputs", 
      "schedule": "*/5 * * * *"
    }
  ]
}
```

---

## 11. Database Migration

```sql
-- Migration: Multi-tenant regulatory intelligence platform
-- Date: 2026-02-12

-- 1. Create agencies table
CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  federal_register_slug TEXT NOT NULL,
  newsroom_feeds JSONB DEFAULT '[]',
  document_types TEXT[] DEFAULT ARRAY['RULE', 'PRORULE', 'NOTICE'],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  output_type TEXT NOT NULL DEFAULT 'pptx',
  branding JSONB DEFAULT '{}',
  model_config JSONB DEFAULT '{"base_model": "claude-sonnet-4-5-20250929", "customization_model": "claude-haiku-4-5-20251001"}',
  has_clients BOOLEAN DEFAULT FALSE,
  auto_process BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create organization_agencies junction
CREATE TABLE IF NOT EXISTS organization_agencies (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agency_id TEXT REFERENCES agencies(id) ON DELETE CASCADE,
  federal_register_enabled BOOLEAN DEFAULT TRUE,
  newsroom_enabled BOOLEAN DEFAULT TRUE,
  document_types TEXT[],
  PRIMARY KEY (organization_id, agency_id)
);

-- 4. Add organization_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);

-- 5. Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  context TEXT NOT NULL,
  industry TEXT,
  focus_areas TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_id);

-- 6. Create regulatory_documents table
CREATE TABLE IF NOT EXISTS regulatory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  agency_id TEXT NOT NULL REFERENCES agencies(id),
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT,
  publication_date DATE,
  source_url TEXT,
  pdf_url TEXT,
  citation TEXT,
  document_type TEXT,
  is_significant BOOLEAN,
  feed_name TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  content_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_reg_docs_agency ON regulatory_documents(agency_id);
CREATE INDEX IF NOT EXISTS idx_reg_docs_date ON regulatory_documents(publication_date DESC);

-- 7. Create document_outputs table
CREATE TABLE IF NOT EXISTS document_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulatory_document_id UUID NOT NULL REFERENCES regulatory_documents(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  output_type TEXT NOT NULL,
  output_path TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  is_base_output BOOLEAN DEFAULT TRUE,
  model_used TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(regulatory_document_id, organization_id, is_base_output)
);

-- 8. Create client_outputs table
CREATE TABLE IF NOT EXISTS client_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_output_id UUID NOT NULL REFERENCES document_outputs(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  output_path TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  selected_for_generation BOOLEAN DEFAULT FALSE,
  selected_by UUID REFERENCES profiles(id),
  selected_at TIMESTAMPTZ,
  model_used TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_output_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_client_outputs_status ON client_outputs(status);

-- 9. Insert initial agencies
INSERT INTO agencies (id, name, federal_register_slug, newsroom_feeds) VALUES
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

-- 10. Enable RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_outputs ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies (simplified - expand as needed)
CREATE POLICY "Users see own org" ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users see own org clients" ON clients FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users see own org documents" ON document_outputs FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users see own client outputs" ON client_outputs FOR ALL
  USING (document_output_id IN (
    SELECT id FROM document_outputs 
    WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  ));
```

---

## 12. Implementation Order

### Phase 1: Database & Core Structure (Week 1)
1. Run database migration
2. Create Jayson's organization record
3. Create Catalyst organization record
4. Migrate existing Jayson data to new structure
5. Set up Nancy's user account linked to Catalyst org

### Phase 2: Monitoring Enhancement (Week 1-2)
1. Refactor existing Federal Register monitor to use new schema
2. Add agency routing logic
3. Implement RSS feed monitoring for FDA
4. Add CMS newsroom monitoring for Jayson
5. Test unified monitoring cron

### Phase 3: Output Generation (Week 2)
1. Keep existing PPTX generation for Jayson's org
2. Implement base memo generation (Opus) for Catalyst
3. Implement client customization (Haiku) 
4. Implement PDF generation with Catalyst branding
5. Test two-model pipeline

### Phase 4: User Interface (Week 2-3)
1. Add organization context to auth/session
2. Create client management UI for Catalyst
3. Create document list with source indicators
4. Create client selection modal
5. Add download functionality for memos

### Phase 5: Testing & Refinement (Week 3)
1. End-to-end testing both organizations
2. Cost tracking verification
3. Performance optimization
4. User acceptance testing with Nancy

---

## 13. Post-Deployment Setup

### For Jayson (Existing User)

```sql
-- Create organization
INSERT INTO organizations (name, slug, output_type, has_clients, auto_process)
VALUES ('Jayson Team', 'jayson-team', 'pptx', FALSE, TRUE);

-- Link to CMS
INSERT INTO organization_agencies (organization_id, agency_id)
SELECT id, 'cms' FROM organizations WHERE slug = 'jayson-team';

-- Update Jayson's profile
UPDATE profiles SET organization_id = (SELECT id FROM organizations WHERE slug = 'jayson-team')
WHERE email = 'jayson@...';

-- Migrate existing federal_register_documents to new schema
-- (migration script to transfer data)
```

### For Nancy (New User)

```sql
-- Create Catalyst organization
INSERT INTO organizations (name, slug, output_type, has_clients, branding, model_config)
VALUES (
  'Catalyst Healthcare Consulting',
  'catalyst',
  'memo_pdf',
  TRUE,
  '{
    "company_name": "Catalyst Healthcare Consulting",
    "tagline": "Igniting progress at the intersection of regulation, policy, and innovation",
    "logo_url": "https://cdn.prod.website-files.com/67ab1b028067c83763b0acf7/67ab1d6e783fcba64eb75481_gingi_logo.png",
    "primary_color": "#1a1a2e",
    "secondary_color": "#e94560"
  }',
  '{
    "base_model": "claude-opus-4-5-20251101",
    "customization_model": "claude-haiku-4-5-20251001"
  }'
);

-- Link to FDA
INSERT INTO organization_agencies (organization_id, agency_id)
SELECT id, 'fda' FROM organizations WHERE slug = 'catalyst';

-- Create Nancy's user (via admin)
-- Then update her profile:
UPDATE profiles SET 
  organization_id = (SELECT id FROM organizations WHERE slug = 'catalyst'),
  role = 'admin'
WHERE email = 'nancy@catalysthcc.com';
```

---

## 14. Files to Create/Modify

### New Files
```
/lib/agencies.ts                           # Agency configuration utilities
/lib/rss-parser.ts                         # RSS feed parsing
/lib/memo-generator.ts                     # Two-model memo generation
/lib/pdf-generator.ts                      # Branded PDF creation

/app/api/cron/check-regulatory-sources/route.ts
/app/api/organizations/route.ts
/app/api/organizations/[id]/route.ts
/app/api/organizations/[id]/agencies/route.ts
/app/api/clients/route.ts
/app/api/clients/[id]/route.ts
/app/api/documents/route.ts
/app/api/documents/[id]/route.ts
/app/api/documents/[id]/generate-base/route.ts
/app/api/documents/[id]/generate-clients/route.ts

/components/clients/ClientList.tsx
/components/clients/ClientForm.tsx
/components/clients/ClientSelector.tsx
/components/documents/DocumentList.tsx
/components/documents/SourceBadge.tsx
/components/outputs/MemoPreview.tsx

/app/(dashboard)/clients/page.tsx
/app/(dashboard)/documents/page.tsx
/app/(dashboard)/documents/[id]/page.tsx
/app/(admin)/organizations/page.tsx

/supabase/migrations/20260212_multi_tenant_platform.sql
```

### Modified Files
```
/vercel.json                               # Update cron jobs
/lib/supabase/types.ts                     # Add new table types
/middleware.ts                             # Add org context
/app/(dashboard)/layout.tsx                # Org-aware layout
```

---

*End of Specification*
