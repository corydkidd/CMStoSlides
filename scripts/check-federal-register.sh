#!/bin/bash
# Federal Register Auto-Monitor Cron Script
# Runs every 15 minutes to check for new CMS documents

# Load environment variables
set -a
source /home/coryk/server/CMStoSlides/.env.local
set +a

# Call the cron endpoint
curl -X POST http://localhost:3000/api/cron/check-federal-register \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  >> /home/coryk/server/CMStoSlides/logs/federal-register-cron.log 2>&1

echo "" >> /home/coryk/server/CMStoSlides/logs/federal-register-cron.log
echo "---" >> /home/coryk/server/CMStoSlides/logs/federal-register-cron.log
