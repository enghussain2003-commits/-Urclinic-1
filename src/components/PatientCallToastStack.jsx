import { useEffect, useState } from 'react';
import { CheckCircle2, Megaphone, UserRound, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  localizedPatientCallText,
  patientCallErrorMessage,
  patientCallMetaLine,
  patientCallRouteForNotification,
} from '../services/patientCallService';
import { useToast } from '../hooks/useToast';

const PatientCallToast = ({ notification }) => {
  const { i18n, t } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const toast = useToast();
  const {
    acknowledgePatientCall,
    dismissPatientCallToast,
    markNotificationRead,
  } = useApp();
  const [hovered, setHovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const route = patientCallRouteForNotification(notification);
  const title = localizedPatientCallText(notification, 'title', isAr);
  const message = localizedPatientCallText(notification, 'message', isAr);
  const metaLine = patientCallMetaLine(notification, isAr);

  useEffect(() => {
    if (hovered) return undefined;
    const timer = window.setTimeout(() => dismissPatientCallToast(notification.id), 12000);
    return () => window.clearTimeout(timer);
  }, [dismissPatientCallToast, hovered, notification.id]);

  const openPatient = async () => {
    if (!notification.is_read) await markNotificationRead(notification.id);
    dismissPatientCallToast(notification.id);
    if (route) navigate(route);
  };

  const acknowledge = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await acknowledgePatientCall(notification.id);
      toast.success(isAr ? 'تم تأكيد استدعاء المريض.' : 'Patient call acknowledged.');
    } catch (err) {
      console.error('Patient call acknowledgement failed:', err);
      toast.error(patientCallErrorMessage(err?.code, isAr));
      setBusy(false);
    }
  };

  return (
    <article
      className="patient-call-toast"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="patient-call-toast__icon">
        <Megaphone size={20} />
      </div>
      <div className="patient-call-toast__body">
        <strong>{title || t('patient_call')}</strong>
        <p>{message}</p>
        {metaLine && <span>{metaLine}</span>}
        <div className="patient-call-toast__actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={openPatient}>
            <UserRound size={14} /> {t('open_profile')}
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={acknowledge} disabled={busy}>
            <CheckCircle2 size={14} /> {busy ? t('loading') : t('acknowledge')}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="patient-call-toast__close"
        onClick={() => dismissPatientCallToast(notification.id)}
        aria-label={t('cancel')}
      >
        <X size={16} />
      </button>
    </article>
  );
};

const PatientCallToastStack = () => {
  const { patientCallToasts } = useApp();

  if (!patientCallToasts?.length) return null;

  return (
    <div className="patient-call-toast-stack" role="status" aria-live="polite">
      {patientCallToasts.map(notification => (
        <PatientCallToast key={notification.id} notification={notification} />
      ))}
    </div>
  );
};

export default PatientCallToastStack;
