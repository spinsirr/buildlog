-- Per-platform content overrides for a post.
-- Keys are platform ids from lib/platforms.ts (e.g. 'twitter', 'linkedin', 'bluesky').
-- Values are the content string to publish on that platform.
-- An absent key means "use posts.content as the fallback".

alter table posts
  add column platform_variants jsonb not null default '{}'::jsonb;
