-- =====================================================================
-- CareClinic Multi-Tenant — STAGING / BRANCH TEST DATA  (seed)
-- =====================================================================
--  ⚠️  STAGING / BRANCH ONLY.  DO NOT RUN ON PRODUCTION.
--
--  PRE-REQS:
--    * 0001_multitenant.sql already applied on this branch.
--    * The Custom Access Token Hook is enabled (so JWTs carry clinic_id/role).
--
--  WHAT THIS DOES:
--    Part A (pure SQL) — seeds two clinics with doctors / patients /
--    appointments / EHR, WITHOUT auth users. This is enough to test
--    cross-tenant DATA ISOLATION (run the queries in Part C as each role).
--
--    Part B (manual) — create the handful of Auth ACTORS (admin, employee,
--    doctor, patient per clinic) that the RLS Test Matrix logs in as.
--    Auth users cannot be created cleanly in plain SQL, so they are made via
--    the Auth API / Dashboard, then wired with the UPDATEs in Part B.
--
--  IDEMPOTENT: fixed UUIDs + ON CONFLICT DO NOTHING → safe to re-run.
--  CLEANUP: see Part D at the bottom.
-- =====================================================================

-- Light guard (not a hard stop): warns if this looks like a populated DB.
do $$
begin
  if (select count(*) from public.clinics) > 5 then
    raise notice 'clinics table is non-trivial — make sure this is STAGING, not production.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- PART A — pure-SQL test data (no auth users required)
-- ---------------------------------------------------------------------

-- Two tenants
insert into public.clinics (id, name, address, phone) values
  ('11111111-1111-1111-1111-111111111111', 'Clinic Alpha', 'Baghdad - Karrada',  '+964 770 000 0001'),
  ('22222222-2222-2222-2222-222222222222', 'Clinic Beta',  'Basra - Ashar',      '+964 770 000 0002')
on conflict (id) do nothing;

-- Doctors (no login yet → profile_id NULL; gives Dr. Ali a login in Part B)
insert into public.doctors (id, clinic_id, full_name, email, specialty, clinic_address, fee, open_time, close_time, break_start, break_end, work_days) values
  ('d1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Dr. Ali Hassan',  'ali@alpha.test',  'cardiology', 'Karrada St 1', 50, '09:00','17:00','13:00','14:00', array['sat','sun','mon','tue','wed','thu']),
  ('d1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Dr. Sara Mahdi',  'sara@alpha.test', 'pediatrics', 'Karrada St 1', 40, '10:00','18:00', null, null,        array['sat','sun','mon','tue','wed']),
  ('d2222222-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Dr. Omar Salem',  'omar@beta.test',  'general',    'Ashar St 9',  35, '09:00','15:00','12:00','12:30', array['sun','mon','tue','wed','thu'])
on conflict (id) do nothing;

-- Patients (staff-created records → auth_user_id NULL; P1 gets a login in Part B)
insert into public.patients (id, clinic_id, full_name, phone, email, gender, date_of_birth) values
  ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Patient One (Alpha)',   '+964 771 111 1111', 'p1@alpha.test', 'male',   '1990-01-01'),
  ('a1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Patient Two (Alpha)',   '+964 771 111 1112', 'p2@alpha.test', 'female', '1995-05-05'),
  ('a2222222-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Patient Three (Beta)',  '+964 772 222 2221', 'p3@beta.test',  'male',   '1988-08-08')
on conflict (id) do nothing;

-- Appointments (doctor + patient must share the row's clinic — they do)
insert into public.appointments (id, clinic_id, patient_id, doctor_id, appointment_date, appointment_time, status, fee, paid, payment_method) values
  ('b1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'd1111111-0000-0000-0000-000000000001', current_date + 1, '09:30', 'pending',   50, false, 'cash'),
  ('b1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000002', 'd1111111-0000-0000-0000-000000000002', current_date + 1, '10:30', 'confirmed', 40, true,  'card'),
  ('b2222222-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'a2222222-0000-0000-0000-000000000003', 'd2222222-0000-0000-0000-000000000003', current_date + 2, '09:00', 'pending',   35, false, 'cash')
on conflict (id) do nothing;

-- EHR for an Alpha patient (to test patient/doctor/staff visibility)
insert into public.medical_history (id, clinic_id, patient_id, doctor_id, visit_date, diagnosis, notes) values
  ('c1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'd1111111-0000-0000-0000-000000000001', current_date - 7, 'Hypertension', 'Follow-up in 1 month')
on conflict (id) do nothing;

insert into public.medical_files (id, clinic_id, patient_id, file_url, file_type) values
  ('e1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'https://example.test/ecg.pdf', 'lab')
on conflict (id) do nothing;

-- =====================================================================
-- PART B — Auth ACTORS (run AFTER creating the auth users)
-- =====================================================================
-- Create these auth users first (Dashboard → Authentication → Add user,
-- or via the create-clinic-user Edge Function, or supabase.auth.admin.createUser):
--
--   alpha_admin@test.com     (will be clinic_admin of Clinic Alpha)
--   alpha_employee@test.com  (employee, Clinic Alpha)
--   ali@alpha.test           (doctor login for Dr. Ali, Clinic Alpha)
--   p1@alpha.test            (patient login for Patient One, Clinic Alpha)
--   beta_admin@test.com      (clinic_admin of Clinic Beta)
--
-- Then paste each new user's UUID below and run the wiring UPDATEs.
-- (auth.users IDs are shown in Dashboard → Authentication → Users.)
--
-- -- Clinic Alpha admin
-- update public.profiles set role='clinic_admin', clinic_id='11111111-1111-1111-1111-111111111111'
--   where id = '<ALPHA_ADMIN_AUTH_ID>';
--
-- -- Clinic Alpha employee
-- update public.profiles set role='employee', clinic_id='11111111-1111-1111-1111-111111111111'
--   where id = '<ALPHA_EMPLOYEE_AUTH_ID>';
--
-- -- Dr. Ali login → role doctor + link doctor record
-- update public.profiles set role='doctor', clinic_id='11111111-1111-1111-1111-111111111111'
--   where id = '<ALI_AUTH_ID>';
-- update public.doctors set profile_id='<ALI_AUTH_ID>'
--   where id = 'd1111111-0000-0000-0000-000000000001';
--
-- -- Patient One login → link patient record (role stays 'patient', clinic_id NULL)
-- update public.patients set auth_user_id='<P1_AUTH_ID>'
--   where id = 'a1111111-0000-0000-0000-000000000001';
--
-- -- Clinic Beta admin
-- update public.profiles set role='clinic_admin', clinic_id='22222222-2222-2222-2222-222222222222'
--   where id = '<BETA_ADMIN_AUTH_ID>';
--
-- -- Your own account as the platform super_admin (clinic_id stays NULL)
-- update public.profiles set role='super_admin', clinic_id=null
--   where id = '<YOUR_AUTH_ID>';
--
-- IMPORTANT: every actor must LOG OUT and LOG IN again after wiring, so the
-- access-token hook re-issues a JWT carrying the new role + clinic_id claims.

-- =====================================================================
-- PART C — Isolation checks (run while logged in as each actor)
-- =====================================================================
-- alpha_employee : select count(*) from public.patients;      -- expect 2 (Alpha only)
-- alpha_employee : select count(*) from public.appointments;  -- expect 2 (Alpha only)
-- beta_admin     : select count(*) from public.patients;      -- expect 1 (Beta only)
-- p1 (patient)   : select count(*) from public.patients;      -- expect 1 (self only)
-- ali (doctor)   : select count(*) from public.patients;      -- expect only patients he treats
-- super_admin    : select count(*) from public.clinics;       -- expect 2
-- alpha_employee : select * from public.appointments
--                    where clinic_id='22222222-2222-2222-2222-222222222222'; -- expect 0 rows
-- (Full 14-row matrix is in MULTITENANT_DESIGN.md §8.)

-- =====================================================================
-- PART D — Cleanup (remove seeded test data from the branch)
-- =====================================================================
-- delete from public.appointments    where id in ('b1111111-0000-0000-0000-000000000001','b1111111-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000003');
-- delete from public.medical_files    where id = 'e1111111-0000-0000-0000-000000000001';
-- delete from public.medical_history  where id = 'c1111111-0000-0000-0000-000000000001';
-- delete from public.patients         where id in ('a1111111-0000-0000-0000-000000000001','a1111111-0000-0000-0000-000000000002','a2222222-0000-0000-0000-000000000003');
-- delete from public.doctors          where id in ('d1111111-0000-0000-0000-000000000001','d1111111-0000-0000-0000-000000000002','d2222222-0000-0000-0000-000000000003');
-- delete from public.clinics          where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
