-- Agent memory: durable product context that the agent builds over time.
-- Each repo gets its own memory entries (product identity, narrative, audience patterns).
-- The agent reads and writes this table via tools during decision-making.

CREATE TABLE agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  repo_id uuid REFERENCES connected_repos(id) ON DELETE SET NULL,
  key text NOT NULL,
  value text NOT NULL,
  category text NOT NULL CHECK (category IN ('product_identity', 'narrative', 'audience', 'pattern')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, repo_id, key)
);

-- Index for agent tool queries
CREATE INDEX idx_agent_memory_user_repo ON agent_memory (user_id, repo_id, updated_at DESC);

-- RLS
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

-- Users can read their own memory (for future dashboard display)
CREATE POLICY "Users can read own memory"
  ON agent_memory FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (edge functions + API routes) handles inserts/updates via upsert

-- Enhance post_decisions with agent reasoning trace
ALTER TABLE post_decisions ADD COLUMN IF NOT EXISTS reasoning_trace jsonb;
ALTER TABLE post_decisions ADD COLUMN IF NOT EXISTS agent_model text;
ALTER TABLE post_decisions ADD COLUMN IF NOT EXISTS step_count integer;
