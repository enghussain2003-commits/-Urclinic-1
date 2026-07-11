-- 0008 - Tighten staff-created notification inserts.
--
-- notifications.user_id references profiles.id, which is the same UUID as
-- auth.users.id/auth.uid(). Prescription notifications target the patient's
-- auth/profile UUID, while clinic ownership lives on notifications.clinic_id.
--
-- The previous INSERT policy only checked that staff wrote a row with their own
-- clinic_id. It did not validate that the target user_id was a patient account
-- linked to that same clinic, so prescription notification inserts could fail
-- once the target/clinic relationship was enforced by application data shape.
--
-- Keep patient SELECT unchanged: patients still only read rows where
-- notifications.user_id = auth.uid().

drop policy if exists notif_insert on public.notifications;

create policy notif_insert on public.notifications for insert
  with check (
    is_super_admin()
    or (
      clinic_id is not null
      and (
        -- Clinic staff may notify a patient only inside their own clinic.
        -- user_id must be the patient's auth/profile UUID, proven by the
        -- patients.auth_user_id link in the same clinic.
        (
          clinic_id = current_clinic_id()
          and current_user_role() in ('clinic_admin','doctor','employee')
          and public.patient_auth_in_clinic(user_id, clinic_id)
        )

        -- Preserve the existing appointment booking flow: a patient may notify
        -- the selected doctor of the clinic carried by the notification row.
        or (
          current_user_role() = 'patient'
          and exists (
            select 1
            from public.doctors d
            where d.profile_id = user_id
              and d.clinic_id = clinic_id
          )
        )
      )
    )
  );
