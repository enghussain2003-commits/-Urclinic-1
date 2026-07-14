-- 0017 - Appointment completion payment ledger.
--
-- Creates one durable payment record per completed appointment and an atomic
-- RPC that completes the appointment and records payment in the same DB
-- transaction.

begin;

alter table public.clinics
  add column if not exists currency text not null default 'IQD';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clinics_currency_check'
  ) then
    alter table public.clinics
      add constraint clinics_currency_check check (currency ~ '^[A-Z]{3}$');
  end if;
end $$;

create table if not exists public.appointment_payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  doctor_id uuid references public.doctors(id) on delete set null,
  consultation_fee numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  payment_status text not null,
  payment_method text,
  currency text not null default 'IQD',
  note text,
  paid_at timestamptz,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_payments_status_check
    check (payment_status in ('paid', 'partially_paid', 'unpaid', 'waived')),
  constraint appointment_payments_method_check
    check (payment_method is null or payment_method in ('cash', 'card', 'transfer', 'other')),
  constraint appointment_payments_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint appointment_payments_amounts_check
    check (
      consultation_fee >= 0
      and paid_amount >= 0
      and paid_amount <= consultation_fee
    ),
  constraint appointment_payments_status_amount_check
    check (
      (payment_status = 'paid' and paid_amount = consultation_fee)
      or (payment_status = 'unpaid' and paid_amount = 0)
      or (payment_status = 'waived' and paid_amount = 0)
      or (payment_status = 'partially_paid' and paid_amount > 0 and paid_amount < consultation_fee)
    ),
  constraint appointment_payments_method_required_check
    check (paid_amount = 0 or payment_method is not null)
);

create unique index if not exists appointment_payments_appointment_uniq
  on public.appointment_payments(appointment_id);
create index if not exists idx_appointment_payments_clinic
  on public.appointment_payments(clinic_id);
create index if not exists idx_appointment_payments_doctor
  on public.appointment_payments(doctor_id);
create index if not exists idx_appointment_payments_patient
  on public.appointment_payments(patient_id);
create index if not exists idx_appointment_payments_paid_at
  on public.appointment_payments(paid_at);
create index if not exists idx_appointment_payments_status
  on public.appointment_payments(payment_status);

alter table public.appointment_payments enable row level security;

drop policy if exists appointment_payments_select on public.appointment_payments;
create policy appointment_payments_select on public.appointment_payments for select
  using (
    public.is_super_admin()
    or (clinic_id = public.current_clinic_id() and public.current_user_role() in ('clinic_admin','employee'))
    or public.is_my_doctor(doctor_id)
    or public.is_my_patient(patient_id)
  );

drop trigger if exists trg_appointment_payments_updated_at on public.appointment_payments;
create trigger trg_appointment_payments_updated_at
  before update on public.appointment_payments
  for each row execute function public.touch_updated_at();

create or replace function public.complete_appointment_with_payment(
  p_appointment_id uuid,
  p_consultation_fee numeric,
  p_paid_amount numeric,
  p_payment_status text,
  p_payment_method text default null,
  p_note text default null,
  p_currency text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.current_user_role();
  v_clinic_id uuid := public.current_clinic_id();
  v_appointment public.appointments%rowtype;
  v_payment public.appointment_payments%rowtype;
  v_doctor_fee numeric;
  v_clinic_fee numeric;
  v_resolved_fee numeric;
  v_fee numeric;
  v_paid numeric;
  v_currency text;
  v_method text;
  v_can_complete boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select a.*
    into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;

  if v_appointment.status::text in ('cancelled', 'rejected') then
    raise exception 'Cancelled or rejected appointments cannot be completed'
      using errcode = '23514';
  end if;

  select d.fee, c.default_consultation_fee, c.currency
    into v_doctor_fee, v_clinic_fee, v_currency
  from public.doctors d
  join public.clinics c on c.id = v_appointment.clinic_id
  where d.id = v_appointment.doctor_id;

  v_currency := upper(coalesce(nullif(p_currency, ''), v_currency, 'IQD'));
  v_resolved_fee := coalesce(nullif(v_appointment.fee, 0), nullif(v_doctor_fee, 0), nullif(v_clinic_fee, 0), 0);
  v_fee := coalesce(p_consultation_fee, v_resolved_fee);
  v_paid := coalesce(p_paid_amount, 0);
  v_method := nullif(p_payment_method, '');

  v_can_complete :=
    public.is_super_admin()
    or (v_role in ('clinic_admin','employee') and v_appointment.clinic_id = v_clinic_id)
    or (v_role = 'doctor' and public.is_my_doctor(v_appointment.doctor_id));

  if not v_can_complete then
    raise exception 'You are not allowed to complete this appointment'
      using errcode = '42501';
  end if;

  if v_role not in ('clinic_admin','super_admin') and v_fee <> v_resolved_fee then
    raise exception 'Only clinic admins can adjust the consultation fee'
      using errcode = '42501';
  end if;

  if v_fee < 0 or v_paid < 0 then
    raise exception 'Payment amounts cannot be negative' using errcode = '23514';
  end if;

  if v_paid > v_fee then
    raise exception 'Paid amount cannot exceed consultation fee' using errcode = '23514';
  end if;

  if p_payment_status not in ('paid', 'partially_paid', 'unpaid', 'waived') then
    raise exception 'Invalid payment status' using errcode = '23514';
  end if;

  if p_payment_status = 'paid' and v_paid <> v_fee then
    raise exception 'Paid appointments must record the full consultation fee'
      using errcode = '23514';
  end if;

  if p_payment_status in ('unpaid', 'waived') and v_paid <> 0 then
    raise exception 'Unpaid or waived appointments must have zero paid amount'
      using errcode = '23514';
  end if;

  if p_payment_status = 'partially_paid' and not (v_paid > 0 and v_paid < v_fee) then
    raise exception 'Partially paid appointments require an amount greater than zero and less than the fee'
      using errcode = '23514';
  end if;

  if v_paid > 0 and v_method is null then
    raise exception 'Payment method is required when a paid amount is recorded'
      using errcode = '23514';
  end if;

  if v_method is not null and v_method not in ('cash', 'card', 'transfer', 'other') then
    raise exception 'Invalid payment method' using errcode = '23514';
  end if;

  select *
    into v_payment
  from public.appointment_payments
  where appointment_id = v_appointment.id
  for update;

  if found then
    return jsonb_build_object(
      'appointment', to_jsonb(v_appointment),
      'payment', to_jsonb(v_payment),
      'already_recorded', true
    );
  end if;

  update public.appointments
  set
    status = 'completed',
    completed_at = coalesce(completed_at, now()),
    fee = v_fee,
    paid = (v_paid > 0),
    payment_method = v_method
  where id = v_appointment.id
  returning * into v_appointment;

  insert into public.appointment_payments (
    appointment_id,
    clinic_id,
    patient_id,
    doctor_id,
    consultation_fee,
    paid_amount,
    payment_status,
    payment_method,
    currency,
    note,
    paid_at,
    recorded_by
  )
  values (
    v_appointment.id,
    v_appointment.clinic_id,
    v_appointment.patient_id,
    v_appointment.doctor_id,
    v_fee,
    v_paid,
    p_payment_status,
    v_method,
    v_currency,
    nullif(p_note, ''),
    case when v_paid > 0 then now() else null end,
    v_uid
  )
  returning * into v_payment;

  return jsonb_build_object(
    'appointment', to_jsonb(v_appointment),
    'payment', to_jsonb(v_payment),
    'already_recorded', false
  );
end;
$$;

grant execute on function public.complete_appointment_with_payment(
  uuid, numeric, numeric, text, text, text, text
) to authenticated;

commit;
