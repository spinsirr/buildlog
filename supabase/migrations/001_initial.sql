-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  github_username text,
  github_avatar_url text,
  created_at timestamptz default now()
);

-- Connected repos
create table public.connected_repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  github_repo_id bigint not null,
  full_name text not null, -- e.g. "user/repo"
  webhook_id bigint, -- GitHub webhook ID
  webhook_secret text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(user_id, github_repo_id)
);

-- Platform connections
-- NOTE: OAuth tokens (access_token, refresh_token) are stored as plaintext.
-- This is a known limitation. For production hardening, consider encrypting
-- these values at the application layer using AES-256-GCM before storage
-- and decrypting on read. Supabase column-level encryption (pgsodium/vault)
-- is another option. See: https://supabase.com/docs/guides/database/vault
create table public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  platform text not null, -- 'twitter', 'linkedin', 'bluesky'
  access_token text not null, -- TODO: encrypt at rest (see note above)
  refresh_token text, -- TODO: encrypt at rest (see note above)
  platform_user_id text,
  platform_username text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, platform)
);

-- Posts (draft/published)
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  repo_id uuid references public.connected_repos(id) on delete set null,
  source_type text not null, -- 'commit', 'pr', 'release', 'manual'
  source_data jsonb, -- raw GitHub event data
  content text not null, -- generated post content
  platforms text[] default '{}', -- target platforms
  status text default 'draft', -- 'draft', 'published', 'archived'
  published_at timestamptz,
  publish_results jsonb, -- results per platform
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.connected_repos enable row level security;
alter table public.platform_connections enable row level security;
alter table public.posts enable row level security;

create policy "Users can manage own profile" on public.profiles for all using (auth.uid() = id);
create policy "Users can manage own repos" on public.connected_repos for all using (auth.uid() = user_id);
create policy "Users can manage own connections" on public.platform_connections for all using (auth.uid() = user_id);
create policy "Users can manage own posts" on public.posts for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, github_username, github_avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
