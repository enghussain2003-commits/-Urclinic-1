import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Edit3,
  KeyRound,
  Loader2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { specialties } from '../data/specialties';
import {
  APPOINTMENT_DURATIONS,
  IRAQI_GOVERNORATES,
  WORK_DAYS,
  callSuperAdmin,
  generateStrongPassword,
  passwordScore,
} from '../services/superAdminService';
import { supabase } from '../supabaseClient';
import ContactActionsCard from '../components/ContactActionsCard';
import { buildContactMessage } from '../services/contactService';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const emptyUserForm = {
  role: 'doctor',
  full_name: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
  specialty: 'general',
  diagnosis_description: '',
  fee: '',
  working_days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'],
  opening_time: '09:00',
  closing_time: '17:00',
  appointment_duration: 30,
  status: 'active',
};

const SuperAdminClinicDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [clinic, setClinic] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('overview');
  const [clinicForm, setClinicForm] = useState(null);
  const [userModal, setUserModal] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [oneTimeCredential, setOneTimeCredential] = useState(null);

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = isAr ? 'ar' : 'en';
  }, [isAr]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [clinicRes, profileRes, doctorRes, patientRes, appointmentRes] = await Promise.all([
        supabase.from('clinics').select('*').eq('id', id).single(),
        supabase.from('profiles').select('*').eq('clinic_id', id).order('created_at', { ascending: false }),
        supabase.from('doctors').select('*').eq('clinic_id', id).order('created_at', { ascending: false }),
        supabase.from('patients').select('id, clinic_id').eq('clinic_id', id),
        supabase.from('appointments').select('id, clinic_id, status').eq('clinic_id', id),
      ]);
      const firstError = [clinicRes, profileRes, doctorRes, patientRes, appointmentRes].find(res => res.error)?.error;
      if (firstError) throw firstError;
      setClinic(clinicRes.data);
      setClinicForm(normalizeClinic(clinicRes.data));
      setProfiles(profileRes.data || []);
      setDoctors(doctorRes.data || []);
      setPatients(patientRes.data || []);
      setAppointments(appointmentRes.data || []);
    } catch (err) {
      console.error('Super admin clinic load failed:', err);
      setError(getLocalizedErrorMessage(err, { isAr, fallback: 'load' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => load());
    return () => cancelAnimationFrame(frame);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const clinicAdmins = profiles.filter(p => p.role === 'clinic_admin');
  const employees = profiles.filter(p => p.role === 'employee');
  const doctorProfiles = profiles.filter(p => p.role === 'doctor');
  const completed = appointments.filter(a => a.status === 'completed').length;
  const cancelled = appointments.filter(a => ['cancelled', 'rejected'].includes(a.status)).length;

  const doctorRows = useMemo(() => doctors.map(doc => ({
    doctor: doc,
    profile: doctorProfiles.find(p => String(p.id) === String(doc.profile_id)),
  })), [doctorProfiles, doctors]);

  const runAction = async (action, payload, success) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await callSuperAdmin(action, payload);
      setMessage(success);
      await load();
      return true;
    } catch (err) {
      console.error('Super admin clinic action failed:', err);
      setError(getLocalizedErrorMessage(err, { isAr, fallback: 'request' }));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveClinic = async () => {
    await runAction('update_clinic', {
      clinic_id: id,
      ...clinicForm,
      default_consultation_fee: Number(clinicForm.default_consultation_fee),
      appointment_duration: Number(clinicForm.appointment_duration),
    }, isAr ? 'تم تحديث العيادة' : 'Clinic updated');
  };

  const setClinicStatus = async (nextStatus) => {
    await runAction('set_clinic_status', { clinic_id: id, status: nextStatus }, isAr ? 'تم تحديث حالة العيادة' : 'Clinic status updated');
  };

  const submitUser = async (event) => {
    event.preventDefault();
    if (passwordScore(userModal.password) < 3) {
      setError(isAr ? 'كلمة المرور ضعيفة' : 'Password is too weak');
      return;
    }
    const ok = await runAction('create_clinic_user', {
      clinic_id: id,
      ...userModal,
      fee: userModal.fee === '' ? clinicForm.default_consultation_fee : Number(userModal.fee),
      appointment_duration: Number(userModal.appointment_duration),
    }, isAr ? 'تم إنشاء الحساب' : 'Account created');
    if (ok) {
      setOneTimeCredential({ email: userModal.email, password: userModal.password, label: userModal.full_name });
      setUserModal(null);
    }
  };

  const submitEditUser = async (event) => {
    event.preventDefault();
    const ok = await runAction('update_managed_user', editUser, isAr ? 'تم تحديث الحساب' : 'Account updated');
    if (ok) setEditUser(null);
  };

  const submitReset = async (event) => {
    event.preventDefault();
    if (resetModal.password !== resetModal.confirm_password) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    if (passwordScore(resetModal.password) < 3) {
      setError(isAr ? 'كلمة المرور ضعيفة' : 'Password is too weak');
      return;
    }
    const ok = await runAction('reset_password', {
      user_id: resetModal.user_id,
      password: resetModal.password,
      confirm_password: resetModal.confirm_password,
    }, isAr ? 'تمت إعادة تعيين كلمة المرور' : 'Password reset');
    if (ok) {
      setOneTimeCredential({ email: resetModal.email, password: resetModal.password, label: resetModal.name });
      setResetModal(null);
    }
  };

  if (loading) return <div className="super-admin-page"><div className="super-admin-loading"><span /><span /><span /></div></div>;
  if (!clinic) return <div className="super-admin-page"><div className="super-admin-empty">{isAr ? 'العيادة غير موجودة' : 'Clinic not found'}</div></div>;

  const tabs = [
    { id: 'overview', label: isAr ? 'معلومات العيادة' : 'Clinic info' },
    { id: 'admins', label: isAr ? 'مديرو العيادة' : 'Clinic Admins' },
    { id: 'doctors', label: isAr ? 'الأطباء' : 'Doctors' },
    { id: 'employees', label: isAr ? 'الموظفون' : 'Employees' },
  ];

  return (
    <div className="super-admin-page animate-in">
      <section className="super-admin-hero">
        <div>
          <button className="super-admin-back" onClick={() => navigate('/dashboard/super-admin/clinics')}><ArrowLeft size={16} /> {isAr ? 'العيادات' : 'Clinics'}</button>
          <span><Building2 size={16} /> {clinic.governorate || (isAr ? 'غير محدد' : 'Not set')}</span>
          <h1>{clinic.name}</h1>
          <p>{clinic.address || '-'}</p>
        </div>
        <button className={`btn ${clinic.is_active === false ? 'btn-primary' : 'btn-outline'}`} disabled={busy} onClick={() => setClinicStatus(clinic.is_active === false ? 'active' : 'suspended')}>
          {clinic.is_active === false ? <ShieldCheck size={17} /> : <ShieldAlert size={17} />}
          {clinic.is_active === false ? (isAr ? 'تفعيل العيادة' : 'Activate clinic') : (isAr ? 'تعليق العيادة' : 'Suspend clinic')}
        </button>
      </section>

      {error && <div className="super-admin-alert super-admin-alert--error">{error}</div>}
      {message && <div className="super-admin-alert super-admin-alert--success">{message}</div>}
      {oneTimeCredential && <OneTimeCredential data={oneTimeCredential} isAr={isAr} onClose={() => setOneTimeCredential(null)} />}

      <section className="super-admin-stats">
        <Stat icon={<Stethoscope />} label={isAr ? 'الأطباء' : 'Doctors'} value={doctors.length} />
        <Stat icon={<Users />} label={isAr ? 'الموظفون' : 'Employees'} value={employees.length} />
        <Stat icon={<Users />} label={isAr ? 'المرضى' : 'Patients'} value={patients.length} />
        <Stat icon={<CalendarDays />} label={isAr ? 'المواعيد' : 'Appointments'} value={appointments.length} />
        <Stat icon={<CheckCircle2 />} label={isAr ? 'مكتملة' : 'Completed'} value={completed} />
        <Stat icon={<ShieldAlert />} label={isAr ? 'ملغاة/مرفوضة' : 'Cancelled'} value={cancelled} />
      </section>

      <nav className="super-admin-tabs">
        {tabs.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </nav>

      {tab === 'overview' && clinicForm && (
        <section className="super-admin-card">
          <div className="super-admin-card-head"><span><Edit3 /></span><h2>{isAr ? 'تعديل معلومات العيادة' : 'Edit clinic information'}</h2></div>
          <ContactActionsCard
            title={isAr ? 'تواصل مع العيادة' : 'Contact clinic'}
            subtitle={isAr ? 'رقم العيادة الرسمي، بدون كشف أرقام شخصية.' : 'Official clinic number without exposing personal staff phones.'}
            phone={clinicForm.phone}
            whatsappMessage={buildContactMessage({ type: 'support', isAr })}
            compact
          />
          <div className="super-admin-form-grid">
            <Field label={isAr ? 'اسم العيادة' : 'Clinic name'} value={clinicForm.name} onChange={v => setClinicForm({ ...clinicForm, name: v })} />
            <SelectField label={isAr ? 'المحافظة' : 'Governorate'} value={clinicForm.governorate} onChange={v => setClinicForm({ ...clinicForm, governorate: v })} options={IRAQI_GOVERNORATES.map(g => ({ value: g.id, label: isAr ? g.ar : g.en }))} />
            <Field label={isAr ? 'العنوان' : 'Address'} value={clinicForm.address} onChange={v => setClinicForm({ ...clinicForm, address: v })} wide />
            <Field label={isAr ? 'الهاتف' : 'Phone'} value={clinicForm.phone} onChange={v => setClinicForm({ ...clinicForm, phone: v })} />
            <Field label={isAr ? 'الكشفية الافتراضية' : 'Default fee'} type="number" value={clinicForm.default_consultation_fee} onChange={v => setClinicForm({ ...clinicForm, default_consultation_fee: v })} />
            <Field label={isAr ? 'وقت الفتح' : 'Opening time'} type="time" value={clinicForm.opening_time} onChange={v => setClinicForm({ ...clinicForm, opening_time: v })} />
            <Field label={isAr ? 'وقت الإغلاق' : 'Closing time'} type="time" value={clinicForm.closing_time} onChange={v => setClinicForm({ ...clinicForm, closing_time: v })} />
            <SelectField label={isAr ? 'مدة الموعد' : 'Appointment duration'} value={clinicForm.appointment_duration} onChange={v => setClinicForm({ ...clinicForm, appointment_duration: Number(v) })} options={APPOINTMENT_DURATIONS.map(v => ({ value: v, label: `${v} ${isAr ? 'دقيقة' : 'min'}` }))} />
            <DayPicker isAr={isAr} days={clinicForm.working_days} onToggle={day => setClinicForm(prev => ({ ...prev, working_days: prev.working_days.includes(day) ? prev.working_days.filter(d => d !== day) : [...prev.working_days, day] }))} />
          </div>
          <div className="super-admin-submit-row"><button className="btn btn-primary" disabled={busy} onClick={saveClinic}>{busy ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />} {isAr ? 'حفظ العيادة' : 'Save clinic'}</button></div>
        </section>
      )}

      {tab === 'admins' && <AccountList title={isAr ? 'مديرو العيادة' : 'Clinic Admins'} rows={clinicAdmins} isAr={isAr} onEdit={setEditUser} onReset={setResetModalFromProfile(setResetModal)} onStatus={runUserStatus(runAction, isAr)} />}
      {tab === 'doctors' && (
        <AccountList
          title={isAr ? 'الأطباء' : 'Doctors'}
          rows={doctorRows.map(r => ({ ...r.profile, doctor: r.doctor }))}
          isAr={isAr}
          onEdit={(row) => setEditUser({ ...row, ...row.doctor, user_id: row.id, phone: row.phone_number || '' })}
          onReset={setResetModalFromProfile(setResetModal)}
          onStatus={runUserStatus(runAction, isAr)}
          extraAction={<button className="btn btn-primary" onClick={() => setUserModal({ ...emptyUserForm, role: 'doctor', fee: clinicForm.default_consultation_fee })}><Plus size={17} /> {isAr ? 'إضافة طبيب' : 'Add Doctor'}</button>}
        />
      )}
      {tab === 'employees' && (
        <AccountList
          title={isAr ? 'الموظفون' : 'Employees'}
          rows={employees}
          isAr={isAr}
          onEdit={(row) => setEditUser({ ...row, user_id: row.id, phone: row.phone_number || '' })}
          onReset={setResetModalFromProfile(setResetModal)}
          onStatus={runUserStatus(runAction, isAr)}
          extraAction={<button className="btn btn-primary" onClick={() => setUserModal({ ...emptyUserForm, role: 'employee' })}><Plus size={17} /> {isAr ? 'إضافة موظف' : 'Add Employee'}</button>}
        />
      )}

      {userModal && <UserModal isAr={isAr} t={t} form={userModal} setForm={setUserModal} onSubmit={submitUser} busy={busy} onClose={() => setUserModal(null)} />}
      {editUser && <EditUserModal isAr={isAr} t={t} form={editUser} setForm={setEditUser} onSubmit={submitEditUser} busy={busy} onClose={() => setEditUser(null)} />}
      {resetModal && <ResetModal isAr={isAr} modal={resetModal} setModal={setResetModal} onSubmit={submitReset} busy={busy} onClose={() => setResetModal(null)} />}
    </div>
  );
};

const normalizeClinic = (clinic) => {
  const hours = clinic?.working_hours || {};
  return {
    name: clinic?.name || '',
    governorate: clinic?.governorate || 'Baghdad',
    address: clinic?.address || '',
    phone: clinic?.phone || '',
    default_consultation_fee: clinic?.default_consultation_fee ?? 0,
    working_days: Array.isArray(clinic?.working_days) ? clinic.working_days : ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'],
    opening_time: clinic?.opening_time || hours.start || '09:00',
    closing_time: clinic?.closing_time || hours.end || '17:00',
    appointment_duration: clinic?.appointment_duration || clinic?.default_appointment_duration || 30,
    status: clinic?.is_active === false ? 'suspended' : 'active',
  };
};

const Stat = ({ icon, label, value }) => <div className="super-admin-stat"><span>{icon}</span><p>{label}</p><strong>{value}</strong></div>;
const Field = ({ label, value, onChange, type = 'text', wide = false }) => <label className={`form-group ${wide ? 'super-admin-wide' : ''}`}><span className="form-label">{label}</span><input className="input" type={type} value={value || ''} onChange={e => onChange(e.target.value)} /></label>;
const SelectField = ({ label, value, onChange, options }) => <label className="form-group"><span className="form-label">{label}</span><select className="input" value={value || ''} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
const DayPicker = ({ isAr, days, onToggle }) => <div className="super-admin-wide"><span className="form-label">{isAr ? 'أيام الدوام' : 'Working days'}</span><div className="super-admin-days">{WORK_DAYS.map(d => <button key={d.id} type="button" className={days?.includes(d.id) ? 'active' : ''} onClick={() => onToggle(d.id)}>{isAr ? d.ar : d.en}</button>)}</div></div>;

const setResetModalFromProfile = (setter) => (profile) => {
  const password = generateStrongPassword();
  setter({ user_id: profile.id, name: profile.full_name, email: profile.email, password, confirm_password: password });
};

const runUserStatus = (runAction, isAr) => async (profile, status) => {
  await runAction('set_user_status', { user_id: profile.id, status }, isAr ? 'تم تحديث حالة الحساب' : 'Account status updated');
};

const AccountList = ({ title, rows, isAr, onEdit, onReset, onStatus, extraAction }) => (
  <section className="super-admin-card super-admin-card--flush">
    <div className="super-admin-card-head">
      <span><UserCog /></span>
      <h2>{title}</h2>
      {extraAction}
    </div>
    {rows.length === 0 ? (
      <div className="super-admin-empty"><Users size={30} /><p>{isAr ? 'لا توجد حسابات.' : 'No accounts yet.'}</p></div>
    ) : (
      <div className="super-admin-account-grid">
        {rows.map(row => <AccountCard key={row.id} row={row} isAr={isAr} onEdit={onEdit} onReset={onReset} onStatus={onStatus} />)}
      </div>
    )}
  </section>
);

const AccountCard = ({ row, isAr, onEdit, onReset, onStatus }) => {
  const suspended = row.status === 'suspended';
  const contactPhone = row.phone_number || row.phone || row.doctor?.phone;
  return (
    <article className="super-admin-account-card">
      <div>
        <span>{(row.full_name || '?').charAt(0).toUpperCase()}</span>
        <div><strong>{row.full_name || '-'}</strong><small>{row.email || '-'}</small></div>
        <em className={suspended ? 'suspended' : 'active'}>{suspended ? (isAr ? 'معلق' : 'Suspended') : (isAr ? 'نشط' : 'Active')}</em>
      </div>
      <p>{row.role === 'doctor' ? row.doctor?.specialty : row.role}</p>
      <ContactActionsCard
        title={isAr ? 'تواصل سريع' : 'Quick Contact'}
        subtitle={isAr ? 'رقم الحساب ضمن هذه العيادة.' : 'Account phone within this clinic.'}
        phone={contactPhone}
        whatsappMessage={buildContactMessage({
          type: 'staff',
          isAr,
          name: row.full_name,
        })}
        actor={{ role: 'super_admin' }}
        target={{ role: row.role }}
        compact
      />
      <div className="super-admin-account-actions">
        <button className="btn btn-sm btn-outline" onClick={() => onEdit(row)}><Edit3 size={14} /> {isAr ? 'تعديل' : 'Edit'}</button>
        <button className="btn btn-sm btn-outline" onClick={() => onReset(row)}><KeyRound size={14} /> {isAr ? 'كلمة المرور' : 'Reset'}</button>
        <button className="btn btn-sm btn-outline" onClick={() => onStatus(row, suspended ? 'active' : 'suspended')}>{suspended ? (isAr ? 'تفعيل' : 'Activate') : (isAr ? 'تعليق' : 'Suspend')}</button>
      </div>
    </article>
  );
};

const UserModal = ({ isAr, t, form, setForm, onSubmit, busy, onClose }) => (
  <Modal title={form.role === 'doctor' ? (isAr ? 'إضافة طبيب' : 'Add Doctor') : (isAr ? 'إضافة موظف' : 'Add Employee')} onClose={onClose}>
    <form onSubmit={onSubmit} className="super-admin-form-grid">
      <Field label={isAr ? 'الاسم الكامل' : 'Full name'} value={form.full_name} onChange={v => setForm({ ...form, full_name: v })} />
      <Field label={isAr ? 'البريد الإلكتروني' : 'Email'} type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
      <Field label={isAr ? 'الهاتف' : 'Phone'} value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
      {form.role === 'doctor' && <DoctorFields isAr={isAr} t={t} form={form} setForm={setForm} />}
      <Field label={isAr ? 'كلمة المرور المؤقتة' : 'Temporary password'} type="text" value={form.password} onChange={v => setForm({ ...form, password: v })} />
      <Field label={isAr ? 'تأكيد كلمة المرور' : 'Confirm password'} type="text" value={form.confirm_password} onChange={v => setForm({ ...form, confirm_password: v })} />
      <div className="super-admin-tool-row super-admin-wide">
        <button type="button" className="btn btn-outline" onClick={() => { const p = generateStrongPassword(); setForm({ ...form, password: p, confirm_password: p }); }}><KeyRound size={16} /> {isAr ? 'توليد كلمة مرور' : 'Generate password'}</button>
        <button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} {isAr ? 'إنشاء الحساب' : 'Create account'}</button>
      </div>
    </form>
  </Modal>
);

const DoctorFields = ({ isAr, t, form, setForm }) => (
  <>
    <SelectField label={isAr ? 'التخصص' : 'Specialty'} value={form.specialty} onChange={v => setForm({ ...form, specialty: v })} options={specialties.map(s => ({ value: s.id, label: t(s.id) || s.id }))} />
    <Field label={isAr ? 'وصف الخدمة' : 'Service description'} value={form.diagnosis_description} onChange={v => setForm({ ...form, diagnosis_description: v })} wide />
    <Field label={isAr ? 'الكشفية' : 'Fee'} type="number" value={form.fee} onChange={v => setForm({ ...form, fee: v })} />
    <Field label={isAr ? 'وقت الفتح' : 'Opening time'} type="time" value={form.opening_time} onChange={v => setForm({ ...form, opening_time: v })} />
    <Field label={isAr ? 'وقت الإغلاق' : 'Closing time'} type="time" value={form.closing_time} onChange={v => setForm({ ...form, closing_time: v })} />
    <SelectField label={isAr ? 'مدة الموعد' : 'Appointment duration'} value={form.appointment_duration} onChange={v => setForm({ ...form, appointment_duration: Number(v) })} options={APPOINTMENT_DURATIONS.map(v => ({ value: v, label: `${v} ${isAr ? 'دقيقة' : 'min'}` }))} />
    <DayPicker isAr={isAr} days={form.working_days} onToggle={day => setForm(prev => ({ ...prev, working_days: prev.working_days.includes(day) ? prev.working_days.filter(d => d !== day) : [...prev.working_days, day] }))} />
  </>
);

const EditUserModal = ({ isAr, t, form, setForm, onSubmit, busy, onClose }) => (
  <Modal title={isAr ? 'تعديل الحساب' : 'Edit account'} onClose={onClose}>
    <form onSubmit={onSubmit} className="super-admin-form-grid">
      <Field label={isAr ? 'الاسم الكامل' : 'Full name'} value={form.full_name} onChange={v => setForm({ ...form, full_name: v })} />
      <Field label={isAr ? 'البريد الإلكتروني' : 'Email'} type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
      <Field label={isAr ? 'الهاتف' : 'Phone'} value={form.phone} onChange={v => setForm({ ...form, phone: v, phone_number: v })} />
      {form.role === 'doctor' && <DoctorFields isAr={isAr} t={t} form={form} setForm={setForm} />}
      <div className="super-admin-submit-row super-admin-wide"><button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />} {isAr ? 'حفظ' : 'Save'}</button></div>
    </form>
  </Modal>
);

const ResetModal = ({ isAr, modal, setModal, onSubmit, busy, onClose }) => (
  <Modal title={isAr ? 'إعادة تعيين كلمة المرور' : 'Reset Password'} onClose={onClose}>
    <form onSubmit={onSubmit} className="super-admin-form-grid">
      <div className="super-admin-wide super-admin-alert"><strong>{modal.name}</strong><br /><span dir="ltr">{modal.email}</span></div>
      <Field label={isAr ? 'كلمة المرور المؤقتة' : 'New temporary password'} type="text" value={modal.password} onChange={v => setModal({ ...modal, password: v })} />
      <Field label={isAr ? 'تأكيد كلمة المرور' : 'Confirm password'} type="text" value={modal.confirm_password} onChange={v => setModal({ ...modal, confirm_password: v })} />
      <div className="super-admin-tool-row super-admin-wide">
        <button type="button" className="btn btn-outline" onClick={() => { const p = generateStrongPassword(); setModal({ ...modal, password: p, confirm_password: p }); }}><KeyRound size={16} /> {isAr ? 'توليد' : 'Generate'}</button>
        <button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />} {isAr ? 'إعادة التعيين' : 'Reset password'}</button>
      </div>
    </form>
  </Modal>
);

const OneTimeCredential = ({ data, isAr, onClose }) => {
  const copy = value => navigator.clipboard?.writeText(value);
  return <div className="super-admin-result"><strong>{isAr ? 'بيانات مؤقتة تظهر مرة واحدة' : 'Temporary credential shown once'}</strong><p>{data.label}</p><code>{data.password}</code><div className="super-admin-tool-row"><button className="btn btn-outline" onClick={() => copy(data.email)}><Clipboard size={14} /> Email</button><button className="btn btn-outline" onClick={() => copy(data.password)}><Clipboard size={14} /> Password</button><button className="btn btn-primary" onClick={onClose}>{isAr ? 'إغلاق' : 'Close'}</button></div></div>;
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-overlay super-admin-modal-overlay">
    <div className="super-admin-modal">
      <div className="super-admin-modal-head"><h2>{title}</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button></div>
      {children}
    </div>
  </div>
);

export default SuperAdminClinicDetails;
