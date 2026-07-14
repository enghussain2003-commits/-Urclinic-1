export const PATIENT_CALL_NOTIFICATION_TYPE = 'patient_call';
export const PATIENT_CALL_SOUND_KEY = 'urclinic_patient_call_sound_enabled';
export const PATIENT_CALL_RECIPIENT_ROLES = ['clinic_admin', 'employee'];
export const PATIENT_CALL_ELIGIBLE_STATUSES = ['approved', 'in_progress', 'checked_in'];

export const isPatientCallNotification = (notification) =>
  notification?.type === PATIENT_CALL_NOTIFICATION_TYPE;

export const isPatientCallRecipientRole = (role) =>
  PATIENT_CALL_RECIPIENT_ROLES.includes(String(role || '').trim().toLowerCase());

export const isPatientCallEligibleStatus = (status) =>
  PATIENT_CALL_ELIGIBLE_STATUSES.includes(String(status || '').trim().toLowerCase());

export const readPatientCallSoundPreference = () => {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(PATIENT_CALL_SOUND_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const savePatientCallSoundPreference = (enabled) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PATIENT_CALL_SOUND_KEY, enabled ? 'true' : 'false');
  } catch {
    // Sound preference is non-critical.
  }
};

export const playPatientCallChime = () => {
  if (typeof window === 'undefined' || !readPatientCallSoundPreference()) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.13, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.48);

    [660, 880].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + index * 0.16);
      oscillator.connect(gain);
      oscillator.start(ctx.currentTime + index * 0.16);
      oscillator.stop(ctx.currentTime + index * 0.16 + 0.16);
    });

    window.setTimeout(() => ctx.close?.(), 700);
  } catch {
    // Browsers may block audio before user interaction; the visual alert remains.
  }
};

export const patientCallRouteForNotification = (notification) =>
  notification?.route
  || notification?.metadata?.route
  || (notification?.patient_id ? `/dashboard/patients/${notification.patient_id}` : null);

export const localizedPatientCallText = (notification, field, isAr) => {
  const localizedKey = `${field}_${isAr ? 'ar' : 'en'}`;
  const fallbackKey = `${field}_${isAr ? 'en' : 'ar'}`;
  return notification?.metadata?.[localizedKey]
    || notification?.metadata?.[fallbackKey]
    || notification?.[field]
    || '';
};

export const patientCallMetaLine = (notification, isAr) => {
  const bookingCode = notification?.booking_code || notification?.metadata?.booking_code;
  const timeValue = notification?.appointment_time || notification?.metadata?.appointment_time;
  const parts = [];

  if (bookingCode) {
    parts.push(isAr ? `رقم الحجز: ${bookingCode}` : `Booking: ${bookingCode}`);
  }
  if (timeValue) {
    const timeLabel = String(timeValue).slice(0, 5);
    parts.push(isAr ? `الوقت: ${timeLabel}` : `Time: ${timeLabel}`);
  }

  return parts.join(isAr ? ' · ' : ' · ');
};

export const patientCallErrorMessage = (code, isAr) => {
  const messages = {
    PATIENT_CALL_SENT: {
      ar: 'تم إرسال استدعاء المريض إلى فريق الاستقبال.',
      en: 'Patient call sent to the reception team.',
    },
    PATIENT_CALL_COOLDOWN: {
      ar: 'تم استدعاء هذا المريض قبل لحظات. يرجى الانتظار دقيقة قبل الإرسال مجدداً.',
      en: 'This patient was called moments ago. Please wait a minute before trying again.',
    },
    PATIENT_CALL_NO_RECIPIENTS: {
      ar: 'لا يوجد موظف استقبال أو مدير عيادة نشط لاستلام الاستدعاء الآن.',
      en: 'No active clinic admin or employee is available to receive this call right now.',
    },
    PATIENT_CALL_NOT_TODAY: {
      ar: 'يمكن استدعاء مرضى مواعيد اليوم فقط.',
      en: "Only today's appointments can be called.",
    },
    PATIENT_CALL_INELIGIBLE_STATUS: {
      ar: 'لا يمكن استدعاء المريض في حالة هذا الموعد.',
      en: 'This appointment status cannot be called.',
    },
    PATIENT_CALL_WRONG_DOCTOR: {
      ar: 'لا يمكنك استدعاء مريض غير مخصص لك.',
      en: "You can't call a patient assigned to another doctor.",
    },
    PATIENT_CALL_CLINIC_MISMATCH: {
      ar: 'لا يمكنك تنفيذ هذا الإجراء خارج عيادتك.',
      en: "You can't perform this action outside your clinic.",
    },
    PATIENT_CALL_DOCTOR_ONLY: {
      ar: 'استدعاء المرضى متاح للطبيب المعالج فقط.',
      en: 'Patient calls are available only to the assigned doctor.',
    },
    PATIENT_CALL_ACK_NOT_ALLOWED: {
      ar: 'ليست لديك صلاحية لتأكيد هذا الاستدعاء.',
      en: "You don't have permission to acknowledge this call.",
    },
  };

  return messages[code]?.[isAr ? 'ar' : 'en']
    || (isAr
      ? 'تعذر تنفيذ استدعاء المريض. يرجى المحاولة مرة أخرى.'
      : 'Unable to process the patient call. Please try again.');
};
