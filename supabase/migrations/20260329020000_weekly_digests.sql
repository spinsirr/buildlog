-- Weekly digest summaries, generated once per user per week
CREATE TABLE IF NOT EXISTS public.weekly_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL, -- Monday of the week
  summary text NOT NULL,
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;

-- Users can read own digests
CREATE POLICY "Users can read own digests"
  ON public.weekly_digests FOR SELECT
  USING (auth.uid() = user_id);

-- Public can read digests for changelog-enabled users
CREATE POLICY "Public can view changelog digests"
  ON public.weekly_digests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = weekly_digests.user_id
        AND profiles.changelog_enabled = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_weekly_digests_user_week
  ON public.weekly_digests (user_id, week_start DESC);
