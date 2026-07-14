import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  CalendarX2,
  CheckCircle2,
  Edit3,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  UserRoundCog,
  X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  IRAQI_GOVERNORATES,
  callSuperAdmin,
  generateStrongPassword,
  passwordScore,
} from '../services/superAdminService';
import { useToast } from '../hooks/useToast';

const ACTIVE_STATUSES = ['pending', 'approved', 'confirmed', 'in_progress'];

const SuperAdminPatientDetails = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const toast = useToast();
  const isAr = i18n.language === 'ar';
  const [profile, setProfile] = useState(null);
  const [patientRows, setPatientRows] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [notifyModal, setNotifyModal] = useState(null);
  const [oneTimeCredential, setOneTimeCredential] = useState(null);

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = isAr ? 'ar' : 'en';
  }, [isAr]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileRes, patientRes, clinicRes, doctorRes, auditRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, phone_number, role, status, governorate, address, created_at, updated_at, must_change_password').eq('id', patientId).single(),
        supabase.from('patients').select('*').eq('auth_user_id', patientId).order('created_at', { ascending: false }),
        supabase.from('clinics').select('id, name, governorate, address'),
        supabase.from('doctors').select('id, clinic_id, profile_id, full_name, specialty'),
        supabase.from('support_audit_logs').select('*').eq('target_user_id', patientId).order('created_at', { ascending: false }).limit(20),
      ]);
      const firstError = [profileRes, patientRes, clinicRes, doctorRes, auditRes].find(res => res.error)?.error;
      if (firstError) throw firstError;
      const rows = patientRes.data || [];
      let apptRows = [];
      if (rows.length) {
        const { data, error: apptError } = await supabase
          .from('appointments')
          .select('*')
          .in('patient_id', rows.map(row => row.id))
          .order('appointment_date', { ascending: false });
        if (apptError) throw apptError;
        apptRows = data || [];
      }
      setProfile(profileRes.data);
      setPatientRows(rows);
      setClinics(clinicRes.data || []);
      setDoctors(doctorRes.data || []);
      setAppointments(apptRows);
      setAuditLogs(auditRes.data || []);
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر تحميل حساب المريض' : 'Could not load patient account'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => load());
    return () => cancelAnimationFrame(frame);
  }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const clinicById = useMemo(() => new Map(clinics.map(c => [String(c.id), c])), [clinics]);
  const doctorById = useMemo(() => new Map(doctors.map(d => [String(d.id), d])), [doctors]);
  const patientById = useMemo(() => new Map(patientRows.map(p => [String(p.id), p])), [patientRows]);
  const activeAppointments = appointments.filter(apt => ACTIVE_STATUSES.includes(String(apt.status)));
  const upcomingAppointments = appointments.filter(apt => ACTIVE_STATUSES.includes(String(apt.status)) && apt.appointment_date >= new Date().toISOString().slice(0, 10));
  const cancelledAppointments = appointments.filter(apt => String(apt.status) === 'cancelled' || String(apt.status) === 'rejected');
  const completedAppointments = appointments.filter(apt => String(apt.status) === 'completed');

  const runAction = async (action, payload, successMessage) => {
    setBusy(true);
    setError('');
    try {
      await callSuperAdmin(action, payload);
      toast.success(successMessage);
      await load();
      return true;
    } catch (err) {
      const message = err.message || (isAr ? 'فشل الطلب' : 'Request failed');
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    const ok = await runAction('update_patient_account', {
      profile_id: patientId,
      full_name: editModal.full_name,
      email: editModal.email,
      phone: editModal.phone_number,
      governorate: editModal.governorate,
      address: editModal.address,
    }, isAr ? 'تم تحديث حساب المريض' : 'Patient account updated');
    if (ok) setEditModal(null);
  };

  const submitReset = async (event) => {
    event.preventDefault();
    if (resetModal.password !== resetModal.confirm_password) {
      toast.error(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    if (passwordScore(resetModal.password) < 3) {
      toast.error(isAr ? 'كلمة المرور ضعيفة' : 'Password is too weak');
      return;
    }
    const ok = await runAction('reset_patient_password', {
      profile_id: patientId,
      password: resetModal.password,
      confirm_password: resetModal.confirm_password,
    }, isAr ? 'تمت إعادة تعيين كلمة المرور' : 'Password reset');
    if (ok) {
      setOneTimeCredential({ email: profile.email, password: resetModal.password, label: profile.full_name });
      setResetModal(null);
    }
  };

  const setStatus = async (status) => {
    await runAction(status === 'suspended' ? 'suspend_patient_account' : 'reactivate_patient_account', {
      profile_id: patientId,
      reason: status === 'suspended' ? (isAr ? 'إجراء دعم' : 'Support action') : null,
    }, status === 'suspended' ? (isAr ? 'تم تعليق الحساب' : 'Account suspended') : (isAr ? 'تم تفعيل الحساب' : 'Account reactivated'));
  };

  const submitCancel = async (event) => {
    event.preventDefault();
    const ok = await runAction('cancel_patient_appointment', {
      appointment_id: cancelModal.appointment.id,
      cancellation_reason: cancelModal.reason,
      support_notes: cancelModal.support_notes,
      notify_patient: cancelModal.notify_patient,
      notify_doctor: cancelModal.notify_doctor,
      notify_clinic_admin: cancelModal.notify_clinic_admin,
    }, isAr ? 'تم إلغاء الموعد وإرسال الإشعارات' : 'Appointment cancelled and notifications sent');
    if (ok) setCancelModal(null);
  };

  const submitNotification = async (event) => {
    event.preventDefault();
    const ok = await runAction('send_patient_support_notification', {
      profile_id: patientId,
      title: notifyModal.title,
      message: notifyModal.message,
    }, isAr ? 'تم إرسال الإشعار' : 'Notification sent');
    if (ok) setNotifyModal(null);
  };

  if (loading) return <div className="super-admin-page"><div className="super-admin-loading"><span /><span /><span /></div></div>;
  if (!profile) return <div className="super-admin-page"><div className="super-admin-empty">{isAr ? 'حساب المريض غير موجود' : 'Patient account not found'}</div></div>;

  return (
    <div className="super-admin-page animate-in">
      <section className="super-admin-hero">
        <div>
          <button className="super-admin-back" onClick={() => navigate('/dashboard/super-admin/patients')}><ArrowLeft size={16} /> {isAr ? 'حسابات المرضى' : 'Patient Accounts'}</button>
          <span><UserRoundCog size={16} /> {profile.status === 'suspended' ? (isAr ? 'حساب معلق' : 'Suspended account') : (isAr ? 'حساب نشط' : 'Active account')}</span>
          <h1>{profile.full_name || '-'}</h1>
          <p>{profile.email || '-'} · <span dir="ltr">{profile.phone_number || '-'}</span></p>
        </div>
        <div className="super-admin-tool-row">
          <button className="btn btn-outline" onClick={() => setEditModal({ ...profile })}><Edit3 size={17} /> {isAr ? 'تعديل' : 'Edit'}</button>
          <button className="btn btn-outline" onClick={() => { const p = generateStrongPassword(); setResetModal({ password: p, confirm_password: p }); }}><KeyRound size={17} /> {isAr ? 'كلمة المرور' : 'Reset'}</button>
          <button className={profile.status === 'suspended' ? 'btn btn-primary' : 'btn btn-danger'} disabled={busy} onClick={() => setStatus(profile.status === 'suspended' ? 'active' : 'suspended')}>
            {profile.status === 'suspended' ? <ShieldCheck size={17} /> : <ShieldAlert size={17} />}
            {profile.status === 'suspended' ? (isAr ? 'تفعيل' : 'Reactivate') : (isAr ? 'تعليق' : 'Suspend')}
          </button>
        </div>
      </section>

      {error && <div className="super-admin-alert super-admin-alert--error">{error}</div>}
      {oneTimeCredential && <OneTimeCredential data={oneTimeCredential} isAr={isAr} onClose={() => setOneTimeCredential(null)} />}

      <section className="super-admin-stats">
        <Stat icon={<CalendarX2 />} label={isAr ? 'موعد نشط' : 'Active appointments'} value={activeAppointments.length} />
        <Stat icon={<CheckCircle2 />} label={isAr ? 'زيارات مكتملة' : 'Completed visits'} value={completedAppointments.length} />
        <Stat icon={<CalendarX2 />} label={isAr ? 'ملغاة' : 'Cancelled'} value={cancelledAppointments.length} />
        <Stat icon={<UserRoundCog />} label={isAr ? 'سجلات عيادات' : 'Clinic patient records'} value={patientRows.length} />
      </section>

      <section className="super-admin-detail-grid">
        <InfoCard title={isAr ? 'معلومات الحساب' : 'Account Information'}>
          <Info label={isAr ? 'الاسم الكامل' : 'Full name'} value={profile.full_name} />
          <Info label={isAr ? 'البريد الإلكتروني' : 'Email'} value={profile.email} />
          <Info label={isAr ? 'الهاتف' : 'Phone'} value={profile.phone_number} dir="ltr" />
          <Info label={isAr ? 'المحافظة' : 'Governorate'} value={profile.governorate} />
          <Info label={isAr ? 'العنوان' : 'Address'} value={profile.address} />
          <Info label={isAr ? 'الحالة' : 'Status'} value={profile.status === 'suspended' ? (isAr ? 'معلق' : 'Suspended') : (isAr ? 'نشط' : 'Active')} />
          <Info label={isAr ? 'العيادة' : 'Clinic'} value={patientRows.map(row => clinicById.get(String(row.clinic_id))?.name).filter(Boolean).join(', ') || '-'} />
          <Info label={isAr ? 'تاريخ الإنشاء' : 'Created'} value={formatDateTime(profile.created_at, isAr)} />
          <Info label={isAr ? 'آخر تحديث' : 'Last updated'} value={formatDateTime(profile.updated_at, isAr)} />
          <Info label={isAr ? 'آخر تسجيل دخول' : 'Last sign-in'} value={isAr ? 'متاح فقط عبر سجلات Auth الآمنة' : 'Available only through secure Auth logs'} />
        </InfoCard>

        <InfoCard title={isAr ? 'إجراءات الدعم' : 'Support Actions'}>
          <div className="super-admin-action-stack">
            <button className="btn btn-outline" onClick={() => setEditModal({ ...profile })}><Edit3 size={16} /> {isAr ? 'تعديل بيانات المريض' : 'Edit patient data'}</button>
            <button className="btn btn-outline" onClick={() => { const p = generateStrongPassword(); setResetModal({ password: p, confirm_password: p }); }}><KeyRound size={16} /> {isAr ? 'إعادة تعيين كلمة المرور' : 'Reset password'}</button>
            <button className="btn btn-outline" onClick={() => setNotifyModal({ title: isAr ? 'رسالة من دعم UrClinic' : 'Message from UrClinic Support', message: '' })}><Bell size={16} /> {isAr ? 'إرسال إشعار دعم' : 'Send support notification'}</button>
            <button className={profile.status === 'suspended' ? 'btn btn-primary' : 'btn btn-danger'} onClick={() => setStatus(profile.status === 'suspended' ? 'active' : 'suspended')}>
              {profile.status === 'suspended' ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
              {profile.status === 'suspended' ? (isAr ? 'إعادة تفعيل الحساب' : 'Reactivate account') : (isAr ? 'تعليق الحساب' : 'Suspend account')}
            </button>
          </div>
        </InfoCard>
      </section>

      <AppointmentSection
        title={isAr ? 'المواعيد النشطة والحالية' : 'Current Active Appointment'}
        rows={activeAppointments}
        isAr={isAr}
        clinicById={clinicById}
        doctorById={doctorById}
        patientById={patientById}
        onCancel={setCancelModalFromAppointment(setCancelModal)}
      />
      <AppointmentSection title={isAr ? 'المواعيد القادمة' : 'Upcoming Appointments'} rows={upcomingAppointments} isAr={isAr} clinicById={clinicById} doctorById={doctorById} patientById={patientById} onCancel={setCancelModalFromAppointment(setCancelModal)} />
      <AppointmentSection title={isAr ? 'الزيارات المكتملة' : 'Completed Visit History'} rows={completedAppointments} isAr={isAr} clinicById={clinicById} doctorById={doctorById} patientById={patientById} />
      <AppointmentSection title={isAr ? 'المواعيد الملغاة' : 'Cancelled Appointments'} rows={cancelledAppointments} isAr={isAr} clinicById={clinicById} doctorById={doctorById} patientById={patientById} />

      <section className="super-admin-card super-admin-card--flush">
        <div className="super-admin-card-head"><span><ShieldCheck /></span><h2>{isAr ? 'سجل إجراءات الدعم' : 'Support Audit Log'}</h2></div>
        {auditLogs.length === 0 ? <div className="super-admin-empty"><p>{isAr ? 'لا توجد إجراءات دعم بعد.' : 'No support actions yet.'}</p></div> : (
          <div className="super-admin-audit-list">
            {auditLogs.map(log => <div key={log.id}><strong>{log.action_type}</strong><span>{formatDateTime(log.created_at, isAr)}</span><p>{log.reason || log.metadata?.title || '-'}</p></div>)}
          </div>
        )}
      </section>

      {editModal && <EditPatientModal isAr={isAr} form={editModal} setForm={setEditModal} onSubmit={submitEdit} busy={busy} onClose={() => setEditModal(null)} />}
      {resetModal && <ResetModal isAr={isAr} modal={resetModal} setModal={setResetModal} onSubmit={submitReset} busy={busy} onClose={() => setResetModal(null)} />}
      {notifyModal && <NotifyModal isAr={isAr} modal={notifyModal} setModal={setNotifyModal} onSubmit={submitNotification} busy={busy} onClose={() => setNotifyModal(null)} />}
      {cancelModal && <CancelAppointmentModal isAr={isAr} modal={cancelModal} setModal={setCancelModal} onSubmit={submitCancel} busy={busy} onClose={() => setCancelModal(null)} />}
    </div>
  );
};

const setCancelModalFromAppointment = (setter) => (appointment) => setter({
  appointment,
  reason: '',
  support_notes: '',
  notify_patient: true,
  notify_doctor: true,
  notify_clinic_admin: true,
});

const formatDateTime = (value, isAr) => value
  ? new Intl.DateTimeFormat(isAr ? 'ar-IQ' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-';

const formatAppointmentTime = (apt, isAr) => apt?.appointment_date
  ? `${new Intl.DateTimeFormat(isAr ? 'ar-IQ' : 'en', { dateStyle: 'medium' }).format(new Date(`${apt.appointment_date}T00:00:00`))} · ${String(apt.appointment_time || '').slice(0, 5)}`
  : '-';

const Stat = ({ icon, label, value }) => <div className="super-admin-stat"><span>{icon}</span><p>{label}</p><strong>{value}</strong></div>;
const InfoCard = ({ title, children }) => <section className="super-admin-card"><div className="super-admin-card-head"><h2>{title}</h2></div><div className="super-admin-info-list">{children}</div></section>;
const Info = ({ label, value, dir }) => <div><span>{label}</span><strong dir={dir}>{value || '-'}</strong></div>;

const AppointmentSection = ({ title, rows, isAr, clinicById, doctorById, patientById, onCancel }) => (
  <section className="super-admin-card super-admin-card--flush">
    <div className="super-admin-card-head"><span><CalendarX2 /></span><h2>{title}</h2></div>
    {rows.length === 0 ? <div className="super-admin-empty"><p>{isAr ? 'لا توجد مواعيد.' : 'No appointments.'}</p></div> : (
      <div className="super-admin-table-wrap">
        <table className="super-admin-table">
          <thead>
            <tr>
              <th>{isAr ? 'رمز الحجز' : 'Booking code'}</th>
              <th>{isAr ? 'الطبيب' : 'Doctor'}</th>
              <th>{isAr ? 'العيادة' : 'Clinic'}</th>
              <th>{isAr ? 'التاريخ والوقت' : 'Date & time'}</th>
              <th>{isAr ? 'الحالة' : 'Status'}</th>
              <th>{isAr ? 'الإجراء' : 'Action'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(apt => {
              const patient = patientById.get(String(apt.patient_id));
              return (
                <tr key={apt.id}>
                  <td><strong>{apt.booking_code || '-'}</strong><small>{patient?.full_name || ''}</small></td>
                  <td>{doctorById.get(String(apt.doctor_id))?.full_name || '-'}</td>
                  <td>{clinicById.get(String(apt.clinic_id))?.name || '-'}</td>
                  <td>{formatAppointmentTime(apt, isAr)}</td>
                  <td><span className="super-admin-status neutral">{apt.status}</span></td>
                  <td>{onCancel && ACTIVE_STATUSES.includes(String(apt.status)) ? <button className="btn btn-sm btn-danger" onClick={() => onCancel(apt)}><CalendarX2 size={14} /> {isAr ? 'إلغاء' : 'Cancel'}</button> : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const Field = ({ label, value, onChange, type = 'text', required = false, wide = false }) => (
  <label className={`form-group ${wide ? 'super-admin-wide' : ''}`}>
    <span className="form-label">{label}</span>
    <input className="input" type={type} required={required} value={value || ''} onChange={e => onChange(e.target.value)} />
  </label>
);

const EditPatientModal = ({ isAr, form, setForm, onSubmit, busy, onClose }) => (
  <Modal title={isAr ? 'تعديل حساب المريض' : 'Edit Patient Account'} onClose={onClose}>
    <form onSubmit={onSubmit} className="super-admin-form-grid">
      <Field required label={isAr ? 'الاسم الكامل' : 'Full name'} value={form.full_name} onChange={v => setForm({ ...form, full_name: v })} />
      <Field required type="email" label={isAr ? 'البريد الإلكتروني' : 'Email'} value={form.email} onChange={v => setForm({ ...form, email: v })} />
      <Field label={isAr ? 'الهاتف' : 'Phone'} value={form.phone_number} onChange={v => setForm({ ...form, phone_number: v })} />
      <label className="form-group">
        <span className="form-label">{isAr ? 'المحافظة' : 'Governorate'}</span>
        <select className="input" value={form.governorate || ''} onChange={e => setForm({ ...form, governorate: e.target.value })}>
          <option value="">{isAr ? 'غير محدد' : 'Not set'}</option>
          {IRAQI_GOVERNORATES.map(g => <option key={g.id} value={g.id}>{isAr ? g.ar : g.en}</option>)}
        </select>
      </label>
      <Field wide label={isAr ? 'العنوان' : 'Address'} value={form.address} onChange={v => setForm({ ...form, address: v })} />
      <div className="super-admin-submit-row super-admin-wide"><button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />} {isAr ? 'حفظ' : 'Save'}</button></div>
    </form>
  </Modal>
);

const ResetModal = ({ isAr, modal, setModal, onSubmit, busy, onClose }) => (
  <Modal title={isAr ? 'إعادة تعيين كلمة المرور' : 'Reset Password'} onClose={onClose}>
    <form onSubmit={onSubmit} className="super-admin-form-grid">
      <Field label={isAr ? 'كلمة المرور المؤقتة' : 'Temporary password'} value={modal.password} onChange={v => setModal({ ...modal, password: v })} />
      <Field label={isAr ? 'تأكيد كلمة المرور' : 'Confirm password'} value={modal.confirm_password} onChange={v => setModal({ ...modal, confirm_password: v })} />
      <div className="super-admin-tool-row super-admin-wide">
        <button type="button" className="btn btn-outline" onClick={() => { const p = generateStrongPassword(); setModal({ ...modal, password: p, confirm_password: p }); }}><KeyRound size={16} /> {isAr ? 'توليد' : 'Generate'}</button>
        <button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />} {isAr ? 'إعادة التعيين' : 'Reset'}</button>
      </div>
    </form>
  </Modal>
);

const NotifyModal = ({ isAr, modal, setModal, onSubmit, busy, onClose }) => (
  <Modal title={isAr ? 'إرسال إشعار دعم' : 'Send Support Notification'} onClose={onClose}>
    <form onSubmit={onSubmit} className="super-admin-form-grid">
      <Field required label={isAr ? 'العنوان' : 'Title'} value={modal.title} onChange={v => setModal({ ...modal, title: v })} />
      <label className="form-group super-admin-wide"><span className="form-label">{isAr ? 'الرسالة' : 'Message'}</span><textarea className="input" required rows={4} value={modal.message} onChange={e => setModal({ ...modal, message: e.target.value })} /></label>
      <div className="super-admin-submit-row super-admin-wide"><button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Bell size={16} />} {isAr ? 'إرسال' : 'Send'}</button></div>
    </form>
  </Modal>
);

const CancelAppointmentModal = ({ isAr, modal, setModal, onSubmit, busy, onClose }) => (
  <Modal title={isAr ? 'تأكيد إلغاء الموعد' : 'Confirm Appointment Cancellation'} onClose={onClose}>
    <form onSubmit={onSubmit} className="super-admin-form-grid">
      <div className="super-admin-wide super-admin-alert">
        <strong>{modal.appointment.booking_code || modal.appointment.id}</strong><br />
        <span>{formatAppointmentTime(modal.appointment, isAr)} · {modal.appointment.status}</span>
      </div>
      <Field required wide label={isAr ? 'سبب الإلغاء' : 'Cancellation reason'} value={modal.reason} onChange={v => setModal({ ...modal, reason: v })} />
      <label className="form-group super-admin-wide"><span className="form-label">{isAr ? 'ملاحظات داخلية' : 'Internal support notes'}</span><textarea className="input" rows={3} value={modal.support_notes} onChange={e => setModal({ ...modal, support_notes: e.target.value })} /></label>
      <Toggle label={isAr ? 'إشعار المريض' : 'Notify patient'} checked={modal.notify_patient} onChange={v => setModal({ ...modal, notify_patient: v })} />
      <Toggle label={isAr ? 'إشعار الطبيب' : 'Notify doctor'} checked={modal.notify_doctor} onChange={v => setModal({ ...modal, notify_doctor: v })} />
      <Toggle label={isAr ? 'إشعار مدير العيادة' : 'Notify Clinic Admin'} checked={modal.notify_clinic_admin} onChange={v => setModal({ ...modal, notify_clinic_admin: v })} />
      <div className="super-admin-submit-row super-admin-wide"><button className="btn btn-danger" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <CalendarX2 size={16} />} {isAr ? 'إلغاء الموعد' : 'Cancel appointment'}</button></div>
    </form>
  </Modal>
);

const Toggle = ({ label, checked, onChange }) => (
  <label className="super-admin-check super-admin-check--inline">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

const OneTimeCredential = ({ data, isAr, onClose }) => {
  const copy = value => navigator.clipboard?.writeText(value);
  return <div className="super-admin-result"><strong>{isAr ? 'كلمة مرور مؤقتة تظهر مرة واحدة' : 'Temporary password shown once'}</strong><p>{data.label}</p><code>{data.password}</code><div className="super-admin-tool-row"><button className="btn btn-outline" onClick={() => copy(data.email)}>Email</button><button className="btn btn-outline" onClick={() => copy(data.password)}>Password</button><button className="btn btn-primary" onClick={onClose}>{isAr ? 'إغلاق' : 'Close'}</button></div></div>;
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-overlay super-admin-modal-overlay">
    <div className="super-admin-modal">
      <div className="super-admin-modal-head"><h2>{title}</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button></div>
      {children}
    </div>
  </div>
);

export default SuperAdminPatientDetails;
