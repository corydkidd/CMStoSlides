#!/bin/bash
# Conversion Jobs Processing Cron Script
# Runs every minute to process pending conversion jobs

# Load environment variables
set -a
source /home/coryk/server/CMStoSlides/.env.local
set +a

# Call the cron endpoint
curl -X POST http://localhost:3000/api/cron/process-jobs \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  >> /home/coryk/server/CMStoSlides/logs/process-jobs-cron.log 2>&1

echo "" >> /home/coryk/server/CMStoSlides/logs/process-jobs-cron.log
echo "---" >> /home/coryk/server/CMStoSlides/logs/process-jobs-cron.log
