import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Plus,
  Save,
  Stethoscope,
  Trash2,
  Umbrella,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../supabaseClient';
import {
  AVAILABILITY_REASONS,
  DEFAULT_PERIODS,
  IRAQ_DAY_ORDER,
  appointmentConflictsWithSchedule,
  createAvailabilityClosure,
  dayLabel,
  deleteAvailabilityClosure,
  evaluateAvailability,
  groupPeriodsByDay,
  loadAvailabilityForClinics,
  localDateKey,
  reasonLabel,
  saveWeeklySchedule,
} from '../services/availabilityService';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const emptyClosure = {
  scope: 'clinic',
  doctor_id: '',
  reason: 'vacation',
  closure_type: 'vacation',
  starts_on: localDateKey(),
  ends_on: localDateKey(),
  return_on: '',
  start_time: '',
  end_time: '',
  allow_future_booking: true,
  notify_patients: true,
  note: '',
};

const emptySchedule = () => Object.fromEntries(IRAQ_DAY_ORDER.map(day => [day, day === 'fri' ? [] : DEFAULT_PERIODS]));

const AvailabilityManagement = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { user, doctors, appointments } = useApp();
  const toast = useToast();
  const [clinic, setClinic] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [closures, setClosures] = useState([]);
  const [clinicSchedule, setClinicSchedule] = useState(emptySchedule);
  const [doctorSchedule, setDoctorSchedule] = useState(emptySchedule);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [closureForm, setClosureForm] = useState(emptyClosure);
  const [loading, setLoading] = useState(true);
  const [savingClinic, setSavingClinic] = useState(false);
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [savingClosure, setSavingClosure] = useState(false);

  const clinicDoctors = useMemo(() =>
    doctors.filter(doc => String(doc.clinic_id || '') === String(user?.clinic_id || '')),
    [doctors, user?.clinic_id]);

  const selectedDoctor = clinicDoctors.find(doc => String(doc.id) === String(selectedDoctorId)) || null;
  const today = localDateKey();
  const canManage = ['clinic_admin', 'employee'].includes(user?.role);

  const reload = async () => {
    if (!user?.clinic_id) return;
    setLoading(true);
    try {
      const [clinicRes, availability] = await Promise.all([
        supabase.from('clinics').select('id, name, governorate, is_active').eq('id', user.clinic_id).single(),
        loadAvailabilityForClinics([user.clinic_id]),
      ]);
      if (clinicRes.error) throw clinicRes.error;
      setClinic(clinicRes.data);
      setPeriods(availability.periods);
      setClosures(availability.closures);
      setClinicSchedule(groupPeriodsByDay(availability.periods.filter(period => !period.doctor_id)));
      const firstDoctor = selectedDoctorId || clinicDoctors[0]?.id || '';
      setSelectedDoctorId(firstDoctor);
      const doctorPeriods = availability.periods.filter(period => String(period.doctor_id || '') === String(firstDoctor));
      setDoctorSchedule(doctorPeriods.length ? groupPeriodsByDay(doctorPeriods) : emptySchedule());
    } catch (err) {
      console.error('Availability load failed:', err);
      toast.error(getLocalizedErrorMessage(err, { isAr, fallback: 'load' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.clinic_id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const doctorPeriods = periods.filter(period => String(period.doctor_id || '') === String(selectedDoctorId));
      setDoctorSchedule(doctorPeriods.length ? groupPeriodsByDay(doctorPeriods) : emptySchedule());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [periods, selectedDoctorId]);

  const todayClinicStatus = evaluateAvailability({
    clinicPeriods: periods.filter(period => !period.doctor_id),
    closures,
    dateKey: today,
    isAr,
  });
  const todayDoctorStatus = selectedDoctor ? evaluateAvailability({
    clinicPeriods: periods.filter(period => !period.doctor_id),
    doctorPeriods: periods.filter(period => String(period.doctor_id || '') === String(selectedDoctor.id)),
    closures,
    doctor: selectedDoctor,
    dateKey: today,
    isAr,
  }) : null;

  const clinicConflicts = appointmentConflictsWithSchedule({
    appointments,
    schedule: clinicSchedule,
    closures: closures.filter(closure => !closure.doctor_id),
  });
  const doctorConflicts = selectedDoctor ? appointmentConflictsWithSchedule({
    appointments,
    schedule: doctorSchedule,
    closures: closures.filter(closure => String(closure.doctor_id || '') === String(selectedDoctor.id)),
    doctorId: selectedDoctor.id,
  }) : [];

  const closurePreviewConflicts = useMemo(() => {
    const draftClosure = {
      clinic_id: user?.clinic_id,
      doctor_id: closureForm.scope === 'doctor' ? closureForm.doctor_id : null,
      starts_on: closureForm.starts_on,
      ends_on: closureForm.ends_on,
      start_time: closureForm.start_time || null,
      end_time: closureForm.end_time || null,
    };
    return appointmentConflictsWithSchedule({
      appointments,
      schedule: closureForm.scope === 'doctor' ? doctorSchedule : clinicSchedule,
      closures: [draftClosure],
      doctorId: closureForm.scope === 'doctor' ? closureForm.doctor_id : null,
    });
  }, [appointments, clinicSchedule, closureForm, doctorSchedule, user?.clinic_id]);

  const saveClinic = async () => {
    setSavingClinic(true);
    try {
      await saveWeeklySchedule({ clinicId: user.clinic_id, schedule: clinicSchedule, actorId: user.id });
      toast.success(isAr ? 'تم حفظ جدول العيادة.' : 'Clinic schedule saved.');
      await reload();
    } catch (err) {
      console.error('Clinic schedule save failed:', err);
      toast.error(getLocalizedErrorMessage(err, { isAr, fallback: 'settings' }));
    } finally {
      setSavingClinic(false);
    }
  };

  const saveDoctor = async () => {
    if (!selectedDoctor) return;
    setSavingDoctor(true);
    try {
      await saveWeeklySchedule({ clinicId: user.clinic_id, doctorId: selectedDoctor.id, schedule: doctorSchedule, actorId: user.id });
      toast.success(isAr ? 'تم حفظ جدول الطبيب.' : 'Doctor schedule saved.');
      await reload();
    } catch (err) {
      console.error('Doctor schedule save failed:', err);
      toast.error(getLocalizedErrorMessage(err, { isAr, fallback: 'settings' }));
    } finally {
      setSavingDoctor(false);
    }
  };

  const createClosure = async () => {
    if (!closureForm.starts_on || !closureForm.ends_on) return;
    setSavingClosure(true);
    try {
      const savedClosure = await createAvailabilityClosure({
        clinicId: user.clinic_id,
        doctorId: closureForm.scope === 'doctor' ? closureForm.doctor_id : null,
        closure: closureForm,
        actorId: user.id,
      });
      if (closureForm.notify_patients) {
        await notifyAffectedPatients(closurePreviewConflicts, savedClosure);
      }
      toast.success(isAr ? 'تم تسجيل الإغلاق أو الإجازة.' : 'Closure or vacation saved.');
      setClosureForm(emptyClosure);
      await reload();
    } catch (err) {
      console.error('Closure save failed:', err);
      toast.error(getLocalizedErrorMessage(err, { isAr, fallback: 'settings' }));
    } finally {
      setSavingClosure(false);
    }
  };

  const notifyAffectedPatients = async (affectedAppointments, closure) => {
    const rows = (affectedAppointments || [])
      .map(appointment => {
        const targetUserId = appointment.patient?.auth_user_id || appointment.patient_profile?.id || null;
        if (!targetUserId) return null;
        return {
          clinic_id: user.clinic_id,
          user_id: targetUserId,
          appointment_id: appointment.id,
          title: isAr ? 'تحديث توفر العيادة' : 'Clinic availability update',
          message: isAr
            ? `قد يتأثر موعدك بتاريخ ${appointment.date || appointment.appointment_date} بسبب ${reasonLabel(closure.reason, true)}.`
            : `Your appointment on ${appointment.date || appointment.appointment_date} may be affected by ${reasonLabel(closure.reason, false)}.`,
          type: 'availability_changed',
          metadata: {
            closure_id: closure.id,
            appointment_date: appointment.date || appointment.appointment_date,
            appointment_time: appointment.time || appointment.appointment_time,
          },
        };
      })
      .filter(Boolean);

    if (!rows.length) return;
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) {
      console.warn('availability notification insert failed:', error.message);
    }
  };

  const removeClosure = async (closureId) => {
    try {
      await deleteAvailabilityClosure({ closureId });
      toast.success(isAr ? 'تم حذف الإغلاق.' : 'Closure removed.');
      await reload();
    } catch (err) {
      console.error('Closure delete failed:', err);
      toast.error(getLocalizedErrorMessage(err, { isAr, fallback: 'settings' }));
    }
  };

  if (!canManage) {
    return (
      <div className="page-padding availability-page">
        <div className="support-empty support-empty--error">
          <AlertTriangle size={32} />
          <p>{isAr ? 'إدارة التوفر متاحة لمدير العيادة والموظفين المخولين فقط.' : 'Availability management is available to clinic admins and authorized employees only.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-padding availability-page animate-in">
      <section className="availability-hero">
        <div>
          <span><CalendarClock size={16} /> {isAr ? 'إدارة التوفر' : 'Availability Management'}</span>
          <h1>{isAr ? 'جدولة العيادة والأطباء' : 'Clinic & Doctor Schedule'}</h1>
          <p>{clinic?.name || (isAr ? 'عيادتك' : 'Your clinic')}</p>
        </div>
      </section>

      {loading ? (
        <div className="support-skeleton"><span></span><span></span><span></span></div>
      ) : (
        <>
          <section className="availability-status-grid">
            <StatusCard title={isAr ? 'حالة العيادة اليوم' : "Today's clinic status"} status={todayClinicStatus} />
            <StatusCard title={isAr ? 'حالة الطبيب المحدد' : 'Selected doctor status'} status={todayDoctorStatus} empty={!selectedDoctor} />
            <div className="availability-status-card">
              <span>{isAr ? 'إغلاقات قادمة' : 'Upcoming closures'}</span>
              <strong>{closures.length}</strong>
              <p>{isAr ? 'تُفتح تلقائياً بعد نهاية الفترة' : 'Automatically reopens after the period ends'}</p>
            </div>
          </section>

          <section className="availability-grid">
            <div className="availability-panel">
              <PanelHeader icon={<Clock size={18} />} title={isAr ? 'الجدول الأسبوعي للعيادة' : 'Clinic weekly schedule'} subtitle={isAr ? 'يدعم الفترات الصباحية والمسائية المتعددة.' : 'Supports unlimited morning and evening periods.'} />
              <WeeklyScheduleEditor schedule={clinicSchedule} onChange={setClinicSchedule} isAr={isAr} />
              <ConflictList conflicts={clinicConflicts} isAr={isAr} />
              <div className="availability-actions">
                <button className="btn btn-primary" onClick={saveClinic} disabled={savingClinic}>
                  <Save size={16} /> {savingClinic ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ جدول العيادة' : 'Save clinic schedule')}
                </button>
              </div>
            </div>

            <div className="availability-panel">
              <PanelHeader icon={<Stethoscope size={18} />} title={isAr ? 'توفر الأطباء' : 'Doctor availability'} subtitle={isAr ? 'اضبط دوام طبيب محدد أو إجازته.' : 'Set a specific doctor schedule or vacation.'} />
              <label className="support-field">
                <span>{isAr ? 'الطبيب' : 'Doctor'}</span>
                <select value={selectedDoctorId} onChange={event => setSelectedDoctorId(event.target.value)}>
                  <option value="">{isAr ? 'اختر الطبيب' : 'Select doctor'}</option>
                  {clinicDoctors.map(doc => <option key={doc.id} value={doc.id}>{doc.full_name || doc.name}</option>)}
                </select>
              </label>
              {selectedDoctor ? (
                <>
                  <WeeklyScheduleEditor schedule={doctorSchedule} onChange={setDoctorSchedule} isAr={isAr} />
                  <ConflictList conflicts={doctorConflicts} isAr={isAr} />
                  <div className="availability-actions">
                    <button className="btn btn-primary" onClick={saveDoctor} disabled={savingDoctor}>
                      <Save size={16} /> {savingDoctor ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ جدول الطبيب' : 'Save doctor schedule')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="support-empty"><p>{isAr ? 'اختر طبيباً لتعديل جدوله.' : 'Select a doctor to edit their schedule.'}</p></div>
              )}
            </div>
          </section>

          <section className="availability-panel">
            <PanelHeader icon={<Umbrella size={18} />} title={isAr ? 'الإغلاقات والإجازات المؤقتة' : 'Temporary closures & vacations'} subtitle={isAr ? 'إغلاق عيادة كاملة أو طبيب لفترة محددة.' : 'Close the whole clinic or one doctor for a date range.'} />
            <div className="availability-closure-form">
              <label className="support-field">
                <span>{isAr ? 'النطاق' : 'Scope'}</span>
                <select value={closureForm.scope} onChange={event => setClosureForm(prev => ({ ...prev, scope: event.target.value }))}>
                  <option value="clinic">{isAr ? 'العيادة بالكامل' : 'Entire clinic'}</option>
                  <option value="doctor">{isAr ? 'طبيب محدد' : 'One doctor'}</option>
                </select>
              </label>
              {closureForm.scope === 'doctor' && (
                <label className="support-field">
                  <span>{isAr ? 'الطبيب' : 'Doctor'}</span>
                  <select value={closureForm.doctor_id} onChange={event => setClosureForm(prev => ({ ...prev, doctor_id: event.target.value }))}>
                    <option value="">{isAr ? 'اختر الطبيب' : 'Select doctor'}</option>
                    {clinicDoctors.map(doc => <option key={doc.id} value={doc.id}>{doc.full_name || doc.name}</option>)}
                  </select>
                </label>
              )}
              <label className="support-field">
                <span>{isAr ? 'السبب' : 'Reason'}</span>
                <select value={closureForm.reason} onChange={event => setClosureForm(prev => ({ ...prev, reason: event.target.value, closure_type: event.target.value }))}>
                  {AVAILABILITY_REASONS.map(reason => <option key={reason} value={reason}>{reasonLabel(reason, isAr)}</option>)}
                </select>
              </label>
              <label className="support-field"><span>{isAr ? 'من تاريخ' : 'Start date'}</span><input type="date" value={closureForm.starts_on} onChange={event => setClosureForm(prev => ({ ...prev, starts_on: event.target.value }))} /></label>
              <label className="support-field"><span>{isAr ? 'إلى تاريخ' : 'End date'}</span><input type="date" value={closureForm.ends_on} onChange={event => setClosureForm(prev => ({ ...prev, ends_on: event.target.value }))} /></label>
              <label className="support-field"><span>{isAr ? 'تاريخ العودة' : 'Return date'}</span><input type="date" value={closureForm.return_on} onChange={event => setClosureForm(prev => ({ ...prev, return_on: event.target.value }))} /></label>
              <label className="support-field"><span>{isAr ? 'وقت البداية اختياري' : 'Optional start time'}</span><input type="time" value={closureForm.start_time} onChange={event => setClosureForm(prev => ({ ...prev, start_time: event.target.value }))} /></label>
              <label className="support-field"><span>{isAr ? 'وقت النهاية اختياري' : 'Optional end time'}</span><input type="time" value={closureForm.end_time} onChange={event => setClosureForm(prev => ({ ...prev, end_time: event.target.value }))} /></label>
              <label className="support-check"><input type="checkbox" checked={closureForm.allow_future_booking} onChange={event => setClosureForm(prev => ({ ...prev, allow_future_booking: event.target.checked }))} /><span>{isAr ? 'السماح بالحجز بعد تاريخ العودة' : 'Allow future booking after return'}</span></label>
              <label className="support-check"><input type="checkbox" checked={closureForm.notify_patients} onChange={event => setClosureForm(prev => ({ ...prev, notify_patients: event.target.checked }))} /><span>{isAr ? 'تنبيه المرضى المتأثرين داخل التطبيق' : 'Notify affected patients in-app'}</span></label>
            </div>
            <ConflictList conflicts={closurePreviewConflicts} isAr={isAr} />
            <div className="availability-actions">
              <button className="btn btn-primary" onClick={createClosure} disabled={savingClosure || (closureForm.scope === 'doctor' && !closureForm.doctor_id)}>
                <Plus size={16} /> {savingClosure ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'إضافة الإغلاق' : 'Add closure')}
              </button>
            </div>

            <div className="availability-closure-list">
              {closures.length === 0 ? (
                <div className="support-empty"><p>{isAr ? 'لا توجد إغلاقات قادمة.' : 'No upcoming closures.'}</p></div>
              ) : closures.map(closure => (
                <article key={closure.id} className="availability-closure-card">
                  <div>
                    <strong>{closure.doctor_id ? (clinicDoctors.find(doc => String(doc.id) === String(closure.doctor_id))?.full_name || reasonLabel(closure.reason, isAr)) : (isAr ? 'العيادة بالكامل' : 'Entire clinic')}</strong>
                    <p>{reasonLabel(closure.reason, isAr)} · {closure.starts_on} → {closure.ends_on}</p>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => removeClosure(closure.id)} title={isAr ? 'حذف' : 'Delete'}><Trash2 size={16} /></button>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

const StatusCard = ({ title, status, empty = false }) => (
  <div className="availability-status-card">
    <span>{title}</span>
    {empty || !status ? (
      <><strong>-</strong><p>-</p></>
    ) : (
      <><strong className={status.badgeClass}>{status.label}</strong><p>{status.detail || '-'}</p></>
    )}
  </div>
);

const PanelHeader = ({ icon, title, subtitle }) => (
  <div className="availability-panel-head">
    <div>
      <span>{icon}</span>
      <h2>{title}</h2>
    </div>
    <p>{subtitle}</p>
  </div>
);

const WeeklyScheduleEditor = ({ schedule, onChange, isAr }) => {
  const updateDay = (day, nextPeriods) => onChange(prev => ({ ...prev, [day]: nextPeriods }));
  const setPeriod = (day, index, key, value) => {
    updateDay(day, (schedule[day] || []).map((period, i) => i === index ? { ...period, [key]: value } : period));
  };
  return (
    <div className="availability-week">
      {IRAQ_DAY_ORDER.map(day => {
        const periods = schedule[day] || [];
        const open = periods.length > 0;
        return (
          <article key={day} className="availability-day">
            <div className="availability-day-head">
              <strong>{dayLabel(day, isAr)}</strong>
              <label className="availability-switch">
                <input type="checkbox" checked={open} onChange={event => updateDay(day, event.target.checked ? DEFAULT_PERIODS : [])} />
                <span>{open ? (isAr ? 'مفتوح' : 'Open') : (isAr ? 'مغلق' : 'Closed')}</span>
              </label>
            </div>
            {open && (
              <div className="availability-periods">
                {periods.map((period, index) => (
                  <div key={`${day}-${index}`} className="availability-period-row">
                    <input type="time" value={period.start_time} onChange={event => setPeriod(day, index, 'start_time', event.target.value)} />
                    <span>→</span>
                    <input type="time" value={period.end_time} onChange={event => setPeriod(day, index, 'end_time', event.target.value)} />
                    <button type="button" onClick={() => updateDay(day, periods.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
                  </div>
                ))}
                <button type="button" className="availability-add-period" onClick={() => updateDay(day, [...periods, { start_time: '17:00', end_time: '21:00' }])}>
                  <Plus size={14} /> {isAr ? 'إضافة فترة' : 'Add period'}
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};

const ConflictList = ({ conflicts = [], isAr }) => {
  if (!conflicts.length) return null;
  return (
    <div className="availability-conflicts">
      <strong><AlertTriangle size={16} /> {isAr ? 'مواعيد متأثرة' : 'Affected appointments'}</strong>
      <p>{isAr ? 'راجع هذه المواعيد قبل تأكيد التغيير. لا يتم حذف أي موعد تلقائياً.' : 'Review these appointments before confirming. No appointments are deleted automatically.'}</p>
      <div>
        {conflicts.slice(0, 8).map(item => (
          <span key={item.id}>{item.booking_code || item.id} · {item.patient_name || '-'} · {item.date || item.appointment_date} {String(item.time || item.appointment_time || '').slice(0, 5)}</span>
        ))}
      </div>
    </div>
  );
};

export default AvailabilityManagement;
