-- 0019 - Patient identity and Iraqi phone validation.
--
-- Enforces stronger validation for new/updated patient identity records without
-- deleting or rewriting existing data. Constraints are NOT VALID so production
-- can inspect and clean old rows separately.

begin;

create or replace function public.normalize_iraqi_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_raw text;
  v_clean text;
  v_local text;
  v_subscriber text;
begin
  if p_phone is null or btrim(p_phone) = '' then
    return null;
  end if;

  v_raw := translate(p_phone, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  if v_raw ~ '[A-Za-zء-ي]' then
    return null;
  end if;

  v_clean := regexp_replace(v_raw, '[[:space:]\-\(\)\.]', '', 'g');

  if v_clean ~ '^07[0-9]{9}$' then
    v_local := substring(v_clean from 2);
  elsif v_clean ~ '^\+9647[0-9]{9}$' then
    v_local := substring(v_clean from 5);
  elsif v_clean ~ '^9647[0-9]{9}$' then
    v_local := substring(v_clean from 4);
  else
    return null;
  end if;

  if v_local !~ '^7[0-9]{9}$' then
    return null;
  end if;

  v_subscriber := substring(v_local from 2);
  if v_subscriber ~ '^([0-9])\1{8}$' or v_subscriber = '000000000' then
    return null;
  end if;

  return '+964' || v_local;
end;
$$;

create or replace function public.is_valid_iraqi_phone(p_phone text)
returns boolean
language sql
immutable
as $$
  select p_phone is null or public.normalize_iraqi_phone(p_phone) is not null;
$$;

create or replace function public.normalize_person_name(p_name text)
returns text
language sql
immutable
as $$
  select nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
$$;

create or replace function public.is_placeholder_person_name(p_name text)
returns boolean
language sql
immutable
as $$
  select lower(public.normalize_person_name(p_name)) in (
    'test', 'testing', 'user', 'unknown', 'fake', 'demo', 'asdf', 'qwerty',
    'تجربة', 'تجريبي', 'مجهول', 'وهمي', 'مريض'
  )
  or exists (
    select 1
    from regexp_split_to_table(lower(public.normalize_person_name(p_name)), '\s+') part
    where part in (
      'test', 'testing', 'user', 'unknown', 'fake', 'demo', 'asdf', 'qwerty',
      'تجربة', 'تجريبي', 'مجهول', 'وهمي', 'مريض'
    )
  );
$$;

create or replace function public.is_valid_person_name(p_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_name text := public.normalize_person_name(p_name);
  v_compact text;
  v_word_count int;
begin
  if v_name is null then
    return false;
  end if;

  if char_length(v_name) < 4 or char_length(v_name) > 60 then
    return false;
  end if;

  if v_name ~ '[0-9٠-٩۰-۹]' then
    return false;
  end if;

  if v_name ~ '[^A-Za-zء-ي[:space:]''-]' then
    return false;
  end if;

  select count(*) into v_word_count
  from regexp_split_to_table(v_name, '\s+') part
  where part <> '';

  if v_word_count < 2 then
    return false;
  end if;

  v_compact := regexp_replace(v_name, '[[:space:]''-]', '', 'g');
  if v_compact ~ '^(.)\1{5,}$' then
    return false;
  end if;

  if public.is_placeholder_person_name(v_name) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.normalize_patient_identity_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  new.full_name := public.normalize_person_name(new.full_name);
  if new.phone is not null and btrim(new.phone) <> '' then
    v_phone := public.normalize_iraqi_phone(new.phone);
    if v_phone is not null then
      new.phone := v_phone;
    end if;
  elsif new.phone is not null then
    new.phone := null;
  end if;
  return new;
end;
$$;

create or replace function public.normalize_profile_identity_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  new.full_name := public.normalize_person_name(new.full_name);
  if new.phone_number is not null and btrim(new.phone_number) <> '' then
    v_phone := public.normalize_iraqi_phone(new.phone_number);
    if v_phone is not null then
      new.phone_number := v_phone;
    end if;
  elsif new.phone_number is not null then
    new.phone_number := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_patients_normalize_identity on public.patients;
create trigger trg_patients_normalize_identity
  before insert or update of full_name, phone on public.patients
  for each row execute function public.normalize_patient_identity_fields();

drop trigger if exists trg_profiles_normalize_identity on public.profiles;
create trigger trg_profiles_normalize_identity
  before insert or update of full_name, phone_number on public.profiles
  for each row execute function public.normalize_profile_identity_fields();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'patients_phone_iraqi_check') then
    alter table public.patients
      add constraint patients_phone_iraqi_check
      check (phone is null or public.is_valid_iraqi_phone(phone)) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_phone_iraqi_check') then
    alter table public.profiles
      add constraint profiles_phone_iraqi_check
      check (phone_number is null or public.is_valid_iraqi_phone(phone_number)) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'patients_full_name_quality_check') then
    alter table public.patients
      add constraint patients_full_name_quality_check
      check (public.is_valid_person_name(full_name)) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_patient_full_name_quality_check') then
    alter table public.profiles
      add constraint profiles_patient_full_name_quality_check
      check (role::text <> 'patient' or public.is_valid_person_name(full_name)) not valid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.profiles
    where role::text = 'patient'
      and phone_number is not null
      and public.normalize_iraqi_phone(phone_number) is not null
    group by public.normalize_iraqi_phone(phone_number)
    having count(*) > 1
  ) then
    raise notice 'Duplicate normalized patient profile phones exist. Skipping profiles_patient_phone_normalized_uniq; run diagnostics before cleanup.';
  elsif not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_patient_phone_normalized_uniq'
  ) then
    execute 'create unique index profiles_patient_phone_normalized_uniq on public.profiles (public.normalize_iraqi_phone(phone_number)) where role::text = ''patient'' and phone_number is not null and public.normalize_iraqi_phone(phone_number) is not null';
  end if;

  if exists (
    select 1
    from public.patients
    where phone is not null
      and public.normalize_iraqi_phone(phone) is not null
    group by clinic_id, public.normalize_iraqi_phone(phone)
    having count(*) > 1
  ) then
    raise notice 'Duplicate normalized clinic patient phones exist. Skipping patients_clinic_phone_normalized_uniq; run diagnostics before cleanup.';
  elsif not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'patients_clinic_phone_normalized_uniq'
  ) then
    execute 'create unique index patients_clinic_phone_normalized_uniq on public.patients (clinic_id, public.normalize_iraqi_phone(phone)) where phone is not null and public.normalize_iraqi_phone(phone) is not null';
  end if;
end $$;

create or replace function public.is_patient_phone_available(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_iraqi_phone(p_phone);
begin
  if v_phone is null then
    return false;
  end if;

  return not exists (
    select 1 from public.profiles p
    where p.role::text = 'patient'
      and public.normalize_iraqi_phone(p.phone_number) = v_phone
  );
end;
$$;

grant execute on function public.is_patient_phone_available(text) to anon, authenticated;

create or replace function public.enforce_patient_booking_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.appointments a
    where a.patient_id = new.patient_id
      and a.created_at > now() - interval '60 seconds'
      and a.id is distinct from new.id
  ) then
    raise exception 'booking rate limit exceeded'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_patient_booking_cooldown on public.appointments;
create trigger trg_patient_booking_cooldown
  before insert on public.appointments
  for each row execute function public.enforce_patient_booking_cooldown();

commit;

-- Diagnostic queries to run before optional cleanup:
--
-- Invalid patient phones:
-- select id, clinic_id, full_name, phone from public.patients
-- where phone is not null and public.normalize_iraqi_phone(phone) is null;
--
-- Duplicate normalized patient phones per clinic:
-- select clinic_id, public.normalize_iraqi_phone(phone) normalized_phone, count(*), array_agg(id) patient_ids
-- from public.patients
-- where phone is not null and public.normalize_iraqi_phone(phone) is not null
-- group by clinic_id, public.normalize_iraqi_phone(phone)
-- having count(*) > 1;
--
-- Invalid patient profile phones:
-- select id, full_name, phone_number from public.profiles
-- where role::text = 'patient'
--   and phone_number is not null
--   and public.normalize_iraqi_phone(phone_number) is null;
--
-- Placeholder/invalid names:
-- select 'patients' source, id, full_name from public.patients
-- where not public.is_valid_person_name(full_name)
-- union all
-- select 'profiles' source, id, full_name from public.profiles
-- where role::text = 'patient' and not public.is_valid_person_name(full_name);
