# Advient Product Deployment Guide

**Version:** 1.0  
**Last Updated:** December 2025  
**Server:** phaedrus (home server)  
**Applies To:** All Advient Advisors web applications

---

## Overview

This guide documents how to deploy Advient products (like HTA Intelligence Platform) to phaedrus and make them publicly accessible via Cloudflare Tunnel. Claude Code runs directly on phaedrus for development and deployment.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                   │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE (advientadvisors.com)                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ DNS + Proxy     │  │ SSL Termination │  │ DDoS Protection │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           └────────────────────┼────────────────────┘                   │
│                                ▼                                        │
│                    Cloudflare Tunnel (cloudflared)                      │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           PHAEDRUS (Home Server)                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Docker Environment                           │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │   │
│  │  │ cloudflared  │  │ HTA Platform │  │ PostgreSQL   │           │   │
│  │  │ (tunnel)     │  │ (Next.js)    │  │ (database)   │           │   │
│  │  │ Port: N/A    │  │ Port: 3000   │  │ Port: 5432   │           │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │   │
│  │  │ Authentik    │  │ Heimdall     │  │ Future Apps  │           │   │
│  │  │ (auth)       │  │ (dashboard)  │  │              │           │   │
│  │  │ Port: 9000   │  │ Port: 8080   │  │ Port: 300X   │           │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Storage:                                                               │
│  - ~/server/          → Docker service configs                         │
│  - /data/             → RAID 10 array (persistent data)                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Current Services

| Service | Internal URL | External URL | Port |
|---------|--------------|--------------|------|
| Heimdall (Dashboard) | phaedrus.local:8080 | — (internal only) | 8080 |
| HTA Intelligence | phaedrus.local:3000 | hta.advientadvisors.com | 3000 |
| Authentik | phaedrus.local:9000 | auth.advientadvisors.com | 9000 |
| PostgreSQL | localhost:5432 | — (internal only) | 5432 |
| Plex | phaedrus.local:32400 | — (internal only) | 32400 |

---

## Server Details

| Component | Details |
|-----------|---------|
| **Server Name** | phaedrus |
| **Local Access** | phaedrus.local (via mDNS/Avahi) |
| **OS** | Ubuntu Desktop |
| **CPU** | AMD Ryzen 7 7700 |
| **RAM** | 64GB |
| **Storage** | RAID 10 array mounted at `/data` |
| **User** | coryk (in docker group, no sudo needed for Docker) |
| **Docker Services** | ~/server/[service-name]/ |
| **Persistent Data** | /data/[service-name]/ |

### SSH Access

```bash
ssh coryk@phaedrus.local
```

### Port Allocation Convention

| Range | Purpose |
|-------|---------|
| 3000-3099 | Next.js / Node.js applications |
| 5000-5099 | Python applications |
| 5432 | PostgreSQL |
| 8080-8099 | Utility services (Heimdall, etc.) |
| 9000-9099 | Auth services (Authentik) |
| 32400 | Plex |

---

## Deploying a New Advient Product

### Prerequisites

- SSH access to phaedrus
- Cloudflare account access (advientadvisors.com)
- Application code ready for containerization

---

### Phase 1: Application Setup on Phaedrus

#### 1.1 Create Directory Structure

```bash
# SSH into phaedrus
ssh coryk@phaedrus.local

# Create service directory
mkdir -p ~/server/[app-name]
cd ~/server/[app-name]

# If app needs persistent data on RAID:
sudo mkdir -p /data/[app-name]
sudo chown coryk:coryk /data/[app-name]
```

#### 1.2 Create Docker Compose File

Create `docker-compose.yml`:

```yaml
services:
  [app-name]:
    build: .
    container_name: [app-name]
    restart: unless-stopped
    ports:
      - "300X:3000"  # Choose next available port
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@host:5432/dbname
    volumes:
      - /data/[app-name]:/app/data  # If persistent storage needed
    networks:
      - web

networks:
  web:
    external: true
```

#### 1.3 Create Dockerfile (for Next.js apps)

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Note:** For standalone output, add to `next.config.js`:

```javascript
module.exports = {
  output: 'standalone',
}
```

#### 1.4 Database Setup (if needed)

**Option A: Shared PostgreSQL instance**

If using the existing PostgreSQL container:

```bash
# Connect to existing postgres
docker exec -it postgres psql -U postgres

# Create database and user
CREATE DATABASE [app_name];
CREATE USER [app_user] WITH PASSWORD '[secure_password]';
GRANT ALL PRIVILEGES ON DATABASE [app_name] TO [app_user];
\q
```

**Option B: Dedicated PostgreSQL in same compose file**

```yaml
services:
  [app-name]:
    # ... app config ...
    depends_on:
      - db
    environment:
      - DATABASE_URL=postgresql://[app_user]:[password]@db:5432/[app_name]

  db:
    image: postgres:16-alpine
    container_name: [app-name]-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: [app_user]
      POSTGRES_PASSWORD: [password]
      POSTGRES_DB: [app_name]
    volumes:
      - /data/[app-name]/postgres:/var/lib/postgresql/data
    networks:
      - web
```

#### 1.5 Build and Start

```bash
cd ~/server/[app-name]

# Build the image
docker compose build

# Start the service
docker compose up -d

# Check logs
docker compose logs -f

# Verify it's running
curl http://localhost:300X
```

---

### Phase 2: Cloudflare Tunnel Configuration

#### 2.1 Add Public Hostname (Cloudflare Dashboard Method)

**You (Cory) need to do this step manually:**

1. Go to https://one.dash.cloudflare.com/
2. Navigate to: **Networks → Tunnels**
3. Click on your existing tunnel (the one serving hta.advientadvisors.com)
4. Click **Configure**
5. Go to **Public Hostname** tab
6. Click **Add a public hostname**
7. Fill in:
   - **Subdomain:** `[app-name]` (e.g., `contracts`, `tools`, `demo`)
   - **Domain:** `advientadvisors.com`
   - **Type:** `HTTP`
   - **URL:** `172.17.0.1:300X` (Docker host IP + your app's port)
   
   *Or if using Docker networks:* `[container-name]:3000`

8. Click **Save hostname**

#### 2.2 Verify DNS (Usually Automatic)

Cloudflare Tunnel typically creates the DNS record automatically. Verify:

1. Go to: **Cloudflare Dashboard → advientadvisors.com → DNS**
2. Confirm there's a CNAME record:
   - **Name:** `[app-name]`
   - **Target:** `[tunnel-id].cfargotunnel.com`
   - **Proxy status:** Proxied (orange cloud)

If not auto-created, add it manually:
- **Type:** CNAME
- **Name:** [app-name]
- **Target:** [your-tunnel-id].cfargotunnel.com
- **Proxy status:** Proxied

#### 2.3 Test External Access

```bash
# From any machine (not phaedrus)
curl -I https://[app-name].advientadvisors.com

# Should return HTTP 200
```

---

### Phase 3: Authentication (Optional)

If the app should require login:

#### 3.1 Add to Authentik

1. Go to: https://auth.advientadvisors.com/if/admin/
2. Navigate to: **Applications → Providers → Create**
3. Select **Proxy Provider**
4. Configure:
   - **Name:** `[App Name] Provider`
   - **External host:** `https://[app-name].advientadvisors.com`
5. Save

6. Navigate to: **Applications → Applications → Create**
7. Configure:
   - **Name:** `[App Display Name]`
   - **Slug:** `[app-name]`
   - **Provider:** Select the provider you just created
8. Save

9. Add group bindings for who can access

#### 3.2 Configure Cloudflare Access

**You (Cory) need to do this step manually:**

1. Go to: https://one.dash.cloudflare.com/
2. Navigate to: **Access → Applications → Add an application**
3. Select **Self-hosted**
4. Configure:
   - **Application name:** `[App Display Name]`
   - **Application domain:** `[app-name].advientadvisors.com`
5. Add policy:
   - **Policy name:** `Require Authentication`
   - **Action:** Allow
   - **Include:** Select your Authentik IdP
6. Save

---

## Example: Full HTA Platform Deployment

Here's how HTA Intelligence was deployed as reference:

### Directory Structure

```
~/server/hta-platform/
├── docker-compose.yml
├── Dockerfile
├── .env
├── package.json
├── next.config.js
├── src/
│   └── ... (application code)
└── prisma/
    └── schema.prisma

/data/hta-platform/
└── postgres/
    └── ... (PostgreSQL data files)
```

### docker-compose.yml

```yaml
services:
  app:
    build: .
    container_name: hta-platform
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://hta_user:${DB_PASSWORD}@db:5432/hta_intelligence
    depends_on:
      - db
    networks:
      - web

  db:
    image: postgres:16-alpine
    container_name: hta-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: hta_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: hta_intelligence
    volumes:
      - /data/hta-platform/postgres:/var/lib/postgresql/data
    networks:
      - web

networks:
  web:
    external: true
```

### .env

```bash
DB_PASSWORD=your_secure_password_here
```

### Cloudflare Tunnel Config

| Field | Value |
|-------|-------|
| Subdomain | hta |
| Domain | advientadvisors.com |
| Type | HTTP |
| URL | 172.17.0.1:3000 |

---

## Common Operations

### View Logs

```bash
cd ~/server/[app-name]
docker compose logs -f
```

### Restart Service

```bash
cd ~/server/[app-name]
docker compose restart
```

### Update Application

```bash
cd ~/server/[app-name]

# Pull latest code (if using git)
git pull

# Rebuild and restart
docker compose build
docker compose up -d
```

### Stop Service

```bash
cd ~/server/[app-name]
docker compose down
```

### View All Running Containers

```bash
docker ps
```

### Check Resource Usage

```bash
docker stats
```

---

## Troubleshooting

### App not accessible externally

1. **Check container is running:**
   ```bash
   docker ps | grep [app-name]
   ```

2. **Check local access works:**
   ```bash
   curl http://localhost:300X
   ```

3. **Verify Cloudflare Tunnel route:**
   - Check Cloudflare Dashboard → Tunnels → Your Tunnel → Public Hostnames
   - Ensure the hostname is listed and URL is correct

4. **Check cloudflared logs:**
   ```bash
   docker logs cloudflared
   ```

5. **Verify DNS:**
   ```bash
   dig [app-name].advientadvisors.com
   ```

### Database connection issues

1. **Check database container is running:**
   ```bash
   docker ps | grep postgres
   ```

2. **Test connection:**
   ```bash
   docker exec -it [db-container] psql -U [user] -d [database]
   ```

3. **Check network connectivity:**
   ```bash
   docker network inspect web
   ```

### Container won't start

1. **Check logs:**
   ```bash
   docker compose logs [service-name]
   ```

2. **Check for port conflicts:**
   ```bash
   sudo lsof -i :[port]
   ```

3. **Verify Dockerfile builds:**
   ```bash
   docker compose build --no-cache
   ```

---

## Checklist for New Deployments

### Claude Code Tasks (on phaedrus)
```
□ Create ~/server/[app-name]/ directory
□ Create docker-compose.yml
□ Create Dockerfile (if building from source)
□ Create .env file with secrets
□ Set up database (if needed)
□ Build and start containers
□ Verify local access (curl localhost:PORT)
□ Test the application functionality
```

### Manual Steps (Cory)
```
□ Add public hostname in Cloudflare Tunnel dashboard
□ Verify DNS record exists (or create CNAME)
□ Test external access (https://[app].advientadvisors.com)
□ Add to Authentik (if auth required)
□ Add to Cloudflare Access (if auth required)
□ Add to Heimdall dashboard (optional)
□ Update this documentation with new service
```

---

## Security Notes

1. **Never commit .env files** to git repositories
2. **Use strong passwords** for databases (generate with `openssl rand -hex 16`)
3. **Keep containers updated** — periodically run `docker compose pull`
4. **Cloudflare provides:**
   - SSL/TLS termination (always HTTPS)
   - DDoS protection
   - WAF (Web Application Firewall) on paid plans
5. **Internal services** (Heimdall, Plex) should NOT be exposed via Cloudflare Tunnel

---

## Contact

For questions about deployments or server issues:

**Cory Kidd**  
Advient Advisors  
cory@advientadvisors.com

---

*This guide is maintained by Advient Advisors. Last updated December 2025.*
