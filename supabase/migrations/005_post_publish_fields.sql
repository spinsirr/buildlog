-- Add columns for tracking published post details per platform
alter table public.posts add column if not exists platform_post_id text;
alter table public.posts add column if not exists platform_post_url text;
