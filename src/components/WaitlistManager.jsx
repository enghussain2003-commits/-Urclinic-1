import { useTranslation } from 'react-i18next';
import { getWaitlist, doctors } from '../data/mockData';
import { Clock, Bell } from 'lucide-react';

const WaitlistManager = ({ doctorId }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const waitlist = getWaitlist().filter(w => w.doctorId === doctorId);
  const doctor = doctors.find(d => d.id === doctorId);

  if (waitlist.length === 0) return null;

  return (
    <div className="card-flat" style={{ marginTop: '1.5rem' }}>
      <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Clock size={18} color="var(--warning)" />
        {t('waitlist')} — {isAr ? doctor?.nameAr : doctor?.name}
      </h4>
      <p style={{ fontSize: '0.8125rem', marginBottom: '1rem' }}>{t('waitlist_info')}</p>
      {waitlist.map(w => (
        <div key={w.id} className="waitlist-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="waitlist-position">#{w.position}</div>
            <span style={{ fontWeight: 600 }}>{isAr ? w.patientAr : w.patient}</span>
          </div>
          <button className="btn btn-ghost btn-sm">
            <Bell size={14} /> {t('send_reminder')}
          </button>
        </div>
      ))}
    </div>
  );
};

export default WaitlistManager;
