-- ============================================================
-- EMAIL TEMPLATES — DIAGNOSE + FIX
-- Run this whole file in Supabase → SQL Editor.
-- Safe to run more than once.
-- ============================================================

-- STEP 1: create the table if it's missing
create table if not exists email_templates (
  key         text primary key,
  subject     text default '',
  title       text default '',
  body        text default '',
  updated_at  timestamptz default now()
);

-- STEP 2: make sure the columns allow empty values
alter table email_templates alter column subject drop not null;
alter table email_templates alter column title   drop not null;
alter table email_templates alter column body    drop not null;

-- STEP 3: reset the security policy
alter table email_templates enable row level security;

drop policy if exists "email templates admin" on email_templates;
drop policy if exists "email templates read"  on email_templates;
drop policy if exists "email templates write" on email_templates;

-- Logged-in admin (Cass) can do everything
create policy "email templates admin" on email_templates
  for all
  to authenticated
  using (true)
  with check (true);

-- STEP 4: check it worked — this should return your rows (may be empty at first)
select key, subject, left(coalesce(body,''), 60) as body_preview, updated_at
from email_templates
order by key;
