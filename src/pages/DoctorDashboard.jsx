import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDoctorStats } from '../hooks/useDoctorStats';
import {
  Bell,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  NotebookPen,
  Phone,
  Play,
  Search,
  ShieldCheck,
  Stethoscope,
  Timer,
  TrendingUp,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import StatCard from '../components/analytics/StatCard';
import SvgBarChart from '../components/analytics/SvgBarChart';
import { to12Hour } from '../components/TimeSlotGrid';
import PaymentCompletionModal from '../components/PaymentCompletionModal';
import { useToast } from '../hooks/useToast';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const DoctorDashboard = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const toast = useToast();
  const { user, appointments, doctors, patients, notifications, changeStatus, completeAppointmentWithPayment, loading } = useApp();
  const [patientQuery, setPatientQuery] = useState('');
  const [paymentAppointment, setPaymentAppointment] = useState(null);
  const [statusBusyId, setStatusBusyId] = useState(null);

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language, isAr]);

  const stats = useDoctorStats({ appointments, doctors, patients, user });

  const statusBadge = s => ({
    pending: 'badge-warning', approved: 'badge-info', confirmed: 'badge-info', in_progress: 'badge-primary',
    completed: 'badge-success', cancelled: 'badge-danger', rejected: 'badge-danger',
    'no-show': 'badge-danger', no_show: 'badge-danger',
  }[s] || 'badge-warning');

  const statusLabel = s => t(s === 'no-show' ? 'no_show' : s);

  const handleStatusChange = async (apt, nextStatus) => {
    if (!apt || statusBusyId) return;
    setStatusBusyId(`${apt.id}:${nextStatus}`);
    try {
      await changeStatus(apt.id, nextStatus);
    } catch (err) {
      console.error('Doctor appointment status change failed:', err);
      toast.error(getLocalizedErrorMessage(err, { isAr, fallback: 'appointmentStatus' }));
    } finally {
      setStatusBusyId(null);
    }
  };

  const renderActions = apt => {
    const s = apt.status;
    if (s === 'pending' || s === 'approved' || s === 'confirmed') {
      return (
        <div className="doctor-action-row">
          <button className="btn btn-sm btn-primary" disabled={!!statusBusyId} onClick={() => handleStatusChange(apt, 'in_progress')}>
            <Play size={13} /> {t('start_visit')}
          </button>
          <button className="btn btn-sm btn-success" onClick={() => setPaymentAppointment(apt)}>
            <CheckCircle size={13} /> {t('complete_visit')}
          </button>
          <button className="btn btn-sm btn-outline doctor-btn-danger" disabled={!!statusBusyId} onClick={() => handleStatusChange(apt, 'cancelled')}>
            <X size={13} /> {t('cancel')}
          </button>
        </div>
      );
    }
    if (s === 'in_progress') {
      return (
        <div className="doctor-action-row">
          <button className="btn btn-sm btn-success" onClick={() => setPaymentAppointment(apt)}>
            <CheckCircle size={13} /> {t('complete_visit')}
          </button>
          <button className="btn btn-sm btn-outline doctor-btn-danger" disabled={!!statusBusyId} onClick={() => handleStatusChange(apt, 'cancelled')}>
            <X size={13} /> {t('cancel')}
          </button>
        </div>
      );
    }
    return <span className="text-muted text-sm">{statusLabel(s)}</span>;
  };

  const dateLabel = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const drPrefix = isAr ? 'د. ' : 'Dr. ';
  const nextPatient = stats.todayList.find(a => ['pending', 'approved', 'confirmed', 'in_progress'].includes(a.status));
  const waitingQueue = stats.todayList.filter(a => ['pending', 'approved', 'confirmed', 'in_progress'].includes(a.status)).slice(0, 5);
  const recentNotifications = notifications.slice(0, 4);

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return stats.recentPatients;
    return stats.recentPatients.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q)
    );
  }, [patientQuery, stats.recentPatients]);

  const quickActions = [
    {
      label: t('today_appointments'),
      desc: t('daily_schedule'),
      icon: <Calendar size={18} />,
      onClick: () => document.querySelector('.doctor-schedule-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    },
    { label: t('prescription'), desc: t('prescription_shortcuts'), icon: <NotebookPen size={18} />, onClick: () => navigate('/dashboard/patients') },
    { label: t('patients_menu'), desc: t('open_profile'), icon: <Users size={18} />, onClick: () => navigate('/dashboard/patients') },
  ];

  return (
    <div className="page-padding doctor-dashboard-page animate-in">
      <section className="doctor-hero">
        <div className="doctor-hero__copy">
          <span className="doctor-kicker">
            <ShieldCheck size={16} />
            {t('doctor_workspace')}
          </span>
          <h1>{t('doctor_dashboard')}</h1>
          <p>{user?.name ? `${drPrefix}${user.name} · ` : ''}{dateLabel}</p>
        </div>
        <div className="doctor-hero__status">
          <span>{t('daily_workload')}</span>
          <strong>{stats.todayTotal}</strong>
          <em>{t('today_appointments')}</em>
        </div>
      </section>

      <section className="doctor-focus-grid">
        <article className="doctor-next-card">
          <div className="doctor-panel-header">
            <div>
              <span className="doctor-section-label">{t('next_patient')}</span>
              <h2>{nextPatient?.patient_name || t('no_appointments_today')}</h2>
            </div>
            <div className="doctor-next-icon">
              <UserRound size={22} />
            </div>
          </div>
          {nextPatient ? (
            <>
              <div className="doctor-next-meta">
                <span><Clock size={15} />{to12Hour(nextPatient.time, isAr)}</span>
                <span className={`badge ${statusBadge(nextPatient.status)}`}>{statusLabel(nextPatient.status)}</span>
                <span dir="ltr">{nextPatient.booking_code || '-'}</span>
              </div>
              <div className="doctor-next-actions">
                {renderActions(nextPatient)}
              </div>
            </>
          ) : (
            <div className="doctor-empty-inline">
              <Calendar size={22} />
              <span>{t('no_appointments_today')}</span>
            </div>
          )}
        </article>

        <article className="doctor-queue-card">
          <div className="doctor-panel-header">
            <div>
              <span className="doctor-section-label">{t('waiting_queue')}</span>
              <h3>{t('waiting_appointments')}</h3>
            </div>
            <Timer size={18} />
          </div>
          {waitingQueue.length === 0 ? (
            <div className="doctor-empty-inline">
              <CheckCircle size={22} />
              <span>{t('no_appointments_today')}</span>
            </div>
          ) : (
            <div className="doctor-queue-list">
              {waitingQueue.map(apt => (
                <div key={apt.id}>
                  <span>{to12Hour(apt.time, isAr)}</span>
                  <strong>{apt.patient_name || '—'}</strong>
                  <em className={`badge ${statusBadge(apt.status)}`}>{statusLabel(apt.status)}</em>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="analytics-stats-grid doctor-stats-grid">
        <StatCard icon={<Calendar size={20} />} iconBg="rgba(37,99,235,0.12)" accent="#2563eb" value={stats.todayTotal} label={t('today_appointments')} />
        <StatCard icon={<CheckCircle size={20} />} iconBg="rgba(16,185,129,0.12)" accent="#10b981" value={stats.completedToday} label={t('completed_visits')} />
        <StatCard icon={<Clock size={20} />} iconBg="rgba(245,158,11,0.12)" accent="#f59e0b" value={stats.waitingToday} label={t('waiting_appointments')} />
        <StatCard icon={<Users size={20} />} iconBg="rgba(8,145,178,0.12)" accent="#0891b2" value={stats.patientsThisMonth} label={t('patients_this_month')} />
      </section>

      <section className="doctor-main-grid">
        <div className="doctor-main-column">
          <div className="doctor-card-panel">
            <div className="doctor-panel-header">
              <div>
                <span className="doctor-section-label">{t('daily_schedule')}</span>
                <h3>{t('today_appointments')}</h3>
              </div>
              <Calendar size={18} />
            </div>
            <div className="doctor-schedule-list">
              {loading ? (
                <div className="doctor-loading-state">
                  <span></span><span></span><span></span>
                </div>
              ) : stats.todayList.length === 0 ? (
                <div className="doctor-empty-state">
                  <Calendar size={28} />
                  <p>{t('no_appointments_today')}</p>
                </div>
              ) : stats.todayList.map(apt => (
                <article key={apt.id} className="doctor-appointment-row">
                  <div className="doctor-time-block">
                    <Clock size={14} />
                    <strong>{to12Hour(apt.time, isAr)}</strong>
                  </div>
                  <div className="doctor-appointment-main">
                    <strong>{apt.patient_name || '—'}</strong>
                    <span dir="ltr">{apt.booking_code || '-'}</span>
                  </div>
                  <span className={`badge ${statusBadge(apt.status)}`}>{statusLabel(apt.status)}</span>
                  {renderActions(apt)}
                </article>
              ))}
            </div>
          </div>

          <div className="doctor-card-panel">
            <div className="doctor-panel-header">
              <div>
                <span className="doctor-section-label">{t('workload_summary')}</span>
                <h3>{t('appointments_per_week')}</h3>
              </div>
              <TrendingUp size={18} />
            </div>
            <div className="doctor-chart-body">
              {stats.weeklyData.some(d => d.count > 0) ? (
                <SvgBarChart data={stats.weeklyData.map(d => ({ label: d.label, value: d.count }))} color="var(--primary)" height={190} />
              ) : (
                <div className="chart-empty">{t('no_data_available')}</div>
              )}
            </div>
          </div>
        </div>

        <aside className="doctor-side-column">
          <div className="doctor-card-panel">
            <div className="doctor-panel-header">
              <div>
                <span className="doctor-section-label">{t('clinical_quick_actions')}</span>
                <h3>{t('doctor_workspace')}</h3>
              </div>
              <Stethoscope size={18} />
            </div>
            <div className="doctor-quick-list">
              {quickActions.map(action => (
                <button key={action.label} type="button" onClick={action.onClick}>
                  <span>{action.icon}</span>
                  <div>
                    <strong>{action.label}</strong>
                    <em>{action.desc}</em>
                  </div>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          </div>

          <div className="doctor-card-panel">
            <div className="doctor-panel-header">
              <div>
                <span className="doctor-section-label">{t('patient_quick_search')}</span>
                <h3>{t('recent_patients')}</h3>
              </div>
              <Search size={18} />
            </div>
            <label className="doctor-search-box">
              <Search size={16} />
              <input
                value={patientQuery}
                onChange={event => setPatientQuery(event.target.value)}
                placeholder={t('search_patients')}
              />
            </label>
            {filteredPatients.length === 0 ? (
              <div className="doctor-empty-inline">
                <Users size={22} />
                <span>{t('no_recent_patients')}</span>
              </div>
            ) : (
              <div className="doctor-patient-list doctor-patient-list--premium">
                {filteredPatients.slice(0, 5).map((p, idx) => (
                  <div key={`${p.name}-${idx}`} className="doctor-patient-item">
                    <div className="doctor-patient-avatar">{(p.name || '?').charAt(0).toUpperCase()}</div>
                    <div className="doctor-patient-info">
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      {p.phone && <div className="text-sm text-muted flex items-center gap-sm" dir="ltr"><Phone size={11} /> {p.phone}</div>}
                      <div className="text-sm text-muted">{t('last_visit')}: {p.lastDate || '—'}</div>
                    </div>
                    <button className="btn btn-sm btn-outline" disabled={!p.profileId} onClick={() => p.profileId && navigate(`/dashboard/patients/${p.profileId}`)}>
                      {t('open_profile')} <ChevronRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="doctor-card-panel">
            <div className="doctor-panel-header">
              <div>
                <span className="doctor-section-label">{t('prescription_shortcuts')}</span>
                <h3>{t('prescription')}</h3>
              </div>
              <FileText size={18} />
            </div>
            <div className="doctor-prescription-card">
              <NotebookPen size={20} />
              <div>
                <strong>{t('new_prescription')}</strong>
                <p>{t('prescription_shortcuts_desc')}</p>
              </div>
            </div>
          </div>

          <div className="doctor-card-panel">
            <div className="doctor-panel-header">
              <div>
                <span className="doctor-section-label">{t('notifications')}</span>
                <h3>{t('notification_preview')}</h3>
              </div>
              <Bell size={18} />
            </div>
            {recentNotifications.length === 0 ? (
              <div className="doctor-empty-inline">
                <Bell size={22} />
                <span>{t('no_notifications')}</span>
              </div>
            ) : (
              <div className="doctor-notification-list">
                {recentNotifications.map(item => (
                  <div key={item.id} className={item.is_read ? '' : 'unread'}>
                    <span></span>
                    <div>
                      <strong>{t(item.title) || item.title}</strong>
                      <p>{t(item.message) || item.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
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

export default DoctorDashboard;
