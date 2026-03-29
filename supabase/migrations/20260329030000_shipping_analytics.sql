-- Add structured shipping data to posts for changelog + agent API
alter table posts add column if not exists category text;
alter table posts add column if not exists change_summary text;

-- Index for efficient changelog queries (by user, category, date)
create index if not exists idx_posts_user_category on posts (user_id, category, created_at desc);

-- Comment for clarity
comment on column posts.category is 'AI-classified change type: feature, fix, improvement, infra, docs, performance, ui';
comment on column posts.change_summary is 'Human-readable summary of what changed, suitable for changelogs and agent consumption';
