-- ============================================================
-- EDITABLE EMAIL TEMPLATES — run ONCE in Supabase SQL Editor.
-- Lets Cass edit the subject and wording of every automatic
-- email from her admin panel, without touching code.
--
-- If a template row is missing or blank, the app falls back to
-- the built-in default wording — so nothing can break.
-- ============================================================

create table if not exists email_templates (
  key         text primary key,          -- e.g. 'received', 'confirmed'
  subject     text,
  title       text,
  body        text,
  updated_at  timestamptz default now()
);

alter table email_templates enable row level security;

-- Only the logged-in admin can read or write these.
drop policy if exists "email templates admin" on email_templates;
create policy "email templates admin" on email_templates
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
