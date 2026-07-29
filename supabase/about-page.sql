-- ============================================================
-- EDITABLE ABOUT PAGE — run ONCE in Supabase SQL Editor.
-- Adds an `about` field to the settings table so Cass can edit
-- her About page text and photo from the admin panel.
--
-- Stored as JSON so new fields can be added later without
-- another migration. Safe to re-run.
-- ============================================================

alter table settings add column if not exists about jsonb;

-- Seed the current wording so nothing looks empty on first load.
-- Only fills it if it's still null (won't overwrite her edits).
update settings
set about = jsonb_build_object(
  'eyebrow',      'The Artist',
  'heading',      'About Cass',
  'tagline',      'It''s not just makeup. It''s a whole experience.',
  'p1',           'Cass is a Los Angeles-based makeup artist specialising in bridal, editorial and special-occasion glam. Every look is built around the person wearing it — enhancing natural features, never masking them.',
  'p2',           'From intimate one-on-one glam classes to full bridal parties and on-set editorial work, the goal is always the same: to help you feel luminous, confident, and entirely yourself.',
  'image_url',    '',
  'stat1_num',    '320+',
  'stat1_label',  'Clients',
  'stat2_num',    '5★',
  'stat2_label',  'Rated',
  'stat3_num',    '2021',
  'stat3_label',  'Since',
  'cta',          'Book a Session'
)
where id = 1 and about is null;

-- Show the result
select id, about from settings where id = 1;
