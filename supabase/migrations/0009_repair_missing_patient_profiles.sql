-- 0009 - Repair auth-linked patients missing profile rows.
--
-- notifications.user_id references public.profiles(id), while prescription
-- notifications target public.patients.auth_user_id. If an auth user was
-- linked to a patient before the auth.users -> profiles trigger existed or ran,
-- the notification insert cannot satisfy notifications_user_id_fkey.
--
-- This backfills only missing profile rows. Existing profiles are preserved by
-- the left join filter and ON CONFLICT guard.

insert into public.profiles (
  id,
  full_name,
  email,
  phone_number,
  role,
  clinic_id
)
select distinct on (p.auth_user_id)
  p.auth_user_id,
  coalesce(nullif(p.full_name, ''), nullif(u.raw_user_meta_data ->> 'full_name', ''), ''),
  coalesce(nullif(p.email, ''), u.email),
  coalesce(nullif(p.phone, ''), nullif(u.raw_user_meta_data ->> 'phone', '')),
  'patient'::public.user_role,
  null
from public.patients p
join auth.users u
  on u.id = p.auth_user_id
left join public.profiles existing
  on existing.id = p.auth_user_id
where p.auth_user_id is not null
  and existing.id is null
order by p.auth_user_id, p.created_at nulls last, p.id
on conflict (id) do nothing;

-- Keep the future signup invariant explicit and idempotent in case an older
-- database was missing the trigger even though the function exists.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
