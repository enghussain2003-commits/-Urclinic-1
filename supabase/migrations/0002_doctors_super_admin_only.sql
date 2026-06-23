-- =====================================================================
-- CareClinic → Doctors RLS update (0002)
-- Restrict doctor INSERT/UPDATE/DELETE to super_admin only.
-- Previously clinic_admin could insert doctors; that permission is revoked.
-- =====================================================================

begin;

-- Replace the INSERT policy: only super_admin may create doctor records.
drop policy if exists doctors_insert on public.doctors;
create policy doctors_insert on public.doctors for insert
  with check (
    is_super_admin()
    and public.profile_in_clinic(profile_id, clinic_id)
  );

-- Replace the UPDATE policy: only super_admin may edit doctor records.
drop policy if exists doctors_update on public.doctors;
create policy doctors_update on public.doctors for update
  using  (is_super_admin())
  with check (
    is_super_admin()
    and public.profile_in_clinic(profile_id, clinic_id)
  );

-- Replace the DELETE policy: only super_admin may delete doctor records.
drop policy if exists doctors_delete on public.doctors;
create policy doctors_delete on public.doctors for delete
  using (is_super_admin());

commit;
