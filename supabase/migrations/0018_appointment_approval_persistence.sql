-- 0018 - Persist doctor appointment approvals.
--
-- Fixes the approval flow by allowing assigned doctors to update only their
-- own appointments while preserving clinic isolation and patient self-cancel
-- limits.

begin;

alter table public.appointments
  add column if not exists approved_at timestamptz;

create or replace function public.set_appointment_approved_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'approved' and old.status::text is distinct from 'approved' then
    new.approved_at = coalesce(new.approved_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_appointments_approved_at on public.appointments;
create trigger trg_appointments_approved_at
  before update of status on public.appointments
  for each row execute function public.set_appointment_approved_at();

drop policy if exists appts_update on public.appointments;
create policy appts_update on public.appointments for update
  using (
    public.is_super_admin()
    or (clinic_id = public.current_clinic_id() and public.current_user_role() in ('clinic_admin','employee'))
    or (public.current_user_role() = 'doctor' and public.is_my_doctor(doctor_id))
    or public.is_my_patient(patient_id)
  )
  with check (
    (
      public.is_super_admin()
      or (clinic_id = public.current_clinic_id() and public.current_user_role() in ('clinic_admin','employee'))
      or (public.current_user_role() = 'doctor' and public.is_my_doctor(doctor_id))
      or (public.is_my_patient(patient_id) and status::text = 'cancelled')
    )
    and public.doctor_in_clinic(doctor_id, clinic_id)
    and public.patient_in_clinic(patient_id, clinic_id)
  );

commit;
