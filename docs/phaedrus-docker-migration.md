# Regulatory Intelligence Platform: Docker Migration Specification

**For**: Claude Code on phaedrus  
**Date**: February 12, 2026  
**Purpose**: Migrate existing Vercel-style deployment to self-contained Docker containers with RAID storage

---

## Overview

The Regulatory Intelligence Platform is currently deployed and needs to be migrated from a Vercel-style architecture to self-contained Docker containers on phaedrus with all storage on the RAID array.

---

## Current State (Questions for Claude Code)

Before proceeding with migration, please confirm the current setup:

1. **Application Location**: Where is the Next.js app currently deployed?
   - Path on phaedrus filesystem?
   
2. **Database**: What database is in use?
   - Supabase (cloud)?
   - Local PostgreSQL?
   - If local, where is data stored?

3. **Process Management**: How is the Next.js app currently running?
   - PM2?
   - Systemd service?
   - Direct node process?

4. **Cron Jobs**: How are scheduled tasks currently implemented?
   - System crontab?
   - PM2 scheduler?
   - Other?

5. **File Storage**: Where are generated files (PPTX, PDF) currently stored?
   - Local filesystem path?
   - Supabase Storage?

---

## Target Architecture

### Container Structure

```
phaedrus
├── Docker Containers
│   ├── regulatory-intel-app     # Next.js application
│   ├── regulatory-intel-db      # PostgreSQL database (if not using Supabase cloud)
│   └── regulatory-intel-cron    # Cron scheduler (or use host cron)
│
└── RAID Array Mounts
    └── /mnt/raid/regulatory-intel/
        ├── storage/
        │   ├── uploads/
        │   └── outputs/
        │       ├── jayson-team/
        │       │   └── pptx/
        │       └── catalyst/
        │           ├── base-memos/
        │           └── client-memos/
        ├── database/            # PostgreSQL data (if local)
        ├── backups/
        └── logs/
```

### Docker Compose Configuration

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    container_name: regulatory-intel-app
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3000"  # Map to available port on host
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@db:5432/regulatory_intel
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - STORAGE_PATH=/app/storage
      - CRON_SECRET=${CRON_SECRET}
    volumes:
      - /mnt/raid/regulatory-intel/storage:/app/storage
      - /mnt/raid/regulatory-intel/logs:/app/logs
    depends_on:
      - db
    restart: unless-stopped
    networks:
      - regulatory-intel-network

  db:
    container_name: regulatory-intel-db
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=regulatory_intel
    volumes:
      - /mnt/raid/regulatory-intel/database:/var/lib/postgresql/data
      - /mnt/raid/regulatory-intel/backups:/backups
    restart: unless-stopped
    networks:
      - regulatory-intel-network
    # No ports exposed - only accessible within Docker network

networks:
  regulatory-intel-network:
    driver: bridge
```

### Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Builder stage
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create storage directories
RUN mkdir -p /app/storage /app/logs

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

### Environment File

Create `.env.production`:

```bash
# Database
DB_PASSWORD=<generate-secure-password>
DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@db:5432/regulatory_intel

# Anthropic API
ANTHROPIC_API_KEY=<your-key>

# Application
NODE_ENV=production
NEXTAUTH_URL=https://regulatory-intel.phaedrus.local  # Or your domain
NEXTAUTH_SECRET=<generate-secure-secret>

# Cron
CRON_SECRET=<generate-secure-secret>

# Storage
STORAGE_PATH=/app/storage
```

---

## Migration Steps

### Step 1: Create RAID Directory Structure

```bash
# Create base directories on RAID
sudo mkdir -p /mnt/raid/regulatory-intel/{storage,database,backups,logs}
sudo mkdir -p /mnt/raid/regulatory-intel/storage/{uploads,outputs}
sudo mkdir -p /mnt/raid/regulatory-intel/storage/outputs/{jayson-team,catalyst}
sudo mkdir -p /mnt/raid/regulatory-intel/storage/outputs/jayson-team/pptx
sudo mkdir -p /mnt/raid/regulatory-intel/storage/outputs/catalyst/{base-memos,client-memos}

# Set ownership for Docker user (typically 1001)
sudo chown -R 1001:1001 /mnt/raid/regulatory-intel
```

### Step 2: Database Migration

**Option A: If currently using Supabase Cloud**
```bash
# Export data from Supabase
# 1. Use Supabase CLI or pg_dump against Supabase connection string
pg_dump -h <supabase-host> -U postgres -d postgres \
  --schema=public \
  -F c -f /mnt/raid/regulatory-intel/backups/supabase-export.dump

# 2. Start local PostgreSQL container first
docker-compose up -d db

# 3. Restore into local PostgreSQL
docker exec -i regulatory-intel-db pg_restore \
  -U postgres -d regulatory_intel \
  /backups/supabase-export.dump
```

**Option B: If already using local PostgreSQL**
```bash
# Stop existing PostgreSQL
sudo systemctl stop postgresql

# Copy data directory to RAID
sudo cp -a /var/lib/postgresql/data/* /mnt/raid/regulatory-intel/database/

# Or use pg_dump if different version
pg_dump -U postgres regulatory_intel > /mnt/raid/regulatory-intel/backups/db-backup.sql
```

### Step 3: Update Application Code for Local Storage

**Replace Supabase Storage calls with local filesystem:**

Create/update `lib/storage.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || '/app/storage';

export async function saveFile(
  orgSlug: string,
  type: 'pptx' | 'base-memos' | 'client-memos',
  filename: string,
  buffer: Buffer
): Promise<string> {
  const dir = path.join(STORAGE_PATH, 'outputs', orgSlug, type);
  await fs.mkdir(dir, { recursive: true });
  
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, buffer);
  
  // Return relative path for database storage
  return `outputs/${orgSlug}/${type}/${filename}`;
}

export async function getFile(relativePath: string): Promise<Buffer> {
  const filepath = path.join(STORAGE_PATH, relativePath);
  return fs.readFile(filepath);
}

export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(STORAGE_PATH, relativePath));
    return true;
  } catch {
    return false;
  }
}

export function getPublicUrl(relativePath: string): string {
  return `/api/files/${relativePath}`;
}
```

**Create file serving endpoint** `app/api/files/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || '/app/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  // Add authentication check here
  
  const filePath = path.join(STORAGE_PATH, ...params.path);
  
  // Security: ensure path is within storage directory
  if (!filePath.startsWith(STORAGE_PATH)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  
  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
```

### Step 4: Update Database Connection

**Update `lib/db.ts` or equivalent:**

```typescript
import { Pool } from 'pg';

// For Docker deployment, use internal network hostname
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Docker internal: postgresql://postgres:password@db:5432/regulatory_intel
  // Non-Docker: postgresql://postgres:password@localhost:5432/regulatory_intel
});

export default pool;
```

**Or if using Drizzle/Prisma, update the connection string in the config.**

### Step 5: Set Up Cron Jobs

**Option A: Host system crontab (recommended for simplicity)**

```bash
# Edit crontab
crontab -e

# Add regulatory monitoring (every 15 minutes)
*/15 * * * * curl -X POST http://localhost:3001/api/cron/check-regulatory-sources \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  >> /mnt/raid/regulatory-intel/logs/cron.log 2>&1

# Daily database backup (2 AM)
0 2 * * * docker exec regulatory-intel-db pg_dump -U postgres regulatory_intel \
  > /mnt/raid/regulatory-intel/backups/daily-$(date +\%Y\%m\%d).sql 2>&1
```

**Option B: Dedicated cron container**

Add to `docker-compose.yml`:

```yaml
  cron:
    container_name: regulatory-intel-cron
    image: alpine:latest
    command: crond -f -d 8
    volumes:
      - ./crontab:/etc/crontabs/root:ro
    networks:
      - regulatory-intel-network
```

Create `crontab` file:

```
*/15 * * * * wget -q -O - --header="Authorization: Bearer ${CRON_SECRET}" \
  http://app:3000/api/cron/check-regulatory-sources
```

### Step 6: Build and Deploy

```bash
# Navigate to application directory
cd /path/to/regulatory-intel

# Build Docker images
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Verify database connection
docker exec regulatory-intel-app node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query('SELECT NOW()').then(r => console.log('DB OK:', r.rows[0])).catch(console.error);
"
```

### Step 7: Configure Reverse Proxy (if needed)

If using nginx or Caddy for SSL/routing:

**Nginx config snippet:**
```nginx
server {
    listen 443 ssl;
    server_name regulatory-intel.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Verification Checklist

After migration, verify:

- [ ] Application accessible at configured port/URL
- [ ] Database queries working (check document list loads)
- [ ] File uploads working (test document upload)
- [ ] File downloads working (test PPTX/PDF download)
- [ ] Cron jobs executing (check logs after 15 min)
- [ ] Federal Register monitoring working (wait for next check cycle)
- [ ] Both organizations working:
  - [ ] Jayson's team can access and get PPTX outputs
  - [ ] Catalyst can access and get PDF memos
- [ ] Backups being created on schedule

---

## Rollback Plan

If migration fails:

1. Stop Docker containers: `docker-compose down`
2. Restore previous process management (PM2/systemd)
3. Point application back to original database
4. Restore original storage configuration

---

## Future Notes (Infrastructure Patterns)

For future applications on phaedrus:

1. **All apps should use Docker Compose** for consistent deployment
2. **All persistent data on RAID** at `/mnt/raid/<app-name>/`
3. **Standard directory structure:**
   ```
   /mnt/raid/<app-name>/
   ├── storage/     # Application files
   ├── database/    # Database data
   ├── backups/     # Automated backups
   └── logs/        # Application logs
   ```
4. **Use internal Docker network** for inter-container communication
5. **Don't expose database ports** to host unless necessary
6. **Host crontab** for simple scheduled tasks (easier debugging)
7. **Environment files** stored securely with restricted permissions

---

## Questions for Cory (if Claude Code needs clarification)

1. What port should the app be exposed on? (default: 3001)
2. Is there an existing nginx/Caddy reverse proxy setup?
3. Should the database continue using Supabase Cloud or migrate to local PostgreSQL?
4. Are there existing Docker containers on phaedrus to follow naming conventions from?
5. What's the RAID mount point path? (assumed: /mnt/raid/)

---

*End of Migration Specification*
