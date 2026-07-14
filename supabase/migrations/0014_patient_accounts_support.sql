-- 0014 - Super Admin patient accounts and support management.
--
-- Adds support-safe metadata, audit logging, idempotent new-patient account
-- notifications, and cancellation fields while preserving appointment history.

begin;

alter table public.profiles
  add column if not exists governorate text,
  add column if not exists address text;

alter table public.appointments
  add column if not exists cancelled_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists cancelled_by_role text,
  add column if not exists cancellation_reason text,
  add column if not exists support_notes text,
  add column if not exists cancelled_at timestamptz;

alter table public.notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.support_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_role text not null,
  action_type text not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  clinic_id uuid references public.clinics(id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_audit_logs_actor_role_check'
  ) then
    alter table public.support_audit_logs
      add constraint support_audit_logs_actor_role_check check (actor_role = 'super_admin');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'support_audit_logs_action_type_check'
  ) then
    alter table public.support_audit_logs
      add constraint support_audit_logs_action_type_check check (
        action_type in (
          'patient_profile_updated',
          'patient_email_updated',
          'patient_password_reset',
          'patient_account_suspended',
          'patient_account_reactivated',
          'appointment_cancelled_by_support',
          'support_notification_sent'
        )
      );
  end if;
end $$;

create index if not exists idx_profiles_patient_directory
  on public.profiles(role, status, created_at desc);
create index if not exists idx_profiles_patient_phone
  on public.profiles(phone_number) where role = 'patient';
create index if not exists idx_patients_auth_clinic
  on public.patients(auth_user_id, clinic_id);
create index if not exists idx_appointments_cancelled_by
  on public.appointments(cancelled_by_user_id);
create index if not exists idx_support_audit_actor
  on public.support_audit_logs(actor_user_id, created_at desc);
create index if not exists idx_support_audit_target
  on public.support_audit_logs(target_user_id, created_at desc);
create index if not exists idx_support_audit_patient
  on public.support_audit_logs(patient_id, created_at desc);
create index if not exists idx_support_audit_appointment
  on public.support_audit_logs(appointment_id, created_at desc);

create unique index if not exists notifications_new_patient_account_once
  on public.notifications(user_id, type, ((metadata->>'patient_profile_id')))
  where type = 'new_patient_account';

alter table public.support_audit_logs enable row level security;

drop policy if exists support_audit_logs_select on public.support_audit_logs;
create policy support_audit_logs_select on public.support_audit_logs for select
  using (is_super_admin());

drop policy if exists support_audit_logs_insert on public.support_audit_logs;
create policy support_audit_logs_insert on public.support_audit_logs for insert
  with check (is_super_admin() and actor_user_id = auth.uid() and actor_role = 'super_admin');

create or replace function public.notify_super_admin_new_patient_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  admin_row record;
  patient_record_id uuid;
  patient_clinic_id uuid;
  notification_metadata jsonb;
begin
  if new.role::text <> 'patient' then
    return new;
  end if;

  select p.id, p.clinic_id
    into patient_record_id, patient_clinic_id
  from public.patients p
  where p.auth_user_id = new.id
  order by p.created_at asc
  limit 1;

  notification_metadata := jsonb_build_object(
    'patient_profile_id', new.id,
    'patient_record_id', patient_record_id,
    'patient_name', new.full_name,
    'phone', new.phone_number,
    'email', new.email,
    'clinic_id', patient_clinic_id,
    'registration_timestamp', coalesce(new.created_at, now()),
    'notification_type', 'new_patient_account'
  );

  for admin_row in
    select id from public.profiles where role::text = 'super_admin' and status = 'active'
  loop
    insert into public.notifications (clinic_id, user_id, title, message, type, metadata)
    values (
      null,
      admin_row.id,
      'حساب مريض جديد',
      'تم إنشاء حساب مريض جديد باسم ' || coalesce(nullif(new.full_name, ''), 'مريض جديد'),
      'new_patient_account',
      notification_metadata
    )
    on conflict (user_id, type, ((metadata->>'patient_profile_id')))
      where type = 'new_patient_account'
      do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_super_admin_new_patient_account on public.profiles;
create trigger trg_notify_super_admin_new_patient_account
  after insert on public.profiles
  for each row execute function public.notify_super_admin_new_patient_account();

-- Backfill one notification per existing patient account where none exists.
insert into public.notifications (clinic_id, user_id, title, message, type, metadata)
select
  null,
  sa.id,
  'حساب مريض جديد',
  'تم إنشاء حساب مريض جديد باسم ' || coalesce(nullif(p.full_name, ''), 'مريض جديد'),
  'new_patient_account',
  jsonb_build_object(
    'patient_profile_id', p.id,
    'patient_record_id', pr.id,
    'patient_name', p.full_name,
    'phone', p.phone_number,
    'email', p.email,
    'clinic_id', pr.clinic_id,
    'registration_timestamp', p.created_at,
    'notification_type', 'new_patient_account'
  )
from public.profiles p
cross join public.profiles sa
left join lateral (
  select id, clinic_id
  from public.patients
  where auth_user_id = p.id
  order by created_at asc
  limit 1
) pr on true
where p.role::text = 'patient'
  and sa.role::text = 'super_admin'
  and sa.status = 'active'
on conflict (user_id, type, ((metadata->>'patient_profile_id')))
  where type = 'new_patient_account'
  do nothing;

commit;
