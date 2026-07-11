import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, Phone, Calendar, Clock, FileText, Upload, Plus, X,
  Stethoscope, ArrowLeft, Bell, Activity, Image, File, ChevronDown, ChevronUp, Pill, Trash2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import PrescriptionViewer from '../components/PrescriptionViewer';

const StaffPatientProfile = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { doctors, sendNotification, user, addMedicalHistory, addMedicalFile, createPrescription } = useApp();

  const [patient, setPatient] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [medicalFiles, setMedicalFiles] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [activeTab, setActiveTab] = useState('timeline');
  const [showAddRx, setShowAddRx] = useState(false);
  const [savingRx, setSavingRx] = useState(false);
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
    if (!patient.auth_user_id) {
      alert('Cannot deliver prescription: this patient record is not linked to a login account / لا يمكن إرسال الوصفة لأن ملف المريض غير مرتبط بحساب دخول');
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
      if (result) {
        setPrescriptions(prev => [result, ...prev]);
        setShowAddRx(false);
        setRxForm({ diagnosis: '', instructions: '', medicines: [{ name: '', dosage: '', instructions: '' }] });
      } else {
        alert('Failed to save prescription / تعذّر حفظ الوصفة');
      }
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
      alert('تم استدعاء المريض بنجاح');
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

  if (loading) return <div className="page-padding text-center"><p>Loading patient profile...</p></div>;
  if (!patient) return <div className="page-padding text-center"><h3>Patient not found</h3></div>;

  const firstVisit = medicalHistory.length > 0 ? medicalHistory[medicalHistory.length - 1]?.visit_date : patient.created_at;

  return (
    <div className="page-padding animate-in">
      {/* Header */}
      <button className="btn btn-ghost mb-md" onClick={() => navigate('/dashboard/patients')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={18} /> Back to Patients
      </button>

      <div className="glass p-6 mb-xl">
        <div className="flex justify-between items-start flex-wrap gap-md">
          <div className="flex items-center gap-lg">
            <div style={{
              width: 72, height: 72, borderRadius: '50%', 
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '1.75rem', fontWeight: 800
            }}>
              {patient.full_name?.charAt(0)?.toUpperCase() || 'P'}
            </div>
            <div>
              <h2 style={{ margin: 0 }}>{patient.full_name}</h2>
              <div className="flex gap-lg mt-sm flex-wrap text-muted">
                <span className="flex items-center gap-sm"><Phone size={14} /> {patient.phone || '-'}</span>
                <span className="flex items-center gap-sm"><User size={14} /> {patient.gender || '-'} • Age: {calculateAge(patient.date_of_birth)}</span>
                <span className="flex items-center gap-sm"><Calendar size={14} /> Registered: {new Date(patient.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-sm">
            <button className="btn btn-primary" onClick={handleCallPatient}>
              <Bell size={18} /> Call Patient / استدعاء
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-lg mt-lg flex-wrap">
          <div className="card-flat bg-alt text-center" style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{medicalHistory.length}</div>
            <div className="text-sm text-muted">Total Visits</div>
          </div>
          <div className="card-flat bg-alt text-center" style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6' }}>{medicalFiles.length}</div>
            <div className="text-sm text-muted">Medical Files</div>
          </div>
          <div className="card-flat bg-alt text-center" style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
              {firstVisit ? new Date(firstVisit).toLocaleDateString() : '-'}
            </div>
            <div className="text-sm text-muted">First Visit</div>
          </div>
        </div>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="flex gap-sm mb-xl tabs-row" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <button className={`btn ${activeTab === 'timeline' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('timeline')} style={{ flexShrink: 0 }}>
          <Clock size={16} /> Visit Timeline
        </button>
        <button className={`btn ${activeTab === 'files' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('files')} style={{ flexShrink: 0 }}>
          <FileText size={16} /> Medical Files ({medicalFiles.length})
        </button>
        <button className={`btn ${activeTab === 'prescriptions' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('prescriptions')} style={{ flexShrink: 0 }}>
          <Pill size={16} /> {t('prescriptions')} ({prescriptions.length})
        </button>
      </div>

      {/* Visit Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="animate-in">
          <div className="flex justify-between items-center mb-md">
            <h3 style={{ margin: 0 }}>Visit Timeline / سجل الزيارات</h3>
            <button className="btn btn-primary" onClick={() => setShowAddVisit(!showAddVisit)}>
              {showAddVisit ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Add Visit</>}
            </button>
          </div>

          {/* Add Visit Form */}
          {showAddVisit && (
            <div className="glass p-6 mb-xl animate-in" style={{ borderLeft: '4px solid var(--primary)' }}>
              <h4 className="mb-md">New Visit Record</h4>
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
                <button type="submit" className="btn btn-primary w-full">Save Visit Record</button>
              </form>
            </div>
          )}

          {/* Timeline */}
          <div className="visit-timeline">
            {medicalHistory.length === 0 ? (
              <div className="card-flat bg-alt text-center py-xl text-muted">
                <Stethoscope size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                <p>No visit records yet. Add the first visit!</p>
              </div>
            ) : (
              medicalHistory.map((visit, idx) => (
                <div key={visit.id} className="timeline-item" style={{
                  position: 'relative',
                  paddingInlineStart: '2.5rem',
                  paddingBottom: '1.5rem',
                  borderInlineStart: idx < medicalHistory.length - 1 ? '2px solid var(--primary-200)' : '2px solid transparent',
                  marginInlineStart: '0.75rem'
                }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    insetInlineStart: '-0.5rem',
                    top: '0.25rem',
                    width: '1rem', height: '1rem', borderRadius: '50%',
                    background: idx === 0 ? 'var(--primary)' : 'var(--primary-200)',
                    border: '3px solid var(--bg)'
                  }} />
                  
                  <div className="glass p-4" style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedVisit(expandedVisit === visit.id ? null : visit.id)}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-sm mb-xs">
                          <Calendar size={14} className="text-muted" />
                          <strong>{new Date(visit.visit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                          <span className="text-sm text-muted">{new Date(visit.visit_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="text-sm text-muted">
                          <Stethoscope size={12} style={{ display: 'inline', marginInlineEnd: 4 }} />
                          Dr. {getDocName(visit.doctor_id)}
                        </div>
                      </div>
                      {expandedVisit === visit.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>

                    {/* Collapsed preview */}
                    {expandedVisit !== visit.id && (
                      <p className="text-sm mt-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        <strong>Dx:</strong> {visit.diagnosis?.substring(0, 80)}{visit.diagnosis?.length > 80 ? '...' : ''}
                      </p>
                    )}

                    {/* Expanded details */}
                    {expandedVisit === visit.id && (
                      <div className="mt-md animate-in" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                        <div className="mb-sm"><strong>Diagnosis / التشخيص:</strong><br/>{visit.diagnosis || '-'}</div>
                        <div className="mb-sm"><strong>Treatment / العلاج:</strong><br/>{visit.treatment || '-'}</div>
                        {visit.notes && <div className="mb-sm"><strong>Notes / ملاحظات:</strong><br/>{visit.notes}</div>}
                        {visit.next_review_date && (
                          <div className="badge badge-warning mt-sm">
                            Next Review: {new Date(visit.next_review_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Medical Files Tab */}
      {activeTab === 'files' && (
        <div className="animate-in">
          <div className="flex justify-between items-center mb-md">
            <h3 style={{ margin: 0 }}>Medical Files / الملفات الطبية</h3>
            <button className="btn btn-primary" onClick={() => setShowAddFile(!showAddFile)}>
              {showAddFile ? <><X size={16} /> Cancel</> : <><Upload size={16} /> Upload File</>}
            </button>
          </div>

          {/* Add File Form */}
          {showAddFile && (
            <div className="glass p-6 mb-xl animate-in" style={{ borderLeft: '4px solid #3b82f6' }}>
              <h4 className="mb-md">Upload Medical File</h4>
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
                    {Object.entries(fileTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
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
                  <Upload size={16} /> Save File Record
                </button>
              </form>
            </div>
          )}

          {/* Files Grid */}
          {medicalFiles.length === 0 ? (
            <div className="card-flat bg-alt text-center py-xl text-muted">
              <FileText size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
              <p>No medical files uploaded yet.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {medicalFiles.map(file => (
                <div key={file.id} className="glass p-4" style={{ borderTop: `3px solid ${
                  file.file_type === 'x-ray' ? '#8b5cf6' : 
                  file.file_type === 'lab' ? '#3b82f6' : 
                  file.file_type === 'prescription' ? '#10b981' : 
                  file.file_type === 'report' ? '#f59e0b' : '#6b7280'
                }`}}>
                  <div className="flex items-center gap-sm mb-sm">
                    {fileTypeIcons[file.file_type]}
                    <span className="badge" style={{ 
                      background: file.file_type === 'x-ray' ? 'rgba(139,92,246,0.1)' : 
                        file.file_type === 'lab' ? 'rgba(59,130,246,0.1)' : 
                        file.file_type === 'prescription' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                      color: file.file_type === 'x-ray' ? '#8b5cf6' : 
                        file.file_type === 'lab' ? '#3b82f6' : 
                        file.file_type === 'prescription' ? '#10b981' : '#f59e0b'
                    }}>
                      {fileTypeLabels[file.file_type]?.split('/')[0]?.trim()}
                    </span>
                  </div>
                  <h4 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.95rem' }}>{file.file_name}</h4>
                  {file.description && <p className="text-sm text-muted mb-sm">{file.description}</p>}
                  <div className="text-sm text-muted">
                    {new Date(file.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prescriptions Tab */}
      {activeTab === 'prescriptions' && (
        <div className="animate-in">
          <div className="flex justify-between items-center mb-md">
            <h3 style={{ margin: 0 }}>{t('prescriptions')} / الوصفات الطبية</h3>
            <button className="btn btn-primary" onClick={() => setShowAddRx(!showAddRx)}>
              {showAddRx ? <><X size={16} /> {t('cancel')}</> : <><Plus size={16} /> {t('new_prescription')}</>}
            </button>
          </div>

          {/* Add Prescription Form */}
          {showAddRx && (
            <div className="glass p-6 mb-xl animate-in" style={{ borderInlineStart: '4px solid #10b981' }}>
              <h4 className="mb-md">{t('new_prescription')}</h4>
              <form onSubmit={handleAddPrescription}>
                <div className="form-group">
                  <label className="form-label">{t('diagnosis')} *</label>
                  <textarea className="input" rows={2} required value={rxForm.diagnosis}
                    onChange={e => setRxForm({ ...rxForm, diagnosis: e.target.value })} />
                </div>

                <label className="form-label">{t('medicines')} *</label>
                {rxForm.medicines.map((m, idx) => (
                  <div key={idx} className="card-flat bg-alt" style={{ marginBottom: '0.75rem' }}>
                    <div className="flex gap-md flex-wrap">
                      <div className="form-group mb-0" style={{ flex: '2 1 160px' }}>
                        <input className="input" placeholder={t('medicine_name')} required={idx === 0}
                          value={m.name} onChange={e => setMed(idx, 'name', e.target.value)} />
                      </div>
                      <div className="form-group mb-0" style={{ flex: '1 1 120px' }}>
                        <input className="input" placeholder={t('dosage')}
                          value={m.dosage} onChange={e => setMed(idx, 'dosage', e.target.value)} />
                      </div>
                      <div className="form-group mb-0" style={{ flex: '2 1 160px' }}>
                        <input className="input" placeholder={t('instructions')}
                          value={m.instructions} onChange={e => setMed(idx, 'instructions', e.target.value)} />
                      </div>
                      {rxForm.medicines.length > 1 && (
                        <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeMedRow(idx)}>
                          <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                        </button>
                      )}
                    </div>
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

          {/* Prescriptions list */}
          {prescriptions.length === 0 ? (
            <div className="card-flat bg-alt text-center py-xl text-muted">
              <Pill size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
              <p>{t('no_prescriptions')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
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
    </div>
  );
};

export default StaffPatientProfile;
