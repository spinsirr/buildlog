-- Notifications table for in-app alerts
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  message text not null,
  link text, -- optional link to navigate to (e.g. /posts)
  read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

create policy "Users can manage own notifications" on public.notifications for all using (auth.uid() = user_id);

-- Index for fast unread count queries
create index idx_notifications_user_unread on public.notifications(user_id, read) where read = false;
