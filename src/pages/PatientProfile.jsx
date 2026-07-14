import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileText,
  HeartPulse,
  Hourglass,
  Mail,
  Phone,
  Pill,
  Printer,
  ShieldCheck,
  Stethoscope,
  User,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../supabaseClient';
import Countdown from '../components/Countdown';
import ContactActionsCard from '../components/ContactActionsCard';
import { to12Hour } from '../components/TimeSlotGrid';
import { buildContactMessage } from '../services/contactService';
import { downloadPrescriptionPdf } from '../utils/prescriptionPdf';

const PatientProfile = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { user, appointments, doctors, myPatientIds } = useApp();
  const toast = useToast();
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  const [prescriptionsError, setPrescriptionsError] = useState('');
  const [visibleRxCount, setVisibleRxCount] = useState(6);
  const [selectedRx, setSelectedRx] = useState(null);
  const [clinicContact, setClinicContact] = useState(null);
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

  const firstMedicineName = (rx) => {
    const meds = Array.isArray(rx?.medicines) ? rx.medicines : [];
    return meds.find(m => m?.name)?.name || (isAr ? 'لا يوجد دواء مسجل' : 'No medicine listed');
  };
  const previewText = (text, fallback = '-') => {
    if (!text) return fallback;
    return text.length > 90 ? `${text.slice(0, 90)}...` : text;
  };

  const handleDownloadPrescription = (rx, doctorName) => {
    const opened = downloadPrescriptionPdf(rx, { isAr, doctorName, patientName: user?.name || '' });
    if (!opened) {
      toast.warning(isAr ? 'يرجى السماح بالنوافذ المنبثقة لتنزيل الوصفة.' : 'Please allow pop-ups to download the prescription.');
    }
  };

  const visiblePrescriptions = prescriptions.slice(0, visibleRxCount);

  const activeStatuses = ['pending', 'approved', 'in_progress', 'confirmed'];
  const activeAppointment = [...myAppointments]
    .filter(a => activeStatuses.includes(a.status))
    .sort((a, b) =>
      (a.date || '').localeCompare(b.date || '') ||
      (a.time || '').localeCompare(b.time || '')
    )[0] || null;
  const contactClinicId = activeAppointment?.clinic_id || myAppointments.find(a => a.clinic_id)?.clinic_id || null;

  useEffect(() => {
    let active = true;
    const id = window.setTimeout(() => {
      if (!contactClinicId) {
        if (active) setClinicContact(null);
        return;
      }
      supabase
        .from('clinics')
        .select('id, name, phone')
        .eq('id', contactClinicId)
        .maybeSingle()
        .then(({ data }) => {
          if (active) setClinicContact(data || null);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [contactClinicId]);
  const completedAppointments = [...myAppointments]
    .filter(a => a.status === 'completed')
    .sort((a, b) => new Date(b.completed_at || b.date || 0) - new Date(a.completed_at || a.date || 0));
  const recentAppointments = [...myAppointments]
    .sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') ||
      (b.time || '').localeCompare(a.time || '')
    )
    .slice(0, 5);
  const paidAppointments = myAppointments.filter(a => a.paid);
  const balanceTotal = myAppointments.reduce((sum, a) => sum + Number(a.fee || 0), 0);

  const statusMeta = {
    pending: { cls: 'badge-warning', icon: <Hourglass size={14} />, label: t('pending_approval') },
    approved: { cls: 'badge-success', icon: <CheckCircle size={14} />, label: isAr ? 'مقبول' : 'Approved' },
    confirmed: { cls: 'badge-success', icon: <CheckCircle size={14} />, label: isAr ? 'مقبول' : 'Approved' },
    in_progress: { cls: 'badge-primary', icon: <Clock size={14} />, label: t('in_progress') },
    completed: { cls: 'badge-success', icon: <CheckCircle size={14} />, label: isAr ? 'مكتمل' : 'Completed' },
    rejected: { cls: 'badge-danger', icon: <XCircle size={14} />, label: t('rejected') },
  };

  const label = {
    record: isAr ? 'السجل الطبي' : 'Medical record',
    account: isAr ? 'حساب المريض' : 'Patient account',
    summary: isAr ? 'الملخص الطبي' : 'Medical summary',
    noAllergies: isAr ? 'لا توجد حساسية مسجلة' : 'No allergies recorded',
    noChronic: isAr ? 'لا توجد أمراض مزمنة مسجلة' : 'No chronic diseases recorded',
    vitals: isAr ? 'المؤشرات الحيوية' : 'Vital information',
    history: isAr ? 'سجل الزيارات' : 'Visit history',
    next: isAr ? 'الموعد القادم' : 'Next appointment',
    payments: isAr ? 'ملخص الدفع' : 'Payment summary',
    files: isAr ? 'الملفات الطبية' : 'Medical files',
    none: isAr ? 'لا توجد بيانات مسجلة بعد' : 'No records yet',
    secure: isAr ? 'ملف آمن ومنظم' : 'Secure organized profile',
  };

  return (
    <div className="page-padding patient-emr-page patient-emr-page--portal animate-in">
      <section className="patient-emr-hero">
        <div className="patient-emr-identity">
          <div className="patient-emr-avatar">{(user?.name || '?').charAt(0).toUpperCase()}</div>
          <div>
            <span className="patient-emr-kicker"><ShieldCheck size={15} /> {label.record}</span>
            <h1>{user?.name || '-'}</h1>
            <div className="patient-emr-meta">
              <span><Phone size={14} /> <span dir="ltr">{user?.phone || '-'}</span></span>
              <span><Mail size={14} /> {user?.email || '-'}</span>
              <span><User size={14} /> {isAr ? 'مريض' : 'Patient'}</span>
            </div>
          </div>
        </div>
        <div className="patient-emr-hero-card">
          <span>{label.next}</span>
          <strong>{activeAppointment ? to12Hour(activeAppointment.time, isAr) : '-'}</strong>
          <em>{activeAppointment?.date || t('no_upcoming')}</em>
        </div>
      </section>

      <section className="patient-emr-stats">
        <div className="patient-emr-stat">
          <Calendar size={18} />
          <strong>{myAppointments.length}</strong>
          <span>{isAr ? 'كل المواعيد' : 'Total appointments'}</span>
        </div>
        <div className="patient-emr-stat">
          <CheckCircle size={18} />
          <strong>{completedAppointments.length}</strong>
          <span>{isAr ? 'زيارات مكتملة' : 'Completed visits'}</span>
        </div>
        <div className="patient-emr-stat">
          <Pill size={18} />
          <strong>{prescriptions.length}</strong>
          <span>{t('prescriptions')}</span>
        </div>
        <div className="patient-emr-stat">
          <CreditCard size={18} />
          <strong>{paidAppointments.length}</strong>
          <span>{label.payments}</span>
        </div>
      </section>

      <section className="patient-emr-grid">
        <main className="patient-emr-main">
          <div className="patient-emr-panel patient-emr-panel--next">
            <div className="patient-emr-panel-head">
              <div>
                <span>{label.next}</span>
                <h2>{activeAppointment ? getDocName(activeAppointment.doctor_id) : t('no_upcoming')}</h2>
              </div>
              <Calendar size={19} />
            </div>
            {activeAppointment ? (
              <>
                <div className="patient-emr-appointment-focus">
                  <div>
                    <span>{isAr ? 'رقم الحجز' : 'Booking'}</span>
                    <strong dir="ltr">{activeAppointment.booking_code || '-'}</strong>
                  </div>
                  <div>
                    <span>{isAr ? 'التاريخ والوقت' : 'Date and time'}</span>
                    <strong>{activeAppointment.date} · {to12Hour(activeAppointment.time, isAr)}</strong>
                  </div>
                  <span className={`badge ${statusMeta[activeAppointment.status]?.cls || 'badge-warning'} flex items-center gap-sm`}>
                    {statusMeta[activeAppointment.status]?.icon} {statusMeta[activeAppointment.status]?.label || activeAppointment.status}
                  </span>
                </div>
                {(activeAppointment.status === 'approved' || activeAppointment.status === 'confirmed') && (
                  <div className="patient-emr-countdown">
                    <span>{t('time_until_appointment')}</span>
                    <Countdown date={activeAppointment.date} time={activeAppointment.time} />
                  </div>
                )}
              </>
            ) : (
              <div className="patient-emr-empty">
                <Calendar size={28} />
                <p>{t('no_upcoming')}</p>
              </div>
            )}
          </div>

          <div className="patient-emr-panel">
            <div className="patient-emr-panel-head">
              <div>
                <span>{label.history}</span>
                <h2>{isAr ? 'خط زمني للزيارات' : 'Clinical timeline'}</h2>
              </div>
              <Activity size={19} />
            </div>
            {recentAppointments.length === 0 ? (
              <div className="patient-emr-empty">
                <Stethoscope size={28} />
                <p>{label.none}</p>
              </div>
            ) : (
              <div className="patient-emr-timeline">
                {recentAppointments.map((apt, idx) => (
                  <article key={apt.id} className="patient-emr-timeline-row">
                    <span className="patient-emr-timeline-dot"></span>
                    <div>
                      <strong>{getDocName(apt.doctor_id)}</strong>
                      <p>{apt.date} · {to12Hour(apt.time, isAr)} · {apt.booking_code || '-'}</p>
                    </div>
                    <span className={`badge ${statusMeta[apt.status]?.cls || 'badge-warning'}`}>
                      {statusMeta[apt.status]?.label || apt.status}
                    </span>
                    {idx === 0 && <em>{isAr ? 'الأحدث' : 'Latest'}</em>}
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="patient-emr-panel">
            <div className="patient-emr-panel-head">
              <div>
                <span>{t('prescriptions')}</span>
                <h2>{isAr ? 'الأدوية والتعليمات' : 'Medication and instructions'}</h2>
              </div>
              <FileText size={19} />
            </div>
            {prescriptionsLoading ? (
              <div className="patient-emr-loading"><span></span><span></span><span></span></div>
            ) : prescriptionsError ? (
              <div className="patient-emr-empty patient-emr-empty--danger">
                <XCircle size={28} />
                <p>{prescriptionsError}</p>
              </div>
            ) : prescriptions.length === 0 ? (
              <div className="patient-emr-empty">
                <Pill size={28} />
                <p>{t('no_prescriptions')}</p>
              </div>
            ) : (
              <>
                <div className="patient-emr-rx-grid">
                  {visiblePrescriptions.map((rx, idx) => {
                    const dt = rxDateTime(rx);
                    const doctorName = getDocNameById(rx.doctor_id) || (isAr ? 'طبيب العيادة' : 'Clinic doctor');
                    return (
                      <article key={rx.id} className={`patient-emr-rx-card ${idx === 0 ? 'is-latest' : ''}`}>
                        <div className="patient-emr-rx-top">
                          <div className="rx-symbol">℞</div>
                          {idx === 0 && <span className="badge badge-primary">{isAr ? 'أحدث وصفة' : 'Latest'}</span>}
                        </div>
                        <h3>{doctorName}</h3>
                        <p><Calendar size={14} /> {dt.date} · {dt.time}</p>
                        <div className="patient-emr-rx-med"><Pill size={15} /> {firstMedicineName(rx)}</div>
                        <span>{previewText(rx.diagnosis, isAr ? 'لا يوجد تشخيص مسجل' : 'No diagnosis recorded')}</span>
                        <div className="patient-emr-rx-actions">
                          <button className="btn btn-sm btn-primary" onClick={() => setSelectedRx(rx)}>
                            <Eye size={15} /> {isAr ? 'التفاصيل' : 'Details'}
                          </button>
                          <button className="btn btn-sm btn-outline" onClick={() => handleDownloadPrescription(rx, doctorName)}>
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
              </>
            )}
          </div>
        </main>

        <aside className="patient-emr-side">
          <ContactActionsCard
            title={isAr ? 'تواصل مع العيادة' : 'Contact clinic support'}
            subtitle={isAr ? 'يفتح واتساب برسالة جاهزة لفريق العيادة.' : 'Opens WhatsApp with a prefilled message for the clinic team.'}
            phone={clinicContact?.phone}
            whatsappMessage={buildContactMessage({
              type: activeAppointment ? 'appointment' : 'support',
              isAr,
              patientName: user?.name,
              clinicName: clinicContact?.name || 'UrClinic',
              appointmentDate: activeAppointment?.date,
              appointmentTime: activeAppointment ? to12Hour(activeAppointment.time, isAr) : '',
            })}
            actor={user}
            target={{ role: 'clinic_support', clinic_id: clinicContact?.id }}
            unavailableMessage={isAr ? 'لا يوجد رقم واتساب متاح للعيادة حالياً.' : 'No WhatsApp number is available for this clinic yet.'}
          />

          <div className="patient-emr-panel">
            <div className="patient-emr-panel-head">
              <div>
                <span>{label.summary}</span>
                <h2>{label.secure}</h2>
              </div>
              <HeartPulse size={19} />
            </div>
            <div className="patient-emr-summary-list">
              <div><span>{isAr ? 'الحساسية' : 'Allergies'}</span><strong>{label.noAllergies}</strong></div>
              <div><span>{isAr ? 'الأمراض المزمنة' : 'Chronic diseases'}</span><strong>{label.noChronic}</strong></div>
              <div><span>{label.vitals}</span><strong>{isAr ? 'تُحدّث خلال الزيارة' : 'Updated during visits'}</strong></div>
            </div>
          </div>

          <div className="patient-emr-panel">
            <div className="patient-emr-panel-head">
              <div>
                <span>{label.payments}</span>
                <h2>{isAr ? 'الحجوزات والدفع' : 'Bookings and payments'}</h2>
              </div>
              <CreditCard size={19} />
            </div>
            <div className="patient-emr-payment">
              <div><span>{isAr ? 'مدفوع' : 'Paid'}</span><strong>{paidAppointments.length}</strong></div>
              <div><span>{isAr ? 'إجمالي الرسوم' : 'Total fees'}</span><strong>${balanceTotal}</strong></div>
            </div>
          </div>

          <div className="patient-emr-panel">
            <div className="patient-emr-panel-head">
              <div>
                <span>{label.files}</span>
                <h2>{isAr ? 'المرفقات' : 'Attachments'}</h2>
              </div>
              <FileText size={19} />
            </div>
            <div className="patient-emr-empty patient-emr-empty--compact">
              <FileText size={24} />
              <p>{isAr ? 'تظهر الملفات الطبية التي يضيفها الفريق هنا.' : 'Medical files added by the team appear here.'}</p>
            </div>
          </div>
        </aside>
      </section>

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
                    <button className="btn btn-primary" onClick={() => handleDownloadPrescription(selectedRx, doctorName)}>
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
