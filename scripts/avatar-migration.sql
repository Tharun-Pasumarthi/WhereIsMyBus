-- Add avatar_url to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- Create Supabase Storage bucket for avatars (public)
-- Run once; if it already exists this is a no-op
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,   -- 2 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: anyone can read avatars (public bucket)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Service-role key used in API routes bypasses RLS for uploads/deletes
