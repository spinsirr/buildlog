-- Decision layer: stores structured AI decisions about whether to generate a post
-- Feature flag on profiles gates the behavior (default off)

-- Feature flag column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS decision_layer_enabled boolean NOT NULL DEFAULT false;

-- Decision history table
CREATE TABLE post_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  repo_id uuid REFERENCES connected_repos(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_data jsonb,
  dedupe_key text,
  decision text NOT NULL CHECK (decision IN ('post', 'skip', 'bundle_later')),
  reason text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  angle text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying a user's decision history
CREATE INDEX idx_post_decisions_user_created ON post_decisions (user_id, created_at DESC);

-- RLS
ALTER TABLE post_decisions ENABLE ROW LEVEL SECURITY;

-- Users can read their own decisions
CREATE POLICY "Users can read own decisions"
  ON post_decisions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role inserts (Edge Functions use service role key, bypasses RLS)
-- No insert policy needed for regular users — decisions are system-generated
