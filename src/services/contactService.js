const IRAQ_COUNTRY_CODE = '964';
const IRAQI_LOCAL_MOBILE = /^07\d{9}$/;
const IRAQI_INTERNATIONAL_MOBILE = /^9647\d{9}$/;

export const normalizePhoneNumber = (rawPhone) => {
  const cleaned = String(rawPhone || '')
    .trim()
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '');

  if (!cleaned) return null;
  if (IRAQI_LOCAL_MOBILE.test(cleaned)) return `${IRAQ_COUNTRY_CODE}${cleaned.slice(1)}`;
  if (IRAQI_INTERNATIONAL_MOBILE.test(cleaned)) return cleaned;
  return null;
};

export const buildWhatsAppUrl = (phone, message = '') => {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) return null;
  const encodedMessage = encodeURIComponent(message || '');
  return `https://wa.me/${normalizedPhone}${encodedMessage ? `?text=${encodedMessage}` : ''}`;
};

export const contactRole = (role) => String(role || '').trim().toLowerCase();

export const canContactUser = ({ actor, target, allowPatientDoctorPhone = false } = {}) => {
  const actorRole = contactRole(actor?.role);
  const targetRole = contactRole(target?.role);
  const sameClinic = actor?.clinic_id && target?.clinic_id && String(actor.clinic_id) === String(target.clinic_id);

  if (!actorRole || !targetRole) return false;
  if (actorRole === 'super_admin') return ['clinic_admin', 'doctor', 'employee', 'patient'].includes(targetRole);
  if (actorRole === 'clinic_admin') {
    if (targetRole === 'super_admin') return true;
    return sameClinic && ['clinic_admin', 'doctor', 'employee', 'patient'].includes(targetRole);
  }
  if (actorRole === 'employee') {
    if (targetRole === 'super_admin') return true;
    return sameClinic && ['doctor', 'clinic_admin', 'patient'].includes(targetRole);
  }
  if (actorRole === 'doctor') {
    if (targetRole === 'super_admin') return true;
    return sameClinic && ['clinic_admin', 'employee', 'patient'].includes(targetRole);
  }
  if (actorRole === 'patient') {
    if (targetRole === 'super_admin' || targetRole === 'clinic_admin' || targetRole === 'clinic_support') return true;
    return allowPatientDoctorPhone && targetRole === 'doctor';
  }
  return false;
};

export const buildContactMessage = ({
  type = 'general',
  isAr = true,
  patientName = '',
  clinicName = '',
  appointmentDate = '',
  appointmentTime = '',
  name = '',
} = {}) => {
  const safePatient = patientName || (isAr ? 'المريض' : 'the patient');
  const safeClinic = clinicName || 'UrClinic';
  const safeName = name || (isAr ? 'المستخدم' : 'user');

  if (type === 'appointment') {
    return isAr
      ? `السلام عليكم ${safePatient}، معك ${safeClinic} بخصوص موعدك بتاريخ ${appointmentDate || '-'} الساعة ${appointmentTime || '-'}.`
      : `Hello ${safePatient}, this is ${safeClinic} regarding your appointment on ${appointmentDate || '-'} at ${appointmentTime || '-'}.`;
  }

  if (type === 'staff') {
    return isAr
      ? `السلام عليكم ${safeName}، معك فريق UrClinic بخصوص حسابك في النظام.`
      : `Hello ${safeName}, this is the UrClinic team regarding your system account.`;
  }

  if (type === 'support') {
    return isAr
      ? 'السلام عليكم، أحتاج مساعدة بخصوص حسابي في UrClinic.'
      : 'Hello, I need help with my UrClinic account.';
  }

  return isAr
    ? `السلام عليكم ${safePatient}، معك ${safeClinic} بخصوص متابعتك الطبية.`
    : `Hello ${safePatient}, this is ${safeClinic} regarding your medical follow-up.`;
};

export const openWhatsAppUrl = (url) => {
  if (!url || typeof window === 'undefined') return false;
  const isMobileLike = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator?.userAgent || '');
  if (isMobileLike) {
    window.location.assign(url);
    return true;
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.assign(url);
  return true;
};
