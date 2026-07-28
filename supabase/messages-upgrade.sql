-- Run this ONCE in Supabase SQL Editor to enable message replies.
-- Adds a column to store Cass's reply and whether the message was read.

alter table messages add column if not exists reply text;
alter table messages add column if not exists replied_at timestamptz;
alter table messages add column if not exists read boolean default false;
