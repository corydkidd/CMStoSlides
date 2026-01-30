# Migration: Supabase → Local Self-Contained Deployment

## Goal
Replace all Supabase dependencies with local infrastructure matching sumis-hub pattern:
- **Database**: Local PostgreSQL container + Prisma ORM
- **Auth**: NextAuth + Authentik SSO (via auth.sumispartners.com)
- **File Storage**: Local filesystem on /mnt/storage/projects/CMStoSlides/
- **No more**: @supabase/supabase-js, Supabase Auth, Supabase Storage, Supabase docker containers

## Reference Implementation
Use `/home/coryk/server/sumis-hub` as the reference for patterns:
- `src/lib/auth.ts` — NextAuth + Authentik config
- `src/lib/db.ts` — Prisma client singleton
- `prisma/schema.prisma` — Prisma schema pattern
- `docker-compose.yml` — App + Postgres container setup
- `Dockerfile` — Multi-stage Next.js build with Prisma

## Step-by-Step Implementation

### Step 1: Create Prisma Schema
Create `prisma/schema.prisma` with all tables from the Supabase migrations:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  profileImage  String?
  authentikId   String    @unique
  isAdmin       Boolean   @default(false)
  isActive      Boolean   @default(true)
  templatePath  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  descriptionDocs     DescriptionDocument[] @relation("UserDocs")
  createdDocs         DescriptionDocument[] @relation("CreatedByDocs")
  conversionJobs      ConversionJob[]
  federalRegisterDocs FederalRegisterDocument[]
}

model DescriptionDocument {
  id        String   @id @default(cuid())
  userId    String
  content   String
  version   Int      @default(1)
  isCurrent Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdById String?

  user      User     @relation("UserDocs", fields: [userId], references: [id], onDelete: Cascade)
  createdBy User?    @relation("CreatedByDocs", fields: [createdById], references: [id])
  jobs      ConversionJob[]

  @@index([userId, isCurrent])
}

model ConversionJob {
  id                    String    @id @default(cuid())
  userId                String
  status                String    @default("pending")
  inputFilename         String
  inputPath             String
  inputSizeBytes        BigInt?
  extractedText         String?
  descriptionDocId      String?
  processingStartedAt   DateTime?
  processingCompletedAt DateTime?
  outputFilename        String?
  outputPath            String?
  outputSizeBytes       BigInt?
  errorMessage          String?
  metadata              Json?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user           User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  descriptionDoc DescriptionDocument? @relation(fields: [descriptionDocId], references: [id])
  federalRegisterDoc FederalRegisterDocument?

  @@index([userId, status])
  @@index([status])
}

model FederalRegisterDocument {
  id               String    @id @default(cuid())
  documentNumber   String    @unique
  citation         String?
  title            String
  documentType     String?
  abstract         String?
  publicationDate  DateTime
  pdfUrl           String
  htmlUrl          String?
  isSignificant    Boolean   @default(false)
  agencies         Json?
  autoProcess      Boolean   @default(true)
  targetUserId     String?
  conversionJobId  String?   @unique
  detectedAt       DateTime  @default(now())
  pdfDownloadedAt  DateTime?
  processingStatus String    @default("pending")
  errorMessage     String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  targetUser    User?          @relation(fields: [targetUserId], references: [id])
  conversionJob ConversionJob? @relation(fields: [conversionJobId], references: [id])

  @@index([documentNumber])
  @@index([publicationDate(sort: Desc)])
  @@index([processingStatus])
  @@index([targetUserId])
}

model FederalRegisterSettings {
  id                     String    @id @default(cuid())
  isEnabled              Boolean   @default(true)
  pollIntervalMinutes    Int       @default(15)
  agencySlugs            String[]  @default(["centers-for-medicare-medicaid-services"])
  documentTypes          String[]  @default(["RULE", "PRORULE", "NOTICE"])
  onlySignificant        Boolean   @default(false)
  defaultTargetUserId    String?
  autoProcessNew         Boolean   @default(true)
  lastPollAt             DateTime?
  lastPollStatus         String?
  lastPollDocumentsFound Int?
  initialized            Boolean   @default(false)
  initialDocumentCount   Int       @default(5)
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
}
```

Commit: "Add Prisma schema for local database"

### Step 2: Create lib/db.ts (Prisma client singleton)
Copy pattern from sumis-hub:
```ts
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

Commit: "Add Prisma client singleton"

### Step 3: Create lib/auth.ts (NextAuth + Authentik)
Pattern from sumis-hub — use auth.sumispartners.com as IdP. Create the NextAuth config:
- Provider: Authentik OAuth (same endpoints as sumis-hub)
- Callbacks: jwt (store groups, authentikId), session (expose groups), signIn (upsert User in Prisma)
- Pages: /auth/signin, /auth/error
- Session strategy: JWT

Also create `app/api/auth/[...nextauth]/route.ts`.

Env vars needed: AUTHENTIK_CLIENT_ID, AUTHENTIK_CLIENT_SECRET, AUTHENTIK_ISSUER, NEXTAUTH_URL, NEXTAUTH_SECRET

Commit: "Add NextAuth + Authentik authentication"

### Step 4: Create lib/storage.ts (local filesystem storage)
Replace Supabase Storage with local filesystem:
```ts
const STORAGE_ROOT = process.env.UPLOAD_DIR || '/app/data';

export async function saveUpload(userId: string, filename: string, buffer: Buffer): Promise<string>
// Saves to {STORAGE_ROOT}/uploads/{userId}/{timestamp}_{filename}
// Returns relative path

export async function saveOutput(userId: string, filename: string, buffer: Buffer): Promise<string>
// Saves to {STORAGE_ROOT}/outputs/{userId}/{timestamp}_{filename}
// Returns relative path

export async function getFilePath(relativePath: string): string
// Returns absolute path for reading

export async function getFileBuffer(relativePath: string): Promise<Buffer>
// Reads file and returns buffer
```

Commit: "Add local filesystem storage utility"

### Step 5: Update docker-compose.yml
Add PostgreSQL container, volume mounts for storage, remove Supabase env vars:
```yaml
services:
  app:
    build: .
    container_name: cms-converter
    restart: unless-stopped
    ports:
      - "3002:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://cms_converter:${DB_PASSWORD}@db:5432/cms_converter
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - AUTHENTIK_CLIENT_ID=${AUTHENTIK_CLIENT_ID}
      - AUTHENTIK_CLIENT_SECRET=${AUTHENTIK_CLIENT_SECRET}
      - AUTHENTIK_ISSUER=${AUTHENTIK_ISSUER}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - CRON_SECRET=${CRON_SECRET}
      - UPLOAD_DIR=/app/data
    volumes:
      - /mnt/storage/projects/CMStoSlides/uploads:/app/data/uploads
      - /mnt/storage/projects/CMStoSlides/outputs:/app/data/outputs
    depends_on:
      db:
        condition: service_healthy
    networks:
      - web

  db:
    image: postgres:16-alpine
    container_name: cms-converter-db-local
    restart: unless-stopped
    environment:
      POSTGRES_USER: cms_converter
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: cms_converter
    volumes:
      - /mnt/storage/projects/CMStoSlides/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cms_converter"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - web

networks:
  web:
    external: true
```

Update Dockerfile to match sumis-hub pattern (multi-stage with prisma generate, copy prisma client).

Create .env with new vars (DB_PASSWORD, NEXTAUTH_SECRET, NEXTAUTH_URL=https://cms.advientadvisors.com, AUTHENTIK_CLIENT_ID, AUTHENTIK_CLIENT_SECRET, AUTHENTIK_ISSUER).

Commit: "Update docker-compose and Dockerfile for local deployment"

### Step 6: Rewrite all API routes and pages
Replace every `createClient`/`createServerClient` from @supabase with Prisma queries.
Replace every Supabase Storage call with lib/storage.ts functions.
Replace every Supabase Auth call with NextAuth `getServerSession`.

Files to rewrite (in order):
1. `middleware.ts` — Replace Supabase auth check with NextAuth session check
2. `app/api/process/route.ts` — Use Prisma + storage
3. `app/api/jobs/[id]/download/route.ts` — Use Prisma + storage (serve file directly instead of signed URL)
4. `app/api/cron/check-federal-register/route.ts` — Use Prisma + storage
5. `app/api/admin/federal-register/*.ts` — All admin FR routes use Prisma
6. `app/dashboard/page.tsx` + `DashboardClient.tsx` — Use Prisma for server, fetch for client
7. `app/history/page.tsx` + `HistoryClient.tsx` — Use Prisma
8. `app/admin/page.tsx` + `AdminDashboardClient.tsx` — Use Prisma
9. `app/admin/users/*` — Use Prisma
10. `app/admin/jobs/*` — Use Prisma
11. `lib/job-processor.ts` — Use Prisma + storage instead of Supabase
12. Remove: `lib/supabase/`, `lib/auth/actions.ts`, `app/api/auth/callback/`, `app/api/auth/login/`, `app/api/auth/set-session/`, `app/auth/`, `contexts/` (if Supabase-specific)

Commit after each major group (API routes, pages, cleanup).

### Step 7: Remove Supabase dependencies
- `npm uninstall @supabase/supabase-js @supabase/ssr`
- Delete `lib/supabase/` directory
- Delete `lib/supabase/database.types.ts`
- Remove Supabase env vars from .env

Commit: "Remove all Supabase dependencies"

### Step 8: Add seed script
Create `prisma/seed.ts` to insert default FederalRegisterSettings.

Commit: "Add seed script for default settings"

## IMPORTANT
- Do NOT run docker compose build/up or prisma migrate/db push
- Just write the code and schema changes
- After each major step, commit with a descriptive message
- When completely finished, run: `clawdbot gateway wake --text "Done: CMStoSlides Supabase migration complete" --mode now`
