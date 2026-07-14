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
const DANGEROUS_EXTENSIONS = new Set(['svg', 'html', 'htm', 'js', 'mjs', 'exe', 'apk', 'zip', 'rar', '7z', 'sh', 'bat', 'cmd', 'php', 'scr', 'msi', 'jar']);
const signedUrlCache = new Map();

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
  const parts = file.name.split('.').filter(Boolean);
  const ext = parts.pop()?.toLowerCase() || '';
  if (parts.length > 1 || parts.some(part => DANGEROUS_EXTENSIONS.has(part.toLowerCase()))) {
    throw new Error('Unsupported attachment type. Use JPG, PNG, WEBP, or PDF.');
  }
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

const readHeader = async (file, bytes = 16) => {
  const buffer = await file.slice(0, bytes).arrayBuffer();
  return new Uint8Array(buffer);
};

const matchesMagicBytes = (header, type) => {
  if (type === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (type === 'image/png') return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  if (type === 'application/pdf') return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
  if (type === 'image/webp') {
    return header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
      && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;
  }
  return false;
};

export const validateSupportAttachmentFile = async (file) => {
  const info = validateSupportAttachment(file);
  if (!file) return null;
  const header = await readHeader(file);
  if (!matchesMagicBytes(header, info.type)) {
    throw new Error('Unsupported file format.');
  }
  return info;
};

export const sanitizeFileName = (name = 'attachment') =>
  name.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/\s+/g, '-').slice(0, 120);

export const formatSupportFileSize = (size = 0, isAr = false) => {
  const value = Number(size) || 0;
  if (value < 1024) return `${value} ${isAr ? 'بايت' : 'B'}`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} ${isAr ? 'ك.ب' : 'KB'}`;
  return `${(value / (1024 * 1024)).toFixed(1)} ${isAr ? 'م.ب' : 'MB'}`;
};

export const isImageAttachment = (attachment) =>
  String(attachment?.file_type || '').startsWith('image/');

const uniqueStorageName = (ext) => {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${id}.${ext}`;
};

export const supportStoragePath = ({ ticketId, messageId, ext }) =>
  `support/${ticketId}/${messageId}/${uniqueStorageName(ext)}`;

export const fetchSupportTickets = async ({ search = '', status = 'all', category = 'all', priority = 'all', sort = 'newest' } = {}) => {
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase
    .from('support_tickets')
    .select(`
      *,
      requester:profiles!support_tickets_created_by_fkey(id, full_name, role, email, clinic_id),
      clinic:clinics(id, name, phone),
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

export const fetchSupportMessage = async ({ ticketId, messageId }) => {
  const { data, error } = await supabase
    .from('support_messages')
    .select(`
      id, ticket_id, sender_id, message, is_internal_note, created_at, edited_at,
      sender:profiles!support_messages_sender_id_fkey(id, full_name, role, email),
      reads:support_message_reads(id, user_id, read_at),
      attachments:support_attachments(id, message_id, uploaded_by, file_name, file_path, file_type, file_size, created_at)
    `)
    .eq('ticket_id', ticketId)
    .eq('id', messageId)
    .single();
  if (error) throw error;
  return data;
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

const removeUploadedSupportObject = async (filePath) => {
  if (!filePath) return;
  const { error } = await supabase.storage.from('support-attachments').remove([filePath]);
  if (error) console.error('Support orphan upload cleanup failed:', error);
};

export const sendSupportMessage = async ({ ticketId, body = '', file = null, isInternalNote = false, onPhase } = {}) => {
  const trimmedBody = String(body || '').trim();
  if (!ticketId) throw new Error('Ticket is required');
  if (!trimmedBody && !file) throw new Error('Message or attachment is required');

  let uploadedPath = null;
  let fileInfo = null;
  let safeName = null;
  const provisionalMessageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    if (file) {
      onPhase?.('uploading');
      fileInfo = await validateSupportAttachmentFile(file);
      safeName = sanitizeFileName(file.name);
      uploadedPath = supportStoragePath({ ticketId, messageId: provisionalMessageId, ext: fileInfo.ext });
      const { error: uploadError } = await supabase.storage
        .from('support-attachments')
        .upload(uploadedPath, file, { cacheControl: '3600', upsert: false, contentType: fileInfo.type });
      if (uploadError) throw uploadError;
    }

    onPhase?.('sending');
    const { data, error } = await supabase.rpc('support_add_message_with_attachment', {
      p_ticket_id: ticketId,
      p_message: trimmedBody,
      p_is_internal_note: isInternalNote,
      p_client_message_id: provisionalMessageId,
      p_file_name: safeName,
      p_file_path: uploadedPath,
      p_file_type: fileInfo?.type || null,
      p_file_size: fileInfo?.size || null,
    });

    if (error) throw error;
    const payload = Array.isArray(data) ? data[0] : data;
    const messageId = payload?.message_id || payload?.message?.id;
    if (!messageId) throw new Error('Support message persistence failed');

    onPhase?.('hydrating');
    return await fetchSupportMessage({ ticketId, messageId });
  } catch (err) {
    if (uploadedPath) await removeUploadedSupportObject(uploadedPath);
    throw err;
  }
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
  const info = await validateSupportAttachmentFile(file);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const safeName = sanitizeFileName(file.name);
  if (!messageId) throw new Error('Attachment must belong to a support message');
  const filePath = supportStoragePath({ ticketId, messageId, ext: info.ext });
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
  if (error) {
    await removeUploadedSupportObject(filePath);
    throw error;
  }
  return Array.isArray(data) ? data[0] : data;
};

export const createSignedAttachmentUrl = async (filePath) => {
  const cached = signedUrlCache.get(filePath);
  if (cached && cached.expiresAt > Date.now() + 15_000) return cached.url;
  const { data, error } = await supabase.storage
    .from('support-attachments')
    .createSignedUrl(filePath, 60 * 5);
  if (error) throw error;
  if (data?.signedUrl) {
    signedUrlCache.set(filePath, { url: data.signedUrl, expiresAt: Date.now() + 4 * 60 * 1000 });
  }
  return data?.signedUrl;
};
