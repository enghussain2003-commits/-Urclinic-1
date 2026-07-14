import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Bell,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  File,
  FileText,
  FolderOpen,
  HeartPulse,
  Image,
  Pill,
  Plus,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../supabaseClient';
import PrescriptionViewer from '../components/PrescriptionViewer';
import ContactActionsCard from '../components/ContactActionsCard';
import { buildContactMessage } from '../services/contactService';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const StaffPatientProfile = () => {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const { doctors, sendNotification, user, addMedicalHistory, addMedicalFile, createPrescription } = useApp();
  const toast = useToast();

  const [patient, setPatient] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [medicalFiles, setMedicalFiles] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [activeTab, setActiveTab] = useState('timeline');
  const [showAddRx, setShowAddRx] = useState(false);
  const [savingRx, setSavingRx] = useState(false);
  const [rxError, setRxError] = useState('');
  const [rxForm, setRxForm] = useState({
    diagnosis: '', instructions: '',
    medicines: [{ name: '', dosage: '', instructions: '' }],
  });
  const [loading, setLoading] = useState(true);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [expandedVisit, setExpandedVisit] = useState(null);

  // New Visit Form
  const [visitForm, setVisitForm] = useState({
    diagnosis: '', treatment: '', notes: '', next_review_date: '', doctor_id: ''
  });

  // New File Form
  const [fileForm, setFileForm] = useState({
    file_name: '', file_type: 'lab', description: '', file_url: ''
  });

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language, isAr]);

  useEffect(() => {
    const fetchPatientData = async () => {
      setLoading(true);
      try {
        // Fetch the clinic-scoped patient record. EHR tables reference patients.id.
        const { data: prof } = await supabase.from('patients').select('*').eq('id', id).single();
        if (prof) setPatient(prof);

        // Fetch medical history
        const { data: history } = await supabase.from('medical_history').select('*').eq('patient_id', id).order('visit_date', { ascending: false });
        if (history) setMedicalHistory(history);

        // Fetch medical files
        const { data: files } = await supabase.from('medical_files').select('*').eq('patient_id', id).order('created_at', { ascending: false });
        if (files) setMedicalFiles(files);

        // Fetch prescriptions
        const rxPatientIds = prof?.auth_user_id ? [prof.auth_user_id, id] : [id];
        const { data: rx } = await supabase.from('prescriptions').select('*').in('patient_id', rxPatientIds).order('prescribed_date', { ascending: false });
        if (rx) setPrescriptions(rx);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchPatientData();
  }, [id]);

  const calculateAge = (dob) => {
    if (!dob) return '-';
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  const getDocName = (docId) => {
    const doc = doctors.find(d =>
      String(d.id) === String(docId) ||
      String(d.profile_id) === String(docId)
    );
    return doc?.name || doc?.full_name || 'Unknown Doctor';
  };

  // Resolve the logged-in doctor's row from their profile id. Prescriptions use
  // the profile/auth id per the prescriptions table RLS contract, while older
  // rows may still contain doctors.id; getDocName supports both.
  const myDoctorId = doctors.find(d => String(d.profile_id) === String(user?.id))?.id || null;
  const myDoctorProfileId = doctors.find(d => String(d.profile_id) === String(user?.id))?.profile_id || null;

  const handleAddVisit = async (e) => {
    e.preventDefault();
    const record = {
      patient_id: id,
      clinic_id: patient.clinic_id,
      doctor_id: visitForm.doctor_id || myDoctorId || null,
      visit_date: new Date().toISOString(),
      diagnosis: visitForm.diagnosis,
      treatment: visitForm.treatment,
      notes: visitForm.notes,
      next_review_date: visitForm.next_review_date || null,
    };
    const result = await addMedicalHistory(record);
    if (result) {
      setMedicalHistory(prev => [result, ...prev]);
      setShowAddVisit(false);
      setVisitForm({ diagnosis: '', treatment: '', notes: '', next_review_date: '', doctor_id: '' });
    }
  };

  const handleAddFile = async (e) => {
    e.preventDefault();
    const record = {
      patient_id: id,
      clinic_id: patient.clinic_id,
      file_name: fileForm.file_name,
      file_type: fileForm.file_type,
      file_url: fileForm.file_url || `/files/${fileForm.file_name}`,
      description: fileForm.description,
    };
    const result = await addMedicalFile(record);
    if (result) {
      setMedicalFiles(prev => [result, ...prev]);
      setShowAddFile(false);
      setFileForm({ file_name: '', file_type: 'lab', description: '', file_url: '' });
    }
  };

  // ---- Prescriptions ----
  const setMed = (idx, field, value) => {
    setRxForm(prev => ({
      ...prev,
      medicines: prev.medicines.map((m, i) => i === idx ? { ...m, [field]: value } : m),
    }));
  };
  const addMedRow = () => setRxForm(prev => ({ ...prev, medicines: [...prev.medicines, { name: '', dosage: '', instructions: '' }] }));
  const removeMedRow = (idx) => setRxForm(prev => ({
    ...prev,
    medicines: prev.medicines.length > 1 ? prev.medicines.filter((_, i) => i !== idx) : prev.medicines,
  }));

  const handleAddPrescription = async (e) => {
    e.preventDefault();
    setRxError('');
    if (!patient.auth_user_id) {
      const message = 'Cannot deliver prescription: this patient record is not linked to a login account / لا يمكن إرسال الوصفة لأن ملف المريض غير مرتبط بحساب دخول';
      setRxError(message);
      toast.warning(isAr ? 'لا يمكن إرسال الوصفة لأن ملف المريض غير مرتبط بحساب دخول.' : 'Cannot deliver prescription because this patient is not linked to a login account.');
      return;
    }
    setSavingRx(true);
    try {
      const medicines = rxForm.medicines.filter(m => m.name.trim());
      const result = await createPrescription({
        patient_id: patient.auth_user_id,
        patient_user_id: patient.auth_user_id,
        doctor_id: myDoctorProfileId,
        clinic_id: patient.clinic_id,
        diagnosis: rxForm.diagnosis,
        instructions: rxForm.instructions,
        medicines,
      });
      setPrescriptions(prev => [result, ...prev]);
      setShowAddRx(false);
      setRxForm({ diagnosis: '', instructions: '', medicines: [{ name: '', dosage: '', instructions: '' }] });
    } catch (err) {
      const message = getLocalizedErrorMessage(err, { isAr, fallback: 'prescription' });
      setRxError(message);
      console.error('Prescription save failed:', {
        message: err?.message,
        code: err?.code,
        patientId: id,
        patientAuthUserId: patient?.auth_user_id,
        clinicId: patient?.clinic_id,
      });
      toast.error(isAr ? 'تعذّر حفظ الوصفة.' : 'Failed to save prescription.');
    } finally {
      setSavingRx(false);
    }
  };

  const handleCallPatient = async () => {
    if (!patient) return;
    const success = await sendNotification(
      patient.id,
      'استدعاء المريض',
      `يرجى التوجه إلى غرفة الفحص الآن - ${patient.full_name}`,
      'call',
      { clinic_id: patient.clinic_id, called_by: user?.id, called_by_name: user?.name || user?.full_name }
    );
    if (success) {
      toast.success(isAr ? 'تم استدعاء المريض بنجاح.' : 'Patient was called successfully.');
    } else {
      toast.error(isAr ? 'تعذر إرسال استدعاء المريض.' : 'Could not send the patient call notification.');
    }
  };

  const fileTypeIcons = {
    'x-ray': <Image size={18} />,
    'lab': <Activity size={18} />,
    'prescription': <FileText size={18} />,
    'report': <File size={18} />,
    'other': <File size={18} />
  };

  const fileTypeLabels = {
    'x-ray': 'X-Ray / أشعة',
    'lab': 'Lab Results / تحاليل',
    'prescription': 'Prescription / وصفة',
    'report': 'Medical Report / تقرير',
    'other': 'Other / أخرى'
  };

  const label = {
    back: isAr ? 'العودة للمرضى' : 'Back to patients',
    workspace: isAr ? 'ملف طبي إلكتروني' : 'Electronic medical record',
    summary: isAr ? 'ملخص طبي' : 'Medical summary',
    quickActions: isAr ? 'إجراءات سريعة' : 'Quick actions',
    timeline: isAr ? 'الخط الزمني' : 'Visit timeline',
    files: isAr ? 'الملفات الطبية' : 'Medical files',
    prescriptions: isAr ? 'الوصفات الطبية' : 'Prescriptions',
    notes: isAr ? 'الملاحظات' : 'Notes',
    allergies: isAr ? 'الحساسية' : 'Allergies',
    chronic: isAr ? 'الأمراض المزمنة' : 'Chronic diseases',
    vitals: isAr ? 'المؤشرات الحيوية' : 'Vitals',
    payments: isAr ? 'ملخص الدفع' : 'Payment summary',
    attachments: isAr ? 'المرفقات' : 'Attachments',
    none: isAr ? 'لا توجد بيانات مسجلة بعد.' : 'No records yet.',
    loading: isAr ? 'جار تحميل ملف المريض...' : 'Loading patient profile...',
    notFound: isAr ? 'لم يتم العثور على المريض' : 'Patient not found',
  };

  if (loading) {
    return (
      <div className="page-padding patient-emr-page">
        <div className="patient-emr-loading patient-emr-loading--page"><span></span><span></span><span></span></div>
        <p className="text-center text-muted">{label.loading}</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="page-padding patient-emr-page">
        <div className="patient-emr-empty">
          <User size={32} />
          <h3>{label.notFound}</h3>
        </div>
      </div>
    );
  }

  const firstVisit = medicalHistory.length > 0 ? medicalHistory[medicalHistory.length - 1]?.visit_date : patient.created_at;
  const latestVisit = medicalHistory[0] || null;
  const age = calculateAge(patient.date_of_birth);
  const profileDate = patient.created_at ? new Date(patient.created_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB') : '-';

  const tabs = [
    { id: 'timeline', icon: <Clock size={16} />, label: label.timeline, count: medicalHistory.length },
    { id: 'files', icon: <FolderOpen size={16} />, label: label.files, count: medicalFiles.length },
    { id: 'prescriptions', icon: <Pill size={16} />, label: label.prescriptions, count: prescriptions.length },
  ];

  return (
    <div className="page-padding patient-emr-page patient-emr-page--staff animate-in">
      <button className="btn btn-ghost patient-emr-back" onClick={() => navigate('/dashboard/patients')}>
        <ArrowLeft size={18} /> {label.back}
      </button>

      <section className="patient-emr-hero">
        <div className="patient-emr-identity">
          <div className="patient-emr-avatar">{patient.full_name?.charAt(0)?.toUpperCase() || 'P'}</div>
          <div>
            <span className="patient-emr-kicker"><ShieldCheck size={15} /> {label.workspace}</span>
            <h1>{patient.full_name}</h1>
            <div className="patient-emr-meta">
              <span><User size={14} /> {patient.gender || '-'} · {isAr ? 'العمر' : 'Age'}: {age}</span>
              <span><Calendar size={14} /> {isAr ? 'مسجل' : 'Registered'}: {profileDate}</span>
              <span dir="ltr">{patient.phone || '-'}</span>
            </div>
          </div>
        </div>
        <div className="patient-emr-hero-actions">
          <button className="btn btn-primary" onClick={handleCallPatient}>
            <Bell size={18} /> {isAr ? 'استدعاء المريض' : 'Call patient'}
          </button>
          <button className="btn btn-outline" onClick={() => { setActiveTab('prescriptions'); setShowAddRx(true); }}>
            <Pill size={18} /> {t('new_prescription')}
          </button>
        </div>
      </section>

      <section className="patient-emr-stats">
        <div className="patient-emr-stat">
          <Stethoscope size={18} />
          <strong>{medicalHistory.length}</strong>
          <span>{isAr ? 'زيارات' : 'Visits'}</span>
        </div>
        <div className="patient-emr-stat">
          <FolderOpen size={18} />
          <strong>{medicalFiles.length}</strong>
          <span>{label.files}</span>
        </div>
        <div className="patient-emr-stat">
          <Pill size={18} />
          <strong>{prescriptions.length}</strong>
          <span>{label.prescriptions}</span>
        </div>
        <div className="patient-emr-stat">
          <Calendar size={18} />
          <strong>{firstVisit ? new Date(firstVisit).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB') : '-'}</strong>
          <span>{isAr ? 'أول زيارة' : 'First visit'}</span>
        </div>
      </section>

      <section className="patient-emr-grid">
        <main className="patient-emr-main">
          <div className="patient-emr-panel">
            <div className="patient-emr-panel-head">
              <div>
                <span>{label.summary}</span>
                <h2>{latestVisit?.diagnosis || (isAr ? 'لا يوجد تشخيص حديث' : 'No recent diagnosis')}</h2>
              </div>
              <HeartPulse size={19} />
            </div>
            <div className="patient-emr-clinical-summary">
              <div>
                <span>{label.allergies}</span>
                <strong>{patient.allergies || (isAr ? 'لا توجد حساسية مسجلة' : 'No allergies recorded')}</strong>
              </div>
              <div>
                <span>{label.chronic}</span>
                <strong>{patient.chronic_diseases || patient.chronic_conditions || (isAr ? 'لا توجد أمراض مزمنة مسجلة' : 'No chronic diseases recorded')}</strong>
              </div>
              <div>
                <span>{label.vitals}</span>
                <strong>{patient.blood_type || patient.blood_pressure || (isAr ? 'تُحدّث أثناء الزيارة' : 'Updated during visit')}</strong>
              </div>
              <div>
                <span>{label.payments}</span>
                <strong>{isAr ? 'مرتبط بالحجوزات' : 'Linked to bookings'}</strong>
              </div>
            </div>
          </div>

          <div className="patient-emr-tabs">
            {tabs.map(tab => (
              <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
                {tab.icon}
                <span>{tab.label}</span>
                <em>{tab.count}</em>
              </button>
            ))}
          </div>

          {activeTab === 'timeline' && (
            <div className="patient-emr-panel animate-in">
              <div className="patient-emr-panel-head">
                <div>
                  <span>{label.timeline}</span>
                  <h2>{isAr ? 'سجل الزيارات والملاحظات' : 'Visits and clinical notes'}</h2>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddVisit(!showAddVisit)}>
                  {showAddVisit ? <><X size={16} /> {t('cancel')}</> : <><Plus size={16} /> {isAr ? 'إضافة زيارة' : 'Add visit'}</>}
                </button>
              </div>

              {showAddVisit && (
                <div className="patient-emr-form-card animate-in">
                  <h3>{isAr ? 'سجل زيارة جديد' : 'New visit record'}</h3>
                  <form onSubmit={handleAddVisit}>
                    <div className="form-group">
                      <label className="form-label">Diagnosis / التشخيص *</label>
                      <textarea className="input" rows={2} required value={visitForm.diagnosis}
                        onChange={e => setVisitForm({...visitForm, diagnosis: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Treatment / العلاج *</label>
                      <textarea className="input" rows={2} required value={visitForm.treatment}
                        onChange={e => setVisitForm({...visitForm, treatment: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Doctor Notes / ملاحظات</label>
                      <textarea className="input" rows={2} value={visitForm.notes}
                        onChange={e => setVisitForm({...visitForm, notes: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Next Review Date / موعد المراجعة</label>
                      <input className="input" type="date" value={visitForm.next_review_date}
                        onChange={e => setVisitForm({...visitForm, next_review_date: e.target.value})} />
                    </div>
                    <button type="submit" className="btn btn-primary w-full">{isAr ? 'حفظ الزيارة' : 'Save visit record'}</button>
                  </form>
                </div>
              )}

              {medicalHistory.length === 0 ? (
                <div className="patient-emr-empty">
                  <Stethoscope size={32} />
                  <p>{label.none}</p>
                </div>
              ) : (
                <div className="patient-emr-timeline">
                  {medicalHistory.map((visit, idx) => (
                    <article key={visit.id} className="patient-emr-timeline-row patient-emr-timeline-row--visit">
                      <span className="patient-emr-timeline-dot"></span>
                      <button type="button" onClick={() => setExpandedVisit(expandedVisit === visit.id ? null : visit.id)}>
                        <div>
                          <strong>{new Date(visit.visit_date).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                          <p>{isAr ? 'د.' : 'Dr.'} {getDocName(visit.doctor_id)} · {visit.diagnosis || '-'}</p>
                        </div>
                        {expandedVisit === visit.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                      {expandedVisit !== visit.id && idx === 0 && <em>{isAr ? 'أحدث زيارة' : 'Latest visit'}</em>}
                      {expandedVisit === visit.id && (
                        <div className="patient-emr-visit-detail animate-in">
                          <div><span>{t('diagnosis')}</span><p>{visit.diagnosis || '-'}</p></div>
                          <div><span>{isAr ? 'العلاج' : 'Treatment'}</span><p>{visit.treatment || '-'}</p></div>
                          {visit.notes && <div><span>{label.notes}</span><p>{visit.notes}</p></div>}
                          {visit.next_review_date && <span className="badge badge-warning">{isAr ? 'المراجعة' : 'Next review'}: {new Date(visit.next_review_date).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB')}</span>}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <div className="patient-emr-panel animate-in">
              <div className="patient-emr-panel-head">
                <div>
                  <span>{label.attachments}</span>
                  <h2>{label.files}</h2>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddFile(!showAddFile)}>
                  {showAddFile ? <><X size={16} /> {t('cancel')}</> : <><Upload size={16} /> {isAr ? 'رفع ملف' : 'Upload file'}</>}
                </button>
              </div>

              {showAddFile && (
                <div className="patient-emr-form-card patient-emr-form-card--file animate-in">
                  <h3>{isAr ? 'رفع ملف طبي' : 'Upload medical file'}</h3>
                  <form onSubmit={handleAddFile}>
                    <div className="form-group">
                      <label className="form-label">File Name / اسم الملف *</label>
                      <input className="input" required value={fileForm.file_name}
                        onChange={e => setFileForm({...fileForm, file_name: e.target.value})}
                        placeholder="e.g., Blood Test Results - June 2026" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">File Category / النوع *</label>
                      <select className="input" value={fileForm.file_type}
                        onChange={e => setFileForm({...fileForm, file_type: e.target.value})}>
                        {Object.entries(fileTypeLabels).map(([key, text]) => (
                          <option key={key} value={key}>{text}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description / وصف</label>
                      <textarea className="input" rows={2} value={fileForm.description}
                        onChange={e => setFileForm({...fileForm, description: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">File URL (or upload path)</label>
                      <input className="input" value={fileForm.file_url}
                        onChange={e => setFileForm({...fileForm, file_url: e.target.value})}
                        placeholder="https://storage.supabase.co/..." />
                    </div>
                    <button type="submit" className="btn btn-primary w-full">
                      <Upload size={16} /> {isAr ? 'حفظ الملف' : 'Save file record'}
                    </button>
                  </form>
                </div>
              )}

              {medicalFiles.length === 0 ? (
                <div className="patient-emr-empty">
                  <FileText size={32} />
                  <p>{label.none}</p>
                </div>
              ) : (
                <div className="patient-emr-file-grid">
                  {medicalFiles.map(file => (
                    <article key={file.id} className="patient-emr-file-card" data-type={file.file_type}>
                      <div>
                        {fileTypeIcons[file.file_type]}
                        <span>{fileTypeLabels[file.file_type]?.split('/')[0]?.trim()}</span>
                      </div>
                      <h3>{file.file_name}</h3>
                      {file.description && <p>{file.description}</p>}
                      <em>{new Date(file.created_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB')}</em>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <div className="patient-emr-panel animate-in">
              <div className="patient-emr-panel-head">
                <div>
                  <span>{label.prescriptions}</span>
                  <h2>{isAr ? 'الوصفات والأدوية' : 'Prescriptions and medicines'}</h2>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddRx(!showAddRx)}>
                  {showAddRx ? <><X size={16} /> {t('cancel')}</> : <><Plus size={16} /> {t('new_prescription')}</>}
                </button>
              </div>

              {showAddRx && (
                <div className="patient-emr-form-card patient-emr-form-card--rx animate-in">
                  <h3>{t('new_prescription')}</h3>
                  {rxError && <div className="patient-emr-alert">{rxError}</div>}
                  <form onSubmit={handleAddPrescription}>
                    <div className="form-group">
                      <label className="form-label">{t('diagnosis')} *</label>
                      <textarea className="input" rows={2} required value={rxForm.diagnosis}
                        onChange={e => setRxForm({ ...rxForm, diagnosis: e.target.value })} />
                    </div>

                    <label className="form-label">{t('medicines')} *</label>
                    {rxForm.medicines.map((m, idx) => (
                      <div key={idx} className="patient-emr-med-row">
                        <input className="input" placeholder={t('medicine_name')} required={idx === 0}
                          value={m.name} onChange={e => setMed(idx, 'name', e.target.value)} />
                        <input className="input" placeholder={t('dosage')}
                          value={m.dosage} onChange={e => setMed(idx, 'dosage', e.target.value)} />
                        <input className="input" placeholder={t('instructions')}
                          value={m.instructions} onChange={e => setMed(idx, 'instructions', e.target.value)} />
                        {rxForm.medicines.length > 1 && (
                          <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeMedRow(idx)}>
                            <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn btn-outline btn-sm mb-md" onClick={addMedRow}>
                      <Plus size={14} /> {t('add_medicine')}
                    </button>

                    <div className="form-group">
                      <label className="form-label">{t('instructions')}</label>
                      <textarea className="input" rows={2} value={rxForm.instructions}
                        onChange={e => setRxForm({ ...rxForm, instructions: e.target.value })} />
                    </div>
                    <button type="submit" className="btn btn-primary w-full" disabled={savingRx}>
                      {savingRx ? t('saving') : t('save_prescription')}
                    </button>
                  </form>
                </div>
              )}

              {prescriptions.length === 0 ? (
                <div className="patient-emr-empty">
                  <Pill size={32} />
                  <p>{t('no_prescriptions')}</p>
                </div>
              ) : (
                <div className="patient-emr-prescription-grid">
                  {prescriptions.map(rx => (
                    <PrescriptionViewer
                      key={rx.id}
                      rx={rx}
                      patientName={patient.full_name}
                      doctorName={getDocName(rx.doctor_id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        <aside className="patient-emr-side">
          <ContactActionsCard
            title={isAr ? 'تواصل سريع' : 'Quick Contact'}
            subtitle={isAr ? 'تواصل مع المريض باستخدام الرقم المصرح داخل نفس العيادة.' : 'Contact this patient using the authorized same-clinic phone number.'}
            phone={patient.phone}
            whatsappMessage={buildContactMessage({
              type: 'patient',
              isAr,
              patientName: patient.full_name,
              clinicName: user?.clinic_name || 'UrClinic',
            })}
            actor={user}
            target={{ role: 'patient', clinic_id: patient.clinic_id }}
          />

          <div className="patient-emr-panel">
            <div className="patient-emr-panel-head">
              <div>
                <span>{label.quickActions}</span>
                <h2>{isAr ? 'اختصارات سريرية' : 'Clinical shortcuts'}</h2>
              </div>
              <Activity size={19} />
            </div>
            <div className="patient-emr-action-list">
              <button onClick={() => { setActiveTab('timeline'); setShowAddVisit(true); }}>
                <Stethoscope size={17} /><span>{isAr ? 'إضافة زيارة' : 'Add visit'}</span>
              </button>
              <button onClick={() => { setActiveTab('prescriptions'); setShowAddRx(true); }}>
                <Pill size={17} /><span>{t('new_prescription')}</span>
              </button>
              <button onClick={() => { setActiveTab('files'); setShowAddFile(true); }}>
                <Upload size={17} /><span>{isAr ? 'رفع ملف' : 'Upload file'}</span>
              </button>
              <button onClick={handleCallPatient}>
                <Bell size={17} /><span>{isAr ? 'استدعاء المريض' : 'Call patient'}</span>
              </button>
            </div>
          </div>

          <div className="patient-emr-panel">
            <div className="patient-emr-panel-head">
              <div>
                <span>{label.notes}</span>
                <h2>{isAr ? 'ملاحظات حديثة' : 'Recent notes'}</h2>
              </div>
              <FileText size={19} />
            </div>
            {latestVisit ? (
              <div className="patient-emr-note-card">
                <strong>{latestVisit.diagnosis || '-'}</strong>
                <p>{latestVisit.notes || latestVisit.treatment || (isAr ? 'لا توجد ملاحظات إضافية.' : 'No additional notes.')}</p>
              </div>
            ) : (
              <div className="patient-emr-empty patient-emr-empty--compact">
                <FileText size={24} />
                <p>{label.none}</p>
              </div>
            )}
          </div>

          <div className="patient-emr-panel">
            <div className="patient-emr-panel-head">
              <div>
                <span>{label.payments}</span>
                <h2>{isAr ? 'مراجعة مالية' : 'Financial review'}</h2>
              </div>
              <CreditCard size={19} />
            </div>
            <div className="patient-emr-payment">
              <div><span>{isAr ? 'الحالة' : 'Status'}</span><strong>{isAr ? 'منظم' : 'Organized'}</strong></div>
              <div><span>{isAr ? 'المرجع' : 'Reference'}</span><strong>{patient.id}</strong></div>
            </div>
          </div>

          <div className="patient-emr-panel">
            <div className="patient-emr-panel-head">
              <div>
                <span>{label.attachments}</span>
                <h2>{isAr ? 'آخر ملف' : 'Latest file'}</h2>
              </div>
              <FolderOpen size={19} />
            </div>
            {medicalFiles[0] ? (
              <div className="patient-emr-note-card">
                <strong>{medicalFiles[0].file_name}</strong>
                <p>{medicalFiles[0].description || fileTypeLabels[medicalFiles[0].file_type]}</p>
              </div>
            ) : (
              <div className="patient-emr-empty patient-emr-empty--compact">
                <FolderOpen size={24} />
                <p>{label.none}</p>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
};

export default StaffPatientProfile;
