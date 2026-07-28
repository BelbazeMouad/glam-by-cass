-- ============================================================
-- REELS UPLOAD SUPPORT — run ONCE in Supabase SQL Editor.
-- Adds columns for uploaded video + thumbnail, and creates a
-- public storage bucket to hold the files.
-- ============================================================

-- 1) Extra columns on reels (safe if they already exist)
alter table reels add column if not exists thumbnail_url text;
-- (video_url already exists — it now holds either an uploaded file URL or a pasted link)

-- 2) Create a public storage bucket for reel media
insert into storage.buckets (id, name, public)
values ('reels', 'reels', true)
on conflict (id) do nothing;

-- 3) Storage policies:
--    anyone can VIEW files (public site plays them),
--    only logged-in admin (Cass) can upload/delete.
drop policy if exists "reels public read" on storage.objects;
create policy "reels public read" on storage.objects
  for select using (bucket_id = 'reels');

drop policy if exists "reels admin write" on storage.objects;
create policy "reels admin write" on storage.objects
  for insert with check (bucket_id = 'reels' and auth.role() = 'authenticated');

drop policy if exists "reels admin update" on storage.objects;
create policy "reels admin update" on storage.objects
  for update using (bucket_id = 'reels' and auth.role() = 'authenticated');

drop policy if exists "reels admin delete" on storage.objects;
create policy "reels admin delete" on storage.objects
  for delete using (bucket_id = 'reels' and auth.role() = 'authenticated');
