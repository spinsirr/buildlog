-- Add x_premium column to profiles for X Premium longer post support
alter table profiles
  add column if not exists x_premium boolean not null default false;
