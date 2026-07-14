-- 0022 - Real-time patient call workflow.
--
-- Doctors call today's eligible assigned patients through a checked RPC. The
-- RPC writes scoped notification rows for active clinic_admin / employee users
-- and records an audit event for each call attempt.

begin;

alter table public.notifications
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists patient_id uuid references public.patients(id) on delete set null,
  add column if not exists doctor_id uuid references public.doctors(id) on delete set null,
  add column if not exists booking_code text,
  add column if not exists appointment_time time,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_notifications_patient_call_user_created
  on public.notifications(user_id, created_at desc)
  where type = 'patient_call';

create index if not exists idx_notifications_patient_call_appointment
  on public.notifications(appointment_id, created_at desc)
  where type = 'patient_call';

create table if not exists public.patient_call_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  triggered_by uuid not null references public.profiles(id) on delete restrict,
  patient_name text not null,
  doctor_name text not null,
  booking_code text,
  appointment_time time,
  status text not null default 'sent'
    check (status in ('sent', 'acknowledged', 'no_recipients')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.patient_call_events enable row level security;

create index if not exists idx_patient_call_events_clinic_created
  on public.patient_call_events(clinic_id, created_at desc);

create index if not exists idx_patient_call_events_appointment_created
  on public.patient_call_events(appointment_id, created_at desc);

drop policy if exists patient_call_events_select on public.patient_call_events;
create policy patient_call_events_select on public.patient_call_events for select
  using (
    public.is_super_admin()
    or (
      clinic_id = public.current_clinic_id()
      and public.current_user_role() in ('clinic_admin', 'employee', 'doctor')
    )
  );

grant select on public.patient_call_events to authenticated;

create or replace function public.call_patient_for_appointment(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles%rowtype;
  v_doctor public.doctors%rowtype;
  v_appointment public.appointments%rowtype;
  v_patient public.patients%rowtype;
  v_clinic_active boolean;
  v_today date := (now() at time zone 'Asia/Baghdad')::date;
  v_patient_name text;
  v_doctor_name text;
  v_recipient_count integer := 0;
  v_event_id uuid;
  v_route text;
  v_title_ar text := 'استدعاء مريض';
  v_title_en text := 'Patient Call';
  v_message_ar text;
  v_message_en text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_AUTH_REQUIRED');
  end if;

  select * into v_actor
  from public.profiles
  where id = auth.uid();

  if not found or coalesce(v_actor.status, 'active') <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_NOT_ALLOWED');
  end if;

  if v_actor.role::text <> 'doctor' then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_DOCTOR_ONLY');
  end if;

  select * into v_doctor
  from public.doctors
  where profile_id = auth.uid()
    and is_active = true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_DOCTOR_NOT_FOUND');
  end if;

  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_APPOINTMENT_NOT_FOUND');
  end if;

  if v_appointment.doctor_id <> v_doctor.id then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_WRONG_DOCTOR');
  end if;

  if v_appointment.clinic_id <> v_doctor.clinic_id
     or v_actor.clinic_id is distinct from v_appointment.clinic_id then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_CLINIC_MISMATCH');
  end if;

  select coalesce(is_active, false) into v_clinic_active
  from public.clinics
  where id = v_appointment.clinic_id;

  if coalesce(v_clinic_active, false) = false then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_CLINIC_INACTIVE');
  end if;

  if v_appointment.appointment_date <> v_today then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_NOT_TODAY');
  end if;

  if v_appointment.status::text not in ('approved', 'in_progress', 'checked_in') then
    return jsonb_build_object(
      'ok', false,
      'code', 'PATIENT_CALL_INELIGIBLE_STATUS',
      'status', v_appointment.status::text
    );
  end if;

  if exists (
    select 1
    from public.patient_call_events e
    where e.appointment_id = p_appointment_id
      and e.created_at > now() - interval '60 seconds'
  ) then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_COOLDOWN');
  end if;

  select * into v_patient
  from public.patients
  where id = v_appointment.patient_id
    and clinic_id = v_appointment.clinic_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_PATIENT_NOT_FOUND');
  end if;

  v_patient_name := coalesce(nullif(v_patient.full_name, ''), 'Unknown patient');
  v_doctor_name := coalesce(nullif(v_doctor.full_name, ''), nullif(v_actor.full_name, ''), 'Doctor');
  v_route := '/dashboard/patients/' || v_patient.id::text;
  v_message_ar := 'الدكتور ' || v_doctor_name || ' يطلب استدعاء المريض ' || v_patient_name || '.';
  v_message_en := 'Dr. ' || v_doctor_name || ' is requesting patient ' || v_patient_name || '.';

  select count(*) into v_recipient_count
  from public.profiles r
  where r.clinic_id = v_appointment.clinic_id
    and r.role::text in ('clinic_admin', 'employee')
    and coalesce(r.status, 'active') = 'active';

  insert into public.patient_call_events (
    clinic_id,
    appointment_id,
    patient_id,
    doctor_id,
    triggered_by,
    patient_name,
    doctor_name,
    booking_code,
    appointment_time,
    status,
    recipient_count
  )
  values (
    v_appointment.clinic_id,
    v_appointment.id,
    v_appointment.patient_id,
    v_appointment.doctor_id,
    auth.uid(),
    v_patient_name,
    v_doctor_name,
    v_appointment.booking_code,
    v_appointment.appointment_time,
    case when v_recipient_count > 0 then 'sent' else 'no_recipients' end,
    v_recipient_count
  )
  returning id into v_event_id;

  if v_recipient_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'PATIENT_CALL_NO_RECIPIENTS',
      'event_id', v_event_id
    );
  end if;

  insert into public.notifications (
    clinic_id,
    user_id,
    title,
    message,
    type,
    is_read,
    route,
    event_key,
    metadata,
    appointment_id,
    patient_id,
    doctor_id,
    booking_code,
    appointment_time
  )
  select
    v_appointment.clinic_id,
    r.id,
    v_title_ar,
    v_message_ar,
    'patient_call',
    false,
    v_route,
    'patient_call:' || v_event_id::text || ':' || r.id::text,
    jsonb_build_object(
      'title_ar', v_title_ar,
      'title_en', v_title_en,
      'message_ar', v_message_ar,
      'message_en', v_message_en,
      'patient_call_event_id', v_event_id,
      'appointment_id', v_appointment.id,
      'patient_id', v_patient.id,
      'doctor_id', v_doctor.id,
      'booking_code', v_appointment.booking_code,
      'appointment_time', v_appointment.appointment_time,
      'patient_name', v_patient_name,
      'doctor_name', v_doctor_name,
      'route', v_route
    ),
    v_appointment.id,
    v_patient.id,
    v_doctor.id,
    v_appointment.booking_code,
    v_appointment.appointment_time
  from public.profiles r
  where r.clinic_id = v_appointment.clinic_id
    and r.role::text in ('clinic_admin', 'employee')
    and coalesce(r.status, 'active') = 'active'
  on conflict (event_key) where event_key is not null do nothing;

  get diagnostics v_recipient_count = row_count;

  update public.patient_call_events
  set recipient_count = v_recipient_count
  where id = v_event_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'PATIENT_CALL_SENT',
    'event_id', v_event_id,
    'recipients_count', v_recipient_count
  );
end;
$$;

create or replace function public.acknowledge_patient_call(p_notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles%rowtype;
  v_notification public.notifications%rowtype;
  v_event_id uuid;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_AUTH_REQUIRED');
  end if;

  select * into v_notification
  from public.notifications
  where id = p_notification_id
    and user_id = auth.uid()
    and type = 'patient_call'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_NOTIFICATION_NOT_FOUND');
  end if;

  select * into v_actor
  from public.profiles
  where id = auth.uid();

  if not found
     or coalesce(v_actor.status, 'active') <> 'active'
     or v_actor.role::text not in ('clinic_admin', 'employee')
     or v_actor.clinic_id is distinct from v_notification.clinic_id then
    return jsonb_build_object('ok', false, 'code', 'PATIENT_CALL_ACK_NOT_ALLOWED');
  end if;

  if v_notification.acknowledged_at is not null then
    return jsonb_build_object(
      'ok', true,
      'code', 'PATIENT_CALL_ALREADY_ACKNOWLEDGED',
      'acknowledged_at', v_notification.acknowledged_at
    );
  end if;

  update public.notifications
  set
    acknowledged_at = v_now,
    acknowledged_by = auth.uid(),
    is_read = true
  where id = p_notification_id;

  begin
    v_event_id := nullif(v_notification.metadata ->> 'patient_call_event_id', '')::uuid;
  exception when others then
    v_event_id := null;
  end;

  if v_event_id is not null then
    update public.patient_call_events
    set
      acknowledged_at = coalesce(acknowledged_at, v_now),
      acknowledged_by = coalesce(acknowledged_by, auth.uid()),
      status = 'acknowledged'
    where id = v_event_id
      and clinic_id = v_notification.clinic_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'PATIENT_CALL_ACKNOWLEDGED',
    'acknowledged_at', v_now
  );
end;
$$;

revoke all on function public.call_patient_for_appointment(uuid) from public, anon;
revoke all on function public.acknowledge_patient_call(uuid) from public, anon;
grant execute on function public.call_patient_for_appointment(uuid) to authenticated;
grant execute on function public.acknowledge_patient_call(uuid) to authenticated;

commit;
