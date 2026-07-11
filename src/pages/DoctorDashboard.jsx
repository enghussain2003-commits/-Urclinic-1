import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDoctorStats } from '../hooks/useDoctorStats';
import {
  Calendar, CheckCircle, Clock, Users, Play, X,
  ChevronRight, Phone, Stethoscope, TrendingUp,
} from 'lucide-react';
import StatCard from '../components/analytics/StatCard';
import SvgBarChart from '../components/analytics/SvgBarChart';
import { to12Hour } from '../components/TimeSlotGrid';

const DoctorDashboard = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const { user, appointments, doctors, patients, changeStatus, loading } = useApp();

  const stats = useDoctorStats({ appointments, doctors, patients, user });

  const statusBadge = s => ({
    pending: 'badge-warning', confirmed: 'badge-info', in_progress: 'badge-primary',
    completed: 'badge-success', cancelled: 'badge-danger', rejected: 'badge-danger',
    'no-show': 'badge-danger', no_show: 'badge-danger',
  }[s] || 'badge-warning');

  const statusLabel = s => t(s === 'no-show' ? 'no_show' : s);

  const renderActions = apt => {
    const s = apt.status;
    if (s === 'pending' || s === 'confirmed') {
      return (
        <div className="flex gap-sm">
          <button
            className="btn btn-sm"
            style={{ background: 'var(--primary)', color: '#fff' }}
            onClick={() => changeStatus(apt.id, 'in_progress')}
          >
            <Play size={13} /> {t('start_visit')}
          </button>
          <button
            className="btn btn-sm btn-outline"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={() => changeStatus(apt.id, 'cancelled')}
          >
            <X size={13} /> {t('cancel')}
          </button>
        </div>
      );
    }
    if (s === 'in_progress') {
      return (
        <div className="flex gap-sm">
          <button
            className="btn btn-sm"
            style={{ background: 'var(--success)', color: '#fff' }}
            onClick={() => changeStatus(apt.id, 'completed')}
          >
            <CheckCircle size={13} /> {t('complete_visit')}
          </button>
          <button
            className="btn btn-sm btn-outline"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={() => changeStatus(apt.id, 'cancelled')}
          >
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

  return (
    <div className="page-padding animate-in">

      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Stethoscope size={24} color="var(--primary)" />
            {t('doctor_dashboard')}
          </h2>
          <p className="text-muted" style={{ margin: '0.3rem 0 0' }}>
            {user?.name ? `${drPrefix}${user.name} · ` : ''}{dateLabel}
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="analytics-stats-grid">
        <StatCard
          icon={<Calendar size={20} />}
          iconBg="rgba(13,148,136,0.12)"  accent="var(--primary)"
          value={stats.todayTotal}         label={t('today_appointments')}
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          iconBg="rgba(16,185,129,0.12)"  accent="#10b981"
          value={stats.completedToday}     label={t('completed_visits')}
        />
        <StatCard
          icon={<Clock size={20} />}
          iconBg="rgba(245,158,11,0.12)"  accent="#f59e0b"
          value={stats.waitingToday}       label={t('waiting_appointments')}
        />
        <StatCard
          icon={<Users size={20} />}
          iconBg="rgba(99,102,241,0.12)"  accent="#6366f1"
          value={stats.patientsThisMonth} label={t('patients_this_month')}
        />
      </div>

      {/* ── Chart + Today's list ── */}
      <div className="analytics-charts-grid">

        {/* Weekly bar chart */}
        <div className="chart-card">
          <div className="chart-card__header">
            <TrendingUp size={16} color="var(--primary)" />
            <h4>{t('appointments_per_week')}</h4>
          </div>
          <div className="chart-card__body">
            {stats.weeklyData.some(d => d.count > 0) ? (
              <SvgBarChart
                data={stats.weeklyData.map(d => ({ label: d.label, value: d.count }))}
                color="var(--primary)"
                height={190}
              />
            ) : (
              <div className="chart-empty">{t('no_data_available')}</div>
            )}
          </div>
        </div>

        {/* Today's schedule */}
        <div className="chart-card">
          <div className="chart-card__header">
            <Calendar size={16} color="var(--primary)" />
            <h4>{t('today_appointments')}</h4>
          </div>
          <div className="table-container" style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('time')}</th>
                  <th>{t('patient')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center text-muted">{t('loading')}</td></tr>
                ) : stats.todayList.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted" style={{ padding: '1.5rem' }}>
                      {t('no_appointments_today')}
                    </td>
                  </tr>
                ) : stats.todayList.map(apt => (
                  <tr key={apt.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Clock size={13} className="text-muted" style={{ marginInlineEnd: 4 }} />
                      {to12Hour(apt.time, isAr)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{apt.patient_name || '—'}</td>
                    <td>
                      <span className={`badge ${statusBadge(apt.status)}`}>
                        {statusLabel(apt.status)}
                      </span>
                    </td>
                    <td>{renderActions(apt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Mobile Cards View */}
          <div className="mobile-card-list">
            {loading ? (
              <div className="text-center text-muted py-xl">{t('loading')}</div>
            ) : stats.todayList.length === 0 ? (
              <div className="text-center text-muted py-xl card-flat bg-alt">
                {t('no_appointments_today')}
              </div>
            ) : (
              stats.todayList.map(apt => (
                <div key={apt.id} className="mobile-card-item">
                  <div className="mobile-card-row">
                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{apt.patient_name || '—'}</div>
                    <span className={`badge ${statusBadge(apt.status)}`}>
                      {statusLabel(apt.status)}
                    </span>
                  </div>
                  <div className="text-sm text-muted mb-md flex items-center">
                    <Clock size={14} style={{ marginInlineEnd: 6 }} />
                    {to12Hour(apt.time, isAr)}
                  </div>
                  <div className="mobile-card-actions">
                    {renderActions(apt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Recent patients ── */}
      <div className="chart-card" style={{ marginTop: '1.5rem' }}>
        <div className="chart-card__header">
          <Users size={16} color="var(--primary)" />
          <h4>{t('recent_patients')}</h4>
        </div>
        <div className="chart-card__body">
          {stats.recentPatients.length === 0 ? (
            <div className="analytics-empty-state">
              <Users size={28} />
              <p>{t('no_recent_patients')}</p>
            </div>
          ) : (
            <div className="doctor-patient-list">
              {stats.recentPatients.map((p, idx) => (
                <div key={idx} className="doctor-patient-item">
                  <div className="doctor-patient-avatar">
                    {(p.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="doctor-patient-info">
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    {p.phone && (
                      <div className="text-sm text-muted flex items-center gap-sm" dir="ltr">
                        <Phone size={11} /> {p.phone}
                      </div>
                    )}
                    <div className="text-sm text-muted">
                      {t('last_visit')}: {p.lastDate || '—'}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-outline"
                    disabled={!p.profileId}
                    onClick={() => p.profileId && navigate(`/dashboard/patients/${p.profileId}`)}
                  >
                    {t('open_profile')} <ChevronRight size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
