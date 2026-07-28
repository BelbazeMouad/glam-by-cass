-- ============================================================
-- STUDIO SETTINGS — run ONCE in Supabase SQL Editor.
-- A single-row table Cass edits (phone, email, location, socials)
-- so the public contact page updates without touching code.
-- ============================================================

create table if not exists settings (
  id          int primary key default 1,
  phone       text default '(555) 123-4567',
  email       text default 'hello@glambycass.com',
  location    text default 'Los Angeles, CA',
  instagram   text default '',
  tiktok      text default '',
  updated_at  timestamptz default now(),
  constraint single_row check (id = 1)
);

-- seed the single row
insert into settings (id) values (1) on conflict (id) do nothing;

-- RLS: anyone can read (public contact page); only admin can edit
alter table settings enable row level security;
drop policy if exists "settings read" on settings;
create policy "settings read" on settings for select using (true);
drop policy if exists "settings write" on settings;
create policy "settings write" on settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
