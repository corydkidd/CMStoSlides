#!/bin/bash

# Script to add Nancy and Jayson to the regulatory intelligence database
# Run this after creating their Authentik accounts

set -e

cd /home/coryk/server/regulatory-intel

echo "=== Regulatory Intelligence Platform - User Setup ==="
echo ""
echo "Step 1: Current Organizations in Database..."
echo ""

docker compose exec -T db psql -U cms_converter -d cms_converter << 'SQL'
SELECT id, name, slug FROM organizations ORDER BY name;
SQL

echo ""
echo "=== Step 2: User Creation SQL Commands ==="
echo ""
echo "After creating Authentik accounts for Nancy and Jayson, get their user IDs from:"
echo "  Authentik Admin > Directory > Users > [user] > Overview > ID (UUID)"
echo ""
echo "Then run these commands (replace [AUTHENTIK_USER_ID] with actual UUIDs):"
echo ""
echo "--- Nancy (Catalyst Healthcare Consulting) ---"
cat << 'SQL'
INSERT INTO "User" (id, email, name, "authentikId", role, "isActive", "organizationId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'nancy@catalysthcc.com',
  'Nancy',
  '[AUTHENTIK_USER_ID]',
  'member',
  true,
  (SELECT id::text FROM organizations WHERE slug = 'catalyst'),
  NOW(),
  NOW()
);
SQL

echo ""
echo "--- Jayson (Health Policy Strategies) ---"
cat << 'SQL'
INSERT INTO "User" (id, email, name, "authentikId", role, "isActive", "organizationId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'jayson@healthpolicystrategiesllc.com',
  'Jayson',
  '[AUTHENTIK_USER_ID]',
  'member',
  true,
  (SELECT id::text FROM organizations WHERE slug = 'health-policy-strategies'),
  NOW(),
  NOW()
);
SQL

echo ""
echo "=== Step 3: To execute the SQL commands: ==="
echo ""
echo "cd /home/coryk/server/regulatory-intel"
echo "docker compose exec -T db psql -U cms_converter -d cms_converter << 'ENDSQL'"
echo "[Paste the INSERT statement with real Authentik user ID]"
echo "ENDSQL"
echo ""
echo "Example with a real Authentik ID:"
echo "docker compose exec -T db psql -U cms_converter -d cms_converter << 'ENDSQL'"
echo 'INSERT INTO "User" (id, email, name, "authentikId", role, "isActive", "organizationId", "createdAt", "updatedAt")'
echo "VALUES ("
echo "  gen_random_uuid()::text,"
echo "  'nancy@catalysthcc.com',"
echo "  'Nancy',"
echo "  '12345678-1234-1234-1234-123456789abc',  -- Replace with actual Authentik user ID"
echo "  'member',"
echo "  true,"
echo "  (SELECT id::text FROM organizations WHERE slug = 'catalyst'),"
echo "  NOW(),"
echo "  NOW()"
echo ");"
echo "ENDSQL"
echo ""
echo "=== Step 4: Verify users were added: ==="
echo "Run: /home/coryk/server/regulatory-intel/list-users.sh"
echo ""
