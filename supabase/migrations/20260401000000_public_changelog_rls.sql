-- Allow anonymous (public) read access to published posts for the changelog feature.
-- This enables /changelog/[username] to fetch published posts without authentication.

-- Published posts are publicly readable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Published posts are publicly readable' AND tablename = 'posts'
  ) THEN
    CREATE POLICY "Published posts are publicly readable" ON public.posts
      FOR SELECT USING (status = 'published');
  END IF;
END $$;

-- Public profile fields (github_username, github_avatar_url) are publicly readable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Profiles are publicly readable' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Profiles are publicly readable" ON public.profiles
      FOR SELECT USING (true);
  END IF;
END $$;

-- Connected repo names are publicly readable (needed to show repo name on changelog posts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Connected repos are publicly readable' AND tablename = 'connected_repos'
  ) THEN
    CREATE POLICY "Connected repos are publicly readable" ON public.connected_repos
      FOR SELECT USING (true);
  END IF;
END $$;

-- Index for efficient public changelog queries
CREATE INDEX IF NOT EXISTS idx_posts_user_published
  ON public.posts (user_id, published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_profiles_github_username
  ON public.profiles (github_username);
