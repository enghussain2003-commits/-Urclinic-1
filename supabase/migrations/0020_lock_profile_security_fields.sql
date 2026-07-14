-- 0020 - Lock protected profile security fields.
--
-- The previous profiles_update policy allowed clinic_admin users to update any
-- same-clinic profile and only checked that the resulting row stayed in the
-- same clinic. That made role/status/password-flag changes possible through
-- direct client table updates. Keep ordinary self profile edits, but force
-- privileged account mutations through trusted service-role flows.

begin;

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (
    is_super_admin()
    or id = auth.uid()
  )
  with check (
    is_super_admin()
    or (
      id = auth.uid()
      and role = current_user_role()::public.user_role
      and clinic_id is not distinct from current_clinic_id()
    )
  );

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete
  using (is_super_admin());

create or replace function public.prevent_unsafe_profile_security_field_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bypass text := current_setting('app.profile_security_bypass', true);
begin
  -- Service-role Edge Functions, migrations, and trusted admin SQL do not have
  -- an end-user auth.uid(). They already bypass RLS and remain the sanctioned
  -- path for role, clinic, status, and password-flag management.
  if auth.uid() is null then
    return new;
  end if;

  -- Forced-password onboarding needs exactly one server-side escape hatch after
  -- Supabase Auth accepts the password change. No other protected field may move.
  if v_bypass = 'clear_own_must_change_password'
     and new.id = old.id
     and new.id = auth.uid()
     and new.role is not distinct from old.role
     and new.clinic_id is not distinct from old.clinic_id
     and new.status is not distinct from old.status
     and old.must_change_password is true
     and new.must_change_password is false
     and new.email is not distinct from old.email
     and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profile id cannot be changed'
      using errcode = '42501';
  end if;

  if new.role is distinct from old.role then
    raise exception 'profile role cannot be changed through direct profile updates'
      using errcode = '42501';
  end if;

  if new.clinic_id is distinct from old.clinic_id then
    raise exception 'profile clinic cannot be changed through direct profile updates'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'profile status cannot be changed through direct profile updates'
      using errcode = '42501';
  end if;

  if new.must_change_password is distinct from old.must_change_password then
    raise exception 'profile password flag cannot be changed through direct profile updates'
      using errcode = '42501';
  end if;

  if new.email is distinct from old.email then
    raise exception 'profile email cannot be changed through direct profile updates'
      using errcode = '42501';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'profile creation timestamp cannot be changed through direct profile updates'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_block_security_field_update on public.profiles;
create trigger trg_profiles_block_security_field_update
  before update on public.profiles
  for each row execute function public.prevent_unsafe_profile_security_field_update();

revoke all on function public.prevent_unsafe_profile_security_field_update() from public, anon, authenticated;

create or replace function public.clear_own_must_change_password()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  perform set_config('app.profile_security_bypass', 'clear_own_must_change_password', true);

  update public.profiles
     set must_change_password = false
   where id = auth.uid()
     and must_change_password is true;
end;
$$;

revoke all on function public.clear_own_must_change_password() from public, anon;
grant execute on function public.clear_own_must_change_password() to authenticated;

commit;
