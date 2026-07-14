-- 0024 - Clinic availability and schedule management.
--
-- Normalized working periods and temporary closures for clinic-wide and
-- doctor-specific availability. Existing clinic/doctor legacy hours remain
-- supported and are backfilled into the new tables.

begin;

create table if not exists public.availability_weekly_periods (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete cascade,
  day_of_week text not null check (day_of_week in ('sat','sun','mon','tue','wed','thu','fri')),
  start_time time not null,
  end_time time not null,
  period_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists public.availability_closures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete cascade,
  closure_type text not null default 'temporary'
    check (closure_type in ('temporary','vacation','travel','unavailable','sick_leave','holiday','emergency','maintenance','power_outage','other')),
  starts_on date not null,
  ends_on date not null,
  return_on date,
  start_time time,
  end_time time,
  reason text not null default 'other',
  note text,
  allow_future_booking boolean not null default true,
  notify_patients boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on <= ends_on),
  check (start_time is null or end_time is null or start_time < end_time)
);

create table if not exists public.availability_audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_availability_periods_clinic_day
  on public.availability_weekly_periods(clinic_id, day_of_week, is_active);
create index if not exists idx_availability_periods_doctor_day
  on public.availability_weekly_periods(doctor_id, day_of_week, is_active)
  where doctor_id is not null;
create index if not exists idx_availability_closures_clinic_dates
  on public.availability_closures(clinic_id, starts_on, ends_on);
create index if not exists idx_availability_closures_doctor_dates
  on public.availability_closures(doctor_id, starts_on, ends_on)
  where doctor_id is not null;
create index if not exists idx_availability_audit_clinic_created
  on public.availability_audit_logs(clinic_id, created_at desc);

alter table public.availability_weekly_periods enable row level security;
alter table public.availability_closures enable row level security;
alter table public.availability_audit_logs enable row level security;

create or replace function public.touch_availability_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_availability_weekly_periods_touch on public.availability_weekly_periods;
create trigger trg_availability_weekly_periods_touch
  before update on public.availability_weekly_periods
  for each row execute function public.touch_availability_updated_at();

drop trigger if exists trg_availability_closures_touch on public.availability_closures;
create trigger trg_availability_closures_touch
  before update on public.availability_closures
  for each row execute function public.touch_availability_updated_at();

create or replace function public.availability_actor_can_manage(p_clinic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
    or (
      auth.uid() is not null
      and p_clinic_id = public.current_clinic_id()
      and public.current_user_role() in ('clinic_admin','employee')
    );
$$;

create or replace function public.availability_actor_can_read(p_clinic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
    or (
      auth.uid() is not null
      and (
        p_clinic_id = public.current_clinic_id()
        or exists (select 1 from public.clinics c where c.id = p_clinic_id and c.is_active = true)
      )
    );
$$;

create or replace function public.appointment_slot_is_available(
  p_clinic_id uuid,
  p_doctor_id uuid,
  p_date date,
  p_time time
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day text;
  v_has_clinic_periods boolean;
  v_has_doctor_periods boolean;
  v_inside_period boolean;
  v_doctor public.doctors%rowtype;
begin
  if p_clinic_id is null or p_doctor_id is null or p_date is null or p_time is null then
    return false;
  end if;

  v_day := case extract(dow from p_date)::int
    when 0 then 'sun'
    when 1 then 'mon'
    when 2 then 'tue'
    when 3 then 'wed'
    when 4 then 'thu'
    when 5 then 'fri'
    else 'sat'
  end;

  if exists (
    select 1
    from public.availability_closures c
    where c.clinic_id = p_clinic_id
      and (c.doctor_id is null or c.doctor_id = p_doctor_id)
      and p_date between c.starts_on and c.ends_on
      and (
        c.start_time is null
        or c.end_time is null
        or (p_time >= c.start_time and p_time < c.end_time)
      )
  ) then
    return false;
  end if;

  select exists (
    select 1
    from public.availability_weekly_periods p
    where p.clinic_id = p_clinic_id
      and p.doctor_id is null
      and p.is_active = true
  ) into v_has_clinic_periods;

  if v_has_clinic_periods then
    select exists (
      select 1
      from public.availability_weekly_periods p
      where p.clinic_id = p_clinic_id
        and p.doctor_id is null
        and p.is_active = true
        and p.day_of_week = v_day
        and p_time >= p.start_time
        and p_time < p.end_time
    ) into v_inside_period;

    if not v_inside_period then
      return false;
    end if;
  end if;

  select exists (
    select 1
    from public.availability_weekly_periods p
    where p.clinic_id = p_clinic_id
      and p.doctor_id = p_doctor_id
      and p.is_active = true
  ) into v_has_doctor_periods;

  if v_has_doctor_periods then
    select exists (
      select 1
      from public.availability_weekly_periods p
      where p.clinic_id = p_clinic_id
        and p.doctor_id = p_doctor_id
        and p.is_active = true
        and p.day_of_week = v_day
        and p_time >= p.start_time
        and p_time < p.end_time
    ) into v_inside_period;

    return v_inside_period;
  end if;

  select *
  into v_doctor
  from public.doctors d
  where d.id = p_doctor_id
    and d.clinic_id = p_clinic_id;

  if not found then
    return false;
  end if;

  if coalesce(array_length(v_doctor.work_days, 1), 0) > 0 and not (v_day = any(v_doctor.work_days)) then
    return false;
  end if;

  if p_time < coalesce(v_doctor.open_time, '09:00'::time)
     or p_time >= coalesce(v_doctor.close_time, '17:00'::time) then
    return false;
  end if;

  if v_doctor.break_start is not null
     and v_doctor.break_end is not null
     and p_time >= v_doctor.break_start
     and p_time < v_doctor.break_end then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.enforce_appointment_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.clinic_id is not distinct from old.clinic_id
     and new.doctor_id is not distinct from old.doctor_id
     and new.appointment_date is not distinct from old.appointment_date
     and new.appointment_time is not distinct from old.appointment_time then
    return new;
  end if;

  if new.status::text in ('pending','approved','confirmed','in_progress')
     and not public.appointment_slot_is_available(
       new.clinic_id,
       new.doctor_id,
       new.appointment_date,
       new.appointment_time
     ) then
    raise exception 'appointment slot is outside clinic or doctor availability'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_appointments_enforce_availability on public.appointments;
create trigger trg_appointments_enforce_availability
  before insert or update of clinic_id, doctor_id, appointment_date, appointment_time on public.appointments
  for each row execute function public.enforce_appointment_availability();

drop policy if exists availability_periods_select on public.availability_weekly_periods;
create policy availability_periods_select on public.availability_weekly_periods for select
  using (public.availability_actor_can_read(clinic_id));

drop policy if exists availability_periods_insert on public.availability_weekly_periods;
create policy availability_periods_insert on public.availability_weekly_periods for insert
  with check (
    public.availability_actor_can_manage(clinic_id)
    and (doctor_id is null or public.doctor_in_clinic(doctor_id, clinic_id))
    and created_by = auth.uid()
  );

drop policy if exists availability_periods_update on public.availability_weekly_periods;
create policy availability_periods_update on public.availability_weekly_periods for update
  using (public.availability_actor_can_manage(clinic_id))
  with check (
    public.availability_actor_can_manage(clinic_id)
    and (doctor_id is null or public.doctor_in_clinic(doctor_id, clinic_id))
  );

drop policy if exists availability_periods_delete on public.availability_weekly_periods;
create policy availability_periods_delete on public.availability_weekly_periods for delete
  using (public.availability_actor_can_manage(clinic_id));

drop policy if exists availability_closures_select on public.availability_closures;
create policy availability_closures_select on public.availability_closures for select
  using (public.availability_actor_can_read(clinic_id));

drop policy if exists availability_closures_insert on public.availability_closures;
create policy availability_closures_insert on public.availability_closures for insert
  with check (
    public.availability_actor_can_manage(clinic_id)
    and (doctor_id is null or public.doctor_in_clinic(doctor_id, clinic_id))
    and created_by = auth.uid()
  );

drop policy if exists availability_closures_update on public.availability_closures;
create policy availability_closures_update on public.availability_closures for update
  using (public.availability_actor_can_manage(clinic_id))
  with check (
    public.availability_actor_can_manage(clinic_id)
    and (doctor_id is null or public.doctor_in_clinic(doctor_id, clinic_id))
  );

drop policy if exists availability_closures_delete on public.availability_closures;
create policy availability_closures_delete on public.availability_closures for delete
  using (public.availability_actor_can_manage(clinic_id));

drop policy if exists availability_audit_select on public.availability_audit_logs;
create policy availability_audit_select on public.availability_audit_logs for select
  using (public.is_super_admin() or clinic_id = public.current_clinic_id());

drop policy if exists availability_audit_insert on public.availability_audit_logs;
create policy availability_audit_insert on public.availability_audit_logs for insert
  with check (actor_id = auth.uid() and public.availability_actor_can_manage(clinic_id));

insert into public.availability_weekly_periods (clinic_id, day_of_week, start_time, end_time, period_order)
select
  c.id,
  d.day_id,
  coalesce(c.opening_time, nullif(c.working_hours ->> 'start', '')::time, '09:00'::time),
  coalesce(c.closing_time, nullif(c.working_hours ->> 'end', '')::time, '17:00'::time),
  0
from public.clinics c
cross join lateral unnest(coalesce(c.working_days, array['sat','sun','mon','tue','wed','thu'])) as d(day_id)
where not exists (
  select 1 from public.availability_weekly_periods p
  where p.clinic_id = c.id and p.doctor_id is null
)
and coalesce(c.opening_time, nullif(c.working_hours ->> 'start', '')::time, '09:00'::time)
  < coalesce(c.closing_time, nullif(c.working_hours ->> 'end', '')::time, '17:00'::time);

insert into public.availability_weekly_periods (clinic_id, doctor_id, day_of_week, start_time, end_time, period_order)
select d.clinic_id, d.id, day_id, d.open_time, coalesce(d.break_start, d.close_time), 0
from public.doctors d
cross join lateral unnest(coalesce(d.work_days, array['sat','sun','mon','tue','wed','thu'])) as wd(day_id)
where not exists (
  select 1 from public.availability_weekly_periods p where p.doctor_id = d.id
)
and d.open_time < coalesce(d.break_start, d.close_time);

insert into public.availability_weekly_periods (clinic_id, doctor_id, day_of_week, start_time, end_time, period_order)
select d.clinic_id, d.id, day_id, coalesce(d.break_end, d.open_time), d.close_time, 1
from public.doctors d
cross join lateral unnest(coalesce(d.work_days, array['sat','sun','mon','tue','wed','thu'])) as wd(day_id)
where not exists (
  select 1 from public.availability_weekly_periods p where p.doctor_id = d.id and p.period_order = 1
)
and d.break_start is not null
and d.break_end is not null
and d.break_end < d.close_time;

grant select on public.availability_weekly_periods to authenticated;
grant select on public.availability_closures to authenticated;
grant select on public.availability_audit_logs to authenticated;
grant insert, update, delete on public.availability_weekly_periods to authenticated;
grant insert, update, delete on public.availability_closures to authenticated;
grant insert on public.availability_audit_logs to authenticated;
grant execute on function public.availability_actor_can_manage(uuid) to authenticated;
grant execute on function public.availability_actor_can_read(uuid) to authenticated;
grant execute on function public.appointment_slot_is_available(uuid, uuid, date, time) to authenticated;

commit;
