import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Headset, Inbox, Search, ShieldCheck, TicketCheck, TimerReset } from 'lucide-react';
import SupportConversation from '../components/support/SupportConversation';
import { fetchSupportTickets, SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUSES } from '../services/supportService';
import { supabase } from '../supabaseClient';

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
  waiting_for_user: isAr ? 'بانتظار المستخدم' : 'Waiting for user',
  resolved: isAr ? 'تم الحل' : 'Resolved',
  closed: isAr ? 'مغلق' : 'Closed',
  reopened: isAr ? 'أعيد فتحه' : 'Reopened',
}[id] || id);

const roleLabel = (role, isAr) => ({
  clinic_admin: isAr ? 'مدير عيادة' : 'Clinic Admin',
  doctor: isAr ? 'طبيب' : 'Doctor',
  employee: isAr ? 'موظف' : 'Employee',
  patient: isAr ? 'مريض' : 'Patient',
}[role] || role || '-');

const SuperAdminSupportCenter = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'all', category: 'all', priority: 'all', sort: 'newest' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setTickets(await fetchSupportTickets(filters));
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر تحميل مركز الدعم' : 'Could not load support center'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [filters.status, filters.category, filters.priority, filters.sort]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel('super-admin-support-center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleTickets = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter(ticket => [
      ticket.ticket_number,
      ticket.subject,
      ticket.requester?.full_name,
      ticket.clinic?.name,
    ].filter(Boolean).some(value => String(value).toLowerCase().includes(q)));
  }, [filters.search, tickets]);

  const stats = useMemo(() => ({
    new: tickets.filter(t => t.status === 'new').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    waiting: tickets.filter(t => t.status === 'waiting_for_user').length,
    resolvedToday: tickets.filter(t => t.status === 'resolved' && (t.resolved_at || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    closed: tickets.filter(t => t.status === 'closed').length,
    unread: tickets.reduce((sum, ticket) => sum + (ticket.unread_count || 0), 0),
  }), [tickets]);

  if (ticketId) {
    return <div className="support-page"><SupportConversation admin ticketId={ticketId} onBack={() => navigate('/dashboard/super-admin/support')} onChanged={load} /></div>;
  }

  return (
    <div className="support-page support-page--admin animate-in">
      <section className="support-hero">
        <div>
          <span><ShieldCheck size={16} /> {isAr ? 'فريق الدعم' : 'Support Center'}</span>
          <h1>{isAr ? 'مركز دعم المشرف العام' : 'Super Admin Support Center'}</h1>
          <p>{isAr ? 'مراجعة تذاكر المستخدمين والرد الرسمي وتتبع الحالات من مكان واحد.' : 'Review user tickets, send official replies, and track status from one place.'}</p>
        </div>
      </section>

      <section className="support-stats">
        <Stat icon={<Inbox size={18} />} label={isAr ? 'جديد' : 'New'} value={stats.new} />
        <Stat icon={<Clock size={18} />} label={isAr ? 'قيد المراجعة' : 'In progress'} value={stats.inProgress} />
        <Stat icon={<TimerReset size={18} />} label={isAr ? 'بانتظار المستخدم' : 'Waiting'} value={stats.waiting} />
        <Stat icon={<TicketCheck size={18} />} label={isAr ? 'محلولة اليوم' : 'Resolved today'} value={stats.resolvedToday} />
        <Stat icon={<Headset size={18} />} label={isAr ? 'مغلقة' : 'Closed'} value={stats.closed} />
        <Stat icon={<Search size={18} />} label={isAr ? 'ردود غير مقروءة' : 'Unread replies'} value={stats.unread} />
      </section>

      <section className="support-toolbar support-toolbar--admin">
        <label className="support-search">
          <Search size={16} />
          <input value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder={isAr ? 'ابحث بالرقم أو الموضوع أو الطالب أو العيادة' : 'Search number, subject, requester, or clinic'} />
        </label>
        <select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}>
          <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          {SUPPORT_STATUSES.map(status => <option key={status} value={status}>{label(status, isAr)}</option>)}
        </select>
        <select value={filters.priority} onChange={event => setFilters({ ...filters, priority: event.target.value })}>
          <option value="all">{isAr ? 'كل الأولويات' : 'All priorities'}</option>
          {SUPPORT_PRIORITIES.map(priority => <option key={priority} value={priority}>{label(priority, isAr)}</option>)}
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

      <section className="support-panel support-panel--admin">
        {loading ? (
          <div className="support-skeleton"><span></span><span></span><span></span></div>
        ) : error ? (
          <div className="support-empty support-empty--error"><p>{error}</p><button className="btn btn-outline" onClick={load}>{isAr ? 'إعادة المحاولة' : 'Retry'}</button></div>
        ) : visibleTickets.length === 0 ? (
          <div className="support-empty">
            <Headset size={36} />
            <h2>{isAr ? 'لا توجد تذاكر مطابقة' : 'No matching tickets'}</h2>
          </div>
        ) : (
          <>
            <div className="support-table-wrap">
              <table className="support-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'الطلب' : 'Ticket'}</th>
                    <th>{isAr ? 'الطالب' : 'Requester'}</th>
                    <th>{isAr ? 'العيادة' : 'Clinic'}</th>
                    <th>{isAr ? 'التصنيف' : 'Category'}</th>
                    <th>{isAr ? 'الأولوية' : 'Priority'}</th>
                    <th>{isAr ? 'الحالة' : 'Status'}</th>
                    <th>{isAr ? 'غير مقروء' : 'Unread'}</th>
                    <th>{isAr ? 'آخر تحديث' : 'Last update'}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTickets.map(ticket => (
                    <tr key={ticket.id}>
                      <td><strong>{ticket.ticket_number}</strong><small>{ticket.subject}</small></td>
                      <td><strong>{ticket.requester?.full_name || '-'}</strong><small>{roleLabel(ticket.requester?.role, isAr)}</small></td>
                      <td>{ticket.clinic?.name || '-'}</td>
                      <td>{label(ticket.category, isAr)}</td>
                      <td><span className={`support-priority support-priority--${ticket.priority}`}>{label(ticket.priority, isAr)}</span></td>
                      <td><span className={`support-status support-status--${ticket.status}`}>{label(ticket.status, isAr)}</span></td>
                      <td>{ticket.unread_count || 0}</td>
                      <td>{new Date(ticket.updated_at).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td><button className="btn btn-primary btn-sm" onClick={() => navigate(`/dashboard/super-admin/support/${ticket.id}`)}>{isAr ? 'فتح' : 'Open'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="support-ticket-list support-ticket-list--mobile">
              {visibleTickets.map(ticket => (
                <button key={ticket.id} className="support-ticket-card" onClick={() => navigate(`/dashboard/super-admin/support/${ticket.id}`)}>
                  <div>
                    <strong>{ticket.ticket_number}</strong>
                    <h3>{ticket.subject}</h3>
                    <p>{ticket.requester?.full_name || '-'} · {ticket.clinic?.name || '-'}</p>
                  </div>
                  <div className="support-card-badges">
                    {ticket.unread_count > 0 && <em>{ticket.unread_count}</em>}
                    <span className={`support-status support-status--${ticket.status}`}>{label(ticket.status, isAr)}</span>
                    <span className={`support-priority support-priority--${ticket.priority}`}>{label(ticket.priority, isAr)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

const Stat = ({ icon, label, value }) => (
  <div className="support-stat">
    <span>{icon}</span>
    <p>{label}</p>
    <strong>{value}</strong>
  </div>
);

export default SuperAdminSupportCenter;
