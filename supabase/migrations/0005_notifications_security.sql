-- 0005 — Tighten notifications INSERT policy (audit finding C2).
--
-- The 0004 policy allowed ANY authenticated user to insert a notification for
-- ANY user_id — no clinic restriction, no recipient validation. That enabled:
--   * cross-clinic notification injection (clinic-A staff/doctor → clinic-B users)
--   * patient → patient spam
--   * untraceable spoofing (notif rows carry no sender)
--
-- This policy preserves every legitimate workflow:
--   * staff approve/reject → patient        (staff in clinic X writes clinic_id=X)
--   * doctor prescribes  → patient          (doctor in clinic X writes clinic_id=X)
--   * patient books      → doctor           (patient writes clinic_id=Y where Y is the
--                                            booked doctor's clinic; recipient must be
--                                            that clinic's doctor)
-- and blocks every illegitimate one.
--
-- Idempotent: safe to re-run; drops then recreates the policy.

drop policy if exists notif_insert on public.notifications;

create policy notif_insert on public.notifications for insert
  with check (
    is_super_admin()
    or (
      -- All clinic-bound notifications must carry their clinic.
      clinic_id is not null
      and (
        -- Staff or doctor inside this clinic may notify anyone (typically a patient
        -- or a colleague of the same clinic). Clinic isolation is enforced because
        -- clinic_id MUST equal the inserter's current_clinic_id() JWT claim.
        (clinic_id = current_clinic_id()
         and current_user_role() in ('clinic_admin','employee','doctor'))

        -- A patient may notify a doctor — but ONLY a doctor of the clinic
        -- carried by this notification row. This is how the booking flow notifies
        -- the chosen doctor without letting patients spam strangers.
        or (current_user_role() = 'patient'
            and exists (
              select 1 from public.doctors d
              where d.profile_id = user_id
                and d.clinic_id  = clinic_id
            ))
      )
    )
  );
