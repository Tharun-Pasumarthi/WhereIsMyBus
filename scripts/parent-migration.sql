-- ============================================================
-- Parent Role Migration
-- Run this in the Supabase SQL Editor AFTER the main schema
-- ============================================================

-- 1. Add 'parent' to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'parent';

-- 2. Create parent_students mapping table
CREATE TABLE IF NOT EXISTS public.parent_students (
  id         bigserial PRIMARY KEY,
  parent_id  uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  UNIQUE (parent_id, student_id)
);

-- 3. Seed example parent users (run AFTER creating accounts in Supabase Auth
--    or use the seed script below)
--
-- After creating parent users via Supabase Dashboard or seed script, link them:
--
--   INSERT INTO public.parent_students (parent_id, student_id)
--   VALUES ('<parent-uuid>', '<student-uuid>');
--
-- ============================================================
-- Seed helper: find student UUIDs by email
-- ============================================================
-- SELECT id, name, email FROM auth.users WHERE email LIKE 'student%@college.edu';
