-- 0015 - Keep patient profile email synchronized with Supabase Auth on signup.
--
-- The canonical login email lives in auth.users.email. profiles.email is a
-- denormalized application field and must be populated from Auth, not from
-- patients.email.

begin;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone_number, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'patient'
  )
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email);
  return new;
end;
$$;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.role::text = 'patient'
  and (p.email is null or btrim(p.email) = '')
  and u.email is not null;

commit;
