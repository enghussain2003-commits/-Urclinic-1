-- 0007 — Link prescription notifications to prescriptions.
--
-- notifications.user_id already references profiles.id, which is the same UUID
-- as auth.users.id/auth.uid(). This optional prescription_id lets the app avoid
-- duplicate "prescription created" notifications for the same prescription.

alter table public.notifications
  add column if not exists prescription_id uuid;

create unique index if not exists notifications_prescription_once
  on public.notifications(user_id, type, prescription_id)
  where prescription_id is not null;

create or replace function public.patient_auth_in_clinic(p_auth_user_id uuid, p_clinic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.patients p
    where p.auth_user_id = p_auth_user_id
      and p.clinic_id = p_clinic_id
  );
$$;

drop policy if exists rx_write on public.prescriptions;
create policy rx_write on public.prescriptions for all
  using (
    is_super_admin()
    or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee','doctor'))
  )
  with check (
    (
      is_super_admin()
      or (clinic_id = current_clinic_id() and current_user_role() in ('clinic_admin','employee','doctor'))
    )
    and public.patient_auth_in_clinic(patient_id, clinic_id)
  );
