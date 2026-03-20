-- Add email notification preference to profiles (default: enabled)
alter table public.profiles add column email_notifications boolean default true;
