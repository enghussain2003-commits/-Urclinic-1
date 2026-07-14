import { supabase } from '../supabaseClient';

export const IRAQI_GOVERNORATES = [
  { id: 'Baghdad', en: 'Baghdad', ar: 'بغداد' },
  { id: 'Basra', en: 'Basra', ar: 'البصرة' },
  { id: 'Nineveh', en: 'Nineveh', ar: 'نينوى' },
  { id: 'Erbil', en: 'Erbil', ar: 'أربيل' },
  { id: 'Najaf', en: 'Najaf', ar: 'النجف' },
  { id: 'Karbala', en: 'Karbala', ar: 'كربلاء' },
  { id: 'Dhi Qar', en: 'Dhi Qar', ar: 'ذي قار' },
  { id: 'Maysan', en: 'Maysan', ar: 'ميسان' },
  { id: 'Muthanna', en: 'Muthanna', ar: 'المثنى' },
  { id: 'Wasit', en: 'Wasit', ar: 'واسط' },
  { id: 'Babil', en: 'Babil', ar: 'بابل' },
  { id: 'Al-Qadisiyah', en: 'Al-Qadisiyah', ar: 'القادسية' },
  { id: 'Diyala', en: 'Diyala', ar: 'ديالى' },
  { id: 'Kirkuk', en: 'Kirkuk', ar: 'كركوك' },
  { id: 'Anbar', en: 'Anbar', ar: 'الأنبار' },
  { id: 'Salah Al-Din', en: 'Salah Al-Din', ar: 'صلاح الدين' },
  { id: 'Dohuk', en: 'Dohuk', ar: 'دهوك' },
  { id: 'Sulaymaniyah', en: 'Sulaymaniyah', ar: 'السليمانية' },
];

const GOVERNORATE_ALIASES = new Map([
  ['Qadisiyah', 'Al-Qadisiyah'],
  ['Al Qadisiyah', 'Al-Qadisiyah'],
  ['القادسية', 'Al-Qadisiyah'],
  ['Salah al-Din', 'Salah Al-Din'],
  ['Salah Al Din', 'Salah Al-Din'],
  ['صلاح الدين', 'Salah Al-Din'],
  ['Duhok', 'Dohuk'],
  ['دهوك', 'Dohuk'],
  ['بغداد', 'Baghdad'],
  ['البصرة', 'Basra'],
  ['نينوى', 'Nineveh'],
  ['أربيل', 'Erbil'],
  ['اربيل', 'Erbil'],
  ['النجف', 'Najaf'],
  ['كربلاء', 'Karbala'],
  ['ذي قار', 'Dhi Qar'],
  ['ميسان', 'Maysan'],
  ['المثنى', 'Muthanna'],
  ['واسط', 'Wasit'],
  ['بابل', 'Babil'],
  ['ديالى', 'Diyala'],
  ['كركوك', 'Kirkuk'],
  ['الأنبار', 'Anbar'],
  ['الانبار', 'Anbar'],
  ['السليمانية', 'Sulaymaniyah'],
]);

const GOVERNORATE_IDS = new Set(IRAQI_GOVERNORATES.map(g => g.id));

export const normalizeGovernorate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (GOVERNORATE_IDS.has(raw)) return raw;
  return GOVERNORATE_ALIASES.get(raw) || raw;
};

export const governorateLabel = (value, isAr = false) => {
  const normalized = normalizeGovernorate(value);
  const found = IRAQI_GOVERNORATES.find(g => g.id === normalized);
  return found ? (isAr ? found.ar : found.en) : '';
};

export const WORK_DAYS = [
  { id: 'sat', en: 'Sat', ar: 'السبت' },
  { id: 'sun', en: 'Sun', ar: 'الأحد' },
  { id: 'mon', en: 'Mon', ar: 'الإثنين' },
  { id: 'tue', en: 'Tue', ar: 'الثلاثاء' },
  { id: 'wed', en: 'Wed', ar: 'الأربعاء' },
  { id: 'thu', en: 'Thu', ar: 'الخميس' },
  { id: 'fri', en: 'Fri', ar: 'الجمعة' },
];

export const APPOINTMENT_DURATIONS = [15, 20, 30, 45, 60];

export const callSuperAdmin = async (action, payload = {}) => {
  const { data, error } = await supabase.functions.invoke('super-admin-management', {
    body: { action, payload },
  });
  if (error) {
    console.error('Super Admin function failed:', { action, error });
    throw new Error('super_admin_request_failed');
  }
  if (data?.error) {
    console.error('Super Admin function returned an error:', { action, error: data.error });
    throw new Error('super_admin_request_failed');
  }
  return data;
};

export const generateStrongPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%';
  const all = upper + lower + digits + symbols;
  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < 14) chars.push(pick(all));
  return chars.sort(() => Math.random() - 0.5).join('');
};

export const passwordScore = (password) => {
  let score = 0;
  if ((password || '').length >= 8) score += 1;
  if ((password || '').length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
};

export const routeForRole = (role) => {
  if (['super_admin', 'clinic_admin', 'doctor', 'employee'].includes(role)) return '/dashboard';
  return '/';
};
