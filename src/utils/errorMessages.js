const TEXT = {
  auth: {
    ar: 'تعذر إنشاء الحساب. يرجى التحقق من البيانات والمحاولة مرة أخرى.',
    en: 'Unable to create your account. Please check your information and try again.',
  },
  login: {
    ar: 'تعذر تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.',
    en: 'Unable to sign in. Please check your email and password.',
  },
  duplicateEmail: {
    ar: 'البريد الإلكتروني مستخدم مسبقاً.',
    en: 'This email is already registered.',
  },
  duplicatePhone: {
    ar: 'رقم الهاتف مستخدم مسبقاً.',
    en: 'This phone number is already registered.',
  },
  weakPassword: {
    ar: 'كلمة المرور لا تحقق متطلبات الأمان.',
    en: 'Password does not meet security requirements.',
  },
  network: {
    ar: 'تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.',
    en: 'Unable to connect to the server. Please try again.',
  },
  permission: {
    ar: 'ليس لديك صلاحية لتنفيذ هذه العملية.',
    en: "You don't have permission to perform this action.",
  },
  booking: {
    ar: 'تعذر إكمال الحجز. يرجى المحاولة مرة أخرى.',
    en: 'Unable to complete booking. Please try again.',
  },
  appointmentStatus: {
    ar: 'تعذر تحديث حالة الموعد. يرجى المحاولة مرة أخرى.',
    en: 'Unable to update appointment status. Please try again.',
  },
  payment: {
    ar: 'تعذر إكمال الموعد وتسجيل الدفع. يرجى المحاولة مرة أخرى.',
    en: 'Unable to complete the appointment and record payment. Please try again.',
  },
  support: {
    ar: 'تعذر تنفيذ إجراء الدعم. يرجى المحاولة مرة أخرى.',
    en: 'Unable to complete the support action. Please try again.',
  },
  profile: {
    ar: 'تعذر تحديث الملف الشخصي. يرجى المحاولة مرة أخرى.',
    en: 'Unable to update the profile. Please try again.',
  },
  prescription: {
    ar: 'تعذر حفظ الوصفة. يرجى المحاولة مرة أخرى.',
    en: 'Unable to save the prescription. Please try again.',
  },
  fileUpload: {
    ar: 'تعذر رفع الملف. يرجى التحقق من نوع وحجم الملف والمحاولة مرة أخرى.',
    en: 'Unable to upload the file. Please check the file type and size and try again.',
  },
  settings: {
    ar: 'تعذر حفظ الإعدادات. يرجى المحاولة مرة أخرى.',
    en: 'Unable to save settings. Please try again.',
  },
  load: {
    ar: 'تعذر تحميل البيانات. يرجى المحاولة مرة أخرى.',
    en: 'Unable to load data. Please try again.',
  },
  request: {
    ar: 'تعذر إكمال الطلب. يرجى المحاولة مرة أخرى.',
    en: 'Unable to complete the request. Please try again.',
  },
  unexpected: {
    ar: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
    en: 'An unexpected error occurred. Please try again.',
  },
  slotTaken: {
    ar: 'عذراً، تم حجز هذا الموعد قبل لحظات. يرجى اختيار وقت آخر.',
    en: 'Sorry, this appointment was just booked. Please choose another time.',
  },
  activeAppointment: {
    ar: 'لديك موعد نشط بالفعل. يرجى الانتظار حتى تكتمل زيارتك الحالية.',
    en: 'You already have an active appointment. Please wait until your current visit is completed.',
  },
  bookingCooldown: {
    ar: 'تم إرسال طلب حجز مؤخراً. يرجى الانتظار قليلاً قبل المحاولة مرة أخرى.',
    en: 'A booking request was sent recently. Please wait a moment before trying again.',
  },
};

const readErrorText = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return [
    error.message,
    error.error_description,
    error.details,
    error.hint,
    error.code,
    error.status,
    error.name,
  ].filter(Boolean).join(' ');
};

const hasAny = (value, terms) => terms.some(term => value.includes(term));

const pick = (key, isAr) => (TEXT[key] || TEXT.unexpected)[isAr ? 'ar' : 'en'];

export const getLocalizedErrorMessage = (error, options = {}) => {
  const { isAr = false, fallback = 'unexpected' } = options;
  const raw = readErrorText(error);
  const lower = raw.toLowerCase();
  const code = String(error?.code || error?.status || '').toLowerCase();

  if (
    hasAny(lower, ['failed to fetch', 'networkerror', 'network error', 'load failed', 'timeout', 'aborterror']) ||
    code === '0'
  ) {
    return pick('network', isAr);
  }

  if (
    code === '42501' ||
    code === '401' ||
    code === '403' ||
    hasAny(lower, ['permission denied', 'not authorized', 'unauthorized', 'row-level security', 'rls', 'jwt'])
  ) {
    return pick('permission', isAr);
  }

  if (
    hasAny(lower, ['weak password', 'password should', 'password must', 'password is too weak']) ||
    (fallback === 'auth' && lower.includes('password'))
  ) {
    return pick('weakPassword', isAr);
  }

  if (
    hasAny(lower, ['email already', 'already registered', 'user already registered', 'duplicate email']) ||
    (code === '23505' && lower.includes('email'))
  ) {
    return pick('duplicateEmail', isAr);
  }

  if (
    hasAny(lower, ['phone already', 'phone number is already', 'duplicate phone', 'patients_phone', 'profiles_patient_phone']) ||
    (code === '23505' && lower.includes('phone'))
  ) {
    return pick('duplicatePhone', isAr);
  }

  if (hasAny(lower, ['appointments_doctor_active_slot_uniq', 'appointments_doctor_slot_uniq', 'just booked', 'slot'])) {
    return pick('slotTaken', isAr);
  }

  if (hasAny(lower, ['patient already has an active appointment', 'active appointment'])) {
    return pick('activeAppointment', isAr);
  }

  if (hasAny(lower, ['booking rate limit exceeded', 'rate limit'])) {
    return pick('bookingCooldown', isAr);
  }

  if (hasAny(lower, ['unsupported attachment', 'unsupported file', 'attachment must', 'file size', 'storage'])) {
    return pick('fileUpload', isAr);
  }

  if (hasAny(lower, ['database error saving new user', 'signup', 'sign up'])) {
    return pick('auth', isAr);
  }

  return pick(fallback, isAr);
};

export const translateAppError = getLocalizedErrorMessage;

