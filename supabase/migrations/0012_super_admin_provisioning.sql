-- 0012 - Super Admin clinic provisioning and account management.
-- Additive only: reuses clinics, profiles, and doctors.

begin;

alter table public.clinics
  add column if not exists governorate text,
  add column if not exists default_consultation_fee numeric default 0 check (default_consultation_fee >= 0),
  add column if not exists working_days text[] default array['sat','sun','mon','tue','wed','thu'],
  add column if not exists opening_time time,
  add column if not exists closing_time time,
  add column if not exists appointment_duration int,
  add column if not exists logo_url text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  add column if not exists status text not null default 'active',
  add column if not exists must_change_password boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.doctors
  add column if not exists diagnosis_description text,
  add column if not exists appointment_duration int,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check check (status in ('active', 'suspended'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'clinics_duration_check'
  ) then
    alter table public.clinics
      add constraint clinics_duration_check check (
        coalesce(appointment_duration, default_appointment_duration, 30) in (15, 20, 30, 45, 60)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'doctors_duration_check'
  ) then
    alter table public.doctors
      add constraint doctors_duration_check check (
        appointment_duration is null or appointment_duration in (15, 20, 30, 45, 60)
      );
  end if;
end $$;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(lower(email));
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_clinics_active on public.clinics(is_active);
create index if not exists idx_clinics_governorate on public.clinics(governorate);
create index if not exists idx_doctors_active on public.doctors(is_active);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  target_user_id uuid references public.profiles(id) on delete set null,
  clinic_id uuid references public.clinics(id) on delete set null,
  action_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor on public.audit_logs(actor_user_id);
create index if not exists idx_audit_logs_target on public.audit_logs(target_user_id);
create index if not exists idx_audit_logs_clinic on public.audit_logs(clinic_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action_type);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select
  using (is_super_admin());

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert
  with check (is_super_admin());

create or replace function public.touch_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_clinics_updated_at on public.clinics;
create trigger trg_clinics_updated_at
  before update on public.clinics
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_doctors_updated_at on public.doctors;
create trigger trg_doctors_updated_at
  before update on public.doctors
  for each row execute function public.touch_updated_at();

create or replace function public.current_account_is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p
    left join public.clinics c on c.id = p.clinic_id
    where p.id = auth.uid()
      and p.status = 'active'
      and (
        p.role = 'super_admin'
        or p.role = 'patient'
        or coalesce(c.is_active, false) = true
      )
  );
$$;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  claims  jsonb;
  v_role  text;
  v_clinic uuid;
  v_status text;
  v_must_change boolean;
begin
  select role::text, clinic_id, status, must_change_password
    into v_role, v_clinic, v_status, v_must_change
  from public.profiles where id = (event->>'user_id')::uuid;

  claims := coalesce(event->'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(v_role, 'patient')));
  claims := jsonb_set(claims, '{account_status}', to_jsonb(coalesce(v_status, 'active')));
  claims := jsonb_set(claims, '{must_change_password}', to_jsonb(coalesce(v_must_change, false)));
  if v_clinic is not null then
    claims := jsonb_set(claims, '{clinic_id}', to_jsonb(v_clinic::text));
  else
    claims := jsonb_set(claims, '{clinic_id}', 'null'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.current_account_is_active() to authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- Keep public booking constrained to active clinics and doctors.
drop policy if exists clinics_select on public.clinics;
create policy clinics_select on public.clinics for select
  using (
    is_super_admin()
    or (auth.uid() is not null and is_active = true and public.current_account_is_active())
  );

drop policy if exists doctors_select on public.doctors;
create policy doctors_select on public.doctors for select
  using (
    is_super_admin()
    or (
      auth.uid() is not null
      and public.current_account_is_active()
      and (is_active = true or clinic_id = current_clinic_id())
      and exists (select 1 from public.clinics c where c.id = doctors.clinic_id and c.is_active = true)
    )
  );

commit;
