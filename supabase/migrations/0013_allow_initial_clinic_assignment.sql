-- 0013 - Allow initial clinic assignment while preserving tenant immutability.
--
-- The auth.users -> profiles trigger creates new profiles before the Super Admin
-- provisioning function can assign the clinic. That first transition is:
--   OLD.clinic_id IS NULL -> NEW.clinic_id IS NOT NULL
-- and must be allowed.
--
-- Any later movement away from an already assigned clinic remains blocked,
-- including changing a non-null clinic_id to another clinic or back to NULL.

create or replace function public.enforce_clinic_id_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- No change, including NULL -> NULL, is always safe.
  if new.clinic_id is not distinct from old.clinic_id then
    return new;
  end if;

  -- Allow the initial assignment of a clinic_id for rows created before the
  -- tenant is known, such as profiles inserted by handle_new_user().
  if old.clinic_id is null and new.clinic_id is not null then
    return new;
  end if;

  -- Once assigned, a clinic-scoped row cannot be moved to a different clinic
  -- or detached back to NULL by ordinary update paths.
  raise exception 'clinic_id is immutable: a record cannot be moved between clinics';
end;
$$;
