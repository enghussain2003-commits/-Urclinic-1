import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { CheckCircle, XCircle, Clock, Search, CalendarDays, User } from 'lucide-react';
import { to12Hour } from '../components/TimeSlotGrid';

const Appointments = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { appointments, doctors, changeStatus, loading } = useApp();

  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const getDocName = (id) => {
    const doc = doctors.find(d => String(d.id) === String(id));
    if (!doc) return isAr ? 'طبيب غير معروف' : 'Unknown doctor';
    return isAr ? (doc.nameAr || doc.name || doc.full_name) : (doc.name || doc.full_name || doc.nameAr);
  };

  const statusBadge = (status) => {
    const map = {
      pending: 'badge-warning',
      confirmed: 'badge-success',
      cancelled: 'badge-danger',
      rejected: 'badge-danger',
      'no-show': 'badge-danger',
    };
    return map[status] || 'badge-warning';
  };

  const statusLabel = (status) => {
    if (status === 'pending')   return isAr ? 'بانتظار الموافقة' : 'Pending';
    if (status === 'confirmed') return isAr ? 'مقبول' : 'Approved';
    if (status === 'cancelled') return isAr ? 'ملغي' : 'Cancelled';
    return isAr ? 'مرفوض' : 'Rejected';
  };

  const filtered = appointments.filter(a => {
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'pending' ? a.status === 'pending' :
      filter === 'confirmed' ? a.status === 'confirmed' :
      filter === 'rejected' ? (a.status === 'rejected' || a.status === 'cancelled') : true;
    const q = query.toLowerCase();
    const matchesQuery = !q ||
      (a.patient_name || '').toLowerCase().includes(q) ||
      (a.patient_phone || '').includes(q);
    return matchesFilter && matchesQuery;
  });

  const counts = {
    all: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    rejected: appointments.filter(a => a.status === 'rejected' || a.status === 'cancelled').length,
  };

  const tabs = [
    { id: 'all', label: isAr ? 'الكل' : 'All' },
    { id: 'pending', label: isAr ? 'بانتظار الموافقة' : 'Pending' },
    { id: 'confirmed', label: isAr ? 'مقبولة' : 'Approved' },
    { id: 'rejected', label: isAr ? 'مرفوضة' : 'Rejected' },
  ];

  const ActionButtons = ({ apt }) => {
    if (apt.status !== 'pending') {
      return (
        <span className="text-muted text-sm">
          {apt.status === 'confirmed'
            ? (isAr ? '✓ تمت الموافقة' : '✓ Approved')
            : (isAr ? '✕ مرفوض' : '✕ Rejected')}
        </span>
      );
    }
    return (
      <div className="flex gap-sm flex-wrap">
        <button
          className="btn btn-sm"
          style={{ background: 'var(--success)', color: '#fff', flex: 1 }}
          onClick={() => changeStatus(apt.id, 'confirmed')}
        >
          <CheckCircle size={15} /> {isAr ? 'قبول' : 'Approve'}
        </button>
        <button
          className="btn btn-sm btn-outline"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)', flex: 1 }}
          onClick={() => changeStatus(apt.id, 'rejected')}
        >
          <XCircle size={15} /> {isAr ? 'رفض' : 'Reject'}
        </button>
      </div>
    );
  };

  return (
    <div className="page-padding animate-in">
      {/* Page header */}
      <div className="flex justify-between items-center mb-xl flex-wrap gap-md page-header-row">
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarDays size={26} color="var(--primary)" />
          {isAr ? 'إدارة الحجوزات' : 'Manage Bookings'}
        </h2>
        {/* Search */}
        <div style={{ position: 'relative' }} className="search-box">
          <Search size={18} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: 12, color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="input"
            placeholder={isAr ? 'ابحث باسم المريض أو الهاتف...' : 'Search by name or phone...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ paddingInlineStart: '2.5rem', minWidth: 220 }}
          />
        </div>
      </div>

      {/* Filter tabs — horizontally scrollable on mobile */}
      <div className="flex gap-sm mb-xl tabs-row" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`btn ${filter === tab.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(tab.id)}
            style={{ flexShrink: 0 }}
          >
            {tab.label} <span style={{ opacity: 0.7 }}>({counts[tab.id]})</span>
          </button>
        ))}
      </div>

      {/* ── Desktop table view ── */}
      <div className="glass p-6 table-container">
        <table>
          <thead>
            <tr>
              <th>{t('patient')}</th>
              <th>{isAr ? 'رقم الحجز' : 'Booking #'}</th>
              <th>{isAr ? 'الهاتف' : 'Phone'}</th>
              <th>{t('doctor')}</th>
              <th>{t('date_time')}</th>
              <th>{t('status')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center text-muted">{t('loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="7" className="text-center text-muted" style={{ padding: '2rem' }}>
                {isAr ? 'لا توجد حجوزات' : 'No bookings found'}
              </td></tr>
            ) : filtered.map(apt => (
              <tr key={apt.id}>
                <td style={{ fontWeight: 600 }}>{apt.patient_name || '-'}</td>
                <td className="text-muted text-sm" style={{ fontFamily: 'monospace' }}>{apt.booking_code || '-'}</td>
                <td dir="ltr" className="text-muted text-sm">{apt.patient_phone || '-'}</td>
                <td>{getDocName(apt.doctor_id)}</td>
                <td>
                  <div>{apt.date}</div>
                  <div className="text-muted text-sm flex items-center gap-sm"><Clock size={12} /> {to12Hour(apt.time, isAr)}</div>
                </td>
                <td>
                  <span className={`badge ${statusBadge(apt.status)}`}>{statusLabel(apt.status)}</span>
                </td>
                <td><ActionButtons apt={apt} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile card list ── */}
      <div className="mobile-card-list">
        {loading ? (
          <div className="text-center text-muted" style={{ padding: '2rem' }}>{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="card-flat text-center text-muted" style={{ padding: '2rem' }}>
            {isAr ? 'لا توجد حجوزات' : 'No bookings found'}
          </div>
        ) : filtered.map(apt => (
          <div key={apt.id} className="mobile-card-item">
            {/* Patient */}
            <div className="flex items-center gap-sm mb-sm">
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0
              }}>
                {(apt.patient_name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{apt.patient_name || '-'}</div>
                <div className="text-sm text-muted" dir="ltr">{apt.patient_phone || '-'}</div>
              </div>
              <span className={`badge ${statusBadge(apt.status)}`} style={{ marginInlineStart: 'auto' }}>
                {statusLabel(apt.status)}
              </span>
            </div>
            <div className="mobile-card-row">
              <span className="mobile-card-label">{isAr ? 'رقم الحجز' : 'Booking #'}</span>
              <span className="mobile-card-value" style={{ fontFamily: 'monospace' }}>{apt.booking_code || '-'}</span>
            </div>
            <div className="mobile-card-row">
              <span className="mobile-card-label"><User size={12} /> {isAr ? 'الطبيب' : 'Doctor'}</span>
              <span className="mobile-card-value">{getDocName(apt.doctor_id)}</span>
            </div>
            <div className="mobile-card-row">
              <span className="mobile-card-label"><CalendarDays size={12} /> {isAr ? 'التاريخ' : 'Date'}</span>
              <span className="mobile-card-value">{apt.date}</span>
            </div>
            <div className="mobile-card-row">
              <span className="mobile-card-label"><Clock size={12} /> {isAr ? 'الوقت' : 'Time'}</span>
              <span className="mobile-card-value">{to12Hour(apt.time, isAr)}</span>
            </div>
            <div className="mobile-card-actions">
              <ActionButtons apt={apt} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Appointments;
