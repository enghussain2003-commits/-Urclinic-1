import { Copy, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../hooks/useToast';
import { buildWhatsAppUrl, canContactUser, normalizePhoneNumber, openWhatsAppUrl } from '../services/contactService';

const WhatsAppIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M16.02 3.2A12.7 12.7 0 0 0 5.06 22.35L3.3 28.8l6.6-1.73A12.68 12.68 0 1 0 16.02 3.2Zm0 2.25a10.43 10.43 0 0 1 8.85 15.95 10.43 10.43 0 0 1-13.33 3.4l-.47-.28-3.9 1.02 1.04-3.8-.3-.49A10.44 10.44 0 0 1 16.02 5.45Zm-4.3 5.2c-.23 0-.6.08-.91.43-.31.34-1.2 1.17-1.2 2.84s1.23 3.3 1.4 3.52c.17.23 2.38 3.8 5.9 5.18 2.92 1.15 3.52.92 4.16.86.64-.06 2.05-.84 2.34-1.65.29-.81.29-1.5.2-1.65-.08-.15-.31-.23-.65-.4-.34-.17-2.05-1.01-2.37-1.12-.31-.12-.54-.17-.77.17-.23.34-.89 1.12-1.09 1.35-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.02-1.9-2.36-.2-.34-.02-.53.15-.7.15-.15.34-.4.52-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.08-.17-.77-1.86-1.06-2.55-.28-.67-.56-.58-.77-.59h-.78Z" />
  </svg>
);

const ContactActionsCard = ({
  title,
  subtitle,
  phone,
  whatsappMessage,
  unavailableMessage,
  actor,
  target,
  allowPatientDoctorPhone = false,
  compact = false,
}) => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const toast = useToast();
  const normalized = normalizePhoneNumber(phone);
  const whatsappUrl = buildWhatsAppUrl(phone, whatsappMessage);
  const permitted = actor && target ? canContactUser({ actor, target, allowPatientDoctorPhone }) : true;
  const displayPhone = permitted ? (phone || '') : '';
  const disabled = !normalized || !permitted;

  const copyPhone = async () => {
    if (!displayPhone) return;
    try {
      await navigator.clipboard?.writeText(displayPhone);
      toast.success(isAr ? 'تم نسخ رقم الهاتف' : 'Phone number copied');
    } catch {
      toast.error(isAr ? 'تعذر نسخ الرقم' : 'Could not copy phone number');
    }
  };

  const openWhatsApp = () => {
    if (!whatsappUrl) {
      toast.warning(unavailableMessage || (isAr ? 'لا يوجد رقم واتساب متاح لهذا الملف.' : 'No WhatsApp number is available for this profile.'));
      return;
    }
    openWhatsAppUrl(whatsappUrl);
  };

  return (
    <section className={`contact-actions-card ${compact ? 'contact-actions-card--compact' : ''}`}>
      <div className="contact-actions-head">
        <span><ShieldCheck size={15} /></span>
        <div>
          <h3>{title || (isAr ? 'تواصل سريع' : 'Quick Contact')}</h3>
          <p>{subtitle || (isAr ? 'استخدم الرقم المصرح لهذا الملف فقط.' : 'Use only the authorized number for this profile.')}</p>
        </div>
      </div>

      <div className="contact-actions-phone">
        <span>{isAr ? 'رقم الهاتف' : 'Phone number'}</span>
        <strong dir="ltr">{displayPhone || '-'}</strong>
      </div>

      {disabled && (
        <div className="contact-actions-empty">
          {!permitted
            ? (isAr ? 'ليست لديك صلاحية للتواصل مع هذا الملف.' : 'You are not authorized to contact this profile.')
            : (unavailableMessage || (isAr ? 'لا يوجد رقم واتساب متاح لهذا الملف.' : 'No WhatsApp number is available for this profile.'))}
        </div>
      )}

      <div className="contact-actions-grid">
        <button
          type="button"
          className="contact-action contact-action--whatsapp"
          onClick={openWhatsApp}
          disabled={disabled}
          title={isAr ? 'فتح واتساب برسالة جاهزة' : 'Open WhatsApp with a prefilled message'}
          aria-label={isAr ? 'تواصل عبر واتساب' : 'Contact via WhatsApp'}
        >
          <WhatsAppIcon />
          <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
        </button>
        <a
          className={`contact-action ${disabled ? 'disabled' : ''}`}
          href={disabled ? undefined : `tel:+${normalized}`}
          aria-disabled={disabled}
          aria-label={isAr ? 'اتصال هاتفي' : 'Call phone number'}
        >
          <Phone size={17} />
          <span>{isAr ? 'اتصال' : 'Call'}</span>
        </a>
        <button
          type="button"
          className="contact-action"
          onClick={copyPhone}
          disabled={!displayPhone || !permitted}
          aria-label={isAr ? 'نسخ رقم الهاتف' : 'Copy phone number'}
        >
          <Copy size={17} />
          <span>{isAr ? 'نسخ' : 'Copy'}</span>
        </button>
      </div>

      <div className="contact-actions-note">
        <MessageCircle size={14} />
        <span>{isAr ? 'لن يتم إرسال أي رسالة تلقائياً.' : 'No message is sent automatically.'}</span>
      </div>
    </section>
  );
};

export default ContactActionsCard;
