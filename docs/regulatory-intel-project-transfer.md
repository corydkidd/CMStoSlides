# Regulatory Intelligence Platform - Project Transfer Document

**Date**: February 12, 2026  
**Transfer from**: Advient Advisors project  
**Transfer to**: Project Development project

---

## PART 1: COMPLETE PROJECT SUMMARY

### What This Is

A multi-tenant regulatory monitoring and document generation platform that:
1. Monitors federal agencies (CMS, FDA) for new regulatory documents
2. Automatically generates outputs (PowerPoint decks or branded PDF memos)
3. Supports multiple client organizations with different needs

### Current Users

**Organization 1: Jayson's Team**
- Monitors: CMS (Centers for Medicare & Medicaid Services)
- Sources: Federal Register API + CMS Newsroom
- Output: PowerPoint decks summarizing regulatory changes
- Clients: None (single output per document)
- Model: Claude Sonnet 4.5

**Organization 2: Catalyst Healthcare Consulting (Nancy Myers)**
- Monitors: FDA (Food and Drug Administration)
- Sources: Federal Register API + FDA RSS feeds (Press Releases, Drugs, Biologics)
- Output: Branded PDF memos
- Clients: 30+ pharma/healthcare clients, each gets customized memo
- Model: Two-tier approach:
  - Opus 4.5 for base analysis (~$0.22/doc)
  - Haiku 4.5 for client customization (~$0.02/client)

### Tech Stack

- **Framework**: Next.js
- **Database**: PostgreSQL (via Supabase currently - needs migration to local)
- **AI**: Anthropic Claude API (Opus 4.5, Sonnet 4.5, Haiku 4.5)
- **Document Generation**: 
  - PPTX via pptxgenjs or similar
  - PDF via branded templates
- **Monitoring**: Cron jobs hitting Federal Register API and RSS feeds

### Database Schema (Key Tables)

```
organizations
├── id, name, slug
├── output_type: 'pptx' | 'memo_pdf'
├── has_clients: boolean
├── branding: jsonb (logo, colors, tagline)
├── model_config: jsonb (base_model, customization_model)

organization_agencies (many-to-many)
├── organization_id → organizations
├── agency_id → agencies

agencies
├── id: 'cms' | 'fda' | etc.
├── name, federal_register_slug
├── newsroom_feeds: jsonb array
├── document_types: text[] (RULE, PRORULE, NOTICE)

clients (for orgs with has_clients=true)
├── id, organization_id, name
├── context_paragraph: text (used for AI customization)
├── is_active: boolean

regulatory_documents
├── id, agency_id
├── source: 'federal_register' | 'newsroom'
├── document_number (FR) or guid (RSS)
├── title, abstract, publication_date
├── pdf_url, html_url
├── detected_at

document_outputs
├── id, regulatory_document_id, organization_id
├── is_base_output: boolean
├── output_path, status
├── model_used, tokens_input, tokens_output

client_outputs (for memo orgs)
├── id, document_output_id, client_id
├── output_path, status
├── selected_for_generation: boolean (user picks which clients)
```

### API Endpoints

```
/api/cron/check-regulatory-sources    # Called every 15 min
/api/organizations/[id]               # Org management
/api/organizations/[id]/agencies      # Agency subscriptions
/api/clients                          # Client CRUD
/api/documents                        # Document list
/api/documents/[id]/generate-base     # Generate base output
/api/documents/[id]/generate-clients  # Generate client memos
/api/files/[...path]                  # Serve generated files
```

### Data Sources

**Federal Register API** (free, no auth):
- Endpoint: `https://www.federalregister.gov/api/v1/documents`
- Filter by agency slug and document type
- Returns structured JSON with PDF links

**FDA RSS Feeds**:
- Press Releases: `https://www.fda.gov/.../press-releases/rss.xml`
- Drugs: `https://www.fda.gov/.../drugs/rss.xml`
- Biologics: `https://www.fda.gov/.../biologics/rss.xml`

**CMS Newsroom**: Requires scraping (no official RSS)

### Two-Model Cost Optimization

For Catalyst's client customization workflow:

1. **Base Analysis (Opus 4.5)**: Read full regulatory document, generate comprehensive analysis memo. Run once per document. ~$0.22/document.

2. **Client Customization (Haiku 4.5)**: Take base memo + client context paragraph, generate client-specific version highlighting relevant impacts. Run per selected client. ~$0.02/client.

This avoids re-reading the full document for each of 30+ clients.

### Current Status

- Application has been built
- Currently deployed on phaedrus (deployment method unclear)
- Needs migration to Docker containers with storage on RAID at /mnt/storage/

---

## PART 2: PROMPT FOR NEW PROJECT

Copy everything below this line and paste into your Project Development project:

---

## Regulatory Intelligence Platform - Docker Migration

### Context

I have a working Next.js application called "Regulatory Intelligence Platform" that needs to be properly containerized with Docker. The app is already built and functional. I need you to migrate it to follow our standard deployment patterns.

### What the App Does

Multi-tenant platform that monitors federal regulatory agencies and generates documents:

- **Jayson's Team**: Monitors CMS → generates PowerPoint summaries
- **Catalyst Healthcare**: Monitors FDA → generates branded PDF memos for 30+ clients

Uses Claude API for document analysis with a two-model cost optimization (Opus for base analysis, Haiku for client customization).

### Current State

- **Code location**: ~/server/CMStoSlides/
- **Status**: Running

Please verify:
1. How is it running? (PM2? systemd? docker? direct node?)
2. Database setup (Supabase cloud? local PostgreSQL?)
3. Where are generated files being stored?
4. Current port it's listening on?

Report back what you find before proceeding with migration.

### Target State

Follow our standard patterns from ~/server/docs/:

- **Code**: ~/server/regulatory-intel/ (rename from CMStoSlides)
- **Storage**: /mnt/storage/projects/regulatory-intel/
  - /storage/ (uploads, outputs)
  - /database/ (PostgreSQL data)
  - /backups/
  - /logs/
- **Domain**: regulatory-intel.advientadvisors.com (or suggest better subdomain)
- **Port**: Next available in 3000-3099 range (check PHAEDRUS-SERVER-INFO.md)

### Key Requirements

1. **Docker Compose** with:
   - Next.js app container
   - PostgreSQL container (migrate from Supabase if needed)
   - Internal network (don't expose DB port)

2. **Cron jobs** for regulatory monitoring:
   - Every 15 min: check Federal Register API and RSS feeds
   - Daily: database backup

3. **Storage migration**:
   - Replace any Supabase Storage calls with local filesystem
   - All persistent data on /mnt/storage/

4. **Cloudflare Tunnel** for external access

### Database Tables to Preserve

If migrating from Supabase, these tables need to come over:
- organizations, organization_agencies
- agencies (seed data for CMS/FDA)
- profiles (users)
- clients
- regulatory_documents
- document_outputs
- client_outputs

### Migration Steps

Once you've verified the current setup:
1. Stop the current process
2. Rename ~/server/CMStoSlides/ to ~/server/regulatory-intel/
3. Create Docker Compose setup
4. Migrate database to local PostgreSQL if on Supabase
5. Update storage paths to /mnt/storage/projects/regulatory-intel/
6. Set up cron jobs
7. Configure Cloudflare Tunnel
8. Test end-to-end
9. Remove old process management (PM2/systemd/etc.)

Let me know what you find first.

---

*End of transfer document*
