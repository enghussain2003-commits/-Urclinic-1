import { supabase } from '../supabaseClient';

export const IRAQI_GOVERNORATES = [
  { id: 'Baghdad', en: 'Baghdad', ar: 'بغداد' },
  { id: 'Basra', en: 'Basra', ar: 'البصرة' },
  { id: 'Dhi Qar', en: 'Dhi Qar', ar: 'ذي قار' },
  { id: 'Maysan', en: 'Maysan', ar: 'ميسان' },
  { id: 'Muthanna', en: 'Muthanna', ar: 'المثنى' },
  { id: 'Qadisiyah', en: 'Qadisiyah', ar: 'القادسية' },
  { id: 'Najaf', en: 'Najaf', ar: 'النجف' },
  { id: 'Karbala', en: 'Karbala', ar: 'كربلاء' },
  { id: 'Babil', en: 'Babil', ar: 'بابل' },
  { id: 'Wasit', en: 'Wasit', ar: 'واسط' },
  { id: 'Diyala', en: 'Diyala', ar: 'ديالى' },
  { id: 'Anbar', en: 'Anbar', ar: 'الأنبار' },
  { id: 'Salah al-Din', en: 'Salah al-Din', ar: 'صلاح الدين' },
  { id: 'Kirkuk', en: 'Kirkuk', ar: 'كركوك' },
  { id: 'Nineveh', en: 'Nineveh', ar: 'نينوى' },
  { id: 'Erbil', en: 'Erbil', ar: 'أربيل' },
  { id: 'Sulaymaniyah', en: 'Sulaymaniyah', ar: 'السليمانية' },
  { id: 'Duhok', en: 'Duhok', ar: 'دهوك' },
  { id: 'Halabja', en: 'Halabja', ar: 'حلبجة' },
];

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
