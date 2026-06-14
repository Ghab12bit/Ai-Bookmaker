-- Run this in the Supabase SQL Editor to set up the database

-- Profiles (team members only)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('designer', 'am')),
  created_at timestamptz not null default now()
);

-- Reviews
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_name text not null,
  stage text not null default 'internal' check (stage in ('internal', 'client')),
  status text not null default 'in_review' check (status in ('in_review', 'changes_requested', 'approved')),
  client_token text unique not null,
  client_link_active boolean not null default false,
  feedback_deadline timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- Versions
create table if not exists versions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  version_number int not null,
  file_url text not null,
  file_type text not null default 'image' check (file_type in ('image', 'pdf')),
  created_at timestamptz not null default now()
);

-- Pins
create table if not exists pins (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references versions(id) on delete cascade,
  x_pct float not null check (x_pct >= 0 and x_pct <= 100),
  y_pct float not null check (y_pct >= 0 and y_pct <= 100),
  author_type text not null check (author_type in ('designer', 'am', 'client')),
  author_name text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Comments
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references pins(id) on delete cascade,
  author_type text not null check (author_type in ('designer', 'am', 'client')),
  author_name text not null,
  body text not null,
  reference_url text,
  created_at timestamptz not null default now()
);

-- Feedback rounds
create table if not exists feedback_rounds (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  submitted_by_type text not null check (submitted_by_type in ('team', 'client')),
  submitted_at timestamptz not null default now()
);

-- RLS policies
alter table profiles enable row level security;
alter table reviews enable row level security;
alter table versions enable row level security;
alter table pins enable row level security;
alter table comments enable row level security;
alter table feedback_rounds enable row level security;

-- Team members can read all profiles
create policy "Team can read profiles" on profiles for select using (true);

-- Team members can read/write reviews
create policy "Team can read reviews" on reviews for select using (true);
create policy "Team can insert reviews" on reviews for insert with check (auth.uid() = created_by);
create policy "Team can update reviews" on reviews for update using (auth.uid() is not null);

-- Versions
create policy "Anyone can read versions" on versions for select using (true);
create policy "Team can insert versions" on versions for insert with check (auth.uid() is not null);

-- Pins - readable by anyone (client links use anon key)
create policy "Anyone can read pins" on pins for select using (true);
create policy "Anyone can insert pins" on pins for insert with check (true);
create policy "Anyone can update pins" on pins for update using (true);

-- Comments
create policy "Anyone can read comments" on comments for select using (true);
create policy "Anyone can insert comments" on comments for insert with check (true);

-- Feedback rounds
create policy "Anyone can read feedback_rounds" on feedback_rounds for select using (true);
create policy "Anyone can insert feedback_rounds" on feedback_rounds for insert with check (true);

-- Storage buckets
insert into storage.buckets (id, name, public) values ('designs', 'designs', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('references', 'references', true) on conflict do nothing;

-- Storage policies
create policy "Anyone can upload designs" on storage.objects for insert with check (bucket_id = 'designs');
create policy "Anyone can read designs" on storage.objects for select using (bucket_id = 'designs');
create policy "Anyone can upload references" on storage.objects for insert with check (bucket_id = 'references');
create policy "Anyone can read references" on storage.objects for select using (bucket_id = 'references');
