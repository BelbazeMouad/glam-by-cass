-- ============================================================
-- GLAM BY CASS — Database schema
-- Run this in Supabase > SQL Editor (paste all, click Run).
-- ============================================================

-- ---------- SERVICES (Cass edits price + deposit in admin) ----------
create table if not exists services (
  id            bigint generated always as identity primary key,
  name          text not null,
  description   text,
  duration_min  int  default 90,
  price         numeric(10,2) not null default 0,   -- full price
  deposit       numeric(10,2) not null default 0,   -- deposit to book
  sort_order    int  default 0,
  active        boolean default true,
  created_at    timestamptz default now()
);

-- ---------- CLIENT REELS (portfolio videos) ----------
create table if not exists reels (
  id            bigint generated always as identity primary key,
  client_name   text,
  service       text,
  look          text,
  video_url     text,
  thumbnail_url text,
  sort_order    int default 0,
  published     boolean default true,
  created_at    timestamptz default now()
);

-- ---------- BOOKINGS ----------
create table if not exists bookings (
  id             bigint generated always as identity primary key,
  client_name    text not null,
  client_email   text,
  client_phone   text,
  service_id     bigint references services(id),
  service_name   text,               -- snapshot in case service is edited/deleted
  booking_date   date not null,
  booking_time   text,               -- e.g. '10:00'
  deposit_amount numeric(10,2),
  status         text default 'pending',  -- pending | confirmed | cancelled
  stripe_session text,
  paid           boolean default false,
  notes          text,
  created_at     timestamptz default now()
);
create index if not exists bookings_date_idx on bookings(booking_date);

-- ---------- DAYS OFF (Cass manually blocks days) ----------
create table if not exists days_off (
  id         bigint generated always as identity primary key,
  off_date   date not null unique,
  reason     text,
  created_at timestamptz default now()
);

-- ---------- MESSAGES (contact form) ----------
create table if not exists messages (
  id         bigint generated always as identity primary key,
  from_name  text,
  from_email text,
  body       text,
  handled    boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Public can READ what visitors need; only logged-in admin can write.
-- Bookings/messages: public can INSERT (to book / send message) but not read.
-- ============================================================
alter table services  enable row level security;
alter table reels     enable row level security;
alter table bookings  enable row level security;
alter table days_off  enable row level security;
alter table messages  enable row level security;

-- SERVICES: anyone can read active services; only authenticated can change
drop policy if exists "services read" on services;
create policy "services read" on services for select using (active = true or auth.role() = 'authenticated');
drop policy if exists "services write" on services;
create policy "services write" on services for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- REELS: anyone reads published; admin writes
drop policy if exists "reels read" on reels;
create policy "reels read" on reels for select using (published = true or auth.role() = 'authenticated');
drop policy if exists "reels write" on reels;
create policy "reels write" on reels for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- DAYS OFF: anyone can read (so calendar shows blocked days); admin writes
drop policy if exists "daysoff read" on days_off;
create policy "daysoff read" on days_off for select using (true);
drop policy if exists "daysoff write" on days_off;
create policy "daysoff write" on days_off for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- BOOKINGS: public can INSERT (create a booking); only admin can read/update/delete.
-- A public "read" policy exposes only date+status so the calendar can grey out taken days (via the view below).
drop policy if exists "bookings insert" on bookings;
create policy "bookings insert" on bookings for insert with check (true);
drop policy if exists "bookings admin" on bookings;
create policy "bookings admin" on bookings for select using (auth.role() = 'authenticated');
drop policy if exists "bookings update" on bookings;
create policy "bookings update" on bookings for update using (auth.role() = 'authenticated');
drop policy if exists "bookings delete" on bookings;
create policy "bookings delete" on bookings for delete using (auth.role() = 'authenticated');

-- MESSAGES: public inserts, admin reads
drop policy if exists "messages insert" on messages;
create policy "messages insert" on messages for insert with check (true);
drop policy if exists "messages admin" on messages;
create policy "messages admin" on messages for all using (auth.role() = 'authenticated');

-- ============================================================
-- PUBLIC AVAILABILITY VIEW
-- Exposes ONLY which dates are unavailable (booked+paid OR day off),
-- so the public calendar can show busy days without leaking client info.
-- ============================================================
create or replace view public_unavailable_dates as
  select booking_date as date from bookings where status <> 'cancelled' and paid = true
  union
  select off_date as date from days_off;

-- allow anon to read the view
grant select on public_unavailable_dates to anon, authenticated;

-- ============================================================
-- SEED: starter services (Cass can edit these in the admin panel)
-- ============================================================
insert into services (name, description, duration_min, price, deposit, sort_order) values
  ('Bridal Makeup',    'Trial + wedding-day application. Long-wear, photo-ready.', 180, 180, 40, 1),
  ('Special Occasion', 'Parties, galas, birthdays. A polished look that lasts all night.', 90, 90, 25, 2),
  ('Photoshoot',       'Editorial & on-set makeup, per look, built for the camera.', 120, 120, 30, 3),
  ('Glam Class',       'A 1-on-1 lesson to master your own everyday or evening glam.', 60, 70, 20, 4)
on conflict do nothing;

insert into reels (client_name, service, look, sort_order) values
  ('Amina','Bridal','Soft glam',1),
  ('Lina','Photoshoot','Bold editorial',2),
  ('Sara','Special Occasion','Warm glow',3)
on conflict do nothing;
