import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { CheckCircle, XCircle, Clock, Search, CalendarDays } from 'lucide-react';
import { to12Hour } from '../components/TimeSlotGrid';

const Appointments = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { appointments, doctors, changeStatus, loading } = useApp();

  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  // Robust doctor-name lookup: tolerate string/number id mismatch (Supabase uuid vs mock int).
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

  return (
    <div className="page-padding animate-in">
      <div className="flex justify-between items-center mb-xl flex-wrap gap-md">
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarDays size={26} color="var(--primary)" />
          {isAr ? 'إدارة الحجوزات' : 'Manage Bookings'}
        </h2>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', top: 12, insetInlineStart: 12, color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="input"
            placeholder={isAr ? 'ابحث باسم المريض أو الهاتف...' : 'Search by patient name or phone...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ paddingInlineStart: '2.5rem' }}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-sm flex-wrap mb-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`btn ${filter === tab.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label} <span style={{ opacity: 0.7 }}>({counts[tab.id]})</span>
          </button>
        ))}
      </div>

      <div className="glass p-6">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('patient')}</th>
                <th>{isAr ? 'الهاتف' : 'Phone'}</th>
                <th>{t('doctor')}</th>
                <th>{t('date_time')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center text-muted">{t('loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="6" className="text-center text-muted" style={{ padding: '2rem' }}>
                  {isAr ? 'لا توجد حجوزات' : 'No bookings found'}
                </td></tr>
              ) : filtered.map(apt => (
                <tr key={apt.id}>
                  <td style={{ fontWeight: 600 }}>{apt.patient_name || '-'}</td>
                  <td dir="ltr" className="text-muted text-sm">{apt.patient_phone || '-'}</td>
                  <td>{getDocName(apt.doctor_id)}</td>
                  <td>
                    <div>{apt.date}</div>
                    <div className="text-muted text-sm flex items-center gap-sm"><Clock size={12} /> {to12Hour(apt.time, isAr)}</div>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge(apt.status)}`}>
                      {apt.status === 'pending' ? (isAr ? 'بانتظار الموافقة' : 'Pending') :
                       apt.status === 'confirmed' ? (isAr ? 'مقبول' : 'Approved') :
                       (isAr ? 'مرفوض' : 'Rejected')}
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
                          <CheckCircle size={15} /> {isAr ? 'قبول' : 'Approve'}
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                          onClick={() => changeStatus(apt.id, 'rejected')}
                        >
                          <XCircle size={15} /> {isAr ? 'رفض' : 'Reject'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted text-sm">
                        {apt.status === 'confirmed'
                          ? (isAr ? '✓ تمت الموافقة' : '✓ Approved')
                          : (isAr ? '✕ مرفوض' : '✕ Rejected')}
                      </span>
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

export default Appointments;
