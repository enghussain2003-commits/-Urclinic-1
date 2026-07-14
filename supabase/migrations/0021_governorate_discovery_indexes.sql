-- 0021 - Governorate normalization support for nationwide booking discovery.
--
-- clinics.governorate is the canonical doctor location. This migration keeps
-- old spelling variants readable, adds the missing-column guard for older
-- environments, and indexes the active doctor/clinic lookup shape used by the
-- patient booking page.

begin;

alter table public.clinics
  add column if not exists governorate text;

update public.clinics
set governorate = case btrim(governorate)
  when 'Qadisiyah' then 'Al-Qadisiyah'
  when 'Al Qadisiyah' then 'Al-Qadisiyah'
  when 'القادسية' then 'Al-Qadisiyah'
  when 'Salah al-Din' then 'Salah Al-Din'
  when 'Salah Al Din' then 'Salah Al-Din'
  when 'صلاح الدين' then 'Salah Al-Din'
  when 'Duhok' then 'Dohuk'
  when 'دهوك' then 'Dohuk'
  when 'بغداد' then 'Baghdad'
  when 'البصرة' then 'Basra'
  when 'نينوى' then 'Nineveh'
  when 'أربيل' then 'Erbil'
  when 'اربيل' then 'Erbil'
  when 'النجف' then 'Najaf'
  when 'كربلاء' then 'Karbala'
  when 'ذي قار' then 'Dhi Qar'
  when 'ميسان' then 'Maysan'
  when 'المثنى' then 'Muthanna'
  when 'واسط' then 'Wasit'
  when 'بابل' then 'Babil'
  when 'ديالى' then 'Diyala'
  when 'كركوك' then 'Kirkuk'
  when 'الأنبار' then 'Anbar'
  when 'الانبار' then 'Anbar'
  when 'السليمانية' then 'Sulaymaniyah'
  else btrim(governorate)
end
where governorate is not null
  and (
    btrim(governorate) <> governorate
    or btrim(governorate) in (
     'Qadisiyah', 'Al Qadisiyah', 'القادسية',
     'Salah al-Din', 'Salah Al Din', 'صلاح الدين',
     'Duhok', 'دهوك',
     'بغداد', 'البصرة', 'نينوى', 'أربيل', 'اربيل', 'النجف',
     'كربلاء', 'ذي قار', 'ميسان', 'المثنى', 'واسط', 'بابل',
     'ديالى', 'كركوك', 'الأنبار', 'الانبار', 'السليمانية'
    )
  );

create index if not exists idx_clinics_active_governorate
  on public.clinics(governorate)
  where is_active = true;

create index if not exists idx_doctors_active_clinic_specialty
  on public.doctors(clinic_id, specialty)
  where is_active = true;

-- Diagnostic: clinics that will only appear under "All Iraq" until admins
-- complete their location data.
do $$
declare
  v_missing int;
begin
  select count(*) into v_missing
  from public.clinics
  where is_active = true
    and nullif(btrim(coalesce(governorate, '')), '') is null;

  if v_missing > 0 then
    raise notice 'Active clinics missing governorate: %. They appear only under All Iraq in booking discovery.', v_missing;
  end if;
end $$;

commit;
