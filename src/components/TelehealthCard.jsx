import { useTranslation } from 'react-i18next';
import { Video, Mic, Phone } from 'lucide-react';

const TelehealthCard = () => {
  const { t } = useTranslation();

  return (
    <div className="telehealth-card">
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Video size={48} style={{ margin: '0 auto 1rem', opacity: 0.9 }} />
        <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>{t('telehealth')}</h3>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          {t('telehealth_info')}
        </p>
        <button className="btn" style={{
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(8px)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          width: '100%', padding: '0.875rem' }}>
          <Video size={18} /> {t('join_call')}
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.25rem' }}>
          <button className="btn btn-icon" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: '50%', width: 44, height: 44 }}>
            <Mic size={18} />
          </button>
          <button className="btn btn-icon" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: '50%', width: 44, height: 44 }}>
            <Video size={18} />
          </button>
          <button className="btn btn-icon" style={{ background: 'rgba(239,68,68,0.8)', color: '#fff', borderRadius: '50%', width: 44, height: 44 }}>
            <Phone size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TelehealthCard;
