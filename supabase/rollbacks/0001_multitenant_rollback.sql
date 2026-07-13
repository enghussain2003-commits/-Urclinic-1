-- =====================================================================
-- CareClinic Multi-Tenant Migration — ROLLBACK for 0001
-- =====================================================================
-- Use this ONLY to undo 0001 on a branch/staging project.
--
-- IMPORTANT: 0001 used a "clean start" that DROPPED the old test tables.
-- This rollback removes the NEW multi-tenant objects. It does NOT restore
-- the old data — that is recovered from the pre-migration BACKUP
-- (see README "Backup" step). Restoring the backup is the real rollback;
-- this script is for tearing down a failed/partial apply before restore.
-- =====================================================================

begin;

-- Disable + drop policies implicitly by dropping the tables.
drop table if exists public.notifications    cascade;
drop table if exists public.medical_files     cascade;
drop table if exists public.medical_history   cascade;
drop table if exists public.appointments      cascade;
drop table if exists public.patients          cascade;
drop table if exists public.doctors           cascade;
drop table if exists public.profiles          cascade;
drop table if exists public.clinics           cascade;

-- Drop functions / hook / triggers created by 0001.
-- (Per-table triggers are dropped automatically with their tables above.)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user()                cascade;
drop function if exists public.custom_access_token_hook(jsonb)  cascade;
drop function if exists public.current_clinic_id()              cascade;
drop function if exists public.current_user_role()              cascade;
drop function if exists public.is_super_admin()                 cascade;
drop function if exists public.doctor_in_clinic(uuid, uuid)     cascade;
drop function if exists public.patient_in_clinic(uuid, uuid)    cascade;
drop function if exists public.profile_in_clinic(uuid, uuid)    cascade;
drop function if exists public.is_my_patient(uuid)              cascade;
drop function if exists public.is_my_doctor(uuid)               cascade;
drop function if exists public.doctor_treats_patient(uuid)      cascade;
drop function if exists public.enforce_clinic_id_immutable()    cascade;

-- Revert the role enum to its original 3 values.
drop type if exists user_role cascade;
create type user_role as enum ('patient', 'employee', 'admin');

commit;

-- After this: restore the pre-migration backup to bring back the old
-- schema + data (profiles, doctors, appointments, bookings, ...).
-- Then, in Dashboard → Authentication → Hooks, DISABLE the access-token hook.
