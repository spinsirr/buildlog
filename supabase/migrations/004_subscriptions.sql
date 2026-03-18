-- Add Stripe customer ID to profiles
alter table public.profiles
  add column if not exists stripe_customer_id text unique;

-- Subscriptions table
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive', -- 'active', 'inactive', 'past_due', 'canceled'
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;
create policy "Users can read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);
