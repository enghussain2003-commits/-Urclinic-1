-- 0006 — EHR metadata used by the staff patient profile UI.
--
-- public.medical_files originally stored only file_url and file_type, while the
-- React UI writes and displays file_name and description. Add those columns
-- idempotently so file uploads no longer fail with unknown-column errors.
--
-- The visit form also stores treatment and next_review_date, which were missing
-- from public.medical_history.

alter table public.medical_files
  add column if not exists file_name text,
  add column if not exists description text;

alter table public.medical_history
  add column if not exists treatment text,
  add column if not exists next_review_date date;
