-- 0004 — Prescriptions table + real notification creation policy.
--
-- Additive and idempotent. Adds:
--   1. public.prescriptions (clinic-scoped medical prescriptions written by doctors/staff)
--   2. RLS so a clinic only sees its own prescriptions and a patient sees their own
--   3. A broadened notifications INSERT policy so the app can create the per-user
--      notifications described in the product spec (approve/reject → patient,
--      new booking → doctor, new prescription → patient).
--
-- No existing table is altered destructively. Safe to re-run.

-- =====================================================================
-- 1. prescriptions
--    patient_id / doctor_id are profile ids (profiles.id == auth uid), matching how
--    the React app already keys medical records. Left without strict FKs so a loose
--    legacy id never blocks an insert; clinic isolation is enforced by RLS below.
-- =====================================================================
create table if not exists public.prescriptions (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid references public.clinics(id) on delete cascade,
  patient_id      uuid not null,
  doctor_id       uuid,
  diagnosis       text,
  medicines       jsonb not null default '[]'::jsonb,
  instructions    text,
  prescribed_date date not null default current_date,
  created_at      timestamptz not null default now()
);

create index if not exists idx_prescriptions_patient on public.prescriptions(patient_id);
create index if not exists idx_prescriptions_clinic  on public.prescriptions(clinic_id);

alter table public.prescriptions enable row level security;

-- Read: super_admin everywhere; clinic staff/doctor within their clinic; the patient their own.
drop policy if exists rx_select on public.prescriptions;
create policy rx_select on public.prescriptions for select
  using (
    is_super_admin()
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee','doctor'))
    or patient_id = auth.uid()
  );

-- Write (insert/update/delete): super_admin, or clinic staff/doctor inside their own clinic.
drop policy if exists rx_write on public.prescriptions;
create policy rx_write on public.prescriptions for all
  using (
    is_super_admin()
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee','doctor'))
  )
  with check (
    is_super_admin()
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee','doctor'))
  );

-- =====================================================================
-- 2. notifications INSERT policy (broaden)
--    The spec routes notifications across users: staff approve/reject → patient,
--    patient books → doctor, doctor prescribes → patient. So any authenticated app
--    user may CREATE a notification. Privacy is preserved by notif_select, which is
--    unchanged and still returns only rows where user_id = auth.uid().
-- =====================================================================
drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert
  with check (
    is_super_admin()
    or current_user_role() in ('clinic_admin','employee','doctor','patient')
  );
