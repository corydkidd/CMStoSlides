# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in project details:
   - **Name**: CMS Converter
   - **Database Password**: Generate a strong password (save it securely)
   - **Region**: Choose closest to your users
4. Wait for project to be created (~2 minutes)

## 2. Get Project Credentials

1. In your Supabase project dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

## 3. Set Up Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Fill in your Supabase credentials in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

## 4. Run Database Migrations

### Option A: Using Supabase SQL Editor (Recommended for initial setup)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20250101000000_initial_schema.sql`
5. Paste into the SQL editor
6. Click **Run** or press `Ctrl/Cmd + Enter`
7. Verify success (should see "Success. No rows returned")

### Option B: Using Supabase CLI

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link to your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Push migrations:
   ```bash
   supabase db push
   ```

## 5. Set Up Storage Buckets

1. Go to **Storage** in your Supabase dashboard
2. Create three buckets:

### Bucket: `uploads`
- **Name**: `uploads`
- **Public**: No (private)
- Click **Create bucket**

### Bucket: `outputs`
- **Name**: `outputs`
- **Public**: No (private)
- Click **Create bucket**

### Bucket: `templates`
- **Name**: `templates`
- **Public**: No (private)
- Click **Create bucket**

## 6. Configure Storage Policies

For each bucket, set up the following policies:

### `uploads` Bucket Policies

```sql
-- Users can upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can read from their own folder
CREATE POLICY "Users can read own uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can read all uploads
CREATE POLICY "Admins can read all uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'uploads' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);
```

### `outputs` Bucket Policies

```sql
-- Users can read from their own folder
CREATE POLICY "Users can read own outputs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'outputs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role can insert outputs
CREATE POLICY "Service can insert outputs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'outputs');

-- Admins can read all outputs
CREATE POLICY "Admins can read all outputs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'outputs' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);
```

### `templates` Bucket Policies

```sql
-- Admins can upload templates
CREATE POLICY "Admins can upload templates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'templates' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- Admins can update templates
CREATE POLICY "Admins can update templates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'templates' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- Users can read their own template
CREATE POLICY "Users can read own template"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'templates' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can read all templates
CREATE POLICY "Admins can read all templates"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'templates' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);
```

## 7. Configure Authentication

1. Go to **Authentication** > **Providers** in Supabase dashboard
2. Enable **Email** provider (for basic auth)
3. For SSO (if needed):
   - Go to **Authentication** > **Providers**
   - Enable and configure your SSO provider (Google, Azure AD, etc.)
   - Copy redirect URLs and configure in your SSO provider

## 8. Create First Admin User

After setting up authentication, you'll need to manually promote your first user to admin:

1. Sign up through your app (once authentication is implemented)
2. Go to **Authentication** > **Users** in Supabase dashboard
3. Find your user ID
4. Go to **SQL Editor** and run:
   ```sql
   UPDATE public.profiles
   SET is_admin = TRUE
   WHERE id = 'your-user-id-here';
   ```

## 9. Verify Setup

Run this query in SQL Editor to verify everything is set up:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should return:
-- conversion_jobs
-- description_documents
-- profiles

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- All tables should have rowsecurity = true
```

## 10. Test Connection

Once your environment variables are set, test the connection:

```bash
npm run dev
```

Check the browser console for any Supabase connection errors.

## Troubleshooting

### "relation does not exist" errors
- Make sure you ran the migration SQL successfully
- Check the SQL Editor for any error messages

### Authentication not working
- Verify environment variables are set correctly
- Check that `.env.local` is not committed to git (it's in `.gitignore`)
- Restart your dev server after changing environment variables

### Storage upload failures
- Verify storage buckets are created
- Check that storage policies are applied correctly
- Ensure RLS is enabled on storage.objects

## Next Steps

Once Supabase is set up:
- ✅ Database schema created
- ✅ RLS policies configured
- ✅ Storage buckets created
- ✅ Environment variables set
- → Ready to implement authentication and UI pages!
