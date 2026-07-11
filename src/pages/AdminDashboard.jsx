import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDashboardStats } from '../hooks/useDashboardStats';
import {
  Users, Stethoscope, Calendar, Clock, CheckCircle, XCircle,
  DollarSign, TrendingUp, AlertCircle, ArrowRight, BarChart2,
} from 'lucide-react';
import StatCard from '../components/analytics/StatCard';
import SvgLineChart from '../components/analytics/SvgLineChart';
import SvgDonutChart from '../components/analytics/SvgDonutChart';
import DateRangeFilter from '../components/analytics/DateRangeFilter';
import RecentPayments from '../components/analytics/RecentPayments';
import RecentActivity from '../components/analytics/RecentActivity';
import { to12Hour } from '../components/TimeSlotGrid';

const AdminDashboard = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const { appointments, doctors, patients, changeStatus, loading: ctxLoading, user } = useApp();

  const [dateRange, setDateRange] = useState('month');

  const { stats, loading: statsLoading } = useDashboardStats({
    appointments,
    doctors,
    patients,
    clinicId: user?.clinic_id,
    dateRange,
  });

  const loading = ctxLoading || statsLoading;
  const today   = new Date().toISOString().slice(0, 10);

  const todaySchedule = appointments
    .filter(a => (a.date || '') === today)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .slice(0, 8);

  const dateLabel = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const statusBadge = s => ({
    pending: 'badge-warning', confirmed: 'badge-info', in_progress: 'badge-primary',
    completed: 'badge-success', cancelled: 'badge-danger', rejected: 'badge-danger',
  }[s] || 'badge-warning');

  /* ── Chart data ────────────────────────────────────────────────────────── */

  const lineData = (stats?.monthlyData || []).map(m => ({
    label:   m.label,
    revenue: m.revenue,
    count:   m.count,
  }));

  const donutSegments = stats ? [
    { label: t('completed'),  value: stats.statusCounts.completed,                                   color: '#10b981' },
    { label: t('pending'),    value: stats.statusCounts.pending,                                     color: '#f59e0b' },
    { label: t('confirmed'),  value: stats.statusCounts.confirmed + stats.statusCounts.in_progress,  color: '#3b82f6' },
    { label: t('cancelled'),  value: stats.statusCounts.cancelled + stats.statusCounts.rejected,     color: '#ef4444' },
  ].filter(s => s.value > 0) : [];

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="page-padding animate-in">

      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(1.25rem, 4vw, 2rem)' }}>{t('dashboard_title')}</h2>
          <p className="text-muted" style={{ margin: '0.3rem 0 0', fontSize: 'clamp(0.8rem, 2.5vw, 0.9375rem)' }}>{dateLabel}</p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* ── Stat cards ── */}
      <div className="analytics-stats-grid">
        <StatCard
          icon={<Users size={20} />}
          iconBg="rgba(59,130,246,0.12)"  accent="#3b82f6"
          value={stats?.totalPatients   ?? 0}  label={t('total_patients')}
        />
        <StatCard
          icon={<Stethoscope size={20} />}
          iconBg="rgba(13,148,136,0.12)"  accent="var(--primary)"
          value={stats?.totalDoctors    ?? 0}  label={t('total_doctors')}
        />
        <StatCard
          icon={<Calendar size={20} />}
          iconBg="rgba(99,102,241,0.12)"  accent="#6366f1"
          value={stats?.todayTotal      ?? 0}  label={t('today_appointments')}
        />
        <StatCard
          icon={<Clock size={20} />}
          iconBg="rgba(245,158,11,0.12)"  accent="#f59e0b"
          value={stats?.pendingApprovals ?? 0} label={t('pending_appointments')}
        />
      </div>

      {/* ── Revenue row ── */}
      <div className="analytics-revenue-row">

        {/* Revenue card */}
        <div className="revenue-card revenue-card--primary">
          <div className="revenue-card__icon revenue-card__icon--primary">
            <DollarSign size={22} />
          </div>
          <div>
            <div className="revenue-card__value">
              {loading ? '…'
                : isAr
                  ? `${Number(stats?.totalRevenue || 0).toLocaleString()} ر.س`
                  : `$${Number(stats?.totalRevenue || 0).toLocaleString()}`
              }
            </div>
            <div className="revenue-card__label">{t('total_revenue')}</div>
            <div className="revenue-card__sub">{t('from_paid_appointments')}</div>
          </div>
        </div>

        {/* Expenses / Net Profit card */}
        {stats?.expensesAvailable === true ? (
          <div className="revenue-card revenue-card--success">
            <div className="revenue-card__icon revenue-card__icon--success">
              <TrendingUp size={22} />
            </div>
            <div>
              <div className="revenue-card__value">
                {isAr
                  ? `${Number(stats.netProfit || 0).toLocaleString()} ر.س`
                  : `$${Number(stats.netProfit || 0).toLocaleString()}`
                }
              </div>
              <div className="revenue-card__label">{t('net_profit')}</div>
              <div className="revenue-card__sub">
                {t('expenses')}: {isAr
                  ? `${Number(stats.totalExpenses || 0).toLocaleString()} ر.س`
                  : `$${Number(stats.totalExpenses || 0).toLocaleString()}`
                }
              </div>
            </div>
          </div>
        ) : stats?.expensesAvailable === false ? (
          <div className="revenue-card revenue-card--muted">
            <div className="revenue-card__icon revenue-card__icon--warn">
              <AlertCircle size={22} />
            </div>
            <div>
              <div className="revenue-card__value revenue-card__value--muted">
                {t('expenses_not_configured')}
              </div>
              <div className="revenue-card__sub">{t('expenses_module_hint')}</div>
            </div>
          </div>
        ) : (
          /* Still loading expenses check */
          <div className="revenue-card revenue-card--muted">
            <div className="revenue-card__icon revenue-card__icon--warn">
              <BarChart2 size={22} />
            </div>
            <div>
              <div className="revenue-card__value revenue-card__value--muted">…</div>
              <div className="revenue-card__sub">{t('loading')}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Charts ── */}
      <div className="analytics-charts-grid">

        {/* Monthly overview — line chart */}
        <div className="chart-card">
          <div className="chart-card__header">
            <h4>{t('monthly_revenue')}</h4>
          </div>
          <div className="chart-card__body">
            {lineData.length > 0 ? (
              <SvgLineChart
                data={lineData}
                lines={[
                  { key: 'revenue', label: t('revenue'),      color: '#0d9488' },
                  { key: 'count',   label: t('appointments'), color: '#6366f1' },
                ]}
                formatY={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                height={190}
              />
            ) : (
              <div className="chart-empty">{t('no_data_available')}</div>
            )}
          </div>
        </div>

        {/* Appointment status distribution — donut */}
        <div className="chart-card">
          <div className="chart-card__header">
            <h4>{t('appointment_distribution')}</h4>
          </div>
          <div className="chart-card__body chart-card__body--center">
            {donutSegments.length > 0 ? (
              <SvgDonutChart segments={donutSegments} size={148} />
            ) : (
              <div className="chart-empty">{t('no_data_available')}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom: Payments + Activity ── */}
      <div className="analytics-bottom-grid">
        <div className="chart-card">
          <div className="chart-card__header">
            <h4>{t('recent_payments')}</h4>
          </div>
          <div className="chart-card__body">
            <RecentPayments payments={stats?.recentPayments || []} loading={loading} />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <h4>{t('recent_activity')}</h4>
          </div>
          <div className="chart-card__body">
            <RecentActivity userId={user?.id} limit={7} />
          </div>
        </div>
      </div>

      {/* ── Today's schedule ── */}
      <div className="chart-card" style={{ marginTop: '1.5rem' }}>
        <div className="chart-card__header" style={{ justifyContent: 'space-between' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={17} color="var(--primary)" />
            {t('todays_schedule')}
          </h4>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/dashboard/appointments')}>
            {t('view_all')} <ArrowRight size={13} />
          </button>
        </div>

        {/* Desktop table */}
        <div className="chart-card__body" style={{ padding: 0 }}>
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
                {ctxLoading ? (
                  <tr><td colSpan="6" className="text-center text-muted" style={{ padding: '1.5rem' }}>{t('loading')}</td></tr>
                ) : todaySchedule.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted" style={{ padding: '2rem' }}>
                      {t('no_appointments_today')}
                    </td>
                  </tr>
                ) : todaySchedule.map(apt => {
                  const doc     = doctors.find(d => String(d.id) === String(apt.doctor_id));
                  const docName = isAr
                    ? (doc?.nameAr || doc?.full_name || doc?.name || '—')
                    : (doc?.name   || doc?.full_name || doc?.nameAr || '—');
                  return (
                    <tr key={apt.id}>
                      <td>{to12Hour(apt.time, isAr)}</td>
                      <td style={{ fontWeight: 600 }}>{apt.patient_name || '—'}</td>
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
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="mobile-card-list" style={{ padding: '0.75rem' }}>
            {ctxLoading ? (
              <div className="text-center text-muted" style={{ padding: '1.5rem' }}>{t('loading')}</div>
            ) : todaySchedule.length === 0 ? (
              <div className="text-center text-muted" style={{ padding: '2rem' }}>{t('no_appointments_today')}</div>
            ) : todaySchedule.map(apt => {
              const doc     = doctors.find(d => String(d.id) === String(apt.doctor_id));
              const docName = isAr
                ? (doc?.nameAr || doc?.full_name || doc?.name || '—')
                : (doc?.name   || doc?.full_name || doc?.nameAr || '—');
              return (
                <div key={apt.id} className="mobile-card-item">
                  <div className="flex items-center justify-between mb-sm">
                    <div style={{ fontWeight: 700 }}>{apt.patient_name || '—'}</div>
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
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">{t('time')}</span>
                    <span className="mobile-card-value">{to12Hour(apt.time, isAr)}</span>
                  </div>
                  {apt.status === 'pending' && (
                    <div className="mobile-card-actions">
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--success)', color: '#fff', flex: 1 }}
                        onClick={() => changeStatus(apt.id, 'confirmed')}
                      >
                        <CheckCircle size={13} /> {t('approve')}
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ borderColor: 'var(--danger)', color: 'var(--danger)', flex: 1 }}
                        onClick={() => changeStatus(apt.id, 'rejected')}
                      >
                        <XCircle size={13} /> {t('reject')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
