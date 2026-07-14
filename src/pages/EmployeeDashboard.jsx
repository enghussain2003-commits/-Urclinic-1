import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Calendar, Clock, Users, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import StatCard from '../components/analytics/StatCard';
import { to12Hour } from '../components/TimeSlotGrid';
import PaymentCompletionModal from '../components/PaymentCompletionModal';
import { useToast } from '../hooks/useToast';

const VOID = ['cancelled', 'rejected', 'completed'];

/**
 * EmployeeDashboard — Reception / front-desk view.
 * Shows ONLY operational data needed for reception work.
 * No financial metrics, no cross-role data.
 */
const EmployeeDashboard = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const toast = useToast();
  const { appointments, doctors, changeStatus, completeAppointmentWithPayment, user, loading } = useApp();
  const [paymentAppointment, setPaymentAppointment] = useState(null);
  const [statusBusyId, setStatusBusyId] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  const todayAppts = useMemo(() =>
    appointments
      .filter(a => (a.date || '') === today)
      .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [appointments, today]
  );

  const stats = useMemo(() => ({
    todayTotal:  todayAppts.filter(a => !VOID.includes(a.status)).length,
    pending:     todayAppts.filter(a => a.status === 'pending').length,
    inProgress:  todayAppts.filter(a => ['approved', 'confirmed', 'in_progress'].includes(a.status)).length,
  }), [todayAppts]);

  // Next 5 upcoming appointments (after today, active statuses)
  const upcoming = useMemo(() =>
    [...appointments]
      .filter(a => (a.date || '') > today && !VOID.includes(a.status))
      .sort((a, b) =>
        (a.date || '').localeCompare(b.date || '') ||
        (a.time || '').localeCompare(b.time || '')
      )
      .slice(0, 5),
    [appointments, today]
  );

  const statusBadge = s => ({
    pending: 'badge-warning', approved: 'badge-info', confirmed: 'badge-info', in_progress: 'badge-primary',
    completed: 'badge-success', cancelled: 'badge-danger', rejected: 'badge-danger',
  }[s] || 'badge-warning');

  const docName = (apt) => {
    const doc = doctors.find(d => String(d.id) === String(apt.doctor_id));
    return isAr
      ? (doc?.nameAr || doc?.full_name || doc?.name || '—')
      : (doc?.name   || doc?.full_name || '—');
  };

  const dateLabel = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const handleStatusChange = async (apt, nextStatus) => {
    if (!apt || statusBusyId) return;
    setStatusBusyId(`${apt.id}:${nextStatus}`);
    try {
      await changeStatus(apt.id, nextStatus);
    } catch (err) {
      toast.error(err?.message || (isAr ? 'تعذر تحديث حالة الموعد.' : 'Could not update appointment status.'));
    } finally {
      setStatusBusyId(null);
    }
  };

  return (
    <div className="page-padding animate-in">

      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h2 style={{ margin: 0 }}>{t('employee_panel')}</h2>
          <p className="text-muted" style={{ margin: '0.3rem 0 0' }}>{dateLabel}</p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="analytics-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))' }}>
        <StatCard
          icon={<Calendar size={20} />}
          iconBg="rgba(99,102,241,0.12)"  accent="#6366f1"
          value={stats.todayTotal}        label={t('today_appointments')}
        />
        <StatCard
          icon={<Clock size={20} />}
          iconBg="rgba(245,158,11,0.12)"  accent="#f59e0b"
          value={stats.pending}           label={t('pending_approval')}
        />
        <StatCard
          icon={<Users size={20} />}
          iconBg="rgba(13,148,136,0.12)"  accent="var(--primary)"
          value={stats.inProgress}        label={t('in_progress')}
        />
      </div>

      {/* ── Today's Schedule ── */}
      <div className="chart-card">
        <div className="chart-card__header" style={{ justifyContent: 'space-between' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={16} color="var(--primary)" />
            {t('todays_schedule')}
          </h4>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/dashboard/appointments')}>
            {t('view_all')} <ArrowRight size={13} />
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('time')}</th>
                <th>{t('patient')}</th>
                <th>{isAr ? 'رقم الحجز' : 'Booking #'}</th>
                <th>{t('doctor')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center text-muted">{t('loading')}</td></tr>
              ) : todayAppts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted" style={{ padding: '2rem' }}>
                    {t('no_appointments_today')}
                  </td>
                </tr>
              ) : todayAppts.map(apt => (
                <tr key={apt.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Clock size={13} className="text-muted" style={{ marginInlineEnd: 4 }} />
                    {to12Hour(apt.time, isAr)}
                  </td>
                  <td style={{ fontWeight: 600 }}>{apt.patient_name || '—'}</td>
                  <td className="text-muted text-sm" style={{ fontFamily: 'monospace' }}>{apt.booking_code || '-'}</td>
                  <td>{docName(apt)}</td>
                  <td>
                    <span className={`badge ${statusBadge(apt.status)}`}>
                      {t(apt.status === 'no-show' ? 'no_show' : apt.status)}
                    </span>
                  </td>
                  <td>
                    {apt.status === 'pending' ? (
                      <div className="flex gap-sm">
                        <button
                          className="btn btn-sm"
                          style={{ background: 'var(--success)', color: '#fff' }}
                          disabled={!!statusBusyId}
                          onClick={() => handleStatusChange(apt, 'approved')}
                        >
                          <CheckCircle size={13} /> {t('approve')}
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                          disabled={!!statusBusyId}
                          onClick={() => handleStatusChange(apt, 'rejected')}
                        >
                          <XCircle size={13} /> {t('reject')}
                        </button>
                      </div>
                    ) : ['approved', 'confirmed', 'in_progress'].includes(apt.status) ? (
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--success)', color: '#fff' }}
                          onClick={() => setPaymentAppointment(apt)}
                      >
                        <CheckCircle size={13} /> {isAr ? 'إكمال' : 'Complete'}
                      </button>
                    ) : <span className="text-muted text-sm">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="mobile-card-list">
          {loading ? (
            <div className="text-center text-muted py-xl">{t('loading')}</div>
          ) : todayAppts.length === 0 ? (
            <div className="text-center text-muted py-xl card-flat bg-alt">
              {t('no_appointments_today')}
            </div>
          ) : (
            todayAppts.map(apt => (
              <div key={apt.id} className="mobile-card">
                <div className="flex justify-between items-start mb-sm">
                  <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{apt.patient_name || '—'}</div>
                  <span className={`badge ${statusBadge(apt.status)}`}>
                    {t(apt.status === 'no-show' ? 'no_show' : apt.status)}
                  </span>
                </div>
                <div className="text-sm text-muted mb-xs flex items-center">
                  <Clock size={14} style={{ marginInlineEnd: 6 }} />
                  {to12Hour(apt.time, isAr)}
                </div>
                <div className="text-sm text-muted mb-xs" style={{ fontFamily: 'monospace' }}>
                  {isAr ? 'رقم الحجز' : 'Booking #'}: {apt.booking_code || '-'}
                </div>
                <div className="text-sm text-muted mb-md flex items-center">
                  {docName(apt)}
                </div>
                <div className="mobile-card-actions">
                  {apt.status === 'pending' ? (
                    <div className="flex gap-sm">
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--success)', color: '#fff', flex: 1 }}
                        disabled={!!statusBusyId}
                        onClick={() => handleStatusChange(apt, 'approved')}
                      >
                        <CheckCircle size={13} /> {t('approve')}
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ borderColor: 'var(--danger)', color: 'var(--danger)', flex: 1 }}
                        disabled={!!statusBusyId}
                        onClick={() => handleStatusChange(apt, 'rejected')}
                      >
                        <XCircle size={13} /> {t('reject')}
                      </button>
                    </div>
                  ) : (
                    ['approved', 'confirmed', 'in_progress'].includes(apt.status) ? (
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--success)', color: '#fff', flex: 1 }}
                        onClick={() => setPaymentAppointment(apt)}
                      >
                        <CheckCircle size={13} /> {isAr ? 'إكمال' : 'Complete'}
                      </button>
                    ) : <span className="text-muted text-sm">—</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Upcoming ── */}
      {upcoming.length > 0 && (
        <div className="chart-card" style={{ marginTop: '1.5rem' }}>
          <div className="chart-card__header">
            <h4>{t('upcoming_appointments')}</h4>
          </div>
          <div className="upcoming-list">
            {upcoming.map((apt) => (
              <div key={apt.id} className="upcoming-item">
                <div className="upcoming-date-block">
                  <div className="upcoming-date-day">
                    {new Date(apt.date).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { day: 'numeric' })}
                  </div>
                  <div className="upcoming-date-month">
                    {new Date(apt.date).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short' })}
                  </div>
                </div>
                <div className="upcoming-info">
                  <div style={{ fontWeight: 600 }}>{apt.patient_name || '—'}</div>
                  <div className="text-sm text-muted">
                    {apt.booking_code || '-'} · {docName(apt)} · {to12Hour(apt.time, isAr)}
                  </div>
                </div>
                <span className={`badge ${statusBadge(apt.status)}`}>
                  {t(apt.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <PaymentCompletionModal
        appointment={paymentAppointment}
        doctors={doctors}
        user={user}
        onClose={() => setPaymentAppointment(null)}
        onSubmit={completeAppointmentWithPayment}
      />
    </div>
  );
};

export default EmployeeDashboard;
