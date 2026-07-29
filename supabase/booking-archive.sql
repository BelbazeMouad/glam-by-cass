-- ============================================================
-- BOOKING ARCHIVE — run ONCE in Supabase SQL Editor.
-- Lets Cass tuck finished bookings out of sight without ever
-- deleting them. Archived bookings stay in the database (and in
-- her Excel exports), they're just hidden from the main list.
-- Safe to re-run.
-- ============================================================

alter table bookings add column if not exists archived boolean default false;
alter table bookings add column if not exists archived_at timestamptz;

-- Make sure nothing is null (older rows)
update bookings set archived = false where archived is null;

-- Faster filtering
create index if not exists bookings_archived_idx on bookings(archived);

select count(*) as total_bookings,
       count(*) filter (where archived) as archived_count
from bookings;
