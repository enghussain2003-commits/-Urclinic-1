import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Calendar, Clock, Users, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import StatCard from '../components/analytics/StatCard';
import { to12Hour } from '../components/TimeSlotGrid';

const VOID = ['cancelled', 'rejected'];

/**
 * EmployeeDashboard — Reception / front-desk view.
 * Shows ONLY operational data needed for reception work.
 * No financial metrics, no cross-role data.
 */
const EmployeeDashboard = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const { appointments, doctors, changeStatus, loading } = useApp();

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
    inProgress:  todayAppts.filter(a => a.status === 'in_progress').length,
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
    pending: 'badge-warning', confirmed: 'badge-info', in_progress: 'badge-primary',
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
                <th>{t('doctor')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center text-muted">{t('loading')}</td></tr>
              ) : todayAppts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>
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
                          onClick={() => changeStatus(apt.id, 'confirmed')}
                        >
                          <CheckCircle size={13} /> {t('approve')}
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                          onClick={() => changeStatus(apt.id, 'rejected')}
                        >
                          <XCircle size={13} /> {t('reject')}
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Upcoming ── */}
      {upcoming.length > 0 && (
        <div className="chart-card" style={{ marginTop: '1.5rem' }}>
          <div className="chart-card__header">
            <h4>{t('upcoming_appointments')}</h4>
          </div>
          <div className="upcoming-list">
            {upcoming.map((apt, i) => (
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
                    {docName(apt)} · {to12Hour(apt.time, isAr)}
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
    </div>
  );
};

export default EmployeeDashboard;
