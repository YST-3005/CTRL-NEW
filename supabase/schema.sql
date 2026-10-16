-- Optional production schema for LabelLens Guardian.
-- Apply in the Supabase SQL editor after creating a project.
-- Demo mode does not require this.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product jsonb not null,
  phase text not null,
  saved boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  prefs jsonb not null,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.scans enable row level security;
alter table public.preferences enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own scans" on public.scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own prefs" on public.preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
