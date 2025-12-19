-- ============================================
-- Seed Data for Development
-- ============================================

-- Note: This file is for reference only.
-- To create test users, use the Supabase Admin API instead of manual SQL inserts.
-- This ensures passwords are properly hashed.

-- To create test users, run these curl commands:

-- Create regular test user:
-- curl -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
--   -H "apikey: YOUR_SERVICE_ROLE_KEY" \
--   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--   -H "Content-Type: application/json" \
--   -d '{
--     "email": "test@example.com",
--     "password": "testpass123",
--     "email_confirm": true,
--     "user_metadata": {
--       "full_name": "Test User"
--     }
--   }'

-- Create admin test user:
-- curl -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
--   -H "apikey: YOUR_SERVICE_ROLE_KEY" \
--   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--   -H "Content-Type: application/json" \
--   -d '{
--     "email": "admin@example.com",
--     "password": "testpass123",
--     "email_confirm": true,
--     "user_metadata": {
--       "full_name": "Admin User"
--     }
--   }'

-- Then set admin flag:
-- UPDATE public.profiles SET is_admin = true WHERE email = 'admin@example.com';

-- ============================================
-- Test Users (created via API):
-- ============================================
-- Regular User:
--   Email: test@example.com
--   Password: testpass123
--
-- Admin User:
--   Email: admin@example.com
--   Password: testpass123
-- ============================================
