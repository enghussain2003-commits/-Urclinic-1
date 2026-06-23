import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  Calendar, Users, Stethoscope, Clock, CheckCircle, UserPlus,
  CalendarDays, ChevronRight, X,
} from 'lucide-react';
import StatsCard from '../components/StatsCard';
import { to12Hour } from '../components/TimeSlotGrid';
import DoctorDashboard from './DoctorDashboard';

const isoToday = () => new Date().toISOString().slice(0, 10);
const VOID = ['cancelled', 'rejected'];

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const { appointments, changeStatus, doctors, patients, loading, user } = useApp();

  // Doctors get a dedicated, per-doctor scoped dashboard (no hooks below this point).
  if (user?.role === 'doctor') return <DoctorDashboard />;

  const today = isoToday();
  const thisMonth = today.slice(0, 7);

  const getDocName = (id) => {
    const doc = doctors.find(d => String(d.id) === String(id));
    if (!doc) return isAr ? 'طبيب غير معروف' : 'Unknown doctor';
    return isAr ? (doc.nameAr || doc.name || doc.full_name) : (doc.name || doc.full_name || doc.nameAr);
  };

  // ---- Clinic management stats (NO financial/revenue data) ----
  const stats = useMemo(() => {
    const todays = appointments.filter(a => a.date === today);
    return {
      totalPatients: patients.length,
      totalDoctors: doctors.length,
      today: todays.filter(a => !VOID.includes(a.status)).length,
      pending: appointments.filter(a => a.status === 'pending').length,
      completed: appointments.filter(a => a.status === 'completed').length,
      newPatients: patients.filter(p => (p.created_at || '').slice(0, 7) === thisMonth).length,
    };
  }, [appointments, doctors, patients, today, thisMonth]);

  const todaySchedule = useMemo(
    () => appointments.filter(a => a.date === today)
      .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [appointments, today]
  );

  const statusBadge = (s) => ({
    pending: 'badge-warning', confirmed: 'badge-info', in_progress: 'badge-primary',
    completed: 'badge-success', cancelled: 'badge-danger', rejected: 'badge-danger',
  }[s] || 'badge-warning');

  return (
    <div className="page-padding animate-in">
      <div className="mb-xl">
        <h2 style={{ margin: 0 }}>{t('dashboard_title')}</h2>
        <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
          {user?.role === 'employee' ? t('employee_panel') : t('clinic_admin_panel')}
        </p>
      </div>

      {/* Management stats — operational only, no revenue */}
      <div className="stats-row" style={{ marginTop: 0 }}>
        <StatsCard icon={<Users size={24} color="#3b82f6" />} iconBg="rgba(59,130,246,0.1)" value={stats.totalPatients} label={t('total_patients')} />
        <StatsCard icon={<Stethoscope size={24} color="var(--primary)" />} iconBg="var(--primary-100)" value={stats.totalDoctors} label={t('total_doctors')} />
        <StatsCard icon={<Calendar size={24} color="#6366f1" />} iconBg="rgba(99,102,241,0.1)" value={stats.today} label={t('today_appointments')} />
        <StatsCard icon={<Clock size={24} color="#f59e0b" />} iconBg="rgba(245,158,11,0.1)" value={stats.pending} label={t('pending_appointments')} />
        <StatsCard icon={<CheckCircle size={24} color="#10b981" />} iconBg="rgba(16,185,129,0.1)" value={stats.completed} label={t('completed_visits')} />
        <StatsCard icon={<UserPlus size={24} color="#8b5cf6" />} iconBg="rgba(139,92,246,0.1)" value={stats.newPatients} label={t('new_patients')} />
      </div>

      {/* Management quick links */}
      <div className="flex gap-lg flex-wrap mb-xl">
        <button className="glass p-6 flex items-center justify-between" style={{ flex: '1 1 280px', cursor: 'pointer', textAlign: 'start' }}
          onClick={() => navigate('/dashboard/appointments')}>
          <div className="flex items-center gap-md">
            <CalendarDays size={22} color="var(--primary)" />
            <div>
              <div style={{ fontWeight: 700 }}>{t('appointments_management')}</div>
              <div className="text-sm text-muted">{t('manage_bookings_desc')}</div>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted" />
        </button>
        <button className="glass p-6 flex items-center justify-between" style={{ flex: '1 1 280px', cursor: 'pointer', textAlign: 'start' }}
          onClick={() => navigate('/dashboard/patients')}>
          <div className="flex items-center gap-md">
            <Users size={22} color="#3b82f6" />
            <div>
              <div style={{ fontWeight: 700 }}>{t('patients_management')}</div>
              <div className="text-sm text-muted">{t('manage_patients_desc')}</div>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted" />
        </button>
      </div>

      {/* Today's schedule */}
      <div className="glass p-6">
        <h3 className="mb-md flex items-center gap-sm"><CalendarDays size={20} color="var(--primary)" /> {t('todays_schedule')}</h3>
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
                <tr><td colSpan="5" className="text-center text-muted">{t('loading')}...</td></tr>
              ) : todaySchedule.length === 0 ? (
                <tr><td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>{t('no_appointments_today')}</td></tr>
              ) : todaySchedule.map(apt => (
                <tr key={apt.id}>
                  <td><span className="flex items-center gap-sm"><Clock size={14} className="text-muted" /> {to12Hour(apt.time, isAr)}</span></td>
                  <td style={{ fontWeight: 600 }}>{apt.patient_name || '-'}</td>
                  <td>{getDocName(apt.doctor_id)}</td>
                  <td><span className={`badge ${statusBadge(apt.status)}`}>{t(apt.status === 'no-show' ? 'no_show' : apt.status)}</span></td>
                  <td>
                    {apt.status === 'pending' ? (
                      <div className="flex gap-sm">
                        <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff' }}
                          onClick={() => changeStatus(apt.id, 'confirmed')}>
                          <CheckCircle size={14} /> {t('approve')}
                        </button>
                        <button className="btn btn-sm btn-outline" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                          onClick={() => changeStatus(apt.id, 'rejected')}>
                          <X size={14} /> {t('reject')}
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
    </div>
  );
};

export default Dashboard;
