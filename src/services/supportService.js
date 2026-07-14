import { supabase } from '../supabaseClient';

export const SUPPORT_CATEGORIES = [
  'appointments',
  'accounts',
  'patients',
  'doctors',
  'employees',
  'prescriptions',
  'notifications',
  'subscription',
  'technical',
  'suggestion',
  'other',
];

export const SUPPORT_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const SUPPORT_STATUSES = ['new', 'in_progress', 'waiting_for_user', 'resolved', 'closed', 'reopened'];

export const SUPPORT_NOTIFICATION_TYPES = [
  'support_ticket_created',
  'support_user_reply',
  'support_admin_reply',
  'support_status_in_progress',
  'support_status_waiting',
  'support_status_resolved',
  'support_status_closed',
  'support_status_reopened',
];

export const canViewAllSupportTickets = (user) => user?.role === 'super_admin';
export const canReplyAsSupport = (user) => user?.role === 'super_admin';
export const canAddInternalNote = (user) => user?.role === 'super_admin';
export const canAssignTicket = (user) => user?.role === 'super_admin';
export const canChangeSupportStatus = (user) => user?.role === 'super_admin';
export const canCreateSupportTicket = (user) =>
  ['clinic_admin', 'doctor', 'employee', 'patient'].includes(user?.role);

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export const localizedSupportText = (row, field, isAr) => {
  const metadata = row?.metadata || {};
  const localized = metadata[`${field}_${isAr ? 'ar' : 'en'}`];
  return localized || row?.[field] || '';
};

export const supportRouteForNotification = (notification, role) => {
  const metadata = notification?.metadata || {};
  const ticketId = notification?.support_ticket_id || metadata.ticket_id;
  if (notification?.route || metadata.route) return notification.route || metadata.route;
  if (!ticketId) return null;
  return role === 'super_admin'
    ? `/dashboard/super-admin/support/${ticketId}`
    : `/dashboard/support/tickets/${ticketId}`;
};

export const getDeviceInfo = () => {
  if (typeof window === 'undefined') return {};
  const nav = window.navigator || {};
  return {
    route: window.location?.pathname || '',
    device_type: /Android|iPhone|iPad|Mobile/i.test(nav.userAgent || '') ? 'mobile' : 'desktop',
    browser: nav.userAgentData?.brands?.map(b => b.brand).join(', ') || nav.userAgent || '',
    operating_system: nav.platform || '',
    screen_size: `${window.screen?.width || window.innerWidth}x${window.screen?.height || window.innerHeight}`,
    viewport_size: `${window.innerWidth}x${window.innerHeight}`,
    app_version: import.meta.env.VITE_APP_VERSION || '',
    language: nav.language || '',
    timestamp: new Date().toISOString(),
  };
};

export const validateSupportAttachment = (file) => {
  if (!file) return null;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error('Unsupported attachment type. Use JPG, PNG, WEBP, or PDF.');
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Unsupported file format.');
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error('Attachment must be 10 MB or smaller.');
  }
  return { ext, type: file.type, size: file.size };
};

export const sanitizeFileName = (name = 'attachment') =>
  name.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/\s+/g, '-').slice(0, 120);

export const fetchSupportTickets = async ({ search = '', status = 'all', category = 'all', priority = 'all', sort = 'newest' } = {}) => {
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase
    .from('support_tickets')
    .select(`
      *,
      requester:profiles!support_tickets_created_by_fkey(id, full_name, role, email, clinic_id),
      clinic:clinics(id, name),
      messages:support_messages(id, sender_id, is_internal_note, created_at, reads:support_message_reads(id, user_id))
    `);

  if (status !== 'all') query = query.eq('status', status);
  if (category !== 'all') query = query.eq('category', category);
  if (priority !== 'all') query = query.eq('priority', priority);

  const { data, error } = await query.order('updated_at', { ascending: sort === 'oldest' });
  if (error) throw error;

  const term = search.trim().toLowerCase();
  return (data || [])
    .map(ticket => ({
      ...ticket,
      unread_count: (ticket.messages || []).filter(m =>
        m.sender_id !== user?.id &&
        !m.is_internal_note &&
        !(m.reads || []).some(r => r.user_id === user?.id)
      ).length,
    }))
    .filter(ticket => {
      if (!term) return true;
      return [
        ticket.ticket_number,
        ticket.subject,
        ticket.requester?.full_name,
        ticket.clinic?.name,
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(term));
    });
};

export const fetchSupportTicket = async (ticketId) => {
  const { data, error } = await supabase
    .from('support_tickets')
    .select(`
      *,
      requester:profiles!support_tickets_created_by_fkey(id, full_name, role, email, phone_number, clinic_id),
      assignee:profiles!support_tickets_assigned_to_fkey(id, full_name, role),
      clinic:clinics(id, name, phone, address),
      messages:support_messages(
        id, ticket_id, sender_id, message, is_internal_note, created_at, edited_at,
        sender:profiles!support_messages_sender_id_fkey(id, full_name, role, email),
        reads:support_message_reads(id, user_id, read_at),
        attachments:support_attachments(id, file_name, file_path, file_type, file_size, created_at)
      ),
      attachments:support_attachments(id, message_id, uploaded_by, file_name, file_path, file_type, file_size, created_at),
      events:support_ticket_events(id, actor_id, event_type, old_value, new_value, created_at, actor:profiles!support_ticket_events_actor_id_fkey(id, full_name, role))
    `)
    .eq('id', ticketId)
    .single();

  if (error) throw error;
  return {
    ...data,
    messages: [...(data.messages || [])].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')),
    events: [...(data.events || [])].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
  };
};

export const createSupportTicket = async ({ subject, category, description, priority, currentPage, deviceInfo }) => {
  const { data, error } = await supabase.rpc('support_create_ticket', {
    p_subject: subject,
    p_category: category,
    p_description: description,
    p_priority: priority,
    p_current_page: currentPage,
    p_device_info: deviceInfo,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
};

export const addSupportMessage = async ({ ticketId, message, isInternalNote = false }) => {
  const { data, error } = await supabase.rpc('support_add_message', {
    p_ticket_id: ticketId,
    p_message: message,
    p_is_internal_note: isInternalNote,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
};

export const updateSupportTicket = async ({ ticketId, status = null, priority = null, assignedTo = null }) => {
  const { data, error } = await supabase.rpc('support_update_ticket', {
    p_ticket_id: ticketId,
    p_status: status,
    p_priority: priority,
    p_assigned_to: assignedTo,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
};

export const markSupportTicketRead = async (ticketId) => {
  const { data, error } = await supabase.rpc('support_mark_ticket_read', { p_ticket_id: ticketId });
  if (error) throw error;
  return data;
};

export const fetchSupportUnreadSummary = async () => {
  const { data, error } = await supabase.rpc('support_unread_summary');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || { total_unread: 0, open_tickets: 0 };
};

export const uploadSupportAttachment = async ({ ticketId, messageId = null, file }) => {
  const info = validateSupportAttachment(file);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const safeName = sanitizeFileName(file.name);
  const filePath = `${ticketId}/${user.id}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from('support-attachments')
    .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: info.type });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.rpc('support_register_attachment', {
    p_ticket_id: ticketId,
    p_message_id: messageId,
    p_file_name: safeName,
    p_file_path: filePath,
    p_file_type: info.type,
    p_file_size: info.size,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
};

export const createSignedAttachmentUrl = async (filePath) => {
  const { data, error } = await supabase.storage
    .from('support-attachments')
    .createSignedUrl(filePath, 60 * 5);
  if (error) throw error;
  return data?.signedUrl;
};
