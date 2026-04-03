-- Add project_context column to store README/manifest summary for AI prompt injection
alter table public.connected_repos
  add column project_context text;
