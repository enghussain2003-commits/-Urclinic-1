import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { downloadPrescriptionPdf } from '../utils/prescriptionPdf';
import { useToast } from '../hooks/useToast';

// Renders one prescription record (from the DB) and downloads it as a PDF.
// rx: { diagnosis, medicines:[{name,dosage,instructions}], instructions, prescribed_date }
const PrescriptionViewer = ({ rx, doctorName = '', patientName = '' }) => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const isAr = i18n.language === 'ar';
  if (!rx) return null;

  const meds = Array.isArray(rx.medicines) ? rx.medicines : [];

  return (
    <div className="rx-card">
      <div className="rx-header">
        <div className="rx-symbol">℞</div>
        <div>
          <h3 style={{ margin: 0 }}>{t('prescription')}</h3>
          {doctorName && (
            <p style={{ margin: 0, fontSize: '0.8125rem' }}>{t('prescribed_by')}: {doctorName}</p>
          )}
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('prescribed_on')}: {rx.prescribed_date || '-'}
          </p>
        </div>
      </div>

      {rx.diagnosis && (
        <div className="rx-med">
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{t('diagnosis')}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{rx.diagnosis}</div>
        </div>
      )}

      {meds.map((med, i) => (
        <div key={i} className="rx-med">
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{med.name}</div>
          {med.dosage && (
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {t('dosage')}: {med.dosage}
            </div>
          )}
          {med.instructions && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {t('instructions')}: {med.instructions}
            </div>
          )}
        </div>
      ))}

      {rx.instructions && (
        <div className="rx-med">
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{t('instructions')}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{rx.instructions}</div>
        </div>
      )}

      <button
        className="btn btn-outline"
        style={{ marginTop: '1.25rem', width: '100%' }}
        onClick={() => {
          const opened = downloadPrescriptionPdf(rx, { isAr, doctorName, patientName });
          if (!opened) {
            toast.warning(isAr ? 'يرجى السماح بالنوافذ المنبثقة لتنزيل الوصفة.' : 'Please allow pop-ups to download the prescription.');
          }
        }}
      >
        <Download size={16} /> {t('download_pdf')}
      </button>
    </div>
  );
};

export default PrescriptionViewer;
