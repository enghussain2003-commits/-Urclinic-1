import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Calendar, Clock, User, Phone, Mail, CheckCircle, XCircle, Hourglass } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import PrescriptionViewer from '../components/PrescriptionViewer';
import Countdown from '../components/Countdown';
import { to12Hour } from '../components/TimeSlotGrid';

const PatientProfile = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { user, appointments, doctors, myPatientIds } = useApp();
  const [prescriptions, setPrescriptions] = useState([]);

  // STRICT ID-only linkage. The previous phone/name fallback caused ghost bookings:
  // when a new patient registered with a phone that matched some pre-fix
  // localStorage entry (cc_bookings BK-XXXX, no patient_id), the legacy row would
  // appear in their history. Those legacy rows never reached the database, so
  // they don't belong to any real account. Now only DB-backed appointments whose
  // patient_id is one of THIS user's patients-table rows are shown.
  const myAppointments = appointments.filter(a =>
    a.patient_id && Array.isArray(myPatientIds) && myPatientIds.includes(a.patient_id)
  );

  // Load this patient's prescriptions (RLS returns only their own: patient_id = auth uid).
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    supabase.from('prescriptions').select('*')
      .eq('patient_id', user.id)
      .order('prescribed_date', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { console.warn('prescriptions fetch error:', error.message); return; }
        setPrescriptions(data || []);
      });
    return () => { active = false; };
  }, [user?.id]);

  const getDocName = (id) => {
    const doc = doctors.find(d => String(d.id) === String(id));
    return doc ? (isAr ? (doc.nameAr || doc.name) : (doc.name || doc.full_name)) : '-';
  };
  const getDocNameById = (doctorId) => {
    const doc = doctors.find(d => String(d.id) === String(doctorId));
    return doc ? (isAr ? (doc.nameAr || doc.name) : (doc.name || doc.full_name)) : '';
  };

  // Normalize the various status spellings into one of: pending | confirmed | rejected.
  const normalize = (s) =>
    s === 'confirmed' || s === 'in_progress' || s === 'completed' ? 'confirmed'
    : s === 'rejected' || s === 'cancelled' || s === 'no-show' || s === 'no_show' ? 'rejected'
    : 'pending';

  const statusMeta = {
    pending: { cls: 'badge-warning', icon: <Hourglass size={14} />, label: t('pending_approval') },
    confirmed: { cls: 'badge-success', icon: <CheckCircle size={14} />, label: t('confirmed') },
    rejected: { cls: 'badge-danger', icon: <XCircle size={14} />, label: t('rejected') },
  };

  return (
    <div className="page-padding animate-in container">
      <h2 className="mb-xl">{t('profile')}</h2>

      {/* Account Info Card */}
      <div className="glass p-6 mb-xl">
        <div className="flex items-center gap-lg flex-wrap">
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '1.75rem', fontWeight: 800, flexShrink: 0
          }}>
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>{user?.name || '-'}</h3>
            <div className="flex gap-lg flex-wrap text-muted">
              <span className="flex items-center gap-sm"><Phone size={15} /> <span dir="ltr">{user?.phone || '-'}</span></span>
              <span className="flex items-center gap-sm"><Mail size={15} /> {user?.email || '-'}</span>
              <span className="flex items-center gap-sm"><User size={15} /> {isAr ? 'مريض' : 'Patient'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-xl flex-wrap">
        {/* Appointments List */}
        <div style={{ flex: '2 1 500px' }}>
          <h3 className="mb-md"><Calendar size={20} style={{ display: 'inline', verticalAlign: 'text-bottom', marginInlineEnd: 8 }}/> {t('my_appointments')}</h3>
          <div className="flex flex-col gap-md">
            {myAppointments.length === 0 ? (
              <p className="text-muted">{t('no_upcoming')}</p>
            ) : (
              myAppointments.map(apt => {
                const status = normalize(apt.status);
                const meta = statusMeta[status];
                return (
                  <div key={apt.id} className="card" style={status === 'rejected' ? { opacity: 0.85, borderInlineStart: '3px solid var(--danger)' } : status === 'confirmed' ? { borderInlineStart: '3px solid var(--success)' } : {}}>
                    <div className="flex justify-between items-start flex-wrap gap-md">
                      <div>
                        <h4 className="mb-sm">{getDocName(apt.doctor_id)}</h4>
                        <p className="text-sm mb-xs text-muted">{isAr ? 'رقم الحجز' : 'Booking'}: {apt.id}</p>
                        <p className="text-sm mb-0 flex items-center gap-sm"><Clock size={14}/> {apt.date} — {to12Hour(apt.time, isAr)}</p>
                      </div>
                      <span className={`badge ${meta.cls} flex items-center gap-sm`}>{meta.icon} {meta.label}</span>
                    </div>

                    {/* Confirmed → show details + live countdown */}
                    {status === 'confirmed' && (
                      <div className="mt-md" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
                        <div className="text-sm text-muted mb-sm">{t('time_until_appointment')}</div>
                        <Countdown date={apt.date} time={apt.time} />
                      </div>
                    )}

                    {/* Rejected → clear note in history */}
                    {status === 'rejected' && (
                      <div className="mt-sm text-sm" style={{ color: 'var(--danger)' }}>
                        {t('appointment_rejected_note')}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Prescriptions */}
        <div style={{ flex: '1 1 300px' }}>
          <h3 className="mb-md"><FileText size={20} style={{ display: 'inline', verticalAlign: 'text-bottom', marginInlineEnd: 8 }}/> {t('prescriptions')}</h3>
          {prescriptions.length === 0 ? (
            <div className="card-flat bg-alt text-center text-muted" style={{ padding: '1.5rem' }}>
              <FileText size={32} style={{ opacity: 0.2, margin: '0 auto 0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>{t('no_prescriptions')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-lg">
              {prescriptions.map(rx => (
                <PrescriptionViewer
                  key={rx.id}
                  rx={rx}
                  patientName={user?.name || ''}
                  doctorName={getDocNameById(rx.doctor_id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;
