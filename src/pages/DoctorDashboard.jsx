import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  CalendarDays, CheckCircle, Clock, Users, Play, X,
  ChevronRight, Phone, Stethoscope, UserCheck, TrendingUp,
} from 'lucide-react';
import StatsCard from '../components/StatsCard';
import { to12Hour } from '../components/TimeSlotGrid';

// ---- date helpers (ISO 'YYYY-MM-DD', so string compares are chronological) ----
const isoToday = () => new Date().toISOString().slice(0, 10);
const isoDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const WEEKDAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Statuses that represent a voided appointment (excluded from active counts).
const VOID = ['cancelled', 'rejected'];

const RangeMetric = ({ label, value }) => (
  <div style={{ flex: '1 1 140px' }}>
    <div className="dash-stat-value" style={{ fontSize: '1.75rem' }}>{value}</div>
    <div className="dash-stat-label">{label}</div>
  </div>
);

const DoctorDashboard = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const { user, appointments, doctors, patients, changeStatus, loading } = useApp();

  const [range, setRange] = useState('today');
  const today = isoToday();

  // Resolve THIS doctor's doctors-row id from their profile id (doctors.profile_id → profiles.id).
  // Falls back to an email match if the row wasn't linked. null → nothing shown (safe; never leaks).
  const myDoctorId = useMemo(() => {
    const row = doctors.find(d =>
      String(d.profile_id) === String(user?.id) ||
      (d.email && user?.email && d.email === user.email)
    );
    return row ? String(row.id) : null;
  }, [doctors, user?.id, user?.email]);

  // His appointments only — extra guard on top of AppContext's clinic_id scoping.
  const myAppointments = useMemo(
    () => (myDoctorId ? appointments.filter(a => String(a.doctor_id) === myDoctorId) : []),
    [appointments, myDoctorId]
  );

  // A patient is identified by phone (fallback name) — appointments carry no patient_id.
  const patientKey = (a) => a.patient_phone || a.patient_name || a.id;

  // ---- Today snapshot ----
  const todays = useMemo(() => myAppointments.filter(a => a.date === today), [myAppointments, today]);
  const stats = useMemo(() => {
    const active = todays.filter(a => !VOID.includes(a.status));
    const completed = todays.filter(a => a.status === 'completed');
    const waiting = todays.filter(a => a.status === 'pending' || a.status === 'confirmed');
    const visited = new Set(
      todays.filter(a => a.status === 'in_progress' || a.status === 'completed').map(patientKey)
    );
    return { today: active.length, completed: completed.length, waiting: waiting.length, visited: visited.size };
  }, [todays]);

  // ---- Range filter: Today / This week (rolling 7d) / This month (calendar month) ----
  const inRange = (date) => {
    if (!date) return false;
    if (range === 'today') return date === today;
    if (range === 'week') return date >= isoDaysAgo(6) && date <= today;
    return date.slice(0, 7) === today.slice(0, 7); // month
  };

  const rangeStats = useMemo(() => {
    const appts = myAppointments.filter(a => inRange(a.date) && !VOID.includes(a.status));
    const seen = new Set(appts.map(patientKey));
    // "New patient" = first-ever appointment with this doctor falls inside the selected range.
    const firstSeen = {};
    myAppointments.forEach(a => {
      if (!a.date) return;
      const k = patientKey(a);
      if (!firstSeen[k] || a.date < firstSeen[k]) firstSeen[k] = a.date;
    });
    const newCount = [...seen].filter(k => inRange(firstSeen[k])).length;
    return { appointments: appts.length, patients: seen.size, newPatients: newCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAppointments, range, today]);

  // ---- Today's list (sorted by time) ----
  const todayList = useMemo(
    () => [...todays].sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [todays]
  );

  // ---- Recent patients (latest appointment per patient) + profile link when matchable ----
  const recentPatients = useMemo(() => {
    const map = new Map();
    myAppointments.forEach(a => {
      const k = patientKey(a);
      if (!k) return;
      const cur = map.get(k);
      if (!cur || (a.date || '') > (cur.lastDate || '')) {
        map.set(k, { name: a.patient_name || '-', phone: a.patient_phone || '', lastDate: a.date || '' });
      }
    });
    return [...map.values()]
      .map(p => {
        const prof = patients.find(pt =>
          (pt.phone_number && pt.phone_number === p.phone) ||
          (pt.phone && pt.phone === p.phone) ||
          (pt.full_name && pt.full_name === p.name)
        );
        return { ...p, profileId: prof?.id || null };
      })
      .sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''))
      .slice(0, 6);
  }, [myAppointments, patients]);

  // ---- Visits per day, last 7 days ----
  const last7 = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const count = myAppointments.filter(a => a.date === ds && !VOID.includes(a.status)).length;
      out.push({ ds, count, label: t(WEEKDAY_IDS[d.getDay()]) });
    }
    return out;
  }, [myAppointments, t]);
  const maxCount = Math.max(1, ...last7.map(d => d.count));

  const statusBadge = (s) => ({
    pending: 'badge-warning',
    confirmed: 'badge-info',
    in_progress: 'badge-primary',
    completed: 'badge-success',
    cancelled: 'badge-danger',
    rejected: 'badge-danger',
    'no-show': 'badge-danger',
    no_show: 'badge-danger',
  }[s] || 'badge-warning');

  const statusLabel = (s) => t(s === 'no-show' ? 'no_show' : s);

  const renderActions = (apt) => {
    const s = apt.status;
    if (s === 'pending' || s === 'confirmed') {
      return (
        <div className="flex gap-sm">
          <button className="btn btn-sm" style={{ background: 'var(--primary)', color: '#fff' }}
            onClick={() => changeStatus(apt.id, 'in_progress')}>
            <Play size={14} /> {t('start_visit')}
          </button>
          <button className="btn btn-sm btn-outline" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={() => changeStatus(apt.id, 'cancelled')}>
            <X size={14} /> {t('cancel')}
          </button>
        </div>
      );
    }
    if (s === 'in_progress') {
      return (
        <div className="flex gap-sm">
          <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff' }}
            onClick={() => changeStatus(apt.id, 'completed')}>
            <CheckCircle size={14} /> {t('complete_visit')}
          </button>
          <button className="btn btn-sm btn-outline" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={() => changeStatus(apt.id, 'cancelled')}>
            <X size={14} /> {t('cancel')}
          </button>
        </div>
      );
    }
    return <span className="text-muted text-sm">{statusLabel(s)}</span>;
  };

  const rangeTabs = [
    { id: 'today', label: t('today') },
    { id: 'week', label: t('this_week') },
    { id: 'month', label: t('this_month') },
  ];

  const dateLabel = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="page-padding animate-in">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-md mb-xl">
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Stethoscope size={26} color="var(--primary)" />
            {t('doctor_dashboard')}
          </h2>
          <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
            {user?.name ? `${isAr ? 'د. ' : 'Dr. '}${user.name} · ` : ''}{dateLabel}
          </p>
        </div>
      </div>

      {/* Today snapshot */}
      <div className="stats-row" style={{ marginTop: 0 }}>
        <StatsCard icon={<CalendarDays size={24} color="var(--primary)" />} iconBg="var(--primary-100)" value={stats.today} label={t('today_appointments')} />
        <StatsCard icon={<CheckCircle size={24} color="#10b981" />} iconBg="rgba(16,185,129,0.1)" value={stats.completed} label={t('completed_visits')} />
        <StatsCard icon={<Clock size={24} color="#f59e0b" />} iconBg="rgba(245,158,11,0.1)" value={stats.waiting} label={t('waiting_appointments')} />
        <StatsCard icon={<UserCheck size={24} color="#3b82f6" />} iconBg="rgba(59,130,246,0.1)" value={stats.visited} label={t('patients_visited')} />
      </div>

      {/* Range filter + range metrics */}
      <div className="glass p-6 mb-xl">
        <div className="flex gap-sm flex-wrap mb-lg">
          {rangeTabs.map(tab => (
            <button key={tab.id}
              className={`btn btn-sm ${range === tab.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRange(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-lg flex-wrap">
          <RangeMetric label={t('total_appointments')} value={rangeStats.appointments} />
          <RangeMetric label={t('total_patients')} value={rangeStats.patients} />
          <RangeMetric label={t('new_patients')} value={rangeStats.newPatients} />
        </div>
      </div>

      {/* Today's appointments */}
      <div className="glass p-6 mb-xl">
        <h3 className="mb-md flex items-center gap-sm"><CalendarDays size={20} color="var(--primary)" /> {t('today_appointments')}</h3>
        <div className="table-container">
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
              ) : todayList.length === 0 ? (
                <tr><td colSpan="4" className="text-center text-muted" style={{ padding: '2rem' }}>{t('no_appointments_today')}</td></tr>
              ) : todayList.map(apt => (
                <tr key={apt.id}>
                  <td><span className="flex items-center gap-sm"><Clock size={14} className="text-muted" /> {to12Hour(apt.time, isAr)}</span></td>
                  <td style={{ fontWeight: 600 }}>{apt.patient_name || '-'}</td>
                  <td><span className={`badge ${statusBadge(apt.status)}`}>{statusLabel(apt.status)}</span></td>
                  <td>{renderActions(apt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visits chart + recent patients */}
      <div className="flex gap-xl flex-wrap">
        <div className="glass p-6" style={{ flex: '1 1 380px' }}>
          <h3 className="mb-lg flex items-center gap-sm"><TrendingUp size={20} color="var(--primary)" /> {t('visits_last_7')}</h3>
          <div className="flex items-end gap-sm" style={{ height: 180 }}>
            {last7.map(d => (
              <div key={d.ds} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div className="text-sm text-muted" style={{ marginBottom: 4 }}>{d.count}</div>
                <div style={{
                  width: '100%', maxWidth: 36,
                  height: `${(d.count / maxCount) * 130}px`, minHeight: 4,
                  background: 'linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%)',
                  borderRadius: 6, transition: 'height .5s ease',
                }} />
                <div className="text-sm text-muted" style={{ marginTop: 6 }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-6" style={{ flex: '1 1 380px' }}>
          <h3 className="mb-lg flex items-center gap-sm"><Users size={20} color="var(--primary)" /> {t('recent_patients')}</h3>
          {recentPatients.length === 0 ? (
            <p className="text-muted">{t('no_recent_patients')}</p>
          ) : (
            <div className="flex flex-col gap-md">
              {recentPatients.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between gap-md"
                  style={{ paddingBottom: '0.75rem', borderBottom: idx < recentPatients.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="flex items-center gap-sm">
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, flexShrink: 0,
                    }}>
                      {(p.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {p.phone ? (
                        <div className="text-sm text-muted flex items-center gap-sm" dir="ltr">
                          <Phone size={12} /> {p.phone}
                        </div>
                      ) : null}
                      <div className="text-sm text-muted">{t('last_visit')}: {p.lastDate || '-'}</div>
                    </div>
                  </div>
                  <button className="btn btn-sm btn-outline" disabled={!p.profileId}
                    onClick={() => p.profileId && navigate(`/dashboard/patients/${p.profileId}`)}
                    title={p.profileId ? t('open_profile') : ''}>
                    {t('open_profile')} <ChevronRight size={14} />
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
