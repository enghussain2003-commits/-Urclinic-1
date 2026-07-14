import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDashboardStats } from '../hooks/useDashboardStats';
import {
  AlertCircle,
  ArrowRight,
  BarChart2,
  Bell,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  DollarSign,
  Settings,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  UserCog,
  Users,
  XCircle,
} from 'lucide-react';
import StatCard from '../components/analytics/StatCard';
import SvgLineChart from '../components/analytics/SvgLineChart';
import SvgDonutChart from '../components/analytics/SvgDonutChart';
import DateRangeFilter from '../components/analytics/DateRangeFilter';
import RecentPayments from '../components/analytics/RecentPayments';
import RecentActivity from '../components/analytics/RecentActivity';
import { to12Hour } from '../components/TimeSlotGrid';
import PaymentCompletionModal from '../components/PaymentCompletionModal';
import { formatMoney } from '../utils/money';

const AdminDashboard = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const {
    appointments,
    doctors,
    patients,
    notifications,
    unreadCount,
    changeStatus,
    completeAppointmentWithPayment,
    loading: ctxLoading,
    user,
  } = useApp();

  const [dateRange, setDateRange] = useState('month');
  const [paymentAppointment, setPaymentAppointment] = useState(null);

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language, isAr]);

  const { stats, loading: statsLoading } = useDashboardStats({
    appointments,
    doctors,
    patients,
    clinicId: user?.clinic_id,
    dateRange,
  });

  const loading = ctxLoading || statsLoading;
  const today = new Date().toISOString().slice(0, 10);

  const todaySchedule = useMemo(() => appointments
    .filter(a => (a.date || '') === today)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .slice(0, 8), [appointments, today]);

  const dateLabel = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const statusBadge = s => ({
    pending: 'badge-warning', approved: 'badge-info', confirmed: 'badge-info', in_progress: 'badge-primary',
    completed: 'badge-success', cancelled: 'badge-danger', rejected: 'badge-danger',
  }[s] || 'badge-warning');

  const lineData = (stats?.monthlyData || []).map(m => ({
    label: m.label,
    revenue: m.revenue,
    count: m.count,
  }));

  const donutSegments = stats ? [
    { label: t('completed'), value: stats.statusCounts.completed, color: '#10b981' },
    { label: t('pending'), value: stats.statusCounts.pending, color: '#f59e0b' },
    { label: t('confirmed'), value: stats.statusCounts.confirmed + stats.statusCounts.in_progress, color: '#3b82f6' },
    { label: t('cancelled'), value: stats.statusCounts.cancelled + stats.statusCounts.rejected, color: '#ef4444' },
  ].filter(s => s.value > 0) : [];

  const scheduleSummary = [
    { label: t('pending'), value: todaySchedule.filter(a => a.status === 'pending').length, tone: 'warning' },
    { label: t('approved'), value: todaySchedule.filter(a => ['approved', 'confirmed', 'in_progress'].includes(a.status)).length, tone: 'info' },
    { label: t('completed'), value: todaySchedule.filter(a => a.status === 'completed').length, tone: 'success' },
  ];

  const recentNotifications = notifications.slice(0, 4);
  const activeDoctors = doctors.slice(0, 4);

  const quickActions = [
    { label: t('appointments_management'), desc: t('manage_bookings_desc'), icon: <Calendar size={18} />, path: '/dashboard/appointments' },
    { label: t('patients_management'), desc: t('manage_patients_desc'), icon: <Users size={18} />, path: '/dashboard/patients' },
    { label: t('doctors_menu'), desc: t('manage_doctors'), icon: <Stethoscope size={18} />, path: '/dashboard/doctors' },
    { label: t('schedule_menu'), desc: t('weekly_view'), icon: <Clock size={18} />, path: '/dashboard/schedule' },
  ];

  const money = value => formatMoney(value, {
    currency: stats?.currency,
    locale: isAr ? 'ar-IQ' : 'en-US',
  });

  return (
    <div className="page-padding admin-dashboard animate-in">
      <section className="admin-hero">
        <div className="admin-hero__copy">
          <span className="admin-kicker">
            <ShieldCheck size={16} />
            {t('clinic_admin_panel')}
          </span>
          <h1>{t('dashboard_title')}</h1>
          <p>{dateLabel}</p>
        </div>
        <div className="admin-hero__controls">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard/appointments')}>
            <Calendar size={16} />
            {t('view_all')}
          </button>
        </div>
      </section>

      <section className="admin-command-grid">
        <div className="admin-command-card admin-command-card--primary">
          <div>
            <span>{t('today')}</span>
            <strong>{stats?.todayTotal ?? 0}</strong>
            <p>{t('today_appointments')}</p>
          </div>
          <div className="admin-command-orbit">
            <Calendar size={24} />
          </div>
        </div>
        <div className="admin-command-card">
          <span>{t('pending_appointments')}</span>
          <strong>{stats?.pendingApprovals ?? 0}</strong>
          <p>{t('pending_approval')}</p>
        </div>
        <div className="admin-command-card">
          <span>{t('notifications')}</span>
          <strong>{unreadCount || 0}</strong>
          <p>{t('no_notifications')}</p>
        </div>
      </section>

      <section className="analytics-stats-grid admin-stats-grid">
        <StatCard
          icon={<Users size={20} />}
          iconBg="rgba(59,130,246,0.12)" accent="#3b82f6"
          value={stats?.totalPatients ?? 0} label={t('total_patients')}
        />
        <StatCard
          icon={<Stethoscope size={20} />}
          iconBg="rgba(8,145,178,0.12)" accent="var(--primary)"
          value={stats?.totalDoctors ?? 0} label={t('total_doctors')}
        />
        <StatCard
          icon={<Calendar size={20} />}
          iconBg="rgba(99,102,241,0.12)" accent="#6366f1"
          value={stats?.todayTotal ?? 0} label={t('today_appointments')}
        />
        <StatCard
          icon={<UserCog size={20} />}
          iconBg="rgba(16,185,129,0.12)" accent="#10b981"
          value={stats?.totalEmployees ?? 0} label={t('total_employees')}
        />
      </section>

      <section className="analytics-revenue-row admin-revenue-row">
        <div className="revenue-card revenue-card--primary admin-finance-card">
          <div className="revenue-card__icon revenue-card__icon--primary">
            <DollarSign size={22} />
          </div>
          <div>
            <div className="revenue-card__value">{loading ? '...' : money(stats?.totalRevenue)}</div>
            <div className="revenue-card__label">{t('total_revenue')}</div>
            <div className="revenue-card__sub">{t('from_paid_appointments')}</div>
          </div>
        </div>

        {stats?.expensesAvailable === true ? (
          <div className="revenue-card revenue-card--success admin-finance-card">
            <div className="revenue-card__icon revenue-card__icon--success">
              <TrendingUp size={22} />
            </div>
            <div>
              <div className="revenue-card__value">{money(stats.netProfit)}</div>
              <div className="revenue-card__label">{t('net_profit')}</div>
              <div className="revenue-card__sub">{t('expenses')}: {money(stats.totalExpenses)}</div>
            </div>
          </div>
        ) : (
          <div className="revenue-card revenue-card--muted admin-finance-card">
            <div className="revenue-card__icon revenue-card__icon--warn">
              {stats?.expensesAvailable === false ? <AlertCircle size={22} /> : <BarChart2 size={22} />}
            </div>
            <div>
              <div className="revenue-card__value revenue-card__value--muted">
                {stats?.expensesAvailable === false ? t('expenses_not_configured') : '...'}
              </div>
              <div className="revenue-card__sub">
                {stats?.expensesAvailable === false ? t('expenses_module_hint') : t('loading')}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="admin-main-grid">
        <div className="admin-main-column">
          <div className="analytics-charts-grid admin-charts-grid">
            <div className="chart-card admin-card admin-card--large">
              <div className="chart-card__header">
                <div>
                  <span className="admin-section-label">{t('analytics')}</span>
                  <h4>{t('monthly_revenue')}</h4>
                </div>
              </div>
              <div className="chart-card__body">
                {lineData.length > 0 ? (
                  <SvgLineChart
                    data={lineData}
                    lines={[
                      { key: 'revenue', label: t('revenue'), color: '#2563eb' },
                      { key: 'count', label: t('appointments'), color: '#0891b2' },
                    ]}
                    formatY={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                    height={210}
                  />
                ) : (
                  <div className="chart-empty">{t('no_data_available')}</div>
                )}
              </div>
            </div>

            <div className="chart-card admin-card">
              <div className="chart-card__header">
                <div>
                  <span className="admin-section-label">{t('status')}</span>
                  <h4>{t('appointment_distribution')}</h4>
                </div>
              </div>
              <div className="chart-card__body chart-card__body--center">
                {donutSegments.length > 0 ? (
                  <SvgDonutChart segments={donutSegments} size={156} />
                ) : (
                  <div className="chart-empty">{t('no_data_available')}</div>
                )}
              </div>
            </div>
          </div>

          <div className="analytics-bottom-grid admin-bottom-grid">
            <div className="chart-card admin-card">
              <div className="chart-card__header">
                <div>
                  <span className="admin-section-label">{t('revenue')}</span>
                  <h4>{t('recent_payments')}</h4>
                </div>
              </div>
              <div className="chart-card__body">
                <RecentPayments payments={stats?.recentPayments || []} loading={loading} />
              </div>
            </div>

            <div className="chart-card admin-card">
              <div className="chart-card__header">
                <div>
                  <span className="admin-section-label">{t('activity_overview')}</span>
                  <h4>{t('recent_activity')}</h4>
                </div>
              </div>
              <div className="chart-card__body">
                <RecentActivity userId={user?.id} limit={7} />
              </div>
            </div>
          </div>
        </div>

        <aside className="admin-side-column">
          <div className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <span className="admin-section-label">{t('quick_actions')}</span>
                <h3>{t('clinic_operations')}</h3>
              </div>
              <Settings size={17} />
            </div>
            <div className="admin-action-list">
              {quickActions.map(action => (
                <button key={action.path} type="button" onClick={() => navigate(action.path)}>
                  <span className="admin-action-icon">{action.icon}</span>
                  <span>
                    <strong>{action.label}</strong>
                    <em>{action.desc}</em>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <span className="admin-section-label">{t('calendar_summary')}</span>
                <h3>{t('todays_schedule')}</h3>
              </div>
              <Clock size={17} />
            </div>
            <div className="admin-summary-strip">
              {scheduleSummary.map(item => (
                <div key={item.label} className={`admin-summary-pill admin-summary-pill--${item.tone}`}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <span className="admin-section-label">{t('notifications')}</span>
                <h3>{t('notifications_preview')}</h3>
              </div>
              <Bell size={17} />
            </div>
            {recentNotifications.length === 0 ? (
              <div className="admin-mini-empty">
                <Bell size={22} />
                <span>{t('no_notifications')}</span>
              </div>
            ) : (
              <div className="admin-notification-list">
                {recentNotifications.map(notif => (
                  <div key={notif.id} className={notif.is_read ? '' : 'unread'}>
                    <span></span>
                    <div>
                      <strong>{notif.title}</strong>
                      <p>{notif.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <span className="admin-section-label">{t('doctor_overview')}</span>
                <h3>{t('our_doctors')}</h3>
              </div>
              <Stethoscope size={17} />
            </div>
            {activeDoctors.length === 0 ? (
              <div className="admin-mini-empty">
                <Stethoscope size={22} />
                <span>{t('no_data_available')}</span>
              </div>
            ) : (
              <div className="admin-doctor-list">
                {activeDoctors.map(doc => {
                  const docName = isAr
                    ? (doc?.nameAr || doc?.full_name || doc?.name || t('doctor'))
                    : (doc?.name || doc?.full_name || doc?.nameAr || t('doctor'));
                  const todaysCount = todaySchedule.filter(a => String(a.doctor_id) === String(doc.id)).length;
                  return (
                    <div key={doc.id}>
                      <span>{docName.charAt(0).toUpperCase()}</span>
                      <div>
                        <strong>{docName}</strong>
                        <small>{doc.specialty || t('specialty')}</small>
                      </div>
                      <em>{todaysCount}</em>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="admin-panel admin-staff-overview">
            <div>
              <span className="admin-section-label">{t('staff_overview')}</span>
              <h3>{t('total_employees')}</h3>
            </div>
            <strong>{stats?.totalEmployees ?? 0}</strong>
          </div>
        </aside>
      </section>

      <section className="chart-card admin-card admin-schedule-card">
        <div className="chart-card__header admin-schedule-header">
          <div>
            <span className="admin-section-label">{t('calendar_summary')}</span>
            <h4>
              <Calendar size={17} color="var(--primary)" />
              {t('todays_schedule')}
            </h4>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/dashboard/appointments')}>
            {t('view_all')} <ArrowRight size={13} />
          </button>
        </div>

        <div className="chart-card__body admin-schedule-body">
          <div className="table-container admin-table-container">
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
                {ctxLoading ? (
                  <tr><td colSpan="6"><div className="admin-table-state">{t('loading')}</div></td></tr>
                ) : todaySchedule.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="admin-table-state admin-table-state--empty">
                        <Calendar size={24} />
                        <span>{t('no_appointments_today')}</span>
                      </div>
                    </td>
                  </tr>
                ) : todaySchedule.map(apt => {
                  const doc = doctors.find(d => String(d.id) === String(apt.doctor_id));
                  const docName = isAr
                    ? (doc?.nameAr || doc?.full_name || doc?.name || '—')
                    : (doc?.name || doc?.full_name || doc?.nameAr || '—');
                  return (
                    <tr key={apt.id}>
                      <td className="admin-time-cell">{to12Hour(apt.time, isAr)}</td>
                      <td><strong>{apt.patient_name || '—'}</strong></td>
                      <td className="text-muted text-sm" style={{ fontFamily: 'monospace' }}>{apt.booking_code || '-'}</td>
                      <td>{docName}</td>
                      <td>
                        <span className={`badge ${statusBadge(apt.status)}`}>
                          {t(apt.status === 'no-show' ? 'no_show' : apt.status)}
                        </span>
                      </td>
                      <td>
                        {apt.status === 'pending' ? (
                          <div className="flex gap-sm">
                            <button className="btn btn-sm btn-success" onClick={() => changeStatus(apt.id, 'approved')}>
                              <CheckCircle size={13} /> {t('approve')}
                            </button>
                            <button className="btn btn-sm btn-outline btn-reject" onClick={() => changeStatus(apt.id, 'rejected')}>
                              <XCircle size={13} /> {t('reject')}
                            </button>
                          </div>
                        ) : ['approved', 'confirmed', 'in_progress'].includes(apt.status) ? (
                          <button className="btn btn-sm btn-success" onClick={() => setPaymentAppointment(apt)}>
                            <CheckCircle size={13} /> {isAr ? 'إكمال' : 'Complete'}
                          </button>
                        ) : <span className="text-muted text-sm">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mobile-card-list admin-mobile-schedule">
            {ctxLoading ? (
              <div className="admin-table-state">{t('loading')}</div>
            ) : todaySchedule.length === 0 ? (
              <div className="admin-table-state admin-table-state--empty">
                <Calendar size={24} />
                <span>{t('no_appointments_today')}</span>
              </div>
            ) : todaySchedule.map(apt => {
              const doc = doctors.find(d => String(d.id) === String(apt.doctor_id));
              const docName = isAr
                ? (doc?.nameAr || doc?.full_name || doc?.name || '—')
                : (doc?.name || doc?.full_name || doc?.nameAr || '—');
              return (
                <div key={apt.id} className="mobile-card-item admin-appointment-card">
                  <div className="flex items-center justify-between mb-sm">
                    <div>
                      <strong>{apt.patient_name || '—'}</strong>
                      <small>{to12Hour(apt.time, isAr)}</small>
                    </div>
                    <span className={`badge ${statusBadge(apt.status)}`}>
                      {t(apt.status === 'no-show' ? 'no_show' : apt.status)}
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">{isAr ? 'رقم الحجز' : 'Booking #'}</span>
                    <span className="mobile-card-value" style={{ fontFamily: 'monospace' }}>{apt.booking_code || '-'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">{t('doctor')}</span>
                    <span className="mobile-card-value">{docName}</span>
                  </div>
                  {apt.status === 'pending' && (
                    <div className="mobile-card-actions">
                      <button className="btn btn-sm btn-success" onClick={() => changeStatus(apt.id, 'approved')}>
                        <CheckCircle size={13} /> {t('approve')}
                      </button>
                      <button className="btn btn-sm btn-outline btn-reject" onClick={() => changeStatus(apt.id, 'rejected')}>
                        <XCircle size={13} /> {t('reject')}
                      </button>
                    </div>
                  )}
                  {['approved', 'confirmed', 'in_progress'].includes(apt.status) && (
                    <div className="mobile-card-actions">
                      <button className="btn btn-sm btn-success" onClick={() => setPaymentAppointment(apt)}>
                        <CheckCircle size={13} /> {isAr ? 'إكمال' : 'Complete'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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

export default AdminDashboard;
