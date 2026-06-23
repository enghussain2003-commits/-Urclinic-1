-- 0003 — Visit lifecycle statuses for the Doctor Dashboard.
-- Adds 'in_progress' (Start visit) and 'completed' (Complete) to appointment_status.
--
-- Additive + idempotent: safe to re-run. Existing rows, RLS policies and the column
-- default ('pending') are unchanged. No data is modified.
--
-- NOTE: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block on PostgreSQL
-- < 12, and a newly added value cannot be referenced in the same transaction. The Supabase
-- CLI applies each migration file on its own, so no extra handling is needed here.
alter type appointment_status add value if not exists 'in_progress';
alter type appointment_status add value if not exists 'completed';
