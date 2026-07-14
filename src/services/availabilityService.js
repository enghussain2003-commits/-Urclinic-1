import { supabase } from '../supabaseClient';

export const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const IRAQ_DAY_ORDER = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
export const DEFAULT_PERIODS = [{ start_time: '09:00', end_time: '17:00' }];
export const AVAILABILITY_REASONS = [
  'vacation',
  'travel',
  'unavailable',
  'sick_leave',
  'holiday',
  'emergency',
  'maintenance',
  'power_outage',
  'other',
];

export const dayLabel = (dayId, isAr) => ({
  sat: isAr ? 'السبت' : 'Saturday',
  sun: isAr ? 'الأحد' : 'Sunday',
  mon: isAr ? 'الإثنين' : 'Monday',
  tue: isAr ? 'الثلاثاء' : 'Tuesday',
  wed: isAr ? 'الأربعاء' : 'Wednesday',
  thu: isAr ? 'الخميس' : 'Thursday',
  fri: isAr ? 'الجمعة' : 'Friday',
}[dayId] || dayId);

export const reasonLabel = (reason, isAr) => ({
  vacation: isAr ? 'إجازة' : 'Vacation',
  travel: isAr ? 'سفر الطبيب' : 'Doctor traveling',
  unavailable: isAr ? 'غير متاح' : 'Unavailable',
  sick_leave: isAr ? 'إجازة مرضية' : 'Sick leave',
  holiday: isAr ? 'عطلة رسمية' : 'Official holiday',
  emergency: isAr ? 'طارئ' : 'Emergency',
  maintenance: isAr ? 'صيانة' : 'Maintenance',
  power_outage: isAr ? 'انقطاع كهرباء' : 'Power outage',
  other: isAr ? 'أخرى' : 'Other',
}[reason] || reason);

export const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const toHHMM = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export const localDateKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const dateForKey = (dateKey) => new Date(`${dateKey}T00:00:00`);
export const dayIdForDate = (dateKey) => DAY_IDS[dateForKey(dateKey).getDay()];

export const normalizePeriod = (period, order = 0) => ({
  id: period?.id,
  day_of_week: period?.day_of_week,
  start_time: String(period?.start_time || period?.start || '09:00').slice(0, 5),
  end_time: String(period?.end_time || period?.end || '17:00').slice(0, 5),
  period_order: Number(period?.period_order ?? order),
});

export const periodIsValid = (period) =>
  period?.start_time && period?.end_time && toMinutes(period.start_time) < toMinutes(period.end_time);

export const groupPeriodsByDay = (periods = []) => {
  const grouped = Object.fromEntries(IRAQ_DAY_ORDER.map(day => [day, []]));
  (periods || []).forEach((period, index) => {
    const normalized = normalizePeriod(period, index);
    const day = normalized.day_of_week;
    if (!grouped[day]) grouped[day] = [];
    if (periodIsValid(normalized)) grouped[day].push(normalized);
  });
  IRAQ_DAY_ORDER.forEach(day => grouped[day].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time)));
  return grouped;
};

export const flattenSchedule = (schedule = {}, { clinicId, doctorId = null, actorId = null } = {}) =>
  IRAQ_DAY_ORDER.flatMap(day => (schedule[day] || [])
    .map((period, index) => normalizePeriod({ ...period, day_of_week: day }, index))
    .filter(periodIsValid)
    .map((period, index) => ({
      clinic_id: clinicId,
      doctor_id: doctorId,
      day_of_week: day,
      start_time: period.start_time,
      end_time: period.end_time,
      period_order: index,
      is_active: true,
      created_by: actorId,
    })));

export const legacyPeriodsForDoctor = (doctor, dateKey) => {
  const day = dayIdForDate(dateKey);
  const workDays = Array.isArray(doctor?.work_days) && doctor.work_days.length
    ? doctor.work_days
    : ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'];
  if (!workDays.includes(day)) return [];

  const open = String(doctor?.open_time || '09:00').slice(0, 5);
  const close = String(doctor?.close_time || '17:00').slice(0, 5);
  const breakStart = doctor?.break_start ? String(doctor.break_start).slice(0, 5) : null;
  const breakEnd = doctor?.break_end ? String(doctor.break_end).slice(0, 5) : null;
  if (!breakStart || !breakEnd) return [{ start_time: open, end_time: close }];
  return [
    { start_time: open, end_time: breakStart },
    { start_time: breakEnd, end_time: close },
  ].filter(periodIsValid);
};

export const periodsForDate = ({ periods = [], doctor, dateKey, doctorOnly = false }) => {
  const day = dayIdForDate(dateKey);
  const active = (periods || [])
    .filter(period => period.is_active !== false && period.day_of_week === day)
    .map(normalizePeriod)
    .filter(periodIsValid);

  if (active.length) return active.sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  return doctor && doctorOnly ? legacyPeriodsForDoctor(doctor, dateKey) : active;
};

export const closureAppliesToDate = (closure, dateKey, time = null) => {
  if (!closure || dateKey < closure.starts_on || dateKey > closure.ends_on) return false;
  if (!time || !closure.start_time || !closure.end_time) return true;
  const mins = toMinutes(time);
  return mins >= toMinutes(closure.start_time) && mins < toMinutes(closure.end_time);
};

export const activeClosuresForDate = ({ closures = [], dateKey, doctorId = null, includeClinic = true }) =>
  (closures || []).filter(closure => {
    const matchesTarget = doctorId
      ? (String(closure.doctor_id || '') === String(doctorId) || (includeClinic && !closure.doctor_id))
      : !closure.doctor_id;
    return matchesTarget && closureAppliesToDate(closure, dateKey);
  });

export const getReturnLabel = (closure, isAr) => {
  const returnDate = closure?.return_on || closure?.ends_on;
  if (!returnDate) return '';
  const diff = Math.ceil((dateForKey(returnDate).getTime() - dateForKey(localDateKey()).getTime()) / 86400000);
  if (diff > 1) return isAr ? `العودة خلال ${diff} أيام` : `Returns in ${diff} days`;
  if (diff === 1) return isAr ? 'العودة غداً' : 'Returns tomorrow';
  return isAr ? `العودة في ${returnDate}` : `Returns on ${returnDate}`;
};

export const evaluateAvailability = ({ clinicPeriods = [], doctorPeriods = [], closures = [], doctor = null, dateKey = localDateKey(), isAr = false } = {}) => {
  const clinicClosure = activeClosuresForDate({ closures, dateKey, doctorId: null })[0];
  if (clinicClosure) {
    return {
      status: 'temporarily_closed',
      available: false,
      badgeClass: 'availability-badge availability-badge--closed',
      label: isAr ? 'مغلق مؤقتاً' : 'Temporarily Closed',
      detail: `${reasonLabel(clinicClosure.reason, isAr)} · ${getReturnLabel(clinicClosure, isAr)}`,
      closure: clinicClosure,
    };
  }

  const doctorClosure = doctor?.id
    ? activeClosuresForDate({ closures, dateKey, doctorId: doctor.id, includeClinic: false })[0]
    : null;
  if (doctorClosure) {
    const isTravel = doctorClosure.closure_type === 'travel' || doctorClosure.reason === 'travel';
    const isVacation = doctorClosure.closure_type === 'vacation' || doctorClosure.reason === 'vacation';
    return {
      status: isTravel ? 'traveling' : isVacation ? 'vacation' : 'doctor_unavailable',
      available: false,
      badgeClass: 'availability-badge availability-badge--warning',
      label: isTravel
        ? (isAr ? 'الطبيب مسافر' : 'Doctor Traveling')
        : isVacation
          ? (isAr ? 'الطبيب في إجازة' : 'Doctor On Vacation')
          : (isAr ? 'الطبيب غير متاح' : 'Doctor Unavailable'),
      detail: getReturnLabel(doctorClosure, isAr),
      closure: doctorClosure,
    };
  }

  const day = dayIdForDate(dateKey);
  const clinicDayPeriods = (clinicPeriods || []).filter(period => period.day_of_week === day && period.is_active !== false);
  const doctorDayPeriods = periodsForDate({ periods: doctorPeriods, doctor, dateKey, doctorOnly: true });
  const effectivePeriods = doctor ? doctorDayPeriods : clinicDayPeriods.map(normalizePeriod);
  if (!effectivePeriods.length) {
    return {
      status: 'closed_today',
      available: false,
      badgeClass: 'availability-badge availability-badge--closed',
      label: isAr ? 'مغلق اليوم' : 'Closed Today',
      detail: '',
    };
  }

  const today = localDateKey();
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  if (dateKey === today) {
    const current = effectivePeriods.find(period => currentMins >= toMinutes(period.start_time) && currentMins < toMinutes(period.end_time));
    if (current) {
      return {
        status: 'open_now',
        available: true,
        badgeClass: 'availability-badge availability-badge--open',
        label: isAr ? 'مفتوح الآن' : 'Open Now',
        detail: `${current.start_time} - ${current.end_time}`,
      };
    }
    const next = effectivePeriods.find(period => toMinutes(period.start_time) > currentMins);
    if (next) {
      return {
        status: 'opens_today',
        available: true,
        badgeClass: 'availability-badge availability-badge--soon',
        label: isAr ? `مغلق — يفتح اليوم ${next.start_time}` : `Closed — Opens today at ${next.start_time}`,
        detail: `${next.start_time} - ${next.end_time}`,
      };
    }
    return {
      status: 'closed_today',
      available: false,
      badgeClass: 'availability-badge availability-badge--closed',
      label: isAr ? 'مغلق اليوم' : 'Closed Today',
      detail: '',
    };
  }

  return {
    status: 'future_available',
    available: true,
    badgeClass: 'availability-badge availability-badge--future',
    label: isAr ? 'الحجز المستقبلي متاح' : 'Future Booking Available',
    detail: effectivePeriods.map(p => `${p.start_time}-${p.end_time}`).join(' · '),
  };
};

export const generateAvailabilitySlots = ({ doctor, dateKey, doctorPeriods = [], clinicPeriods = [], closures = [], occupied = [], step = 30 }) => {
  const clinicClosed = activeClosuresForDate({ closures, dateKey, doctorId: null }).some(c => !c.allow_future_booking || dateKey <= c.ends_on);
  const doctorClosed = doctor?.id && activeClosuresForDate({ closures, dateKey, doctorId: doctor.id, includeClinic: false }).some(c => !c.allow_future_booking || dateKey <= c.ends_on);
  if (clinicClosed || doctorClosed) return [];

  const day = dayIdForDate(dateKey);
  const clinicOpen = (clinicPeriods || []).some(p => p.is_active !== false && p.day_of_week === day);
  if (clinicPeriods.length && !clinicOpen) return [];

  const periods = periodsForDate({ periods: doctorPeriods, doctor, dateKey, doctorOnly: true });
  const today = localDateKey();
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const occupiedSet = new Set((occupied || []).map(time => String(time).slice(0, 5)));
  const slots = [];

  periods.forEach(period => {
    for (let mins = toMinutes(period.start_time); mins + step <= toMinutes(period.end_time); mins += step) {
      const time = toHHMM(mins);
      const closedAtTime = activeClosuresForDate({ closures, dateKey, doctorId: doctor?.id, includeClinic: true })
        .some(closure => closureAppliesToDate(closure, dateKey, time));
      const past = dateKey === today && mins <= currentMins;
      const booked = occupiedSet.has(time);
      slots.push({ time, status: closedAtTime ? 'closed' : past ? 'past' : booked ? 'booked' : 'available' });
    }
  });

  return slots;
};

export const loadAvailabilityForClinics = async (clinicIds = []) => {
  const ids = Array.from(new Set((clinicIds || []).filter(Boolean).map(String)));
  if (!ids.length) return { periods: [], closures: [] };
  const [periodRes, closureRes] = await Promise.all([
    supabase.from('availability_weekly_periods').select('*').in('clinic_id', ids).eq('is_active', true).order('period_order'),
    supabase.from('availability_closures').select('*').in('clinic_id', ids).gte('ends_on', localDateKey()).order('starts_on'),
  ]);
  if (periodRes.error) throw periodRes.error;
  if (closureRes.error) throw closureRes.error;
  return { periods: periodRes.data || [], closures: closureRes.data || [] };
};

export const saveWeeklySchedule = async ({ clinicId, doctorId = null, schedule, actorId }) => {
  const rows = flattenSchedule(schedule, { clinicId, doctorId, actorId });
  let deleteQuery = supabase
    .from('availability_weekly_periods')
    .delete()
    .eq('clinic_id', clinicId);
  deleteQuery = doctorId ? deleteQuery.eq('doctor_id', doctorId) : deleteQuery.is('doctor_id', null);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;
  if (rows.length) {
    const { error: insertError } = await supabase.from('availability_weekly_periods').insert(rows);
    if (insertError) throw insertError;
  }
  await supabase.from('availability_audit_logs').insert({
    clinic_id: clinicId,
    doctor_id: doctorId,
    actor_id: actorId,
    action: doctorId ? 'doctor_weekly_schedule_updated' : 'clinic_weekly_schedule_updated',
    new_value: { schedule },
  });
};

export const createAvailabilityClosure = async ({ clinicId, doctorId = null, closure, actorId }) => {
  const payload = {
    clinic_id: clinicId,
    doctor_id: doctorId || null,
    closure_type: closure.closure_type || closure.reason || 'temporary',
    starts_on: closure.starts_on,
    ends_on: closure.ends_on,
    return_on: closure.return_on || closure.ends_on,
    start_time: closure.start_time || null,
    end_time: closure.end_time || null,
    reason: closure.reason || closure.closure_type || 'other',
    note: closure.note || null,
    allow_future_booking: closure.allow_future_booking !== false,
    notify_patients: closure.notify_patients !== false,
    created_by: actorId,
  };
  const { data, error } = await supabase.from('availability_closures').insert(payload).select('*').single();
  if (error) throw error;
  await supabase.from('availability_audit_logs').insert({
    clinic_id: clinicId,
    doctor_id: doctorId || null,
    actor_id: actorId,
    action: doctorId ? 'doctor_closure_created' : 'clinic_closure_created',
    new_value: data,
  });
  return data;
};

export const deleteAvailabilityClosure = async ({ closureId }) => {
  const { error } = await supabase.from('availability_closures').delete().eq('id', closureId);
  if (error) throw error;
};

export const appointmentConflictsWithSchedule = ({ appointments = [], schedule = {}, closures = [], doctorId = null }) =>
  (appointments || []).filter(appointment => {
    if (!['pending', 'approved', 'confirmed', 'in_progress'].includes(String(appointment.status))) return false;
    if (doctorId && String(appointment.doctor_id) !== String(doctorId)) return false;
    const dateKey = appointment.date || appointment.appointment_date;
    const time = String(appointment.time || appointment.appointment_time || '').slice(0, 5);
    if (!dateKey || !time) return false;
    const day = dayIdForDate(dateKey);
    const periods = (schedule[day] || []).map(normalizePeriod).filter(periodIsValid);
    const inside = periods.some(period => toMinutes(time) >= toMinutes(period.start_time) && toMinutes(time) < toMinutes(period.end_time));
    const closed = (closures || []).some(closure => closureAppliesToDate(closure, dateKey, time));
    return closed || !inside;
  });
