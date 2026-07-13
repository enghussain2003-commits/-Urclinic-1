import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, RotateCcw, Stethoscope } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isDemoModeEnabled } from '../demo/demoMode';
import { to12Hour } from '../components/TimeSlotGrid';

const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const ACTIVE_STATUSES = ['pending', 'approved', 'confirmed', 'in_progress'];
const DEFAULT_STEP = 30;

const pad = (value) => String(value).padStart(2, '0');
const toISODate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toMinutes = (time) => {
  const [h, m] = String(time || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toHHMM = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

const startOfWorkWeek = (date) => {
  const d = new Date(date);
  const offset = (d.getDay() + 1) % 7; // Saturday start: Sat=0, Sun=1...
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
};

const doctorWorkDays = (doctor) =>
  Array.isArray(doctor?.work_days) && doctor.work_days.length
    ? doctor.work_days
    : ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'];

const isPastSlot = (dateStr, time) => {
  const slot = new Date(`${dateStr}T${time}:00`);
  return slot.getTime() < Date.now();
};

const getDoctorName = (doctor, isAr) =>
  isAr
    ? (doctor?.nameAr || doctor?.full_name || doctor?.name || '-')
    : (doctor?.name || doctor?.full_name || doctor?.nameAr || '-');

const ScheduleView = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { user, doctors, appointments, loading } = useApp();
  const isDemo = isDemoModeEnabled(user);

  const [weekStart, setWeekStart] = useState(() => startOfWorkWeek(new Date()));
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language, isAr]);

  const activeDoctors = useMemo(() => doctors.filter(d => d.is_active !== false), [doctors]);
  const myDoctor = useMemo(() =>
    activeDoctors.find(d =>
      String(d.profile_id) === String(user?.id) ||
      (d.email && user?.email && d.email === user.email)
    ) || null,
    [activeDoctors, user]
  );

  const visibleDoctors = useMemo(() => {
    if (user?.role === 'doctor') return myDoctor ? [myDoctor] : [];
    return activeDoctors;
  }, [activeDoctors, myDoctor, user?.role]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (user?.role === 'doctor') {
        setSelectedDoctorId(myDoctor?.id || '');
        return;
      }
      if (!selectedDoctorId && visibleDoctors.length > 0) {
        setSelectedDoctorId(visibleDoctors[0].id);
      }
      if (selectedDoctorId && !visibleDoctors.some(d => String(d.id) === String(selectedDoctorId))) {
        setSelectedDoctorId(visibleDoctors[0]?.id || '');
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [myDoctor, selectedDoctorId, user?.role, visibleDoctors]);

  const selectedDoctor = visibleDoctors.find(d => String(d.id) === String(selectedDoctorId)) || null;

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const dateStr = toISODate(date);
      return {
        date,
        dateStr,
        dayId: DAY_IDS[date.getDay()],
        label: t(DAY_IDS[date.getDay()]),
        dayNumber: date.toLocaleDateString(isAr ? 'ar-IQ' : 'en-US', { day: 'numeric', month: 'short' }),
      };
    }),
    [isAr, t, weekStart]
  );

  const timeSlots = useMemo(() => {
    if (!selectedDoctor) return [];
    const open = selectedDoctor.open_time || '09:00';
    const close = selectedDoctor.close_time || '17:00';
    const start = toMinutes(open);
    const end = toMinutes(close);
    const step = DEFAULT_STEP;
    if (end <= start) return [];
    const slots = [];
    for (let mins = start; mins + step <= end; mins += step) {
      slots.push(toHHMM(mins));
    }
    return slots;
  }, [selectedDoctor]);

  const activeAppointments = useMemo(() =>
    appointments.filter(apt =>
      String(apt.doctor_id) === String(selectedDoctorId) &&
      ACTIVE_STATUSES.includes(apt.status)
    ),
    [appointments, selectedDoctorId]
  );

  const appointmentForSlot = (dateStr, time) =>
    activeAppointments.find(apt =>
      (apt.date || apt.appointment_date) === dateStr &&
      String(apt.time || apt.appointment_time || '').slice(0, 5) === time
    );

  const getSlotMeta = (dateStr, dayId, time) => {
    if (!selectedDoctor) return { status: 'unavailable', label: isAr ? 'غير متاح' : 'Unavailable' };
    if (!doctorWorkDays(selectedDoctor).includes(dayId)) {
      return { status: 'break', label: isAr ? 'عطلة' : 'Off day' };
    }

    const mins = toMinutes(time);
    const breakStart = selectedDoctor.break_start ? toMinutes(selectedDoctor.break_start) : null;
    const breakEnd = selectedDoctor.break_end ? toMinutes(selectedDoctor.break_end) : null;
    if (breakStart !== null && breakEnd !== null && mins >= breakStart && mins < breakEnd) {
      return { status: 'break', label: t('break_time') };
    }

    const appointment = appointmentForSlot(dateStr, time);
    if (appointment) {
      return {
        status: 'booked',
        label: appointment.patient_name || appointment.booking_code || t('booked'),
        sublabel: appointment.booking_code || '',
      };
    }

    if (isPastSlot(dateStr, time)) {
      return { status: 'past', label: isAr ? 'انتهى الوقت' : 'Past' };
    }

    return { status: 'available', label: t('available_slot') };
  };

  const shiftWeek = (days) => {
    setWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);

  const weekRange = `${weekStart.toLocaleDateString(isAr ? 'ar-IQ' : 'en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(isAr ? 'ar-IQ' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const todayStr = toISODate(new Date());
  const nowTime = toHHMM(new Date().getHours() * 60 + new Date().getMinutes());
  const currentTimeVisible = weekDays.some(day => day.dateStr === todayStr) && timeSlots.some(slot => slot.slice(0, 2) === nowTime.slice(0, 2));

  return (
    <div className="page-padding operational-page operational-schedule-page animate-in">
      <section className="operational-hero schedule-hero">
        <div>
          <span className="operational-kicker"><CalendarDays size={15} /> {t('weekly_view')}</span>
          <h1>{t('schedule_menu')}</h1>
          <p>{weekRange}</p>
          {isDemo && <span className="badge badge-warning">{isAr ? 'جدول تجريبي معزول' : 'Isolated demo schedule'}</span>}
        </div>
        <div className="schedule-toolbar">
          <button className="btn btn-outline btn-sm" onClick={() => shiftWeek(-7)}>
            <ChevronLeft size={15} /> {isAr ? 'السابق' : 'Previous'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setWeekStart(startOfWorkWeek(new Date()))}>
            <RotateCcw size={15} /> {isAr ? 'اليوم' : 'Today'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => shiftWeek(7)}>
            {isAr ? 'التالي' : 'Next'} <ChevronRight size={15} />
          </button>
        </div>
      </section>

      <section className="schedule-controls operational-panel">
        <div className="form-group mb-0">
          <label className="form-label">
            <Stethoscope size={14} style={{ display: 'inline', marginInlineEnd: 4 }} />
            {isAr ? 'الطبيب' : 'Doctor'}
          </label>
          <select
            className="input"
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            disabled={user?.role === 'doctor' || visibleDoctors.length === 0}
          >
            <option value="">{isAr ? 'اختر الطبيب...' : 'Select doctor...'}</option>
            {visibleDoctors.map(doctor => (
              <option key={doctor.id} value={doctor.id}>{getDoctorName(doctor, isAr)}</option>
            ))}
          </select>
        </div>
        {selectedDoctor && (
          <div className="schedule-doctor-summary">
            <span>{isAr ? 'ساعات الدوام' : 'Working hours'}</span>
            <strong><Clock size={14} /> {to12Hour(selectedDoctor.open_time || '09:00', isAr)} - {to12Hour(selectedDoctor.close_time || '17:00', isAr)}</strong>
            {selectedDoctor.break_start && selectedDoctor.break_end && (
              <em>{t('break_time')}: {to12Hour(selectedDoctor.break_start, isAr)} - {to12Hour(selectedDoctor.break_end, isAr)}</em>
            )}
          </div>
        )}
      </section>

      {loading ? (
        <div className="operational-panel"><div className="operational-loading"><span></span><span></span><span></span></div></div>
      ) : visibleDoctors.length === 0 ? (
        <div className="operational-empty">
          {user?.role === 'doctor'
            ? (isAr ? 'لا يوجد ملف طبيب مرتبط بهذا الحساب.' : 'No doctor profile is linked to this account.')
            : (isAr ? 'لا يوجد أطباء نشطون لعرض الجدول.' : 'No active doctors are available for the schedule.')}
        </div>
      ) : !selectedDoctor ? (
        <div className="operational-empty">{isAr ? 'اختر طبيباً لعرض الجدول.' : 'Select a doctor to view the schedule.'}</div>
      ) : timeSlots.length === 0 ? (
        <div className="operational-empty">{isAr ? 'لا توجد ساعات دوام صالحة لهذا الطبيب.' : 'This doctor does not have valid working hours.'}</div>
      ) : (
        <section className="schedule-board operational-panel">
          <div className="operational-panel-head">
            <div>
              <span>{getDoctorName(selectedDoctor, isAr)}</span>
              <h2>{isAr ? 'جدول الأسبوع' : 'Weekly schedule'}</h2>
            </div>
            {currentTimeVisible && <em>{isAr ? 'الوقت الحالي' : 'Current time'}: {to12Hour(nowTime, isAr)}</em>}
          </div>
          <div className="schedule-scroll">
            <div className="schedule-grid schedule-grid-premium">
              <div className="schedule-header schedule-header--time">{t('time')}</div>
              {weekDays.map(day => (
                <div key={day.dateStr} className={`schedule-header ${day.dateStr === todayStr ? 'is-today' : ''}`}>
                  <strong>{day.label}</strong>
                  <span>{day.dayNumber}</span>
                </div>
              ))}

              {timeSlots.map(time => (
                <div key={time} style={{ display: 'contents' }}>
                  <div className={`schedule-time ${time.slice(0, 2) === nowTime.slice(0, 2) ? 'is-current-hour' : ''}`}>{to12Hour(time, isAr)}</div>
                  {weekDays.map(day => {
                    const meta = getSlotMeta(day.dateStr, day.dayId, time);
                    return (
                      <div key={`${time}-${day.dateStr}`} className="schedule-cell">
                        <div className={`schedule-slot ${meta.status}`}>
                          <div>{meta.label}</div>
                          {meta.sublabel && <small>{meta.sublabel}</small>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ScheduleView;
