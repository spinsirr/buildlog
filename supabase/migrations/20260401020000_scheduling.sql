-- Phase 1: Post scheduling and publish delay
-- Adds scheduled_at to posts, publish_delay_minutes to profiles

-- Add scheduled_at column to posts
alter table public.posts add column if not exists scheduled_at timestamptz;

-- Add publish_delay_minutes to profiles (0 = immediate, >0 = delay in minutes)
alter table public.profiles add column if not exists publish_delay_minutes integer default 0;

-- Index for efficient cron queries: find posts ready to publish
create index if not exists idx_posts_scheduled
  on public.posts (scheduled_at)
  where status = 'scheduled' and scheduled_at is not null;
