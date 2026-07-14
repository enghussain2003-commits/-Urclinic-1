-- 0023 - Harden support message + attachment persistence.
--
-- Storage upload happens before the database call, but message creation and
-- attachment metadata linking now happen together in one SECURITY DEFINER RPC.

begin;

create index if not exists idx_support_messages_ticket_created
  on public.support_messages(ticket_id, created_at);

create index if not exists idx_support_attachments_message_id
  on public.support_attachments(message_id);

do $$
begin
  if not exists (
    select 1
    from public.support_attachments
    group by file_path
    having count(*) > 1
  ) then
    create unique index if not exists support_attachments_file_path_uniq
      on public.support_attachments(file_path);
  else
    raise notice 'Duplicate support attachment file_path values exist; skipping unique index support_attachments_file_path_uniq.';
  end if;
end $$;

create or replace function public.support_ticket_id_from_path(p_name text)
returns uuid language plpgsql immutable as $$
declare
  v_parts text[];
begin
  v_parts := string_to_array(coalesce(p_name, ''), '/');
  if coalesce(v_parts[1], '') = 'support' then
    return nullif(v_parts[2], '')::uuid;
  end if;
  return nullif(v_parts[1], '')::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.support_message_id_from_path(p_name text)
returns uuid language plpgsql immutable as $$
declare
  v_parts text[];
begin
  v_parts := string_to_array(coalesce(p_name, ''), '/');
  if coalesce(v_parts[1], '') = 'support' then
    return nullif(v_parts[3], '')::uuid;
  end if;
  return null;
exception when others then
  return null;
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
  if p_message_id is null then
    raise exception 'Attachment must belong to a support message';
  end if;
  if not exists (
    select 1 from public.support_messages
    where id = p_message_id and ticket_id = p_ticket_id
  ) then
    raise exception 'Message does not belong to ticket';
  end if;

  v_safe_name := left(regexp_replace(coalesce(p_file_name, ''), '[^A-Za-z0-9._ -]', '_', 'g'), 120);
  v_ext := lower(split_part(v_safe_name, '.', array_length(string_to_array(v_safe_name, '.'), 1)));
  if v_ext not in ('jpg','jpeg','png','webp','pdf') then
    raise exception 'File type is not allowed';
  end if;
  if p_file_type not in ('image/jpeg','image/png','image/webp','application/pdf') then
    raise exception 'MIME type is not allowed';
  end if;
  if p_file_size is null or p_file_size < 0 or p_file_size > 10485760 then
    raise exception 'File is too large';
  end if;
  if public.support_ticket_id_from_path(p_file_path) is distinct from p_ticket_id then
    raise exception 'Invalid support attachment path';
  end if;
  if public.support_message_id_from_path(p_file_path) is distinct from p_message_id then
    raise exception 'Invalid support attachment message path';
  end if;

  insert into public.support_attachments(ticket_id, message_id, uploaded_by, file_name, file_path, file_type, file_size)
  values (p_ticket_id, p_message_id, auth.uid(), v_safe_name, p_file_path, p_file_type, p_file_size)
  returning * into v_attachment;

  insert into public.support_ticket_events(ticket_id, actor_id, event_type, new_value)
  values (p_ticket_id, auth.uid(), 'attachment_added', jsonb_build_object('attachment_id', v_attachment.id, 'message_id', p_message_id, 'file_name', v_attachment.file_name));

  return v_attachment;
end;
$$;

create or replace function public.support_add_message_with_attachment(
  p_ticket_id uuid,
  p_message text,
  p_is_internal_note boolean default false,
  p_client_message_id uuid default null,
  p_file_name text default null,
  p_file_path text default null,
  p_file_type text default null,
  p_file_size bigint default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_message public.support_messages%rowtype;
  v_attachment public.support_attachments%rowtype;
  v_admin record;
  v_label_ar text;
  v_label_en text;
  v_has_attachment boolean := nullif(trim(coalesce(p_file_path, '')), '') is not null;
  v_body text := coalesce(trim(p_message), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if nullif(v_body, '') is null and not v_has_attachment then
    raise exception 'Message or attachment is required';
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

  insert into public.support_messages(id, ticket_id, sender_id, message, is_internal_note)
  values (coalesce(p_client_message_id, gen_random_uuid()), p_ticket_id, auth.uid(), v_body, coalesce(p_is_internal_note, false))
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

  if v_has_attachment then
    v_attachment := public.support_register_attachment(
      p_ticket_id,
      v_message.id,
      p_file_name,
      p_file_path,
      p_file_type,
      p_file_size
    );
  end if;

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
      case when nullif(v_body, '') is null then 'تم إرسال مرفق من فريق دعم UrClinic' else v_body end,
      case when nullif(v_body, '') is null then 'UrClinic Support Team sent an attachment.' else v_body end,
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
        case when nullif(v_body, '') is null then 'تم إرسال مرفق' else v_body end,
        case when nullif(v_body, '') is null then 'Attachment sent.' else v_body end,
        v_ticket.id,
        v_ticket.ticket_number,
        '/dashboard/super-admin/support/' || v_ticket.id,
        'support_user_reply:' || v_ticket.id || ':' || v_message.id || ':' || v_admin.id
      );
    end loop;
  end if;

  return jsonb_build_object(
    'message_id', v_message.id,
    'message', to_jsonb(v_message),
    'attachment', case when v_attachment.id is null then null else to_jsonb(v_attachment) end
  );
end;
$$;

drop policy if exists support_attachments_storage_delete on storage.objects;
create policy support_attachments_storage_delete on storage.objects for delete
  using (
    bucket_id = 'support-attachments'
    and public.support_ticket_participant(public.support_ticket_id_from_path(name))
  );

grant execute on function public.support_message_id_from_path(text) to authenticated;
grant execute on function public.support_add_message_with_attachment(uuid,text,boolean,uuid,text,text,text,bigint) to authenticated;

commit;
