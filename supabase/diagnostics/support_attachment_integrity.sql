-- Read-only diagnostics for UrClinic support attachment integrity.
-- Run in Supabase SQL editor when auditing support attachment data.

-- Attachment rows that are not linked to a real support message.
select
  a.id,
  a.ticket_id,
  a.message_id,
  a.file_name,
  a.file_path,
  a.created_at
from public.support_attachments a
left join public.support_messages m on m.id = a.message_id and m.ticket_id = a.ticket_id
where a.message_id is null or m.id is null
order by a.created_at desc;

-- Duplicate metadata rows for the same storage path.
select
  file_path,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as attachment_ids
from public.support_attachments
group by file_path
having count(*) > 1;

-- Messages whose storage-path-linked attachments do not follow the hardened path format.
select
  a.id,
  a.ticket_id,
  a.message_id,
  a.file_path,
  public.support_ticket_id_from_path(a.file_path) as path_ticket_id,
  public.support_message_id_from_path(a.file_path) as path_message_id
from public.support_attachments a
where public.support_ticket_id_from_path(a.file_path) is distinct from a.ticket_id
   or public.support_message_id_from_path(a.file_path) is distinct from a.message_id
order by a.created_at desc;

-- Storage objects with no attachment metadata row.
select
  o.name as storage_path,
  o.created_at,
  o.updated_at,
  o.metadata
from storage.objects o
left join public.support_attachments a on a.file_path = o.name
where o.bucket_id = 'support-attachments'
  and a.id is null
order by o.created_at desc;

-- Attachment metadata rows whose storage object is missing.
select
  a.id,
  a.ticket_id,
  a.message_id,
  a.file_name,
  a.file_path,
  a.created_at
from public.support_attachments a
left join storage.objects o
  on o.bucket_id = 'support-attachments'
 and o.name = a.file_path
where o.id is null
order by a.created_at desc;
