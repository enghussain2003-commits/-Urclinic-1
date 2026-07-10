import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, X, Stethoscope, MapPin, Clock } from 'lucide-react';

const WEEK_DAYS = [
  { id: 'sat', label: 'Sat', labelAr: 'السبت' },
  { id: 'sun', label: 'Sun', labelAr: 'الأحد' },
  { id: 'mon', label: 'Mon', labelAr: 'الإثنين' },
  { id: 'tue', label: 'Tue', labelAr: 'الثلاثاء' },
  { id: 'wed', label: 'Wed', labelAr: 'الأربعاء' },
  { id: 'thu', label: 'Thu', labelAr: 'الخميس' },
  { id: 'fri', label: 'Fri', labelAr: 'الجمعة' },
];

const DoctorManagement = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { specialties, addDoctor, deleteDoctor, user } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Doctors scoped to the logged-in admin's own clinic (super_admin sees all).
  const [doctors, setDoctors] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Clinics for the super_admin dropdown — required for a successful insert
  // (doctors.clinic_id is NOT NULL). Fixed in this commit for audit issue C3.
  const [clinics, setClinics] = useState([]);
  useEffect(() => {
    if (user?.role !== 'super_admin') return;
    supabase.from('clinics').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setClinics(data || []));
  }, [user?.role]);

  const loadClinicDoctors = useCallback(async () => {
    setLoadingDocs(true);
    try {
      // 1) current auth user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setDoctors([]); return; }

      // 2) read this admin's clinic_id + role from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id, role')
        .eq('id', user.id)
        .single();

      // 3) fetch doctors — super_admin sees every clinic; everyone else only their own
      let query = supabase.from('doctors').select('*').order('created_at', { ascending: false });
      if (profile?.role !== 'super_admin') {
        if (!profile?.clinic_id) { setDoctors([]); return; }  // no clinic → nothing to show
        query = query.eq('clinic_id', profile.clinic_id);
      }
      const { data, error: fetchErr } = await query;
      if (fetchErr) { console.error('Failed to load clinic doctors:', fetchErr.message); setDoctors([]); return; }
      setDoctors(data || []);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadClinicDoctors(); }, [loadClinicDoctors]);

  const [form, setForm] = useState({
    clinic_id: '',
    full_name: '',
    email: '',
    specialty: 'general',
    clinic_address: '',
    fee: '',
    open_time: '09:00',
    close_time: '20:00',
    break_start: '13:00',
    break_end: '14:00',
    work_days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'],
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleDay = (dayId) => {
    setForm(prev => ({
      ...prev,
      work_days: prev.work_days.includes(dayId)
        ? prev.work_days.filter(d => d !== dayId)
        : [...prev.work_days, dayId]
    }));
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!form.clinic_id) {
        setError(isAr ? 'اختر العيادة' : 'Select a clinic');
        setSaving(false);
        return;
      }
      if (form.work_days.length === 0) {
        setError(isAr ? 'اختر يوم دوام واحد على الأقل' : 'Select at least one working day');
        setSaving(false);
        return;
      }
      // Send only fields that exist in public.doctors. `clinic_name` and `duration`
      // are intentionally dropped — they aren't columns and previously caused the
      // insert to fail silently.
      await addDoctor({
        clinic_id: form.clinic_id,
        full_name: form.full_name,
        email: form.email,
        specialty: form.specialty,
        clinic_address: form.clinic_address,
        fee: parseFloat(form.fee) || 0,
        open_time: form.open_time,
        close_time: form.close_time,
        break_start: form.break_start,
        break_end: form.break_end,
        work_days: form.work_days,
      });
      setShowModal(false);
      setForm({
        clinic_id: '', full_name: '', email: '', specialty: 'general', clinic_address: '',
        fee: '', open_time: '09:00', close_time: '20:00', break_start: '13:00', break_end: '14:00',
        work_days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'],
      });
      await loadClinicDoctors();   // refresh the clinic-scoped list
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(isAr ? 'حذف هذا الطبيب؟' : 'Delete this doctor?')) return;
    try {
      await deleteDoctor(id);            // throws for non-super_admin (also blocked by RLS)
      await loadClinicDoctors();         // refresh the clinic-scoped list
    } catch (err) {
      alert(err.message);
    }
  };

  const canDelete = user?.role === 'super_admin';

  return (
    <div className="page-padding animate-in">
      <div className="flex justify-between items-center mb-xl">
        <h2>{t('manage_doctors')}</h2>
        {user?.role === 'super_admin' && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> {t('add_doctor')}
          </button>
        )}
      </div>

      <div className="glass p-6">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('doctor')}</th>
                <th>{t('specialty')}</th>
                <th>{isAr ? 'عنوان العيادة' : 'Clinic Address'}</th>
                <th>{isAr ? 'الدوام' : 'Working Hours'}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loadingDocs ? (
                <tr><td colSpan="5" className="text-center text-muted">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</td></tr>
              ) : doctors.length === 0 ? (
                <tr><td colSpan="5" className="text-center text-muted">{isAr ? 'لا يوجد أطباء في عيادتك بعد.' : 'No doctors in your clinic yet.'}</td></tr>
              ) : doctors.map(doc => (
                <tr key={doc.id}>
                  <td>
                    <div className="flex items-center gap-md">
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0
                      }}>
                        {(doc.full_name || doc.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{doc.full_name || (isAr ? doc.nameAr : doc.name)}</span>
                    </div>
                  </td>
                  <td>{t(doc.specialty) || doc.specialty}</td>
                  <td className="text-sm text-muted">{doc.clinic_address || doc.clinic_name || '-'}</td>
                  <td className="text-sm">
                    {doc.open_time && doc.close_time
                      ? `${doc.open_time} - ${doc.close_time}`
                      : '-'}
                  </td>
                  <td>
                    <div className="flex gap-sm">
                      {canDelete ? (
                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(doc.id)} title={t('delete')}>
                          <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                        </button>
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Doctor Modal — rendered via Portal to escape transform stacking context */}
      {showModal && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          zIndex: 9999, overflowY: 'auto', padding: '2rem 1rem'
        }}>
          <div className="glass p-8" style={{ width: '100%', maxWidth: 540 }}>
            <div className="flex justify-between items-center mb-xl">
              <h3 style={{ margin: 0 }}><Stethoscope size={20} style={{ display: 'inline', marginRight: 8 }} />{t('add_doctor')}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>

            {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

            <form onSubmit={handleAddDoctor}>
              <div className="form-group">
                <label className="form-label">{isAr ? 'العيادة' : 'Clinic'} *</label>
                <select className="input" name="clinic_id" required value={form.clinic_id} onChange={handleChange}>
                  <option value="">{isAr ? 'اختر العيادة...' : 'Select clinic...'}</option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{isAr ? 'الاسم الكامل' : 'Full Name'} *</label>
                <input className="input" name="full_name" required value={form.full_name} onChange={handleChange} placeholder={isAr ? 'د. أحمد الراشد' : 'Dr. Ahmad'} />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="input" name="email" type="email" required value={form.email} onChange={handleChange} placeholder="doctor@clinic.com" />
              </div>
              <div className="form-group">
                <label className="form-label">{isAr ? 'التخصص' : 'Specialty'} *</label>
                <select className="input" name="specialty" value={form.specialty} onChange={handleChange}>
                  {specialties.map(s => (
                    <option key={s.id} value={s.id}>{t(s.id) || s.id}</option>
                  ))}
                </select>
              </div>
              {/* #2: Clinic address (replaces the old duration field) */}
              <div className="form-group">
                <label className="form-label"><MapPin size={14} style={{ display: 'inline', marginInlineEnd: 4 }} />{isAr ? 'عنوان العيادة / مكان الحجز' : 'Clinic Address'} *</label>
                <input className="input" name="clinic_address" required value={form.clinic_address} onChange={handleChange} placeholder={isAr ? 'بغداد، شارع الرشيد، بناية 12' : 'Baghdad, Al-Rashid St, Bldg 12'} />
              </div>
              <div className="form-group">
                <label className="form-label">{isAr ? 'سعر الكشفية ($)' : 'Fee ($)'}</label>
                <input className="input" name="fee" type="number" value={form.fee} onChange={handleChange} placeholder="50" />
              </div>

              {/* #3: Working hours, days, break */}
              <div className="card-flat bg-alt" style={{ marginBottom: '1rem' }}>
                <h4 className="mb-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={16} /> {isAr ? 'إعدادات الدوام' : 'Working Schedule'}
                </h4>
                <div className="flex gap-md flex-wrap mb-md">
                  <div className="form-group mb-0" style={{ flex: 1, minWidth: 120 }}>
                    <label className="form-label">{isAr ? 'وقت الفتح' : 'Open Time'}</label>
                    <input className="input" name="open_time" type="time" value={form.open_time} onChange={handleChange} />
                  </div>
                  <div className="form-group mb-0" style={{ flex: 1, minWidth: 120 }}>
                    <label className="form-label">{isAr ? 'وقت الإغلاق' : 'Close Time'}</label>
                    <input className="input" name="close_time" type="time" value={form.close_time} onChange={handleChange} />
                  </div>
                </div>
                <div className="flex gap-md flex-wrap mb-md">
                  <div className="form-group mb-0" style={{ flex: 1, minWidth: 120 }}>
                    <label className="form-label">{isAr ? 'بداية الاستراحة' : 'Break Start'}</label>
                    <input className="input" name="break_start" type="time" value={form.break_start} onChange={handleChange} />
                  </div>
                  <div className="form-group mb-0" style={{ flex: 1, minWidth: 120 }}>
                    <label className="form-label">{isAr ? 'نهاية الاستراحة' : 'Break End'}</label>
                    <input className="input" name="break_end" type="time" value={form.break_end} onChange={handleChange} />
                  </div>
                </div>
                <label className="form-label">{isAr ? 'أيام الدوام' : 'Working Days'}</label>
                <div className="flex gap-sm flex-wrap">
                  {WEEK_DAYS.map(day => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={`btn btn-sm ${form.work_days.includes(day.id) ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {isAr ? day.labelAr : day.label}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={saving}>
                {saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : t('add_doctor')}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DoctorManagement;
