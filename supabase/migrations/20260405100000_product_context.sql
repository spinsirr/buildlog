-- Product context: structured product narrative for AI decision and generation.
-- Separate from connected_repos.project_context (auto-generated from README/manifest).
-- This is user-curated + AI-maintained persistent narrative state.

create table public.product_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  repo_id uuid references public.connected_repos(id) on delete cascade not null,

  -- Product narrative (user-curated)
  product_summary text,
  target_audience text,
  current_narrative text,
  topics_to_emphasize text[],
  topics_to_avoid text[],

  -- AI-maintained context (updated after each generation)
  last_post_angle text,
  narrative_thread jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, repo_id)
);

alter table public.product_context enable row level security;

create policy "Users manage own product context"
  on public.product_context for all using (auth.uid() = user_id);

create index idx_product_context_user_repo
  on public.product_context (user_id, repo_id);
