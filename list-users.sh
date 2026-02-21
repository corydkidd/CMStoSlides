#!/bin/bash

# Script to list all users in the regulatory intelligence database

cd /home/coryk/server/regulatory-intel

echo "=== Regulatory Intelligence Platform - Current Users ==="
echo ""

docker compose exec -T db psql -U cms_converter -d cms_converter << 'SQL'
SELECT 
  u.email,
  u.name,
  u."authentikId",
  u.role,
  u."isActive",
  o.name as organization
FROM "User" u
LEFT JOIN organizations o ON u."organizationId"::uuid = o.id
ORDER BY o.name, u.email;
SQL
