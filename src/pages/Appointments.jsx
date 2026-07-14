import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Eye,
  Phone,
  Search,
  User,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { to12Hour } from '../components/TimeSlotGrid';
import ContactActionsCard from '../components/ContactActionsCard';
import { buildContactMessage } from '../services/contactService';

const Appointments = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const { appointments, doctors, changeStatus, loading, user } = useApp();

  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language, isAr]);

  const getDocName = (id) => {
    const doc = doctors.find(d => String(d.id) === String(id));
    if (!doc) return isAr ? 'طبيب غير معروف' : 'Unknown doctor';
    return isAr ? (doc.nameAr || doc.name || doc.full_name) : (doc.name || doc.full_name || doc.nameAr);
  };

  const statusBadge = (status) => {
    const map = {
      pending: 'badge-warning',
      approved: 'badge-success',
      confirmed: 'badge-success',
      in_progress: 'badge-primary',
      completed: 'badge-success',
      cancelled: 'badge-danger',
      rejected: 'badge-danger',
      'no-show': 'badge-danger',
    };
    return map[status] || 'badge-warning';
  };

  const statusLabel = (status) => {
    if (status === 'pending') return isAr ? 'بانتظار الموافقة' : 'Pending';
    if (status === 'approved' || status === 'confirmed') return isAr ? 'مقبول' : 'Approved';
    if (status === 'in_progress') return isAr ? 'قيد الكشف' : 'In progress';
    if (status === 'completed') return isAr ? 'مكتمل' : 'Completed';
    if (status === 'cancelled') return isAr ? 'ملغي' : 'Cancelled';
    return isAr ? 'مرفوض' : 'Rejected';
  };

  const unknownPatientLabel = isAr ? 'مريض غير معروف' : 'Unknown patient';

  const getPatientName = (apt) =>
    apt?.patient?.full_name ||
    apt?.patient_name ||
    apt?.patient_profile?.full_name ||
    unknownPatientLabel;

  const getPatientPhone = (apt) =>
    apt?.patient?.phone ||
    apt?.patient?.phone_number ||
    apt?.patient_phone ||
    apt?.patient_profile?.phone_number ||
    '';

  const getPatientEmail = (apt) =>
    apt?.patient?.email ||
    apt?.patient_email ||
    apt?.patient_profile?.email ||
    '';

  const filtered = appointments.filter(a => {
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'pending' ? a.status === 'pending' :
      filter === 'confirmed' ? (a.status === 'approved' || a.status === 'confirmed' || a.status === 'in_progress') :
      filter === 'completed' ? a.status === 'completed' :
      filter === 'rejected' ? (a.status === 'rejected' || a.status === 'cancelled') : true;
    const q = query.toLowerCase();
    const patientName = getPatientName(a).toLowerCase();
    const patientPhone = getPatientPhone(a);
    const matchesQuery = !q ||
      patientName.includes(q) ||
      patientPhone.includes(q);
    return matchesFilter && matchesQuery;
  });

  const counts = {
    all: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => ['approved', 'confirmed', 'in_progress'].includes(a.status)).length,
    completed: appointments.filter(a => a.status === 'completed').length,
    rejected: appointments.filter(a => a.status === 'rejected' || a.status === 'cancelled').length,
  };

  const tabs = [
    { id: 'all', label: isAr ? 'الكل' : 'All' },
    { id: 'pending', label: isAr ? 'بانتظار الموافقة' : 'Pending' },
    { id: 'confirmed', label: isAr ? 'مقبولة' : 'Approved' },
    { id: 'completed', label: isAr ? 'مكتملة' : 'Completed' },
    { id: 'rejected', label: isAr ? 'مرفوضة' : 'Rejected' },
  ];

  const appointmentDateTime = (apt) => {
    const date = apt.date || apt.appointment_date || '-';
    const time = String(apt.time || apt.appointment_time || '').slice(0, 5);
    return { date, time };
  };

  const renderActionButtons = (apt) => {
    if (apt.status === 'completed') {
      return (
        <span className="badge badge-success operational-complete-badge">
          <CheckCircle size={14} /> {isAr ? 'مكتمل' : 'Completed'}
        </span>
      );
    }
    if (apt.status === 'approved' || apt.status === 'confirmed' || apt.status === 'in_progress') {
      return (
        <button className="btn btn-sm btn-success" onClick={() => changeStatus(apt.id, 'completed')}>
          <CheckCircle size={15} /> {isAr ? 'إكمال' : 'Complete'}
        </button>
      );
    }
    if (apt.status !== 'pending') return <span className="text-muted text-sm">-</span>;
    return (
      <div className="operational-action-row">
        <button className="btn btn-sm btn-success" onClick={() => changeStatus(apt.id, 'approved')}>
          <CheckCircle size={15} /> {isAr ? 'قبول' : 'Approve'}
        </button>
        <button className="btn btn-sm btn-outline operational-danger-btn" onClick={() => changeStatus(apt.id, 'rejected')}>
          <XCircle size={15} /> {isAr ? 'رفض' : 'Reject'}
        </button>
      </div>
    );
  };

  const summaryCards = [
    { id: 'all', label: isAr ? 'كل الحجوزات' : 'All bookings', value: counts.all, tone: 'primary' },
    { id: 'pending', label: isAr ? 'بانتظار الموافقة' : 'Pending', value: counts.pending, tone: 'warning' },
    { id: 'confirmed', label: isAr ? 'قيد العمل' : 'Active', value: counts.confirmed, tone: 'info' },
    { id: 'completed', label: isAr ? 'مكتملة' : 'Completed', value: counts.completed, tone: 'success' },
  ];

  return (
    <div className="page-padding operational-page operational-appointments-page animate-in">
      <section className="operational-hero">
        <div>
          <span className="operational-kicker"><CalendarDays size={15} /> {isAr ? 'إدارة تشغيلية' : 'Operational workflow'}</span>
          <h1>{isAr ? 'إدارة الحجوزات' : 'Manage Bookings'}</h1>
          <p>{isAr ? 'راجع الطلبات، غيّر الحالات، وافتح تفاصيل الموعد بسرعة.' : 'Review requests, update statuses, and open appointment details quickly.'}</p>
        </div>
        <label className="operational-search">
          <Search size={18} />
          <input
            type="text"
            placeholder={isAr ? 'ابحث باسم المريض أو الهاتف...' : 'Search by name or phone...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
      </section>

      <section className="operational-stats">
        {summaryCards.map(card => (
          <button key={card.id} type="button" className={`operational-stat-card operational-stat-card--${card.tone} ${filter === card.id ? 'active' : ''}`} onClick={() => setFilter(card.id)}>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
          </button>
        ))}
      </section>

      <div className="operational-filter-row">
        {tabs.map(tab => (
          <button key={tab.id} className={filter === tab.id ? 'active' : ''} onClick={() => setFilter(tab.id)}>
            {tab.label} <span>{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      <section className="operational-panel">
        <div className="operational-panel-head">
          <div>
            <span>{isAr ? 'الحجوزات' : 'Appointments'}</span>
            <h2>{isAr ? 'قائمة المواعيد' : 'Appointment list'}</h2>
          </div>
          <em>{filtered.length}</em>
        </div>

        <div className="operational-table-wrap">
          <table className="operational-table">
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
                <tr><td colSpan="7"><div className="operational-loading"><span></span><span></span><span></span></div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7"><div className="operational-empty">{isAr ? 'لا توجد حجوزات' : 'No bookings found'}</div></td></tr>
              ) : filtered.map(apt => {
                const dt = appointmentDateTime(apt);
                const patientName = getPatientName(apt);
                const patientPhone = getPatientPhone(apt);
                return (
                  <tr key={apt.id}>
                    <td>
                      <button className="operational-patient-cell" onClick={() => setSelectedAppointment(apt)}>
                        <span>{patientName.charAt(0).toUpperCase()}</span>
                        <strong>{patientName}</strong>
                      </button>
                    </td>
                    <td className="operational-code" dir="ltr">{apt.booking_code || '-'}</td>
                    <td dir="ltr">{patientPhone || '-'}</td>
                    <td>{getDocName(apt.doctor_id)}</td>
                    <td>
                      <div className="operational-date-cell">
                        <strong>{dt.date}</strong>
                        <span><Clock size={12} /> {to12Hour(dt.time, isAr)}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${statusBadge(apt.status)}`}>{statusLabel(apt.status)}</span></td>
                    <td>
                      <div className="operational-row-actions">
                        <button className="btn btn-sm btn-outline" onClick={() => setSelectedAppointment(apt)}>
                          <Eye size={14} /> {isAr ? 'تفاصيل' : 'Details'}
                        </button>
                        {renderActionButtons(apt)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="operational-mobile-list">
        {loading ? (
          <div className="operational-loading"><span></span><span></span><span></span></div>
        ) : filtered.length === 0 ? (
          <div className="operational-empty">{isAr ? 'لا توجد حجوزات' : 'No bookings found'}</div>
        ) : filtered.map(apt => {
          const dt = appointmentDateTime(apt);
          const patientName = getPatientName(apt);
          const patientPhone = getPatientPhone(apt);
          return (
            <article key={apt.id} className="operational-appointment-card">
              <header>
                <div className="operational-card-patient">
                  <span>{patientName.charAt(0).toUpperCase()}</span>
                  <div>
                    <strong>{patientName}</strong>
                    <em dir="ltr"><Phone size={12} /> {patientPhone || '-'}</em>
                  </div>
                </div>
                <span className={`badge ${statusBadge(apt.status)}`}>{statusLabel(apt.status)}</span>
              </header>
              <div className="operational-card-grid">
                <div><span>{isAr ? 'الحجز' : 'Booking'}</span><strong dir="ltr">{apt.booking_code || '-'}</strong></div>
                <div><span>{t('doctor')}</span><strong>{getDocName(apt.doctor_id)}</strong></div>
                <div><span>{isAr ? 'التاريخ' : 'Date'}</span><strong>{dt.date}</strong></div>
                <div><span>{isAr ? 'الوقت' : 'Time'}</span><strong>{to12Hour(dt.time, isAr)}</strong></div>
              </div>
              <footer>
                <button className="btn btn-sm btn-outline" onClick={() => setSelectedAppointment(apt)}>
                  <Eye size={14} /> {isAr ? 'تفاصيل' : 'Details'}
                </button>
                {renderActionButtons(apt)}
              </footer>
            </article>
          );
        })}
      </div>

      {selectedAppointment && (
        <div className="operational-detail-backdrop" onClick={() => setSelectedAppointment(null)}>
          <aside className="operational-detail-panel" onClick={e => e.stopPropagation()}>
            {(() => {
              const patientName = getPatientName(selectedAppointment);
              const patientPhone = getPatientPhone(selectedAppointment);
              const patientEmail = getPatientEmail(selectedAppointment);
              const dt = appointmentDateTime(selectedAppointment);
              return (
                <>
            <button className="btn btn-ghost btn-icon operational-detail-close" onClick={() => setSelectedAppointment(null)} aria-label={isAr ? 'إغلاق' : 'Close'}>
              <X size={18} />
            </button>
            <span className="operational-kicker"><UserRound size={15} /> {isAr ? 'تفاصيل الموعد' : 'Appointment details'}</span>
            <h2>{patientName}</h2>
            <span className={`badge ${statusBadge(selectedAppointment.status)}`}>{statusLabel(selectedAppointment.status)}</span>
            <ContactActionsCard
              title={isAr ? 'تواصل بخصوص الموعد' : 'Appointment contact'}
              subtitle={isAr ? 'رسالة واتساب جاهزة ببيانات الموعد.' : 'WhatsApp message prefilled with appointment details.'}
              phone={patientPhone}
              whatsappMessage={buildContactMessage({
                type: 'appointment',
                isAr,
                patientName,
                clinicName: 'UrClinic',
                appointmentDate: dt.date,
                appointmentTime: to12Hour(dt.time, isAr),
              })}
              actor={user}
              target={{ role: 'patient', clinic_id: selectedAppointment.clinic_id }}
              compact
            />
            <div className="operational-detail-grid">
              <div><span>{isAr ? 'رقم الحجز' : 'Booking code'}</span><strong dir="ltr">{selectedAppointment.booking_code || '-'}</strong></div>
              <div><span>{isAr ? 'الهاتف' : 'Phone'}</span><strong dir="ltr">{patientPhone || '-'}</strong></div>
              <div><span>{t('doctor')}</span><strong>{getDocName(selectedAppointment.doctor_id)}</strong></div>
              <div><span>{isAr ? 'التاريخ' : 'Date'}</span><strong>{dt.date}</strong></div>
              <div><span>{isAr ? 'الوقت' : 'Time'}</span><strong>{to12Hour(dt.time, isAr)}</strong></div>
              <div><span>{isAr ? 'العيادة' : 'Clinic'}</span><strong>{selectedAppointment.clinic_id || '-'}</strong></div>
              <div><span>{isAr ? 'البريد' : 'Email'}</span><strong>{patientEmail || '-'}</strong></div>
              <div><span>{isAr ? 'الدفع' : 'Payment'}</span><strong>{selectedAppointment.paid ? (isAr ? 'مدفوع' : 'Paid') : (isAr ? 'غير مدفوع' : 'Unpaid')}</strong></div>
            </div>
            <div className="operational-detail-actions">
              {renderActionButtons(selectedAppointment)}
              <button className="btn btn-outline" onClick={() => navigate('/dashboard/patients')}>
                <User size={15} /> {isAr ? 'عرض المرضى' : 'View patients'}
              </button>
            </div>
                </>
              );
            })()}
          </aside>
        </div>
      )}
    </div>
  );
};

export default Appointments;
