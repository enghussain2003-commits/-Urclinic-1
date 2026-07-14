const PLACEHOLDER_NAMES = new Set([
  'test',
  'testing',
  'user',
  'unknown',
  'fake',
  'demo',
  'asdf',
  'qwerty',
  'تجربة',
  'تجريبي',
  'مجهول',
  'وهمي',
  'مريض',
]);

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

const digitMap = new Map([
  ...Array.from(ARABIC_INDIC_DIGITS).map((ch, i) => [ch, String(i)]),
  ...Array.from(EASTERN_ARABIC_DIGITS).map((ch, i) => [ch, String(i)]),
]);

const messages = {
  nameRequired: {
    ar: 'يرجى كتابة الاسم الثلاثي أو اسم واضح من كلمتين',
    en: 'Please enter a clear full name with at least two words.',
  },
  nameLength: {
    ar: 'يجب أن يكون الاسم بين 4 و60 حرفاً',
    en: 'Name must be between 4 and 60 characters.',
  },
  nameWords: {
    ar: 'يرجى كتابة الاسم الثلاثي أو اسم واضح من كلمتين',
    en: 'Please enter at least two meaningful name parts.',
  },
  nameCharacters: {
    ar: 'الاسم يحتوي على رموز غير مسموحة',
    en: 'Name contains unsupported characters.',
  },
  nameRepeated: {
    ar: 'يرجى إدخال اسم واضح وليس أحرفاً مكررة',
    en: 'Please enter a real name, not repeated characters.',
  },
  namePlaceholder: {
    ar: 'يرجى إدخال اسم مريض حقيقي وليس اسماً تجريبياً',
    en: 'Please enter a real patient name, not a placeholder.',
  },
  phoneRequired: {
    ar: 'يرجى إدخال رقم عراقي صحيح مثل 07701234567',
    en: 'Please enter a valid Iraqi number like 07701234567.',
  },
  phoneInvalid: {
    ar: 'يرجى إدخال رقم عراقي صحيح مثل 07701234567',
    en: 'Please enter a valid Iraqi mobile number like 07701234567.',
  },
  phoneRepeated: {
    ar: 'رقم الهاتف غير صالح',
    en: 'Phone number is not valid.',
  },
};

export const identityMessage = (key, isAr = false) =>
  messages[key]?.[isAr ? 'ar' : 'en'] || messages[key]?.en || key;

export const normalizePersonName = (name = '') =>
  String(name)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const isPlaceholderName = (name = '') => {
  const normalized = normalizePersonName(name).toLowerCase();
  if (!normalized) return false;
  const compact = normalized.replace(/[\s'-]+/g, '');
  if (PLACEHOLDER_NAMES.has(normalized) || PLACEHOLDER_NAMES.has(compact)) return true;
  return normalized.split(/\s+/).some(part => PLACEHOLDER_NAMES.has(part));
};

export const validatePersonName = (name, { isAr = false } = {}) => {
  const normalized = normalizePersonName(name);
  if (!normalized) return { valid: false, value: normalized, error: identityMessage('nameRequired', isAr) };
  if (normalized.length < 4 || normalized.length > 60) {
    return { valid: false, value: normalized, error: identityMessage('nameLength', isAr) };
  }
  if (!/^[\p{L}\p{Script=Arabic}\s'-]+$/u.test(normalized) || /[\d٠-٩۰-۹]/u.test(normalized)) {
    return { valid: false, value: normalized, error: identityMessage('nameCharacters', isAr) };
  }
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { valid: false, value: normalized, error: identityMessage('nameWords', isAr) };
  }
  const compact = normalized.replace(/[\s'-]/g, '');
  if (/^([\p{L}\p{Script=Arabic}])\1{5,}$/u.test(compact)) {
    return { valid: false, value: normalized, error: identityMessage('nameRepeated', isAr) };
  }
  if (isPlaceholderName(normalized)) {
    return { valid: false, value: normalized, error: identityMessage('namePlaceholder', isAr) };
  }
  return { valid: true, value: normalized, error: '' };
};

const normalizeDigits = (value = '') =>
  String(value).replace(/[٠-٩۰-۹]/g, ch => digitMap.get(ch) || ch);

export const normalizeIraqiPhone = (phone = '') => {
  const raw = normalizeDigits(phone).trim();
  if (/[A-Za-z\u0600-\u06FF]/.test(raw)) return null;
  const cleaned = raw.replace(/[\s\-().]/g, '');
  let local = null;

  if (/^07\d{9}$/.test(cleaned)) {
    local = cleaned.slice(1);
  } else if (/^\+9647\d{9}$/.test(cleaned)) {
    local = cleaned.slice(4);
  } else if (/^9647\d{9}$/.test(cleaned)) {
    local = cleaned.slice(3);
  }

  if (!local || !/^7\d{9}$/.test(local)) return null;
  const subscriber = local.slice(1);
  if (/^(\d)\1{8}$/.test(subscriber)) return null;
  if (/^0{9}$/.test(subscriber)) return null;

  return `+964${local}`;
};

export const validateIraqiPhone = (phone, { isAr = false } = {}) => {
  if (!String(phone || '').trim()) {
    return { valid: false, value: '', error: identityMessage('phoneRequired', isAr) };
  }
  const normalized = normalizeIraqiPhone(phone);
  if (!normalized) {
    return { valid: false, value: '', error: identityMessage('phoneInvalid', isAr) };
  }
  return { valid: true, value: normalized, error: '' };
};
