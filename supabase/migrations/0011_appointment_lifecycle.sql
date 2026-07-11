-- 0011 - Professional appointment lifecycle.
--
-- Adds the explicit "approved" status, completion timestamping, and backend
-- validation that a patient auth account can have only one active appointment
-- at a time. Existing appointments are preserved permanently.

alter type appointment_status add value if not exists 'approved';
alter type appointment_status add value if not exists 'completed';

alter table public.appointments
  add column if not exists completed_at timestamptz;

create or replace function public.is_active_appointment_status(p_status public.appointment_status)
returns boolean language sql immutable as $$
  select p_status::text in ('pending', 'approved', 'in_progress', 'confirmed');
$$;

create or replace function public.set_appointment_completed_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'completed' and old.status::text is distinct from 'completed' then
    new.completed_at = coalesce(new.completed_at, now());
  elsif new.status::text is distinct from 'completed' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_appointments_completed_at on public.appointments;
create trigger trg_appointments_completed_at
  before update on public.appointments
  for each row execute function public.set_appointment_completed_at();

update public.appointments
set completed_at = coalesce(completed_at, created_at, now())
where status::text = 'completed'
  and completed_at is null;

create or replace function public.enforce_one_active_patient_appointment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_auth_user_id uuid;
begin
  if not public.is_active_appointment_status(new.status) then
    return new;
  end if;

  select p.auth_user_id into v_auth_user_id
  from public.patients p
  where p.id = new.patient_id;

  if v_auth_user_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_auth_user_id::text, 0));

  if exists (
    select 1
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where p.auth_user_id = v_auth_user_id
      and a.id is distinct from new.id
      and public.is_active_appointment_status(a.status)
  ) then
    raise exception 'patient already has an active appointment'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_one_active_patient_appointment on public.appointments;
create trigger trg_one_active_patient_appointment
  before insert or update of patient_id, status on public.appointments
  for each row execute function public.enforce_one_active_patient_appointment();

drop index if exists public.appointments_doctor_active_slot_uniq;
create unique index if not exists appointments_doctor_active_slot_uniq
  on public.appointments(doctor_id, appointment_date, appointment_time)
  where status not in ('cancelled', 'rejected', 'completed');

create or replace function public.active_appointment_slots(
  p_doctor_id uuid,
  p_start date,
  p_end date
)
returns table (
  appointment_date date,
  appointment_time time
)
language sql
stable
security definer
set search_path = public
as $$
  select a.appointment_date, a.appointment_time
  from public.appointments a
  join public.doctors d on d.id = a.doctor_id
  where a.doctor_id = p_doctor_id
    and d.is_active = true
    and a.appointment_date between p_start and p_end
    and a.status not in ('cancelled', 'rejected', 'completed')
  order by a.appointment_date, a.appointment_time;
$$;

grant execute on function public.active_appointment_slots(uuid, date, date) to authenticated;
