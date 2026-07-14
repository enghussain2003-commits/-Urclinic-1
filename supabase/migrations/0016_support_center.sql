-- 0016 - UrClinic Support Center.
-- Secure ticketing, unread tracking, private attachments, and idempotent
-- support notifications.

begin;

alter table public.notifications
  add column if not exists route text,
  add column if not exists support_ticket_id uuid,
  add column if not exists event_key text;

create unique index if not exists notifications_event_key_once
  on public.notifications(event_key)
  where event_key is not null;

create table if not exists public.support_ticket_counters (
  ticket_day date primary key,
  last_number integer not null default 0
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null,
  clinic_id uuid references public.clinics(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  subject text not null,
  category text not null,
  description text not null,
  priority text not null default 'medium',
  status text not null default 'new',
  current_page text,
  device_info jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  message text not null,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  message_id uuid references public.support_messages(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.support_message_reads (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  message_id uuid not null references public.support_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'support_tickets_category_check') then
    alter table public.support_tickets add constraint support_tickets_category_check
      check (category in ('appointments','accounts','patients','doctors','employees','prescriptions','notifications','subscription','technical','suggestion','other'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'support_tickets_priority_check') then
    alter table public.support_tickets add constraint support_tickets_priority_check
      check (priority in ('low','medium','high','urgent'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'support_tickets_status_check') then
    alter table public.support_tickets add constraint support_tickets_status_check
      check (status in ('new','in_progress','waiting_for_user','resolved','closed','reopened'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'support_attachments_file_size_check') then
    alter table public.support_attachments add constraint support_attachments_file_size_check
      check (file_size is null or file_size between 0 and 10485760);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'support_attachments_file_type_check') then
    alter table public.support_attachments add constraint support_attachments_file_type_check
      check (
        file_type is null or file_type in ('image/jpeg','image/png','image/webp','application/pdf')
      );
  end if;
end $$;

create index if not exists idx_support_tickets_created_by on public.support_tickets(created_by);
create index if not exists idx_support_tickets_clinic_id on public.support_tickets(clinic_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);
create index if not exists idx_support_tickets_priority on public.support_tickets(priority);
create index if not exists idx_support_tickets_updated_at on public.support_tickets(updated_at desc);
create index if not exists idx_support_tickets_ticket_number on public.support_tickets(ticket_number);
create index if not exists idx_support_messages_ticket_id on public.support_messages(ticket_id);
create index if not exists idx_support_messages_created_at on public.support_messages(created_at);
create index if not exists idx_support_message_reads_user_id on public.support_message_reads(user_id);
create index if not exists idx_support_ticket_events_ticket_id on public.support_ticket_events(ticket_id);
create index if not exists idx_support_attachments_ticket_id on public.support_attachments(ticket_id);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;
alter table public.support_message_reads enable row level security;
alter table public.support_ticket_events enable row level security;

create or replace function public.can_view_all_support_tickets()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin();
$$;

create or replace function public.can_reply_as_support()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin();
$$;

create or replace function public.can_add_internal_note()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin();
$$;

create or replace function public.can_assign_ticket()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin();
$$;

create or replace function public.can_change_support_status()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin();
$$;

create or replace function public.support_ticket_participant(p_ticket_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.support_tickets t
    where t.id = p_ticket_id
      and (public.is_super_admin() or t.created_by = auth.uid())
  );
$$;

create or replace function public.support_ticket_owner(p_ticket_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select created_by from public.support_tickets where id = p_ticket_id;
$$;

create or replace function public.touch_support_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.touch_support_ticket();

create or replace function public.next_support_ticket_number()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_day date := current_date;
  v_next integer;
begin
  insert into public.support_ticket_counters(ticket_day, last_number)
  values (v_day, 1)
  on conflict (ticket_day)
  do update set last_number = public.support_ticket_counters.last_number + 1
  returning last_number into v_next;

  return 'SUP-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.support_actor_label(p_user_id uuid, p_lang text default 'en')
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_lang = 'ar' and p.role::text = 'doctor' then 'الدكتور ' || coalesce(nullif(p.full_name, ''), 'مستخدم')
    when p_lang = 'ar' and p.role::text = 'patient' then 'المريض ' || coalesce(nullif(p.full_name, ''), 'مستخدم')
    when p_lang = 'ar' and p.role::text = 'employee' then 'موظف العيادة ' || coalesce(nullif(p.full_name, ''), 'مستخدم')
    when p_lang = 'ar' and p.role::text = 'clinic_admin' then 'مدير العيادة ' || coalesce(nullif(p.full_name, ''), 'مستخدم')
    when p.role::text = 'doctor' then 'Dr. ' || coalesce(nullif(p.full_name, ''), 'User')
    when p.role::text = 'patient' then 'Patient ' || coalesce(nullif(p.full_name, ''), 'User')
    when p.role::text = 'employee' then 'Clinic employee ' || coalesce(nullif(p.full_name, ''), 'User')
    when p.role::text = 'clinic_admin' then 'Clinic Admin ' || coalesce(nullif(p.full_name, ''), 'User')
    else coalesce(nullif(p.full_name, ''), 'User')
  end
  from public.profiles p
  where p.id = p_user_id;
$$;

create or replace function public.insert_support_notification(
  p_recipient uuid,
  p_type text,
  p_title_ar text,
  p_title_en text,
  p_message_ar text,
  p_message_en text,
  p_ticket_id uuid,
  p_ticket_number text,
  p_route text,
  p_event_key text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_recipient is null or p_recipient = auth.uid() then
    return;
  end if;

  insert into public.notifications (
    clinic_id, user_id, title, message, type, route, support_ticket_id, event_key, metadata
  )
  values (
    null,
    p_recipient,
    p_title_ar,
    p_message_ar,
    p_type,
    p_route,
    p_ticket_id,
    p_event_key,
    jsonb_build_object(
      'title_ar', p_title_ar,
      'title_en', p_title_en,
      'message_ar', p_message_ar,
      'message_en', p_message_en,
      'ticket_id', p_ticket_id,
      'ticket_number', p_ticket_number,
      'route', p_route
    )
  )
  on conflict (event_key) where event_key is not null do nothing;
end;
$$;

create or replace function public.support_create_ticket(
  p_subject text,
  p_category text,
  p_description text,
  p_priority text default 'medium',
  p_current_page text default null,
  p_device_info jsonb default null
) returns public.support_tickets language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype;
  v_ticket public.support_tickets%rowtype;
  v_admin record;
  v_ticket_number text;
  v_label_ar text;
  v_label_en text;
  v_clinic_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or v_profile.role::text not in ('clinic_admin','doctor','employee','patient') then
    raise exception 'Only clinic users and patients can create support tickets';
  end if;

  if nullif(trim(p_subject), '') is null or nullif(trim(p_description), '') is null then
    raise exception 'Subject and description are required';
  end if;

  v_ticket_number := public.next_support_ticket_number();

  insert into public.support_tickets (
    ticket_number, clinic_id, created_by, subject, category, description, priority, current_page, device_info
  )
  values (
    v_ticket_number,
    v_profile.clinic_id,
    auth.uid(),
    trim(p_subject),
    p_category,
    trim(p_description),
    coalesce(nullif(p_priority, ''), 'medium'),
    nullif(p_current_page, ''),
    p_device_info
  )
  returning * into v_ticket;

  insert into public.support_ticket_events(ticket_id, actor_id, event_type, new_value)
  values (v_ticket.id, auth.uid(), 'ticket_created', to_jsonb(v_ticket));

  v_label_ar := public.support_actor_label(auth.uid(), 'ar');
  v_label_en := public.support_actor_label(auth.uid(), 'en');
  select name into v_clinic_name from public.clinics where id = v_profile.clinic_id;

  for v_admin in
    select id from public.profiles
    where role::text = 'super_admin' and coalesce(status, 'active') = 'active'
  loop
    perform public.insert_support_notification(
      v_admin.id,
      'support_ticket_created',
      'طلب دعم جديد من ' || coalesce(v_label_ar, 'مستخدم') || ' — ' || v_ticket.ticket_number,
      'New support ticket from ' || coalesce(v_label_en, 'User') || ' — ' || v_ticket.ticket_number,
      coalesce(v_ticket.subject, '') || coalesce(' · ' || nullif(v_clinic_name, ''), ''),
      coalesce(v_ticket.subject, '') || coalesce(' · ' || nullif(v_clinic_name, ''), ''),
      v_ticket.id,
      v_ticket.ticket_number,
      '/dashboard/super-admin/support/' || v_ticket.id,
      'support_ticket_created:' || v_ticket.id || ':' || v_admin.id
    );
  end loop;

  return v_ticket;
end;
$$;

create or replace function public.support_add_message(
  p_ticket_id uuid,
  p_message text,
  p_is_internal_note boolean default false
) returns public.support_messages language plpgsql security definer set search_path = public as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_message public.support_messages%rowtype;
  v_admin record;
  v_label_ar text;
  v_label_en text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if nullif(trim(p_message), '') is null then
    raise exception 'Message is required';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id;
  if v_ticket.id is null then
    raise exception 'Ticket not found';
  end if;

  if not public.is_super_admin() and v_ticket.created_by <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  if coalesce(p_is_internal_note, false) and not public.can_add_internal_note() then
    raise exception 'Not authorized to add internal notes';
  end if;

  insert into public.support_messages(ticket_id, sender_id, message, is_internal_note)
  values (p_ticket_id, auth.uid(), trim(p_message), coalesce(p_is_internal_note, false))
  returning * into v_message;

  insert into public.support_message_reads(ticket_id, message_id, user_id)
  values (p_ticket_id, v_message.id, auth.uid())
  on conflict (message_id, user_id) do nothing;

  insert into public.support_ticket_events(ticket_id, actor_id, event_type, new_value)
  values (
    p_ticket_id,
    auth.uid(),
    case when p_is_internal_note then 'internal_note_added' else 'message_created' end,
    jsonb_build_object('message_id', v_message.id, 'is_internal_note', v_message.is_internal_note)
  );

  if public.is_super_admin() and not v_message.is_internal_note then
    update public.support_tickets
      set first_response_at = coalesce(first_response_at, now()),
          status = case when status = 'new' then 'in_progress' else status end
      where id = p_ticket_id;

    perform public.insert_support_notification(
      v_ticket.created_by,
      'support_admin_reply',
      'تم الرد على طلب الدعم ' || v_ticket.ticket_number || ' من فريق دعم UrClinic.',
      'UrClinic Support replied to ticket ' || v_ticket.ticket_number || '.',
      'تم الرد من فريق دعم UrClinic',
      'UrClinic Support Team replied to your request.',
      v_ticket.id,
      v_ticket.ticket_number,
      '/dashboard/support/tickets/' || v_ticket.id,
      'support_admin_reply:' || v_ticket.id || ':' || v_message.id || ':' || v_ticket.created_by
    );
  elsif not public.is_super_admin() then
    v_label_ar := public.support_actor_label(auth.uid(), 'ar');
    v_label_en := public.support_actor_label(auth.uid(), 'en');
    for v_admin in
      select id from public.profiles
      where role::text = 'super_admin' and coalesce(status, 'active') = 'active'
    loop
      perform public.insert_support_notification(
        v_admin.id,
        'support_user_reply',
        'ردّ ' || coalesce(v_label_ar, 'المستخدم') || ' على طلب الدعم ' || v_ticket.ticket_number || '.',
        coalesce(v_label_en, 'User') || ' replied to support ticket ' || v_ticket.ticket_number || '.',
        trim(p_message),
        trim(p_message),
        v_ticket.id,
        v_ticket.ticket_number,
        '/dashboard/super-admin/support/' || v_ticket.id,
        'support_user_reply:' || v_ticket.id || ':' || v_message.id || ':' || v_admin.id
      );
    end loop;
  end if;

  return v_message;
end;
$$;

create or replace function public.support_update_ticket(
  p_ticket_id uuid,
  p_status text default null,
  p_priority text default null,
  p_assigned_to uuid default null
) returns public.support_tickets language plpgsql security definer set search_path = public as $$
declare
  v_old public.support_tickets%rowtype;
  v_new public.support_tickets%rowtype;
  v_event public.support_ticket_events%rowtype;
  v_notif_type text;
  v_title_ar text;
  v_title_en text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_old from public.support_tickets where id = p_ticket_id for update;
  if v_old.id is null then
    raise exception 'Ticket not found';
  end if;

  if public.is_super_admin() then
    update public.support_tickets
      set status = coalesce(nullif(p_status, ''), status),
          priority = coalesce(nullif(p_priority, ''), priority),
          assigned_to = case when public.can_assign_ticket() then coalesce(p_assigned_to, assigned_to) else assigned_to end,
          resolved_at = case when p_status = 'resolved' and status is distinct from 'resolved' then now() else resolved_at end,
          closed_at = case when p_status = 'closed' and status is distinct from 'closed' then now() else closed_at end
      where id = p_ticket_id
      returning * into v_new;
  elsif v_old.created_by = auth.uid() and p_status in ('closed','reopened') and p_priority is null and p_assigned_to is null then
    update public.support_tickets
      set status = p_status,
          closed_at = case when p_status = 'closed' then now() else closed_at end
      where id = p_ticket_id
      returning * into v_new;
  else
    raise exception 'Not authorized';
  end if;

  if v_old.status is distinct from v_new.status then
    insert into public.support_ticket_events(ticket_id, actor_id, event_type, old_value, new_value)
    values (
      p_ticket_id,
      auth.uid(),
      'status_changed',
      jsonb_build_object('status', v_old.status),
      jsonb_build_object('status', v_new.status)
    )
    returning * into v_event;

    v_notif_type := case v_new.status
      when 'in_progress' then 'support_status_in_progress'
      when 'waiting_for_user' then 'support_status_waiting'
      when 'resolved' then 'support_status_resolved'
      when 'closed' then 'support_status_closed'
      when 'reopened' then 'support_status_reopened'
      else null
    end;

    if v_notif_type is not null and public.is_super_admin() then
      v_title_ar := case v_new.status
        when 'in_progress' then 'بدأ فريق الدعم بمراجعة طلبك ' || v_new.ticket_number || '.'
        when 'waiting_for_user' then 'يحتاج فريق الدعم إلى معلومات إضافية في طلبك ' || v_new.ticket_number || '.'
        when 'resolved' then 'تم حل طلب الدعم ' || v_new.ticket_number || '.'
        when 'closed' then 'تم إغلاق طلب الدعم ' || v_new.ticket_number || '.'
        when 'reopened' then 'تمت إعادة فتح طلب الدعم ' || v_new.ticket_number || '.'
      end;
      v_title_en := case v_new.status
        when 'in_progress' then 'The support team started reviewing ticket ' || v_new.ticket_number || '.'
        when 'waiting_for_user' then 'The support team needs more information for ticket ' || v_new.ticket_number || '.'
        when 'resolved' then 'Support ticket ' || v_new.ticket_number || ' has been resolved.'
        when 'closed' then 'Support ticket ' || v_new.ticket_number || ' has been closed.'
        when 'reopened' then 'Support ticket ' || v_new.ticket_number || ' has been reopened.'
      end;
      perform public.insert_support_notification(
        v_new.created_by,
        v_notif_type,
        v_title_ar,
        v_title_en,
        v_title_ar,
        v_title_en,
        v_new.id,
        v_new.ticket_number,
        '/dashboard/support/tickets/' || v_new.id,
        v_notif_type || ':' || v_new.id || ':' || v_new.created_by || ':' || v_event.id
      );
    end if;
  end if;

  if v_old.priority is distinct from v_new.priority then
    insert into public.support_ticket_events(ticket_id, actor_id, event_type, old_value, new_value)
    values (p_ticket_id, auth.uid(), 'priority_changed', jsonb_build_object('priority', v_old.priority), jsonb_build_object('priority', v_new.priority));
  end if;

  if v_old.assigned_to is distinct from v_new.assigned_to then
    insert into public.support_ticket_events(ticket_id, actor_id, event_type, old_value, new_value)
    values (p_ticket_id, auth.uid(), 'assignment_changed', jsonb_build_object('assigned_to', v_old.assigned_to), jsonb_build_object('assigned_to', v_new.assigned_to));
  end if;

  return v_new;
end;
$$;

create or replace function public.support_mark_ticket_read(p_ticket_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not public.support_ticket_participant(p_ticket_id) then
    raise exception 'Not authorized';
  end if;

  insert into public.support_message_reads(ticket_id, message_id, user_id)
  select m.ticket_id, m.id, auth.uid()
  from public.support_messages m
  where m.ticket_id = p_ticket_id
    and m.sender_id <> auth.uid()
    and (public.is_super_admin() or m.is_internal_note = false)
  on conflict (message_id, user_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.support_register_attachment(
  p_ticket_id uuid,
  p_message_id uuid,
  p_file_name text,
  p_file_path text,
  p_file_type text,
  p_file_size bigint
) returns public.support_attachments language plpgsql security definer set search_path = public as $$
declare
  v_attachment public.support_attachments%rowtype;
  v_ext text;
  v_safe_name text;
begin
  if not public.support_ticket_participant(p_ticket_id) then
    raise exception 'Not authorized';
  end if;
  if p_message_id is not null and not exists (
    select 1 from public.support_messages
    where id = p_message_id and ticket_id = p_ticket_id
  ) then
    raise exception 'Message does not belong to ticket';
  end if;

  v_safe_name := regexp_replace(coalesce(p_file_name, ''), '[^A-Za-z0-9._ -]', '_', 'g');
  v_ext := lower(split_part(v_safe_name, '.', array_length(string_to_array(v_safe_name, '.'), 1)));
  if v_ext not in ('jpg','jpeg','png','webp','pdf') then
    raise exception 'File type is not allowed';
  end if;
  if p_file_type not in ('image/jpeg','image/png','image/webp','application/pdf') then
    raise exception 'MIME type is not allowed';
  end if;
  if p_file_size is not null and p_file_size > 10485760 then
    raise exception 'File is too large';
  end if;
  if p_file_path not like p_ticket_id::text || '/' || auth.uid()::text || '/%' then
    raise exception 'Invalid support attachment path';
  end if;

  insert into public.support_attachments(ticket_id, message_id, uploaded_by, file_name, file_path, file_type, file_size)
  values (p_ticket_id, p_message_id, auth.uid(), v_safe_name, p_file_path, p_file_type, p_file_size)
  returning * into v_attachment;

  insert into public.support_ticket_events(ticket_id, actor_id, event_type, new_value)
  values (p_ticket_id, auth.uid(), 'attachment_added', jsonb_build_object('attachment_id', v_attachment.id, 'file_name', v_attachment.file_name));

  return v_attachment;
end;
$$;

create or replace function public.support_unread_summary()
returns table(total_unread integer, open_tickets integer)
language sql stable security definer set search_path = public as $$
  with visible_tickets as (
    select id
    from public.support_tickets t
    where public.is_super_admin() or t.created_by = auth.uid()
  ),
  unread_messages as (
    select m.id
    from public.support_messages m
    join visible_tickets vt on vt.id = m.ticket_id
    left join public.support_message_reads r on r.message_id = m.id and r.user_id = auth.uid()
    where m.sender_id <> auth.uid()
      and r.id is null
      and (public.is_super_admin() or m.is_internal_note = false)
  )
  select
    (select count(*)::integer from unread_messages),
    (select count(*)::integer from public.support_tickets t
      where (public.is_super_admin() or t.created_by = auth.uid())
        and t.status in ('new','in_progress','waiting_for_user','reopened'));
$$;

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets for select
  using (public.is_super_admin() or created_by = auth.uid());

drop policy if exists support_tickets_update_owner on public.support_tickets;

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages for select
  using (
    public.support_ticket_participant(ticket_id)
    and (public.is_super_admin() or is_internal_note = false)
  );

drop policy if exists support_attachments_select on public.support_attachments;
create policy support_attachments_select on public.support_attachments for select
  using (public.support_ticket_participant(ticket_id));

drop policy if exists support_message_reads_select on public.support_message_reads;
create policy support_message_reads_select on public.support_message_reads for select
  using (public.is_super_admin() or user_id = auth.uid());

drop policy if exists support_ticket_events_select on public.support_ticket_events;
create policy support_ticket_events_select on public.support_ticket_events for select
  using (public.is_super_admin());

drop policy if exists support_message_reads_insert on public.support_message_reads;
create policy support_message_reads_insert on public.support_message_reads for insert
  with check (user_id = auth.uid() and public.support_ticket_participant(ticket_id));

drop policy if exists support_no_delete_events on public.support_ticket_events;
create policy support_no_delete_events on public.support_ticket_events for delete
  using (false);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.support_ticket_id_from_path(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.support_uploader_id_from_path(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 2)::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists support_attachments_storage_select on storage.objects;
create policy support_attachments_storage_select on storage.objects for select
  using (
    bucket_id = 'support-attachments'
    and public.support_ticket_participant(public.support_ticket_id_from_path(name))
  );

drop policy if exists support_attachments_storage_insert on storage.objects;
create policy support_attachments_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'support-attachments'
    and public.support_ticket_participant(public.support_ticket_id_from_path(name))
    and public.support_uploader_id_from_path(name) = auth.uid()
    and lower((storage.extension(name))) in ('jpg','jpeg','png','webp','pdf')
  );

grant execute on function public.support_create_ticket(text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.support_add_message(uuid,text,boolean) to authenticated;
grant execute on function public.support_update_ticket(uuid,text,text,uuid) to authenticated;
grant execute on function public.support_mark_ticket_read(uuid) to authenticated;
grant execute on function public.support_register_attachment(uuid,uuid,text,text,text,bigint) to authenticated;
grant execute on function public.support_unread_summary() to authenticated;
grant execute on function public.can_view_all_support_tickets() to authenticated;
grant execute on function public.can_reply_as_support() to authenticated;
grant execute on function public.can_add_internal_note() to authenticated;
grant execute on function public.can_assign_ticket() to authenticated;
grant execute on function public.can_change_support_status() to authenticated;

commit;
