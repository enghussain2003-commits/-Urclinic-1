import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Calendar, Clock, User, Phone, Mail, CheckCircle, XCircle, Hourglass, Download, Eye, Printer, Stethoscope, Pill } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import Countdown from '../components/Countdown';
import { to12Hour } from '../components/TimeSlotGrid';
import { downloadPrescriptionPdf } from '../utils/prescriptionPdf';

const PatientProfile = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { user, appointments, doctors, myPatientIds } = useApp();
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  const [prescriptionsError, setPrescriptionsError] = useState('');
  const [visibleRxCount, setVisibleRxCount] = useState(6);
  const [selectedRx, setSelectedRx] = useState(null);
  const patientUserId = user?.id || null;

  // STRICT ID-only linkage. The previous phone/name fallback caused ghost bookings:
  // when a new patient registered with a phone that matched some pre-fix
  // localStorage entry (cc_bookings BK-XXXX, no patient_id), the legacy row would
  // appear in their history. Those legacy rows never reached the database, so
  // they don't belong to any real account. Now only DB-backed appointments whose
  // patient_id is one of THIS user's patients-table rows are shown.
  const myAppointments = appointments.filter(a =>
    a.patient_id && Array.isArray(myPatientIds) && myPatientIds.includes(a.patient_id)
  );

  const refreshPrescriptions = useCallback(async () => {
    if (!patientUserId) return;
    setPrescriptionsLoading(true);
    setPrescriptionsError('');
    const { data, error } = await supabase.from('prescriptions').select('*')
      .eq('patient_id', patientUserId)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('prescriptions fetch error:', error.message);
      setPrescriptionsError(isAr ? 'تعذّر تحميل الوصفات' : 'Could not load prescriptions');
      setPrescriptionsLoading(false);
      return;
    }
    setPrescriptions(data || []);
    setPrescriptionsLoading(false);
  }, [patientUserId, isAr]);

  // Load this patient's prescriptions. RLS returns only their own rows because
  // prescriptions.patient_id stores auth.uid()/profiles.id.
  useEffect(() => {
    if (!patientUserId) return;
    let active = true;
    const loadFrame = requestAnimationFrame(() => {
      if (active) refreshPrescriptions();
    });

    const channel = supabase
      .channel(`prescriptions:${patientUserId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prescriptions', filter: `patient_id=eq.${patientUserId}` },
        (payload) => {
          if (!active || !payload.new) return;
          setPrescriptions(prev => [payload.new, ...prev.filter(rx => rx.id !== payload.new.id)]
            .sort((a, b) => new Date(b.created_at || b.prescribed_date || 0) - new Date(a.created_at || a.prescribed_date || 0)));
        })
      .subscribe();

    const handleFocus = () => { if (active) refreshPrescriptions(); };
    window.addEventListener('focus', handleFocus);

    return () => {
      active = false;
      cancelAnimationFrame(loadFrame);
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, [patientUserId, refreshPrescriptions]);

  const getDocName = (id) => {
    const doc = doctors.find(d => String(d.id) === String(id));
    return doc ? (isAr ? (doc.nameAr || doc.name) : (doc.name || doc.full_name)) : '-';
  };
  const getDocNameById = (doctorId) => {
    const doc = doctors.find(d =>
      String(d.id) === String(doctorId) ||
      String(d.profile_id) === String(doctorId)
    );
    return doc ? (isAr ? (doc.nameAr || doc.name) : (doc.name || doc.full_name)) : '';
  };

  const rxDateTime = (rx) => {
    const value = rx?.created_at || rx?.prescribed_date;
    if (!value) return { date: '-', time: '-' };
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return { date: rx?.prescribed_date || '-', time: '-' };
    return {
      date: d.toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB'),
      time: d.toLocaleTimeString(isAr ? 'ar-IQ' : 'en-US', { hour: 'numeric', minute: '2-digit' }),
    };
  };

  const medicineCount = (rx) => Array.isArray(rx?.medicines) ? rx.medicines.length : 0;
  const firstMedicineName = (rx) => {
    const meds = Array.isArray(rx?.medicines) ? rx.medicines : [];
    return meds.find(m => m?.name)?.name || (isAr ? 'لا يوجد دواء مسجل' : 'No medicine listed');
  };
  const previewText = (text, fallback = '-') => {
    if (!text) return fallback;
    return text.length > 90 ? `${text.slice(0, 90)}...` : text;
  };

  const visiblePrescriptions = prescriptions.slice(0, visibleRxCount);

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
                        <p className="text-sm mb-xs text-muted">{isAr ? 'رقم الحجز' : 'Booking'}: {apt.booking_code || '-'}</p>
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
        <div style={{ flex: '3 1 640px' }}>
          <div className="flex justify-between items-center gap-md flex-wrap mb-md">
            <h3 style={{ margin: 0 }}><FileText size={20} style={{ display: 'inline', verticalAlign: 'text-bottom', marginInlineEnd: 8 }}/> {t('prescriptions')}</h3>
            {prescriptions.length > 0 && <span className="badge badge-primary">{prescriptions.length}</span>}
          </div>
          {prescriptionsLoading ? (
            <div className="card-flat bg-alt text-center text-muted" style={{ padding: '1.5rem' }}>
              {t('loading')}
            </div>
          ) : prescriptionsError ? (
            <div className="card-flat text-center" style={{ padding: '1.5rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.25)' }}>
              {prescriptionsError}
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="card-flat bg-alt text-center text-muted" style={{ padding: '1.5rem' }}>
              <FileText size={32} style={{ opacity: 0.2, margin: '0 auto 0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>{t('no_prescriptions')}</p>
            </div>
          ) : (
            <div>
              <div className="prescription-grid">
                {visiblePrescriptions.map((rx, idx) => {
                  const dt = rxDateTime(rx);
                  const doctorName = getDocNameById(rx.doctor_id) || (isAr ? 'طبيب العيادة' : 'Clinic doctor');
                  const count = medicineCount(rx);
                  return (
                    <article key={rx.id} className={`prescription-summary-card ${idx === 0 ? 'prescription-summary-card--latest' : ''}`}>
                      <div className="flex justify-between items-start gap-sm mb-md">
                        <div className="rx-symbol" style={{ fontSize: '1.4rem' }}>℞</div>
                        {idx === 0 && <span className="badge badge-primary">{isAr ? 'أحدث وصفة' : 'Latest'}</span>}
                      </div>
                      <h4 className="prescription-doctor">{doctorName}</h4>
                      <div className="prescription-meta">
                        <span><Calendar size={14} /> {isAr ? 'التاريخ' : 'Date'}: {dt.date}</span>
                        <span><Clock size={14} /> {isAr ? 'الوقت' : 'Time'}: {dt.time}</span>
                      </div>
                      <div className="prescription-main-med">
                        <Pill size={16} />
                        <span>{firstMedicineName(rx)}</span>
                      </div>
                      <p className="prescription-diagnosis">{previewText(rx.diagnosis, isAr ? 'لا يوجد تشخيص مسجل' : 'No diagnosis recorded')}</p>
                      <div className="prescription-meta">
                        <span>{isAr ? 'عدد الأدوية' : 'Medicines'}: {count}</span>
                        <span>{previewText(rx.instructions, isAr ? 'لا توجد تعليمات إضافية' : 'No extra instructions')}</span>
                      </div>
                      <div className="flex gap-sm mt-md flex-wrap">
                        <button className="btn btn-sm btn-primary" onClick={() => setSelectedRx(rx)}>
                          <Eye size={15} /> {isAr ? 'عرض التفاصيل' : 'View details'}
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => downloadPrescriptionPdf(rx, { isAr, doctorName, patientName: user?.name || '' })}
                        >
                          <Download size={15} /> {t('download_pdf')}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {visibleRxCount < prescriptions.length && (
                <div className="text-center mt-lg">
                  <button className="btn btn-outline" onClick={() => setVisibleRxCount(c => c + 6)}>
                    {isAr ? 'عرض المزيد' : 'Show more'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedRx && (
        <div className="modal-overlay rx-modal-overlay" onClick={() => setSelectedRx(null)}>
          <div className="rx-detail-modal" onClick={e => e.stopPropagation()}>
            {(() => {
              const doctorName = getDocNameById(selectedRx.doctor_id) || (isAr ? 'طبيب العيادة' : 'Clinic doctor');
              const dt = rxDateTime(selectedRx);
              const meds = Array.isArray(selectedRx.medicines) ? selectedRx.medicines : [];
              return (
                <>
                  <header className="rx-detail-header">
                    <div className="rx-detail-mark">℞</div>
                    <div className="rx-detail-title">
                      <h3>{isAr ? 'وصفة طبية' : 'Prescription'}</h3>
                      <p><Stethoscope size={14} /> {doctorName}</p>
                    </div>
                    <div className="rx-detail-date">
                      <span>{dt.date}</span>
                      <strong>{dt.time}</strong>
                    </div>
                  </header>

                  <div className="rx-detail-body">
                    <section className="rx-info-grid">
                      <div>
                        <span>{isAr ? 'الطبيب' : 'Doctor'}</span>
                        <strong>{doctorName}</strong>
                      </div>
                      <div>
                        <span>{isAr ? 'المريض' : 'Patient'}</span>
                        <strong>{user?.name || '-'}</strong>
                      </div>
                      <div>
                        <span>{isAr ? 'التاريخ' : 'Date'}</span>
                        <strong>{dt.date}</strong>
                      </div>
                      <div>
                        <span>{isAr ? 'الوقت' : 'Time'}</span>
                        <strong>{dt.time}</strong>
                      </div>
                    </section>

                    <section className="rx-detail-section">
                      <h4>{isAr ? 'التشخيص' : 'Diagnosis'}</h4>
                      <p>{selectedRx.diagnosis || (isAr ? 'لا يوجد تشخيص مسجل' : 'No diagnosis recorded')}</p>
                    </section>

                    <section className="rx-detail-section">
                      <div className="rx-section-title-row">
                        <h4>{isAr ? 'الأدوية' : 'Medicines'}</h4>
                        <span className="badge badge-primary">{meds.length}</span>
                      </div>
                      <div className="rx-medicine-list">
                        {meds.length === 0 ? (
                          <div className="rx-medicine-row rx-medicine-row--empty">
                            {isAr ? 'لا توجد أدوية مسجلة' : 'No medicines listed'}
                          </div>
                        ) : meds.map((med, index) => (
                          <article key={`${med.name || 'medicine'}-${index}`} className="rx-medicine-row">
                            <div className="rx-medicine-index">{index + 1}</div>
                            <div className="rx-medicine-content">
                              <h5>{med.name || (isAr ? 'دواء غير مسمى' : 'Unnamed medicine')}</h5>
                              <div className="rx-medicine-fields">
                                <span><strong>{isAr ? 'الجرعة' : 'Dosage'}:</strong> {med.dosage || '-'}</span>
                                <span><strong>{isAr ? 'التعليمات' : 'Instructions'}:</strong> {med.instructions || '-'}</span>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section className="rx-detail-section">
                      <h4>{isAr ? 'تعليمات عامة' : 'General instructions'}</h4>
                      <p>{selectedRx.instructions || (isAr ? 'لا توجد تعليمات إضافية' : 'No extra instructions')}</p>
                    </section>
                  </div>

                  <footer className="rx-detail-footer">
                    <button
                      className="btn btn-primary"
                      onClick={() => downloadPrescriptionPdf(selectedRx, { isAr, doctorName, patientName: user?.name || '' })}
                    >
                      <Download size={16} /> {t('download_pdf')}
                    </button>
                    <button className="btn btn-outline" onClick={() => window.print()}>
                      <Printer size={16} /> {isAr ? 'طباعة' : 'Print'}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setSelectedRx(null)}>
                      {isAr ? 'إغلاق' : 'Close'}
                    </button>
                  </footer>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientProfile;
