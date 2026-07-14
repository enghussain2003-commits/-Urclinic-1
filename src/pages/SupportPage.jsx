import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Headset, MessageSquarePlus, Paperclip, Search, Ticket, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import SupportConversation from '../components/support/SupportConversation';
import {
  canCreateSupportTicket,
  createSupportTicket,
  fetchSupportTickets,
  getDeviceInfo,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  uploadSupportAttachment,
  validateSupportAttachment,
} from '../services/supportService';
import { supabase } from '../supabaseClient';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const label = (id, isAr) => ({
  appointments: isAr ? 'المواعيد' : 'Appointments',
  accounts: isAr ? 'الحسابات' : 'Accounts',
  patients: isAr ? 'المرضى' : 'Patients',
  doctors: isAr ? 'الأطباء' : 'Doctors',
  employees: isAr ? 'الموظفون' : 'Employees',
  prescriptions: isAr ? 'الوصفات' : 'Prescriptions',
  notifications: isAr ? 'الإشعارات' : 'Notifications',
  subscription: isAr ? 'الاشتراك' : 'Subscription',
  technical: isAr ? 'تقني' : 'Technical',
  suggestion: isAr ? 'اقتراح' : 'Suggestion',
  other: isAr ? 'أخرى' : 'Other',
  low: isAr ? 'منخفض' : 'Low',
  medium: isAr ? 'متوسط' : 'Medium',
  high: isAr ? 'عال' : 'High',
  urgent: isAr ? 'عاجل' : 'Urgent',
  new: isAr ? 'جديد' : 'New',
  in_progress: isAr ? 'قيد المراجعة' : 'In progress',
  waiting_for_user: isAr ? 'بانتظارك' : 'Waiting for you',
  resolved: isAr ? 'تم الحل' : 'Resolved',
  closed: isAr ? 'مغلق' : 'Closed',
  reopened: isAr ? 'أعيد فتحه' : 'Reopened',
}[id] || id);

const SupportPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const toast = useToast();
  const { user, refreshNotifications } = useApp();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: 'all', category: 'all', sort: 'newest' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setTickets(await fetchSupportTickets(filters));
    } catch (err) {
      console.error('Support tickets load failed:', err);
      setError(getLocalizedErrorMessage(err, { isAr, fallback: 'support' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [filters.status, filters.category, filters.sort]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel(`support-list:${user?.id || 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const visibleTickets = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter(ticket => [ticket.ticket_number, ticket.subject].some(v => String(v || '').toLowerCase().includes(q)));
  }, [filters.search, tickets]);

  if (ticketId) {
    return <div className="support-page"><SupportConversation ticketId={ticketId} onBack={() => navigate('/dashboard/support')} onChanged={load} /></div>;
  }

  return (
    <div className="support-page animate-in">
      <section className="support-hero">
        <div>
          <span><Headset size={16} /> {isAr ? 'الدعم الفني' : 'Support'}</span>
          <h1>{isAr ? 'مركز دعم UrClinic' : 'UrClinic Support'}</h1>
          <p>{isAr ? 'أنشئ طلب دعم وتابع ردود فريق UrClinic من داخل حسابك.' : 'Create a support request and follow UrClinic team replies from your account.'}</p>
        </div>
        {canCreateSupportTicket(user) && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <MessageSquarePlus size={17} /> {isAr ? 'طلب دعم جديد' : 'New Support Request'}
          </button>
        )}
      </section>

      <section className="support-toolbar">
        <label className="support-search">
          <Search size={16} />
          <input value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder={isAr ? 'ابحث برقم الطلب أو الموضوع' : 'Search by ticket number or subject'} />
        </label>
        <select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}>
          <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          {SUPPORT_STATUSES.map(status => <option key={status} value={status}>{label(status, isAr)}</option>)}
        </select>
        <select value={filters.category} onChange={event => setFilters({ ...filters, category: event.target.value })}>
          <option value="all">{isAr ? 'كل التصنيفات' : 'All categories'}</option>
          {SUPPORT_CATEGORIES.map(category => <option key={category} value={category}>{label(category, isAr)}</option>)}
        </select>
        <select value={filters.sort} onChange={event => setFilters({ ...filters, sort: event.target.value })}>
          <option value="newest">{isAr ? 'الأحدث' : 'Newest'}</option>
          <option value="oldest">{isAr ? 'الأقدم' : 'Oldest'}</option>
        </select>
      </section>

      <section className="support-panel">
        {loading ? (
          <div className="support-skeleton"><span></span><span></span><span></span></div>
        ) : error ? (
          <div className="support-empty support-empty--error"><p>{error}</p><button className="btn btn-outline" onClick={load}>{isAr ? 'إعادة المحاولة' : 'Retry'}</button></div>
        ) : visibleTickets.length === 0 ? (
          <div className="support-empty">
            <Ticket size={36} />
            <h2>{isAr ? 'لا توجد طلبات دعم بعد' : 'No support requests yet'}</h2>
            <p>{isAr ? 'ابدأ بإنشاء أول طلب ليقوم فريق دعم UrClinic بمراجعته.' : 'Create your first ticket and the UrClinic support team will review it.'}</p>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>{isAr ? 'إنشاء أول طلب' : 'Create first ticket'}</button>
          </div>
        ) : (
          <div className="support-ticket-list">
            {visibleTickets.map(ticket => (
              <button key={ticket.id} className="support-ticket-card" onClick={() => navigate(`/dashboard/support/tickets/${ticket.id}`)}>
                <div>
                  <strong>{ticket.ticket_number}</strong>
                  <h3>{ticket.subject}</h3>
                  <p>{label(ticket.category, isAr)} · {new Date(ticket.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</p>
                </div>
                <div className="support-card-badges">
                  {ticket.unread_count > 0 && <em>{ticket.unread_count}</em>}
                  <span className={`support-status support-status--${ticket.status}`}>{label(ticket.status, isAr)}</span>
                  <span className={`support-priority support-priority--${ticket.priority}`}>{label(ticket.priority, isAr)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {modalOpen && <CreateTicketModal isAr={isAr} onClose={() => setModalOpen(false)} onCreated={async (ticket) => {
        setModalOpen(false);
        toast.success(isAr
          ? 'تم استلام طلبك بنجاح. سيقوم فريق دعم UrClinic بمراجعة المشكلة والرد عليك في أسرع وقت.'
          : 'Your request has been received successfully. The UrClinic support team will respond as soon as possible.');
        await load();
        refreshNotifications();
        navigate(`/dashboard/support/tickets/${ticket.id}`);
      }} />}
    </div>
  );
};

const CreateTicketModal = ({ isAr, onClose, onCreated }) => {
  const toast = useToast();
  const [form, setForm] = useState({ subject: '', category: 'technical', description: '', priority: 'medium' });
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    if (!form.subject.trim() || !form.description.trim()) {
      toast.warning(isAr ? 'يرجى إكمال الموضوع والوصف' : 'Please complete subject and description');
      return;
    }
    setSending(true);
    try {
      if (file) validateSupportAttachment(file);
      const ticket = await createSupportTicket({
        ...form,
        currentPage: window.location.pathname,
        deviceInfo: getDeviceInfo(),
      });
      if (file) await uploadSupportAttachment({ ticketId: ticket.id, file });
      onCreated(ticket);
    } catch (err) {
      console.error('Support ticket creation failed:', err);
      toast.error(getLocalizedErrorMessage(err, { isAr, fallback: 'support' }));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="support-modal-overlay" role="dialog" aria-modal="true">
      <form className="support-modal" onSubmit={submit}>
        <div className="support-modal-head">
          <div>
            <h2>{isAr ? 'طلب دعم جديد' : 'New Support Request'}</h2>
            <p>{isAr ? 'لا ترفق كلمات مرور أو معلومات طبية حساسة.' : 'Do not include passwords or sensitive medical information.'}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <label className="support-field">
          <span>{isAr ? 'الموضوع' : 'Subject'}</span>
          <input value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} maxLength={160} required />
        </label>
        <div className="support-form-grid">
          <label className="support-field">
            <span>{isAr ? 'التصنيف' : 'Category'}</span>
            <select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>
              {SUPPORT_CATEGORIES.map(category => <option key={category} value={category}>{label(category, isAr)}</option>)}
            </select>
          </label>
          <label className="support-field">
            <span>{isAr ? 'الأولوية' : 'Priority'}</span>
            <select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>
              {SUPPORT_PRIORITIES.map(priority => <option key={priority} value={priority}>{label(priority, isAr)}</option>)}
            </select>
          </label>
        </div>
        <label className="support-field">
          <span>{isAr ? 'الوصف' : 'Description'}</span>
          <textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={6} required />
        </label>
        <label className="support-upload">
          <Paperclip size={16} />
          <span>{file ? file.name : (isAr ? 'إرفاق صورة أو PDF اختياري' : 'Optional screenshot or PDF')}</span>
          <input hidden type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={event => setFile(event.target.files?.[0] || null)} />
        </label>
        <div className="support-modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={sending}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button className="btn btn-primary" disabled={sending}>{sending ? (isAr ? 'جارٍ الإرسال...' : 'Sending...') : (isAr ? 'إرسال الطلب' : 'Submit request')}</button>
        </div>
      </form>
    </div>
  );
};

export default SupportPage;
