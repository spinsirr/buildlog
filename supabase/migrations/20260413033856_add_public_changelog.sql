-- Add opt-in flag for listing user's changelog in the public directory (/changelog).
-- The /changelog/[username] URL is always accessible; this flag only controls
-- whether the user appears in the public listing / featured sections / sitemap.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_changelog boolean NOT NULL DEFAULT true;

-- Index used by the /changelog directory page to list opted-in users
CREATE INDEX IF NOT EXISTS idx_profiles_public_changelog
  ON public.profiles (public_changelog)
  WHERE public_changelog = true;
