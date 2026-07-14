import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Lock, Paperclip, RefreshCw, Send, ShieldCheck, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../hooks/useToast';
import ContactActionsCard from '../ContactActionsCard';
import { buildContactMessage } from '../../services/contactService';
import {
  addSupportMessage,
  canAddInternalNote,
  canChangeSupportStatus,
  canReplyAsSupport,
  createSignedAttachmentUrl,
  fetchSupportTicket,
  markSupportTicketRead,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  updateSupportTicket,
  uploadSupportAttachment,
  validateSupportAttachment,
} from '../../services/supportService';
import { supabase } from '../../supabaseClient';

const roleLabel = (role, isAr) => ({
  super_admin: isAr ? 'فريق دعم UrClinic' : 'UrClinic Support Team',
  clinic_admin: isAr ? 'مدير العيادة' : 'Clinic Admin',
  doctor: isAr ? 'طبيب' : 'Doctor',
  employee: isAr ? 'موظف' : 'Employee',
  patient: isAr ? 'مريض' : 'Patient',
}[role] || role || '-');

const statusLabel = (status, isAr) => ({
  new: isAr ? 'جديد' : 'New',
  in_progress: isAr ? 'قيد المراجعة' : 'In progress',
  waiting_for_user: isAr ? 'بانتظار المستخدم' : 'Waiting for user',
  resolved: isAr ? 'تم الحل' : 'Resolved',
  closed: isAr ? 'مغلق' : 'Closed',
  reopened: isAr ? 'أعيد فتحه' : 'Reopened',
}[status] || status);

const priorityLabel = (priority, isAr) => ({
  low: isAr ? 'منخفض' : 'Low',
  medium: isAr ? 'متوسط' : 'Medium',
  high: isAr ? 'عال' : 'High',
  urgent: isAr ? 'عاجل' : 'Urgent',
}[priority] || priority);

const fmt = (date, isAr) => date
  ? new Date(date).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
  : '-';

const SupportConversation = ({ ticketId, admin = false, onBack, onChanged }) => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const toast = useToast();
  const { user, refreshNotifications } = useApp();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [file, setFile] = useState(null);
  const [internalNote, setInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSupportTicket(ticketId);
      setTicket(data);
      await markSupportTicketRead(ticketId);
      refreshNotifications();
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر تحميل طلب الدعم' : 'Could not load support ticket'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = window.setTimeout(load, 0);
    const channel = supabase
      .channel(`support-ticket:${ticketId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: `id=eq.${ticketId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_attachments', filter: `ticket_id=eq.${ticketId}` }, load)
      .subscribe();
    return () => {
      window.clearTimeout(id);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const canSupportReply = admin && canReplyAsSupport(user);
  const canAdminChange = admin && canChangeSupportStatus(user);
  const canInternal = admin && canAddInternalNote(user);

  const stats = useMemo(() => ({
    messages: ticket?.messages?.filter(m => !m.is_internal_note).length || 0,
    attachments: ticket?.attachments?.length || 0,
  }), [ticket]);

  const submitReply = async (event) => {
    event.preventDefault();
    if (!reply.trim() && !file) return;
    if (file) validateSupportAttachment(file);
    setSending(true);
    try {
      const created = reply.trim()
        ? await addSupportMessage({ ticketId, message: reply, isInternalNote: internalNote && canInternal })
        : null;
      if (file) {
        await uploadSupportAttachment({ ticketId, messageId: created?.id || null, file });
      }
      setReply('');
      setFile(null);
      setInternalNote(false);
      toast.success(isAr ? 'تم إرسال الرد' : 'Reply sent');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message || (isAr ? 'تعذر إرسال الرد' : 'Could not send reply'));
    } finally {
      setSending(false);
    }
  };

  const updateTicket = async (patch) => {
    setSaving(true);
    try {
      await updateSupportTicket({ ticketId, ...patch });
      toast.success(isAr ? 'تم تحديث الطلب' : 'Ticket updated');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message || (isAr ? 'تعذر تحديث الطلب' : 'Could not update ticket'));
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (attachment) => {
    try {
      const url = await createSignedAttachmentUrl(attachment.file_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err.message || (isAr ? 'تعذر فتح المرفق' : 'Could not open attachment'));
    }
  };

  if (loading) {
    return <div className="support-skeleton"><span></span><span></span><span></span></div>;
  }

  if (error || !ticket) {
    return (
      <div className="support-empty support-empty--error">
        <XCircle size={32} />
        <p>{error || (isAr ? 'طلب الدعم غير موجود' : 'Support ticket not found')}</p>
        <button className="btn btn-outline" onClick={onBack || (() => navigate(admin ? '/dashboard/super-admin/support' : '/dashboard/support'))}>
          <ArrowLeft size={16} /> {isAr ? 'رجوع' : 'Back'}
        </button>
      </div>
    );
  }

  return (
    <div className="support-conversation">
      <section className="support-detail-hero">
        <button className="support-back" onClick={onBack || (() => navigate(admin ? '/dashboard/super-admin/support' : '/dashboard/support'))}>
          <ArrowLeft size={16} /> {isAr ? 'الطلبات' : 'Tickets'}
        </button>
        <div className="support-detail-title">
          <span>{ticket.ticket_number}</span>
          <h1>{ticket.subject}</h1>
          <p>{ticket.description}</p>
        </div>
        <div className="support-badge-row">
          <span className={`support-status support-status--${ticket.status}`}>{statusLabel(ticket.status, isAr)}</span>
          <span className={`support-priority support-priority--${ticket.priority}`}>{priorityLabel(ticket.priority, isAr)}</span>
          <span>{ticket.category}</span>
        </div>
      </section>

      <div className="support-detail-grid">
        <main className="support-thread">
          <div className="support-thread-head">
            <div>
              <span>{isAr ? 'المحادثة' : 'Conversation'}</span>
              <strong>{stats.messages} {isAr ? 'رسائل' : 'messages'}</strong>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={15} /> {isAr ? 'تحديث' : 'Refresh'}</button>
          </div>

          <div className="support-message-list">
            {(ticket.messages || []).map(message => {
              const fromSupport = message.sender?.role === 'super_admin';
              const mine = message.sender_id === user?.id;
              return (
                <article key={message.id} className={`support-message ${mine ? 'mine' : ''} ${message.is_internal_note ? 'internal' : ''}`}>
                  <div className="support-message-meta">
                    <strong>{fromSupport && !admin ? roleLabel('super_admin', isAr) : (message.sender?.full_name || roleLabel(message.sender?.role, isAr))}</strong>
                    <span>{roleLabel(message.sender?.role, isAr)} · {fmt(message.created_at, isAr)}</span>
                    {message.is_internal_note && <em><Lock size={12} /> {isAr ? 'ملاحظة داخلية' : 'Internal note'}</em>}
                  </div>
                  <p>{message.message}</p>
                  {(message.attachments || []).length > 0 && (
                    <div className="support-attachment-row">
                      {message.attachments.map(attachment => (
                        <button key={attachment.id} type="button" onClick={() => openAttachment(attachment)}>
                          <Paperclip size={14} /> {attachment.file_name}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <form className="support-reply-box" onSubmit={submitReply}>
            {canInternal && (
              <label className="support-check">
                <input type="checkbox" checked={internalNote} onChange={event => setInternalNote(event.target.checked)} />
                <span>{isAr ? 'ملاحظة داخلية لا يراها المستخدم' : 'Internal note, hidden from user'}</span>
              </label>
            )}
            <textarea
              value={reply}
              onChange={event => setReply(event.target.value)}
              placeholder={admin && !canSupportReply ? '' : (isAr ? 'اكتب ردك هنا...' : 'Write your reply...')}
              disabled={admin && !canSupportReply}
            />
            <div className="support-reply-actions">
              <label className="btn btn-outline btn-sm">
                <Paperclip size={15} />
                {file ? file.name : (isAr ? 'مرفق' : 'Attachment')}
                <input hidden type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={event => setFile(event.target.files?.[0] || null)} />
              </label>
              <button className="btn btn-primary btn-sm" disabled={sending || (admin && !canSupportReply)}>
                <Send size={15} /> {sending ? (isAr ? 'جارٍ الإرسال...' : 'Sending...') : (isAr ? 'إرسال' : 'Send')}
              </button>
            </div>
          </form>
        </main>

        <aside className="support-side-panel">
          <ContactActionsCard
            title={admin ? (isAr ? 'تواصل مع طالب الدعم' : 'Contact requester') : (isAr ? 'تواصل مع العيادة' : 'Contact clinic support')}
            subtitle={admin
              ? (isAr ? 'استخدم الرقم المرتبط بحساب طالب الدعم.' : 'Use the phone linked to the requester account.')
              : (isAr ? 'يفتح واتساب مع رقم دعم العيادة إن وجد.' : 'Opens WhatsApp with the clinic support number when available.')}
            phone={admin ? (ticket.requester?.phone_number || ticket.requester?.phone) : ticket.clinic?.phone}
            whatsappMessage={buildContactMessage({
              type: admin ? 'patient' : 'support',
              isAr,
              patientName: ticket.requester?.full_name,
              clinicName: ticket.clinic?.name || 'UrClinic',
            })}
            actor={user}
            target={admin
              ? { role: ticket.requester?.role, clinic_id: ticket.requester?.clinic_id }
              : { role: 'clinic_support', clinic_id: ticket.clinic_id }}
            unavailableMessage={isAr ? 'لا يوجد رقم واتساب متاح لهذا الطلب.' : 'No WhatsApp number is available for this ticket.'}
          />

          <div className="support-side-card">
            <h3>{isAr ? 'معلومات الطلب' : 'Ticket details'}</h3>
            <Info label={isAr ? 'طالب الدعم' : 'Requester'} value={ticket.requester?.full_name} />
            <Info label={isAr ? 'الدور' : 'Role'} value={roleLabel(ticket.requester?.role, isAr)} />
            <Info label={isAr ? 'العيادة' : 'Clinic'} value={ticket.clinic?.name || '-'} />
            <Info label={isAr ? 'تاريخ الإنشاء' : 'Created'} value={fmt(ticket.created_at, isAr)} />
            <Info label={isAr ? 'آخر تحديث' : 'Updated'} value={fmt(ticket.updated_at, isAr)} />
            <Info label={isAr ? 'المرفقات' : 'Attachments'} value={stats.attachments} />
          </div>

          {admin && (
            <div className="support-side-card">
              <h3><ShieldCheck size={16} /> {isAr ? 'إدارة الدعم' : 'Support controls'}</h3>
              <label className="support-field">
                <span>{isAr ? 'الحالة' : 'Status'}</span>
                <select value={ticket.status} disabled={!canAdminChange || saving} onChange={event => updateTicket({ status: event.target.value })}>
                  {SUPPORT_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status, isAr)}</option>)}
                </select>
              </label>
              <label className="support-field">
                <span>{isAr ? 'الأولوية' : 'Priority'}</span>
                <select value={ticket.priority} disabled={!canAdminChange || saving} onChange={event => updateTicket({ priority: event.target.value })}>
                  {SUPPORT_PRIORITIES.map(priority => <option key={priority} value={priority}>{priorityLabel(priority, isAr)}</option>)}
                </select>
              </label>
              <div className="support-action-stack">
                <button className="btn btn-outline btn-sm" onClick={() => updateTicket({ status: 'resolved' })} disabled={saving}>{isAr ? 'حل الطلب' : 'Resolve'}</button>
                <button className="btn btn-outline btn-sm" onClick={() => updateTicket({ status: 'closed' })} disabled={saving}>{isAr ? 'إغلاق' : 'Close'}</button>
                <button className="btn btn-outline btn-sm" onClick={() => updateTicket({ status: 'reopened' })} disabled={saving}>{isAr ? 'إعادة فتح' : 'Reopen'}</button>
              </div>
            </div>
          )}

          {!admin && (
            <div className="support-side-card">
              <h3>{isAr ? 'إجراءات' : 'Actions'}</h3>
              <div className="support-action-stack">
                {ticket.status !== 'closed' && (
                  <button className="btn btn-outline btn-sm" onClick={() => updateTicket({ status: 'closed' })} disabled={saving}>
                    {isAr ? 'إغلاق الطلب' : 'Close ticket'}
                  </button>
                )}
                {['closed', 'resolved'].includes(ticket.status) && (
                  <button className="btn btn-primary btn-sm" onClick={() => updateTicket({ status: 'reopened' })} disabled={saving}>
                    {isAr ? 'إعادة فتح الطلب' : 'Reopen ticket'}
                  </button>
                )}
              </div>
            </div>
          )}

          {admin && (
            <div className="support-side-card">
              <h3>{isAr ? 'السجل' : 'Event history'}</h3>
              <div className="support-event-list">
                {(ticket.events || []).map(event => (
                  <div key={event.id}>
                    <strong>{event.event_type}</strong>
                    <span>{event.actor?.full_name || '-'} · {fmt(event.created_at, isAr)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ticket.device_info && (
            <div className="support-side-card">
              <h3>{isAr ? 'بيانات تقنية آمنة' : 'Safe technical metadata'}</h3>
              <div className="support-meta-list">
                {Object.entries(ticket.device_info).map(([key, value]) => (
                  <Info key={key} label={key.replaceAll('_', ' ')} value={String(value || '-')} />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className="support-info-line">
    <span>{label}</span>
    <strong>{value ?? '-'}</strong>
  </div>
);

export default SupportConversation;
