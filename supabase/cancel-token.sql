-- ============================================================
-- CLIENT CANCELLATION — run ONCE in Supabase SQL Editor.
-- Adds a secret token to each booking so clients can cancel
-- from a private link in their email (no account needed).
-- ============================================================

-- 1) Enable the extension that generates random UUIDs (usually already on)
create extension if not exists "pgcrypto";

-- 2) Add the token column. Each booking gets its own unguessable code.
alter table bookings add column if not exists cancel_token uuid default gen_random_uuid();

-- 3) Backfill any existing bookings that don't have one yet
update bookings set cancel_token = gen_random_uuid() where cancel_token is null;

-- 4) Track when/why it was cancelled
alter table bookings add column if not exists cancelled_at timestamptz;
alter table bookings add column if not exists cancelled_by text; -- 'client' or 'admin'

-- 5) Index so looking up by token is fast
create index if not exists bookings_cancel_token_idx on bookings(cancel_token);
