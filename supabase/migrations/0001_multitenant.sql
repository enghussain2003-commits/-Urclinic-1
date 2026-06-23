-- =====================================================================
-- CareClinic → Multi-Tenant SaaS  | Forward Migration  (0001)
-- =====================================================================
-- STRATEGY: clean start (user chose to drop throwaway test data and keep
--           only their own auth account, re-seeded as super_admin).
--
-- SAFETY:
--   * Run on a Supabase BRANCH / STAGING project first — NOT production.
--   * Wrapped in a single transaction: all-or-nothing.
--   * A matching rollback lives in 0001_multitenant_rollback.sql.
--   * Does NOT touch auth.users (your login accounts survive).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Drop old objects (clean start). Order matters (dependents first).
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists check_double_booking on public.bookings;
drop trigger if exists booking_notify on public.bookings;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.prevent_double_booking() cascade;
drop function if exists public.notify_booking() cascade;

drop table if exists public.appointments cascade;
drop table if exists public.bookings cascade;
drop table if exists public.notifications cascade;
drop table if exists public.clinic_settings cascade;
drop table if exists public.doctors cascade;
drop table if exists public.profiles cascade;

-- Recreate the role enum with the final 5 roles.
drop type if exists user_role cascade;
create type user_role as enum ('super_admin', 'clinic_admin', 'employee', 'doctor', 'patient');

-- appointment_status already exists; keep it and add the 'rejected' value the
-- app uses for staff "reject" actions. (PG12+ allows ADD VALUE inside a tx as
-- long as the new value is not USED in the same tx — it is not used here.)
-- (pending, confirmed, completed, cancelled, no_show, rejected)
alter type appointment_status add value if not exists 'rejected';

-- ---------------------------------------------------------------------
-- 1. TENANT ROOT: clinics
-- ---------------------------------------------------------------------
create table public.clinics (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text,
  phone         text,
  working_hours jsonb default '{"start":"09:00","end":"20:00"}'::jsonb,
  default_appointment_duration int default 30,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. profiles  (1 row per auth user; carries role + clinic_id)
--    clinic_id: NOT NULL for staff/doctor (enforced by trigger),
--               NULL for super_admin and self-registered patients.
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  clinic_id   uuid references public.clinics(id) on delete restrict,
  full_name   text not null,
  email       text,
  phone_number text unique,
  role        user_role not null default 'patient',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. doctors  (clinic-scoped; linked to an Auth account via profile_id)
-- ---------------------------------------------------------------------
create table public.doctors (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references public.clinics(id) on delete cascade,
  profile_id    uuid unique references public.profiles(id) on delete set null,
  full_name     text not null,
  email         text,
  specialty     text default 'general',
  clinic_address text,
  fee           numeric default 0 check (fee >= 0),
  open_time     time default '09:00',
  close_time    time default '20:00',
  break_start   time,
  break_end     time,
  work_days     text[] default array['sat','sun','mon','tue','wed','thu'],
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. patients  (clinic-scoped; auth_user_id NULL = staff-created record)
-- ---------------------------------------------------------------------
create table public.patients (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references public.clinics(id) on delete cascade,
  auth_user_id  uuid references auth.users(id) on delete set null,
  full_name     text not null,
  phone         text,
  email         text,
  gender        text,
  date_of_birth date,
  created_at    timestamptz not null default now()
);
-- A given auth user maps to at most one patient record per clinic.
create unique index patients_clinic_auth_uniq
  on public.patients(clinic_id, auth_user_id) where auth_user_id is not null;
-- Prevent duplicate patient records with the same phone within one clinic.
create unique index patients_clinic_phone_uniq
  on public.patients(clinic_id, phone) where phone is not null;

-- ---------------------------------------------------------------------
-- 5. appointments  (consolidated; replaces appointments + bookings)
-- ---------------------------------------------------------------------
create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references public.clinics(id) on delete cascade,
  patient_id       uuid not null references public.patients(id) on delete cascade,
  -- RESTRICT (not CASCADE): a doctor with appointment history cannot be hard-
  -- deleted out from under the records. Use doctors.is_active = false to retire.
  doctor_id        uuid not null references public.doctors(id) on delete restrict,
  appointment_date date not null,
  appointment_time time not null,
  status           appointment_status not null default 'pending',
  payment_method   text,
  paid             boolean not null default false,
  fee              numeric default 0 check (fee >= 0),
  created_at       timestamptz not null default now()
);
-- Prevent double-booking the same doctor at the same slot.
create unique index appointments_doctor_slot_uniq
  on public.appointments(doctor_id, appointment_date, appointment_time);

-- ---------------------------------------------------------------------
-- 6. medical_history & medical_files (clinic-scoped EHR)
-- ---------------------------------------------------------------------
create table public.medical_history (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  patient_id  uuid not null references public.patients(id) on delete cascade,
  doctor_id   uuid references public.doctors(id) on delete set null,
  visit_date  date not null default current_date,
  diagnosis   text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table public.medical_files (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  patient_id  uuid not null references public.patients(id) on delete cascade,
  file_url    text not null,
  file_type   text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. notifications (clinic-scoped, targeted at a user)
-- ---------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid references public.clinics(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text,
  message     text,
  type        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- 8. INDEXES (tenant + hot query paths)
--    Every isolated table gets a clinic_id index because EVERY RLS check
--    and almost every query filters by clinic_id.
-- =====================================================================
create index idx_profiles_clinic        on public.profiles(clinic_id);
create index idx_doctors_clinic         on public.doctors(clinic_id);
create index idx_doctors_profile        on public.doctors(profile_id);
create index idx_patients_clinic        on public.patients(clinic_id);
create index idx_patients_auth          on public.patients(auth_user_id);
create index idx_appts_clinic           on public.appointments(clinic_id);
create index idx_appts_doctor           on public.appointments(doctor_id);
create index idx_appts_patient          on public.appointments(patient_id);
-- Composite: the dashboard lists "today's appointments for this clinic".
create index idx_appts_clinic_date      on public.appointments(clinic_id, appointment_date);
create index idx_mhistory_patient       on public.medical_history(patient_id);
create index idx_mhistory_clinic        on public.medical_history(clinic_id);
create index idx_mfiles_patient         on public.medical_files(patient_id);
create index idx_notifications_user     on public.notifications(user_id);

-- =====================================================================
-- 9. HELPER FUNCTIONS  (read JWT claims, never JOIN profiles in policies)
--    NOTE: named current_user_role() — "current_role" is a reserved word.
-- =====================================================================
create or replace function public.current_clinic_id()
returns uuid language sql stable security definer set search_path = public as $$
  select nullif(auth.jwt() ->> 'clinic_id', '')::uuid;
$$;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  -- Returns NULL for an unauthenticated request (no JWT), so an anonymous
  -- caller is never treated as a 'patient' by any policy branch.
  select case when auth.uid() is null then null
              else coalesce(auth.jwt() ->> 'user_role', 'patient') end;
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'user_role', '') = 'super_admin';
$$;

-- Cross-entity integrity helpers (used in WITH CHECK to stop a row being
-- written with a doctor/patient that belongs to a DIFFERENT clinic).
-- SECURITY DEFINER so the check runs regardless of the writer's own RLS view
-- of doctors/patients; STABLE; no profiles JOIN.
create or replace function public.doctor_in_clinic(p_doctor_id uuid, p_clinic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.doctors d
                 where d.id = p_doctor_id and d.clinic_id = p_clinic_id);
$$;

create or replace function public.patient_in_clinic(p_patient_id uuid, p_clinic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.patients p
                 where p.id = p_patient_id and p.clinic_id = p_clinic_id);
$$;

-- Ownership helpers (SECURITY DEFINER → bypass RLS on the referenced tables).
-- CRITICAL: these REPLACE inline cross-table subqueries inside policies.
-- Inline subqueries (e.g. "patient_id in (select ... from patients)") re-apply
-- the other table's RLS, and because patients<->appointments policies reference
-- each other, that caused "infinite recursion detected in policy". Wrapping the
-- lookups in DEFINER functions breaks the cycle (no RLS re-entry).
create or replace function public.is_my_patient(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.patients
                 where id = p_patient_id and auth_user_id = auth.uid());
$$;

create or replace function public.is_my_doctor(p_doctor_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.doctors
                 where id = p_doctor_id and profile_id = auth.uid());
$$;

create or replace function public.doctor_treats_patient(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.appointments a
                 join public.doctors d on d.id = a.doctor_id
                 where a.patient_id = p_patient_id and d.profile_id = auth.uid());
$$;

-- A doctor row's profile_id (if set) must belong to the same clinic — stops a
-- clinic_admin from linking an account from another clinic as their "doctor".
create or replace function public.profile_in_clinic(p_profile_id uuid, p_clinic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile_id is null
      or exists (select 1 from public.profiles
                 where id = p_profile_id and clinic_id = p_clinic_id);
$$;

-- =====================================================================
-- 10. CUSTOM ACCESS TOKEN HOOK  (injects clinic_id + user_role into JWT)
--     Enable it in Dashboard → Authentication → Hooks (see README step 4).
-- =====================================================================
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  claims  jsonb;
  v_role  text;
  v_clinic uuid;
begin
  select role::text, clinic_id into v_role, v_clinic
  from public.profiles where id = (event->>'user_id')::uuid;

  claims := coalesce(event->'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(v_role, 'patient')));
  if v_clinic is not null then
    claims := jsonb_set(claims, '{clinic_id}', to_jsonb(v_clinic::text));
  else
    claims := jsonb_set(claims, '{clinic_id}', 'null'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Supabase Auth runs the hook as supabase_auth_admin → grant access.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- =====================================================================
-- 11. SIGNUP TRIGGER  (self-registered users → patient profile)
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone_number, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'patient'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 11b. clinic_id IMMUTABILITY  (defense vs. moving a row between clinics)
--   WITH CHECK alone cannot compare OLD vs NEW, so a BEFORE UPDATE trigger
--   makes clinic_id immutable for everyone except super_admin. This is the
--   real guard; the WITH CHECK clauses above are belt-and-suspenders.
-- =====================================================================
create or replace function public.enforce_clinic_id_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.clinic_id is distinct from old.clinic_id and not public.is_super_admin() then
    raise exception 'clinic_id is immutable: a record cannot be moved between clinics';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_clinic_immutable        before update on public.profiles        for each row execute function public.enforce_clinic_id_immutable();
create trigger trg_doctors_clinic_immutable         before update on public.doctors         for each row execute function public.enforce_clinic_id_immutable();
create trigger trg_patients_clinic_immutable        before update on public.patients        for each row execute function public.enforce_clinic_id_immutable();
create trigger trg_appointments_clinic_immutable    before update on public.appointments    for each row execute function public.enforce_clinic_id_immutable();
create trigger trg_mhistory_clinic_immutable        before update on public.medical_history for each row execute function public.enforce_clinic_id_immutable();
create trigger trg_mfiles_clinic_immutable          before update on public.medical_files   for each row execute function public.enforce_clinic_id_immutable();
create trigger trg_notifications_clinic_immutable   before update on public.notifications   for each row execute function public.enforce_clinic_id_immutable();

-- =====================================================================
-- 12. ROW LEVEL SECURITY
-- =====================================================================
alter table public.clinics         enable row level security;
alter table public.profiles        enable row level security;
alter table public.doctors         enable row level security;
alter table public.patients        enable row level security;
alter table public.appointments    enable row level security;
alter table public.medical_history enable row level security;
alter table public.medical_files   enable row level security;
alter table public.notifications   enable row level security;

-- ---- clinics ----
-- Browsable directory for LOGGED-IN users (so patients can pick a clinic to
-- book). Anonymous (no JWT) callers get nothing.
create policy clinics_select on public.clinics for select
  using (is_super_admin() or (auth.uid() is not null and is_active = true));
create policy clinics_insert on public.clinics for insert
  with check (is_super_admin());
create policy clinics_update on public.clinics for update
  using (is_super_admin() or (current_user_role() = 'clinic_admin' and id = current_clinic_id()))
  with check (is_super_admin() or (current_user_role() = 'clinic_admin' and id = current_clinic_id()));
create policy clinics_delete on public.clinics for delete
  using (is_super_admin());

-- ---- profiles ----
create policy profiles_select on public.profiles for select
  using (
    is_super_admin()
    or id = auth.uid()
    or (clinic_id is not null and clinic_id = current_clinic_id()
        and current_user_role() in ('clinic_admin','employee','doctor'))
  );
create policy profiles_insert on public.profiles for insert
  -- self only AND role pinned to 'patient': a client can never self-insert an
  -- elevated role. Staff/doctor profiles are created by the Edge Function
  -- (service_role bypasses RLS), which sets the real role + clinic_id.
  with check (id = auth.uid() and role = 'patient');
create policy profiles_update on public.profiles for update
  using (
    id = auth.uid()
    or is_super_admin()
    or (current_user_role() = 'clinic_admin' and clinic_id = current_clinic_id())
  )
  with check (
    is_super_admin()
    or (current_user_role() = 'clinic_admin' and clinic_id = current_clinic_id())
    -- A self-updater (e.g. patient) cannot escalate role or change their clinic:
    -- the NEW row must keep the role + clinic that are already in their JWT.
    or (id = auth.uid()
        and role::text = current_user_role()
        and clinic_id is not distinct from current_clinic_id())
  );
create policy profiles_delete on public.profiles for delete
  using (is_super_admin() or (current_user_role() = 'clinic_admin' and clinic_id = current_clinic_id()));

-- ---- doctors ----
-- Directory readable to LOGGED-IN users (booking). Writes are clinic-scoped,
-- and profile_id (if set) must belong to the same clinic.
create policy doctors_select on public.doctors for select
  using (is_super_admin() or (auth.uid() is not null and (is_active = true or clinic_id = current_clinic_id())));
create policy doctors_insert on public.doctors for insert
  with check (
    (is_super_admin() or (current_user_role() = 'clinic_admin' and clinic_id = current_clinic_id()))
    and public.profile_in_clinic(profile_id, clinic_id)
  );
create policy doctors_update on public.doctors for update
  using (is_super_admin() or (current_user_role() = 'clinic_admin' and clinic_id = current_clinic_id()))
  with check (
    (is_super_admin() or (current_user_role() = 'clinic_admin' and clinic_id = current_clinic_id()))
    and public.profile_in_clinic(profile_id, clinic_id)
  );
create policy doctors_delete on public.doctors for delete
  using (is_super_admin() or (current_user_role() = 'clinic_admin' and clinic_id = current_clinic_id()));

-- ---- patients ----
create policy patients_select on public.patients for select
  using (
    is_super_admin()
    or auth_user_id = auth.uid()                                   -- the patient themselves
    or (clinic_id = current_clinic_id()
        and current_user_role() in ('clinic_admin','employee'))    -- clinic staff
    or (current_user_role() = 'doctor' and public.doctor_treats_patient(patients.id))  -- doctor: only own patients
  );
create policy patients_insert on public.patients for insert
  with check (
    is_super_admin()
    or auth_user_id = auth.uid()                                   -- patient self-registers
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee'))
  );
create policy patients_update on public.patients for update
  using (
    is_super_admin()
    or auth_user_id = auth.uid()
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee'))
  )
  with check (
    is_super_admin()
    -- self patient may edit own demographics; clinic_id immutability is enforced
    -- by the trg_*_clinic_immutable trigger (WITH CHECK cannot see OLD row).
    or (auth_user_id = auth.uid())
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee'))
  );
create policy patients_delete on public.patients for delete
  using (is_super_admin() or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee')));

-- ---- appointments ----
create policy appts_select on public.appointments for select
  using (
    is_super_admin()
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee'))
    or public.is_my_patient(patient_id)
    or public.is_my_doctor(doctor_id)
  );
create policy appts_insert on public.appointments for insert
  with check (
    (
      is_super_admin()
      or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee'))
      or public.is_my_patient(patient_id)
    )
    -- Referential clinic integrity: the doctor AND the patient on this row
    -- must both belong to the SAME clinic as the row. Blocks a clinic-A staffer
    -- (or patient) from attaching a clinic-B doctor/patient. Applies to everyone,
    -- super_admin included, because it is data integrity, not authorization.
    and public.doctor_in_clinic(doctor_id, clinic_id)
    and public.patient_in_clinic(patient_id, clinic_id)
  );
create policy appts_update on public.appointments for update
  using (
    is_super_admin()
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee'))
    or public.is_my_patient(patient_id)  -- patient may cancel own
  )
  with check (
    (
      is_super_admin()
      or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee'))
      or public.is_my_patient(patient_id)
    )
    and public.doctor_in_clinic(doctor_id, clinic_id)
    and public.patient_in_clinic(patient_id, clinic_id)
  );
create policy appts_delete on public.appointments for delete
  using (is_super_admin() or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee')));

-- ---- medical_history ----
create policy mhistory_select on public.medical_history for select
  using (
    is_super_admin()
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee','doctor'))
    or public.is_my_patient(patient_id)
  );
create policy mhistory_write on public.medical_history for all
  using (is_super_admin() or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee','doctor')))
  with check (
    (is_super_admin() or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee','doctor')))
    -- Referential clinic integrity: patient (and doctor, if set) must be in the row's clinic.
    and public.patient_in_clinic(patient_id, clinic_id)
    and (doctor_id is null or public.doctor_in_clinic(doctor_id, clinic_id))
  );

-- ---- medical_files ----
create policy mfiles_select on public.medical_files for select
  using (
    is_super_admin()
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee','doctor'))
    or public.is_my_patient(patient_id)
  );
create policy mfiles_write on public.medical_files for all
  using (is_super_admin() or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee','doctor')))
  with check (
    (is_super_admin() or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee','doctor')))
    -- Referential clinic integrity: the patient must be in the row's clinic.
    and public.patient_in_clinic(patient_id, clinic_id)
  );

-- ---- notifications ----
create policy notif_select on public.notifications for select
  using (is_super_admin() or user_id = auth.uid());
create policy notif_insert on public.notifications for insert
  with check (
    is_super_admin()
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee'))
  );
create policy notif_update on public.notifications for update
  using (user_id = auth.uid())                 -- mark own as read
  with check (user_id = auth.uid());           -- cannot reassign to another user

commit;

-- =====================================================================
-- 13. SEED (run MANUALLY after enabling the JWT hook & re-logging in)
--     Replace <YOUR_AUTH_USER_ID> with your auth.users id.
-- =====================================================================
-- insert into public.clinics (name, address, phone)
--   values ('Default Clinic', 'Baghdad', '+964...') returning id;  -- note the id
--
-- update public.profiles
--   set role = 'super_admin', clinic_id = null
--   where id = '<YOUR_AUTH_USER_ID>';
