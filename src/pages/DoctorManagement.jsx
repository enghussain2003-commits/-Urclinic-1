import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  BadgeCheck,
  BriefcaseMedical,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Filter,
  Mail,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../supabaseClient';
import ContactActionsCard from '../components/ContactActionsCard';
import { buildContactMessage } from '../services/contactService';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

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
  const { specialties, addDoctor, deleteDoctor, user, appointments = [] } = useApp();
  const toast = useToast();

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [doctors, setDoctors] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [clinics, setClinics] = useState([]);

  useEffect(() => {
    if (user?.role !== 'super_admin') return;
    supabase.from('clinics').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setClinics(data || []));
  }, [user?.role]);

  const loadClinicDoctors = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setDoctors([]); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id, role')
        .eq('id', authUser.id)
        .single();

      let doctorQuery = supabase.from('doctors').select('*').order('created_at', { ascending: false });
      if (profile?.role !== 'super_admin') {
        if (!profile?.clinic_id) { setDoctors([]); return; }
        doctorQuery = doctorQuery.eq('clinic_id', profile.clinic_id);
      }
      const { data, error: fetchErr } = await doctorQuery;
      if (fetchErr) { console.error('Failed to load clinic doctors:', fetchErr.message); setDoctors([]); return; }
      setDoctors(data || []);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => loadClinicDoctors());
    return () => cancelAnimationFrame(id);
  }, [loadClinicDoctors]);

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

  const todayKey = new Date().toISOString().slice(0, 10);
  const clinicById = useMemo(() => new Map(clinics.map(clinic => [String(clinic.id), clinic.name])), [clinics]);

  const todayByDoctor = useMemo(() => {
    const counts = new Map();
    appointments.forEach(appointment => {
      const date = appointment.date ?? appointment.appointment_date;
      const doctorId = appointment.doctor_id ?? appointment.doctorId;
      if (date === todayKey && doctorId) {
        counts.set(String(doctorId), (counts.get(String(doctorId)) || 0) + 1);
      }
    });
    return counts;
  }, [appointments, todayKey]);

  const activeDoctors = useMemo(() => doctors.filter(doc => doc.is_active !== false).length, [doctors]);
  const inactiveDoctors = doctors.length - activeDoctors;
  const specialtiesCount = useMemo(() => new Set(doctors.map(doc => doc.specialty).filter(Boolean)).size, [doctors]);

  const filteredDoctors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return doctors.filter(doc => {
      const active = doc.is_active !== false;
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && active)
        || (statusFilter === 'inactive' && !active);
      const searchable = [
        doc.full_name,
        doc.name,
        doc.nameAr,
        doc.email,
        doc.specialty,
        doc.clinic_address,
        doc.clinic_name,
        clinicById.get(String(doc.clinic_id)),
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!needle || searchable.includes(needle));
    });
  }, [clinicById, doctors, query, statusFilter]);

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
      await loadClinicDoctors();
    } catch (err) {
      console.error('Doctor creation failed:', err);
      setError(getLocalizedErrorMessage(err, { isAr, fallback: 'request' }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(isAr ? 'حذف هذا الطبيب؟' : 'Delete this doctor?')) return;
    try {
      await deleteDoctor(id);
      await loadClinicDoctors();
    } catch (err) {
      console.error('Doctor delete failed:', {
        message: err?.message,
        code: err?.code,
        doctorId: id,
        role: user?.role,
      });
      toast.error(isAr ? 'تعذر حذف الطبيب.' : 'Could not delete doctor.');
    }
  };

  const canDelete = user?.role === 'super_admin';
  const canAdd = user?.role === 'super_admin';

  const getDoctorName = (doc) => doc.full_name || (isAr ? doc.nameAr : doc.name) || doc.name || doc.nameAr || (isAr ? 'طبيب غير مسمى' : 'Unnamed doctor');
  const getInitial = (doc) => getDoctorName(doc).trim().charAt(0).toUpperCase() || '?';
  const getClinicLabel = (doc) => clinicById.get(String(doc.clinic_id)) || doc.clinic_name || doc.clinic_address || (isAr ? 'العيادة الحالية' : 'Current clinic');
  const getWorkDaysLabel = (doc) => {
    const days = Array.isArray(doc.work_days) ? doc.work_days : [];
    if (!days.length) return isAr ? 'غير محدد' : 'Not set';
    return days.map(dayId => {
      const day = WEEK_DAYS.find(item => item.id === dayId);
      return isAr ? (day?.labelAr || dayId) : (day?.label || dayId);
    }).join(isAr ? '، ' : ', ');
  };

  const statusFilters = [
    { id: 'all', label: isAr ? 'كل الأطباء' : 'All doctors', count: doctors.length },
    { id: 'active', label: isAr ? 'نشط' : 'Active', count: activeDoctors },
    { id: 'inactive', label: isAr ? 'غير نشط' : 'Inactive', count: inactiveDoctors },
  ];

  return (
    <div className="doctor-management-page animate-in">
      <section className="doctor-management-hero">
        <div>
          <span className="doctor-management-kicker">
            <ShieldCheck size={16} />
            {isAr ? 'إدارة الفريق الطبي' : 'Medical team control'}
          </span>
          <h1>{t('manage_doctors')}</h1>
          <p>
            {isAr
              ? 'إدارة الأطباء، التخصصات، العيادات، وساعات العمل من مساحة واحدة واضحة وسريعة.'
              : 'Manage doctors, specialties, clinics, and working hours from one calm operational workspace.'}
          </p>
        </div>
        {canAdd && (
          <button className="btn btn-primary doctor-management-add" onClick={() => setShowModal(true)}>
            <Plus size={19} /> {t('add_doctor')}
          </button>
        )}
      </section>

      <section className="doctor-management-stats" aria-label={isAr ? 'ملخص الأطباء' : 'Doctors summary'}>
        <div className="doctor-management-stat">
          <span><UserRound size={18} /></span>
          <p>{isAr ? 'إجمالي الأطباء' : 'Total doctors'}</p>
          <strong>{doctors.length}</strong>
        </div>
        <div className="doctor-management-stat">
          <span><BadgeCheck size={18} /></span>
          <p>{isAr ? 'أطباء نشطون' : 'Active doctors'}</p>
          <strong>{activeDoctors}</strong>
        </div>
        <div className="doctor-management-stat">
          <span><BriefcaseMedical size={18} /></span>
          <p>{isAr ? 'التخصصات' : 'Specialties'}</p>
          <strong>{specialtiesCount}</strong>
        </div>
        <div className="doctor-management-stat">
          <span><CalendarClock size={18} /></span>
          <p>{isAr ? 'مواعيد اليوم' : "Today's appointments"}</p>
          <strong>{Array.from(todayByDoctor.values()).reduce((sum, count) => sum + count, 0)}</strong>
        </div>
      </section>

      <section className="doctor-management-toolbar">
        <label className="doctor-management-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isAr ? 'ابحث بالاسم، البريد، التخصص، أو العيادة' : 'Search by name, email, specialty, or clinic'}
          />
        </label>
        <div className="doctor-management-filters" role="tablist" aria-label={isAr ? 'تصفية الأطباء' : 'Doctor filters'}>
          <span><Filter size={15} /></span>
          {statusFilters.map(item => (
            <button
              key={item.id}
              type="button"
              className={statusFilter === item.id ? 'active' : ''}
              onClick={() => setStatusFilter(item.id)}
            >
              {item.label}
              <em>{item.count}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="doctor-management-panel">
        <div className="doctor-management-panel-head">
          <div>
            <h2>{isAr ? 'قائمة الأطباء' : 'Doctor directory'}</h2>
            <p>
              {isAr
                ? `${filteredDoctors.length} من ${doctors.length} طبيب ظاهر`
                : `${filteredDoctors.length} of ${doctors.length} doctors visible`}
            </p>
          </div>
          <span className="doctor-management-live">
            <Activity size={15} />
            {isAr ? 'بيانات مباشرة' : 'Live data'}
          </span>
        </div>

        {loadingDocs ? (
          <div className="doctor-management-skeleton" aria-label={isAr ? 'جار تحميل الأطباء' : 'Loading doctors'}>
            {[0, 1, 2].map(item => <span key={item} />)}
          </div>
        ) : doctors.length === 0 ? (
          <DoctorEmptyState isAr={isAr} canAdd={canAdd} onAdd={() => setShowModal(true)} t={t} />
        ) : filteredDoctors.length === 0 ? (
          <div className="doctor-management-empty">
            <Search size={34} />
            <h3>{isAr ? 'لا توجد نتائج مطابقة' : 'No matching doctors'}</h3>
            <p>{isAr ? 'جرّب بحثاً مختلفاً أو غيّر التصفية الحالية.' : 'Try a different search or adjust the current filter.'}</p>
          </div>
        ) : (
          <>
            <div className="doctor-management-table-wrap">
              <table className="doctor-management-table">
                <thead>
                  <tr>
                    <th>{t('doctor')}</th>
                    <th>{t('specialty')}</th>
                    <th>{isAr ? 'العيادة' : 'Clinic'}</th>
                    <th>{isAr ? 'الدوام' : 'Working hours'}</th>
                    <th>{isAr ? 'الحالة' : 'Status'}</th>
                    <th>{isAr ? 'اليوم' : 'Today'}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map(doc => (
                    <DoctorTableRow
                      key={doc.id}
                      doc={doc}
                      canDelete={canDelete}
                      getClinicLabel={getClinicLabel}
                      getDoctorName={getDoctorName}
                      getInitial={getInitial}
                      getWorkDaysLabel={getWorkDaysLabel}
                      handleDelete={handleDelete}
                      isAr={isAr}
                      t={t}
                      todayCount={todayByDoctor.get(String(doc.id)) || 0}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="doctor-management-cards">
              {filteredDoctors.map(doc => (
                <DoctorManagementCard
                  key={doc.id}
                  doc={doc}
                  canDelete={canDelete}
                  getClinicLabel={getClinicLabel}
                  getDoctorName={getDoctorName}
                  getInitial={getInitial}
                  getWorkDaysLabel={getWorkDaysLabel}
                  handleDelete={handleDelete}
                  isAr={isAr}
                  t={t}
                  todayCount={todayByDoctor.get(String(doc.id)) || 0}
                  user={user}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {showModal && ReactDOM.createPortal(
        <div className="modal-overlay doctor-management-modal-overlay">
          <div className="doctor-management-modal" role="dialog" aria-modal="true" aria-labelledby="add-doctor-title">
            <div className="doctor-management-modal-head">
              <div>
                <span><Stethoscope size={17} /></span>
                <h3 id="add-doctor-title">{t('add_doctor')}</h3>
                <p>{isAr ? 'أدخل معلومات الطبيب وجدول الدوام الأساسي.' : 'Enter the doctor profile and core working schedule.'}</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} aria-label={isAr ? 'إغلاق' : 'Close'}>
                <X size={20} />
              </button>
            </div>

            {error && <div className="doctor-management-form-error">{error}</div>}

            <form onSubmit={handleAddDoctor} className="doctor-management-form">
              <div className="doctor-management-form-section">
                <div className="doctor-management-form-section-head">
                  <UserRound size={18} />
                  <div>
                    <h4>{isAr ? 'معلومات الطبيب' : 'Doctor profile'}</h4>
                    <p>{isAr ? 'البيانات الأساسية التي تظهر للفريق والمرضى.' : 'Core details shown to the team and patients.'}</p>
                  </div>
                </div>
                <div className="doctor-management-form-grid">
                  <label className="form-group">
                    <span className="form-label">{isAr ? 'العيادة' : 'Clinic'} *</span>
                    <select className="input" name="clinic_id" required value={form.clinic_id} onChange={handleChange}>
                      <option value="">{isAr ? 'اختر العيادة...' : 'Select clinic...'}</option>
                      {clinics.map(clinic => (
                        <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="form-group">
                    <span className="form-label">{isAr ? 'الاسم الكامل' : 'Full name'} *</span>
                    <input className="input" name="full_name" required value={form.full_name} onChange={handleChange} placeholder={isAr ? 'د. أحمد الراشد' : 'Dr. Ahmad'} />
                  </label>
                  <label className="form-group">
                    <span className="form-label">Email *</span>
                    <input className="input" name="email" type="email" required value={form.email} onChange={handleChange} placeholder="doctor@clinic.com" />
                  </label>
                  <label className="form-group">
                    <span className="form-label">{isAr ? 'التخصص' : 'Specialty'} *</span>
                    <select className="input" name="specialty" value={form.specialty} onChange={handleChange}>
                      {specialties.map(specialty => (
                        <option key={specialty.id} value={specialty.id}>{t(specialty.id) || specialty.id}</option>
                      ))}
                    </select>
                  </label>
                  <label className="form-group doctor-management-form-wide">
                    <span className="form-label">{isAr ? 'عنوان العيادة' : 'Clinic address'} *</span>
                    <input className="input" name="clinic_address" required value={form.clinic_address} onChange={handleChange} placeholder={isAr ? 'بغداد، شارع الرشيد، بناية 12' : 'Baghdad, Al-Rashid St, Bldg 12'} />
                  </label>
                  <label className="form-group">
                    <span className="form-label">{isAr ? 'سعر الكشفية ($)' : 'Fee ($)'}</span>
                    <input className="input" name="fee" type="number" value={form.fee} onChange={handleChange} placeholder="50" />
                  </label>
                </div>
              </div>

              <div className="doctor-management-form-section">
                <div className="doctor-management-form-section-head">
                  <Clock size={18} />
                  <div>
                    <h4>{isAr ? 'جدول الدوام' : 'Working schedule'}</h4>
                    <p>{isAr ? 'ساعات العمل والاستراحة والأيام المتاحة.' : 'Working hours, break time, and available days.'}</p>
                  </div>
                </div>
                <div className="doctor-management-form-grid">
                  <label className="form-group">
                    <span className="form-label">{isAr ? 'وقت الفتح' : 'Open time'}</span>
                    <input className="input" name="open_time" type="time" value={form.open_time} onChange={handleChange} />
                  </label>
                  <label className="form-group">
                    <span className="form-label">{isAr ? 'وقت الإغلاق' : 'Close time'}</span>
                    <input className="input" name="close_time" type="time" value={form.close_time} onChange={handleChange} />
                  </label>
                  <label className="form-group">
                    <span className="form-label">{isAr ? 'بداية الاستراحة' : 'Break start'}</span>
                    <input className="input" name="break_start" type="time" value={form.break_start} onChange={handleChange} />
                  </label>
                  <label className="form-group">
                    <span className="form-label">{isAr ? 'نهاية الاستراحة' : 'Break end'}</span>
                    <input className="input" name="break_end" type="time" value={form.break_end} onChange={handleChange} />
                  </label>
                </div>
                <div>
                  <span className="form-label">{isAr ? 'أيام الدوام' : 'Working days'}</span>
                  <div className="doctor-management-day-grid">
                    {WEEK_DAYS.map(day => (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleDay(day.id)}
                        className={form.work_days.includes(day.id) ? 'active' : ''}
                      >
                        {isAr ? day.labelAr : day.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="doctor-management-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : t('add_doctor')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const DoctorEmptyState = ({ isAr, canAdd, onAdd, t }) => (
  <div className="doctor-management-empty">
    <Stethoscope size={38} />
    <h3>{isAr ? 'لا يوجد أطباء بعد' : 'No doctors yet'}</h3>
    <p>
      {isAr
        ? 'ابدأ بإضافة الأطباء وجدولة ساعات العمل لتفعيل الحجوزات.'
        : 'Start by adding doctors and working hours to activate bookings.'}
    </p>
    {canAdd && (
      <button className="btn btn-primary" onClick={onAdd}>
        <Plus size={18} /> {t('add_doctor')}
      </button>
    )}
  </div>
);

const DoctorStatusBadge = ({ active, isAr }) => (
  <span className={`doctor-management-status ${active ? 'active' : 'inactive'}`}>
    <span />
    {active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
  </span>
);

const DoctorAvatar = ({ doc, getInitial }) => (
  <div className="doctor-management-avatar" aria-hidden="true">
    {doc.avatar || getInitial(doc)}
  </div>
);

const DoctorTableRow = ({
  doc,
  canDelete,
  getClinicLabel,
  getDoctorName,
  getInitial,
  getWorkDaysLabel,
  handleDelete,
  isAr,
  t,
  todayCount,
}) => {
  const active = doc.is_active !== false;
  return (
    <tr>
      <td>
        <div className="doctor-management-identity">
          <DoctorAvatar doc={doc} getInitial={getInitial} />
          <div>
            <strong>{getDoctorName(doc)}</strong>
            <span><Mail size={13} /> {doc.email || (isAr ? 'لا يوجد بريد' : 'No email')}</span>
          </div>
        </div>
      </td>
      <td>
        <span className="doctor-management-specialty">
          <Stethoscope size={14} />
          {t(doc.specialty) || doc.specialty || (isAr ? 'غير محدد' : 'Not set')}
        </span>
      </td>
      <td>
        <div className="doctor-management-meta">
          <Building2 size={14} />
          <span>{getClinicLabel(doc)}</span>
        </div>
      </td>
      <td>
        <div className="doctor-management-hours">
          <strong dir="ltr">{doc.open_time && doc.close_time ? `${doc.open_time} - ${doc.close_time}` : '-'}</strong>
          <span>{getWorkDaysLabel(doc)}</span>
        </div>
      </td>
      <td><DoctorStatusBadge active={active} isAr={isAr} /></td>
      <td>
        <span className="doctor-management-today">
          <CalendarClock size={14} />
          {todayCount}
        </span>
      </td>
      <td>
        {canDelete ? (
          <button className="doctor-management-icon-action danger" onClick={() => handleDelete(doc.id)} title={t('delete')} aria-label={t('delete')}>
            <Trash2 size={16} />
          </button>
        ) : (
          <span className="text-muted text-sm">-</span>
        )}
      </td>
    </tr>
  );
};

const DoctorManagementCard = ({
  doc,
  canDelete,
  getClinicLabel,
  getDoctorName,
  getInitial,
  getWorkDaysLabel,
  handleDelete,
  isAr,
  t,
  todayCount,
  user,
}) => {
  const active = doc.is_active !== false;
  return (
    <article className="doctor-management-card">
      <div className="doctor-management-card-head">
        <DoctorAvatar doc={doc} getInitial={getInitial} />
        <div>
          <h3>{getDoctorName(doc)}</h3>
          <span className="doctor-management-specialty">
            <Stethoscope size={14} />
            {t(doc.specialty) || doc.specialty || (isAr ? 'غير محدد' : 'Not set')}
          </span>
        </div>
        <DoctorStatusBadge active={active} isAr={isAr} />
      </div>
      <div className="doctor-management-card-grid">
        <span><Mail size={14} /> {doc.email || (isAr ? 'لا يوجد بريد' : 'No email')}</span>
        <span><Building2 size={14} /> {getClinicLabel(doc)}</span>
        <span><Clock size={14} /> <em dir="ltr">{doc.open_time && doc.close_time ? `${doc.open_time} - ${doc.close_time}` : '-'}</em></span>
        <span><MapPin size={14} /> {doc.clinic_address || (isAr ? 'العنوان غير محدد' : 'Address not set')}</span>
      </div>
      <div className="doctor-management-card-foot">
        <span><CalendarClock size={14} /> {isAr ? `مواعيد اليوم: ${todayCount}` : `Today: ${todayCount}`}</span>
        <span><CheckCircle2 size={14} /> {getWorkDaysLabel(doc)}</span>
      </div>
      <ContactActionsCard
        title={isAr ? 'تواصل سريع' : 'Quick Contact'}
        subtitle={isAr ? 'يستخدم رقم الطبيب إذا كان متاحاً في هذا السجل.' : 'Uses the doctor phone only when it is available on this authorized record.'}
        phone={doc.phone || doc.phone_number}
        whatsappMessage={buildContactMessage({
          type: 'staff',
          isAr,
          name: getDoctorName(doc),
        })}
        unavailableMessage={isAr ? 'لا يوجد رقم واتساب متاح لهذا الطبيب.' : 'No WhatsApp number is available for this doctor.'}
        actor={user}
        target={{ role: 'doctor', clinic_id: doc.clinic_id }}
        compact
      />
      {canDelete && (
        <button className="btn btn-outline doctor-management-delete" onClick={() => handleDelete(doc.id)}>
          <Trash2 size={16} /> {t('delete')}
        </button>
      )}
    </article>
  );
};

export default DoctorManagement;
