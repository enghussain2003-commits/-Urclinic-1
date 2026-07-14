import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Clipboard,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Stethoscope,
  UserCog,
} from 'lucide-react';
import { specialties } from '../data/specialties';
import {
  APPOINTMENT_DURATIONS,
  IRAQI_GOVERNORATES,
  WORK_DAYS,
  callSuperAdmin,
  generateStrongPassword,
  normalizeGovernorate,
  passwordScore,
} from '../services/superAdminService';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const baseClinic = {
  name: '',
  governorate: 'Baghdad',
  address: '',
  phone: '',
  default_consultation_fee: '25',
  working_days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'],
  opening_time: '09:00',
  closing_time: '17:00',
  appointment_duration: 30,
  status: 'active',
};

const baseAdmin = {
  full_name: '',
  email: '',
  password: '',
  confirm_password: '',
  phone: '',
  status: 'active',
};

const baseDoctor = {
  full_name: '',
  email: '',
  password: '',
  confirm_password: '',
  phone: '',
  specialty: 'general',
  diagnosis_description: '',
  fee: '',
  working_days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'],
  opening_time: '09:00',
  closing_time: '17:00',
  appointment_duration: 30,
  status: 'active',
};

const SuperAdminClinicProvision = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const [clinic, setClinic] = useState(baseClinic);
  const [clinicAdmin, setClinicAdmin] = useState(baseAdmin);
  const [doctor, setDoctor] = useState(baseDoctor);
  const [skipDoctor, setSkipDoctor] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const adminStrength = passwordScore(clinicAdmin.password);
  const doctorStrength = passwordScore(doctor.password);

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = isAr ? 'ar' : 'en';
  }, [isAr]);

  const update = (setter) => (key, value) => setter(prev => ({ ...prev, [key]: value }));
  const updateClinic = update(setClinic);
  const updateAdmin = update(setClinicAdmin);
  const updateDoctor = update(setDoctor);

  const toggleDay = (target, setter, day) => {
    setter(prev => {
      const current = prev[target] || [];
      return {
        ...prev,
        [target]: current.includes(day) ? current.filter(item => item !== day) : [...current, day],
      };
    });
  };

  const validate = () => {
    const required = [
      [clinic.name, isAr ? 'اسم العيادة مطلوب' : 'Clinic name is required'],
      [normalizeGovernorate(clinic.governorate), isAr ? 'المحافظة مطلوبة' : 'Governorate is required'],
      [clinic.address, isAr ? 'عنوان العيادة مطلوب' : 'Clinic address is required'],
      [clinicAdmin.full_name, isAr ? 'اسم مدير العيادة مطلوب' : 'Clinic Admin name is required'],
      [clinicAdmin.email, isAr ? 'بريد مدير العيادة مطلوب' : 'Clinic Admin email is required'],
      [clinicAdmin.password, isAr ? 'كلمة مرور مدير العيادة مطلوبة' : 'Clinic Admin password is required'],
    ];
    if (!skipDoctor) {
      required.push(
        [doctor.full_name, isAr ? 'اسم الطبيب مطلوب' : 'Doctor name is required'],
        [doctor.email, isAr ? 'بريد الطبيب مطلوب' : 'Doctor email is required'],
        [doctor.password, isAr ? 'كلمة مرور الطبيب مطلوبة' : 'Doctor password is required'],
        [doctor.specialty, isAr ? 'تخصص الطبيب مطلوب' : 'Doctor specialty is required'],
      );
    }
    const missing = required.find(([value]) => !String(value || '').trim());
    if (missing) return missing[1];
    if (clinicAdmin.password !== clinicAdmin.confirm_password) return isAr ? 'كلمتا مرور مدير العيادة غير متطابقتين' : 'Clinic Admin passwords do not match';
    if (adminStrength < 3) return isAr ? 'كلمة مرور مدير العيادة ضعيفة' : 'Clinic Admin password is too weak';
    if (!skipDoctor && doctor.password !== doctor.confirm_password) return isAr ? 'كلمتا مرور الطبيب غير متطابقتين' : 'Doctor passwords do not match';
    if (!skipDoctor && doctorStrength < 3) return isAr ? 'كلمة مرور الطبيب ضعيفة' : 'Doctor password is too weak';
    if (!clinic.working_days.length || (!skipDoctor && !doctor.working_days.length)) return isAr ? 'اختر أيام دوام واحدة على الأقل' : 'Select at least one working day';
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        clinic: {
          ...clinic,
          default_consultation_fee: Number(clinic.default_consultation_fee),
          appointment_duration: Number(clinic.appointment_duration),
        },
        clinic_admin: clinicAdmin,
        skip_doctor: skipDoctor,
        doctor: skipDoctor ? null : {
          ...doctor,
          fee: doctor.fee === '' ? Number(clinic.default_consultation_fee) : Number(doctor.fee),
          appointment_duration: Number(doctor.appointment_duration),
        },
      };
      const response = await callSuperAdmin('provision_clinic', payload);
      setResult({
        ...response,
        clinicName: clinic.name,
        clinicAdminEmail: clinicAdmin.email,
        clinicAdminPassword: clinicAdmin.password,
        doctorEmail: skipDoctor ? '' : doctor.email,
        doctorPassword: skipDoctor ? '' : doctor.password,
      });
      setClinic(baseClinic);
      setClinicAdmin(baseAdmin);
      setDoctor(baseDoctor);
      setSkipDoctor(false);
    } catch (err) {
      console.error('Clinic provisioning failed:', err);
      setError(getLocalizedErrorMessage(err, { isAr, fallback: 'request' }));
    } finally {
      setSubmitting(false);
    }
  };

  const doctorFeeLabel = useMemo(() =>
    doctor.fee === '' ? `${clinic.default_consultation_fee || 0}` : doctor.fee,
  [doctor.fee, clinic.default_consultation_fee]);

  return (
    <div className="super-admin-page animate-in">
      <section className="super-admin-hero">
        <div>
          <span><ShieldCheck size={16} /> {isAr ? 'المشرف العام فقط' : 'Super Admin only'}</span>
          <h1>{isAr ? 'إضافة عيادة جديدة' : 'Add New Clinic'}</h1>
          <p>{isAr ? 'أنشئ العيادة وحساب مدير العيادة وأول طبيب بدون تبديل جلسة المشرف.' : 'Provision a clinic, its Clinic Admin, and first doctor without replacing the Super Admin session.'}</p>
        </div>
      </section>

      {error && <div className="super-admin-alert super-admin-alert--error">{error}</div>}
      {result && <CredentialsResult result={result} isAr={isAr} onClose={() => setResult(null)} onOpenClinic={() => navigate(`/dashboard/super-admin/clinics/${result.clinic_id}`)} />}

      <form onSubmit={handleSubmit} className="super-admin-provision-grid">
        <ProvisionSection icon={<Building2 />} title={isAr ? 'معلومات العيادة' : 'Clinic information'}>
          <Field label={isAr ? 'اسم العيادة' : 'Clinic name'} required value={clinic.name} onChange={value => updateClinic('name', value)} />
          <SelectField label={isAr ? 'المحافظة' : 'Governorate'} value={clinic.governorate} onChange={value => updateClinic('governorate', value)} options={IRAQI_GOVERNORATES.map(g => ({ value: g.id, label: isAr ? g.ar : g.en }))} />
          <Field label={isAr ? 'العنوان التفصيلي' : 'Detailed address'} required value={clinic.address} onChange={value => updateClinic('address', value)} wide />
          <Field label={isAr ? 'هاتف العيادة' : 'Clinic phone'} value={clinic.phone} onChange={value => updateClinic('phone', value)} />
          <Field label={isAr ? 'الكشفية الافتراضية' : 'Default consultation fee'} required type="number" value={clinic.default_consultation_fee} onChange={value => updateClinic('default_consultation_fee', value)} />
          <TimeGrid isAr={isAr} open={clinic.opening_time} close={clinic.closing_time} duration={clinic.appointment_duration} setOpen={value => updateClinic('opening_time', value)} setClose={value => updateClinic('closing_time', value)} setDuration={value => updateClinic('appointment_duration', Number(value))} />
          <DayPicker isAr={isAr} days={clinic.working_days} onToggle={day => toggleDay('working_days', setClinic, day)} />
        </ProvisionSection>

        <ProvisionSection icon={<UserCog />} title={isAr ? 'حساب مدير العيادة' : 'Clinic Admin account'}>
          <Field label={isAr ? 'الاسم الكامل' : 'Full name'} required value={clinicAdmin.full_name} onChange={value => updateAdmin('full_name', value)} />
          <Field label={isAr ? 'البريد الإلكتروني' : 'Email'} required type="email" value={clinicAdmin.email} onChange={value => updateAdmin('email', value)} />
          <Field label={isAr ? 'رقم الهاتف' : 'Phone'} value={clinicAdmin.phone} onChange={value => updateAdmin('phone', value)} />
          <PasswordFields isAr={isAr} account={clinicAdmin} update={updateAdmin} show={showPasswords} strength={adminStrength} />
          <PasswordTools isAr={isAr} onGenerate={() => {
            const password = generateStrongPassword();
            setClinicAdmin(prev => ({ ...prev, password, confirm_password: password }));
          }} show={showPasswords} setShow={setShowPasswords} />
        </ProvisionSection>

        <ProvisionSection icon={<Stethoscope />} title={isAr ? 'حساب أول طبيب' : 'First Doctor account'}>
          <label className="super-admin-check">
            <input type="checkbox" checked={skipDoctor} onChange={event => setSkipDoctor(event.target.checked)} />
            <span>{isAr ? 'تخطي إنشاء الطبيب حالياً' : 'Skip first doctor for now'}</span>
          </label>
          {!skipDoctor && (
            <>
              <Field label={isAr ? 'الاسم الكامل' : 'Full name'} required value={doctor.full_name} onChange={value => updateDoctor('full_name', value)} />
              <Field label={isAr ? 'البريد الإلكتروني' : 'Email'} required type="email" value={doctor.email} onChange={value => updateDoctor('email', value)} />
              <Field label={isAr ? 'رقم الهاتف' : 'Phone'} value={doctor.phone} onChange={value => updateDoctor('phone', value)} />
              <SelectField label={isAr ? 'التخصص' : 'Specialty'} value={doctor.specialty} onChange={value => updateDoctor('specialty', value)} options={specialties.map(s => ({ value: s.id, label: t(s.id) || s.id }))} />
              <Field label={isAr ? 'وصف الخدمة/التشخيص' : 'Service description'} value={doctor.diagnosis_description} onChange={value => updateDoctor('diagnosis_description', value)} wide />
              <Field label={`${isAr ? 'كشفية الطبيب' : 'Doctor fee'} (${doctorFeeLabel})`} type="number" value={doctor.fee} onChange={value => updateDoctor('fee', value)} />
              <TimeGrid isAr={isAr} open={doctor.opening_time} close={doctor.closing_time} duration={doctor.appointment_duration} setOpen={value => updateDoctor('opening_time', value)} setClose={value => updateDoctor('closing_time', value)} setDuration={value => updateDoctor('appointment_duration', Number(value))} />
              <DayPicker isAr={isAr} days={doctor.working_days} onToggle={day => toggleDay('working_days', setDoctor, day)} />
              <PasswordFields isAr={isAr} account={doctor} update={updateDoctor} show={showPasswords} strength={doctorStrength} />
              <button type="button" className="btn btn-outline" onClick={() => {
                const password = generateStrongPassword();
                setDoctor(prev => ({ ...prev, password, confirm_password: password }));
              }}>
                <KeyRound size={16} /> {isAr ? 'توليد كلمة مرور للطبيب' : 'Generate doctor password'}
              </button>
            </>
          )}
        </ProvisionSection>

        <div className="super-admin-submit-row">
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? <Loader2 size={18} className="spin" /> : <CheckCircle2 size={18} />}
            {submitting ? (isAr ? 'جارٍ الإنشاء...' : 'Provisioning...') : (isAr ? 'إنشاء العيادة والحسابات' : 'Provision clinic and accounts')}
          </button>
        </div>
      </form>
    </div>
  );
};

const ProvisionSection = ({ icon, title, children }) => (
  <section className="super-admin-card">
    <div className="super-admin-card-head">
      <span>{icon}</span>
      <h2>{title}</h2>
    </div>
    <div className="super-admin-form-grid">{children}</div>
  </section>
);

const Field = ({ label, value, onChange, type = 'text', required = false, wide = false }) => (
  <label className={`form-group ${wide ? 'super-admin-wide' : ''}`}>
    <span className="form-label">{label}{required ? ' *' : ''}</span>
    <input className="input" type={type} value={value} onChange={event => onChange(event.target.value)} required={required} />
  </label>
);

const SelectField = ({ label, value, onChange, options }) => (
  <label className="form-group">
    <span className="form-label">{label} *</span>
    <select className="input" value={value} onChange={event => onChange(event.target.value)} required>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
);

const TimeGrid = ({ isAr, open, close, duration, setOpen, setClose, setDuration }) => (
  <>
    <Field label={isAr ? 'وقت الفتح' : 'Opening time'} type="time" value={open} onChange={setOpen} />
    <Field label={isAr ? 'وقت الإغلاق' : 'Closing time'} type="time" value={close} onChange={setClose} />
    <SelectField label={isAr ? 'مدة الموعد' : 'Appointment duration'} value={duration} onChange={setDuration} options={APPOINTMENT_DURATIONS.map(value => ({ value, label: `${value} ${isAr ? 'دقيقة' : 'min'}` }))} />
  </>
);

const DayPicker = ({ isAr, days, onToggle }) => (
  <div className="super-admin-wide">
    <span className="form-label">{isAr ? 'أيام الدوام' : 'Working days'} *</span>
    <div className="super-admin-days">
      {WORK_DAYS.map(day => (
        <button key={day.id} type="button" className={days.includes(day.id) ? 'active' : ''} onClick={() => onToggle(day.id)}>
          {isAr ? day.ar : day.en}
        </button>
      ))}
    </div>
  </div>
);

const PasswordFields = ({ isAr, account, update, show, strength }) => (
  <>
    <Field label={isAr ? 'كلمة المرور المؤقتة' : 'Temporary password'} required type={show ? 'text' : 'password'} value={account.password} onChange={value => update('password', value)} />
    <Field label={isAr ? 'تأكيد كلمة المرور' : 'Confirm password'} required type={show ? 'text' : 'password'} value={account.confirm_password} onChange={value => update('confirm_password', value)} />
    <div className="super-admin-password-strength">
      <span style={{ width: `${Math.max(strength, 1) * 20}%` }} />
      <em>{isAr ? 'قوة كلمة المرور' : 'Password strength'}</em>
    </div>
  </>
);

const PasswordTools = ({ isAr, onGenerate, show, setShow }) => (
  <div className="super-admin-wide super-admin-tool-row">
    <button type="button" className="btn btn-outline" onClick={onGenerate}>
      <KeyRound size={16} /> {isAr ? 'توليد كلمة مرور قوية' : 'Generate strong password'}
    </button>
    <button type="button" className="btn btn-ghost" onClick={() => setShow(!show)}>
      {show ? <EyeOff size={16} /> : <Eye size={16} />} {show ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}
    </button>
  </div>
);

const CredentialsResult = ({ result, isAr, onClose, onOpenClinic }) => {
  const copy = (value) => navigator.clipboard?.writeText(value);
  return (
    <div className="super-admin-result">
      <div>
        <CheckCircle2 size={22} />
        <strong>{isAr ? 'تم إنشاء العيادة بنجاح' : 'Clinic provisioned successfully'}</strong>
        <p>{isAr ? 'اعرض كلمات المرور المؤقتة مرة واحدة فقط ثم سلّمها لصاحب الحساب.' : 'Temporary passwords are shown once here. Provide them securely to the account owners.'}</p>
      </div>
      <div className="super-admin-result-grid">
        <CredentialLine label={isAr ? 'مدير العيادة' : 'Clinic Admin'} email={result.clinicAdminEmail} password={result.clinicAdminPassword} copy={copy} />
        {result.doctorEmail && <CredentialLine label={isAr ? 'الطبيب' : 'Doctor'} email={result.doctorEmail} password={result.doctorPassword} copy={copy} />}
      </div>
      <div className="super-admin-tool-row">
        <button className="btn btn-primary" type="button" onClick={onOpenClinic}>{isAr ? 'فتح تفاصيل العيادة' : 'Open clinic details'}</button>
        <button className="btn btn-outline" type="button" onClick={onClose}>{isAr ? 'إغلاق' : 'Close'}</button>
      </div>
    </div>
  );
};

const CredentialLine = ({ label, email, password, copy }) => (
  <div className="super-admin-credential">
    <strong>{label}</strong>
    <span dir="ltr">{email}</span>
    <code>{password}</code>
    <div>
      <button type="button" className="btn btn-sm btn-outline" onClick={() => copy(email)}><Clipboard size={14} /> Email</button>
      <button type="button" className="btn btn-sm btn-outline" onClick={() => copy(password)}><Clipboard size={14} /> Password</button>
    </div>
  </div>
);

export default SuperAdminClinicProvision;
