-- Consolidate migrations 002-009 + indexes into one idempotent migration.
-- All statements use IF NOT EXISTS / IF EXISTS so this is safe to run
-- against a DB that already has some of these changes applied manually.

-- ============================================================
-- 003: GitHub App installation ID + cleanup
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS github_installation_id bigint;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS github_token;

ALTER TABLE public.connected_repos
  DROP COLUMN IF EXISTS webhook_secret;

ALTER TABLE public.connected_repos
  DROP COLUMN IF EXISTS webhook_id;

-- ============================================================
-- 004: Subscriptions
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_stripe_customer_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_stripe_customer_id_key UNIQUE (stripe_customer_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  status text NOT NULL DEFAULT 'inactive',
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own subscription' AND tablename = 'subscriptions'
  ) THEN
    CREATE POLICY "Users can read own subscription" ON public.subscriptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 005: Post publish fields
-- ============================================================
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS platform_post_id text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS platform_post_url text;

-- ============================================================
-- 006: User settings (tone, auto_publish)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tone text DEFAULT 'casual';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_publish boolean DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tone_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_tone_check
      CHECK (tone IN ('casual', 'professional', 'technical'));
  END IF;
END $$;

-- ============================================================
-- 007: Notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own notifications' AND tablename = 'notifications'
  ) THEN
    CREATE POLICY "Users can manage own notifications" ON public.notifications
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, read) WHERE read = false;

-- ============================================================
-- 008: Dedupe index
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_dedupe_key
  ON public.posts (user_id, (source_data->>'_dedupe_key'))
  WHERE source_data->>'_dedupe_key' IS NOT NULL;

-- ============================================================
-- 009: Email notifications
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true;

-- ============================================================
-- Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_user_status ON posts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_user_source_type ON posts (user_id, source_type);
CREATE INDEX IF NOT EXISTS idx_posts_user_created_desc ON posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_connections_user_platform ON platform_connections (user_id, platform);
