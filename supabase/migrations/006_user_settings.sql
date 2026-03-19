-- Add user preferences to profiles
alter table public.profiles
  add column tone text default 'casual' check (tone in ('casual', 'professional', 'technical')),
  add column auto_publish boolean default false;
