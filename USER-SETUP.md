# User Setup Guide

This guide explains how to add users to the Regulatory Intelligence Platform.

## Overview

Users need to be created in two places:
1. **Authentik** - for authentication (SSO)
2. **Database** - for application access and organization membership

## Scripts Available

- `/home/coryk/server/regulatory-intel/add-users.sh` - Shows SQL commands to add users
- `/home/coryk/server/regulatory-intel/list-users.sh` - Lists all current users

## Workflow

### Step 1: Create Authentik Account

1. Log into Authentik Admin: https://sso.advientadvisors.com/if/admin/
2. Navigate to Directory > Users
3. Click "Create" to add a new user
4. Fill in:
   - Username: user's email (e.g., nancy@catalysthcc.com)
   - Name: user's full name
   - Email: user's email
   - Active: checked
5. Save the user
6. Go to the user's detail page and copy their **ID (UUID)** from the Overview section

### Step 2: Add User to Database

1. Run the add-users script to see the SQL commands:
   ```bash
   /home/coryk/server/regulatory-intel/add-users.sh
   ```

2. Copy the appropriate INSERT statement and replace `[AUTHENTIK_USER_ID]` with the actual UUID from Step 1

3. Execute the SQL command:
   ```bash
   cd /home/coryk/server/regulatory-intel
   docker compose exec -T db psql -U cms_converter -d cms_converter << 'ENDSQL'
   [Paste your INSERT statement here]
   ENDSQL
   ```

### Step 3: Verify User Was Added

```bash
/home/coryk/server/regulatory-intel/list-users.sh
```

## Current Organizations

- **Catalyst Healthcare Consulting** (slug: `catalyst`)
  - Nancy's organization
  
- **Health Policy Strategies** (slug: `health-policy-strategies`)
  - Jayson's organization
  - Cory's test account

## Example: Adding Nancy

1. Create Authentik account for nancy@catalysthcc.com
2. Copy her Authentik UUID (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
3. Run:
   ```bash
   cd /home/coryk/server/regulatory-intel
   docker compose exec -T db psql -U cms_converter -d cms_converter << 'ENDSQL'
   INSERT INTO "User" (id, email, name, "authentikId", role, "isActive", "organizationId", "createdAt", "updatedAt")
   VALUES (
     gen_random_uuid()::text,
     'nancy@catalysthcc.com',
     'Nancy',
     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
     'member',
     true,
     (SELECT id::text FROM organizations WHERE slug = 'catalyst'),
     NOW(),
     NOW()
   );
   ENDSQL
   ```
4. Verify with `list-users.sh`

## User Roles

- `admin` - Full access to all organizations and admin features
- `member` - Standard user access to their organization's data

## Notes

- The `authentikId` field links the database user to their Authentik account
- Users can only access data for their assigned organization
- The application uses Authentik for SSO, so users must exist in both places
