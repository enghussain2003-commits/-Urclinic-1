import { useTranslation } from 'react-i18next';
import { CreditCard, DollarSign } from 'lucide-react';

/**
 * RecentPayments — displays real payment records from appointments.
 *
 * Only shows appointments where paid=true AND fee>0.
 * No calculated placeholders — if no records, shows empty state.
 */
const RecentPayments = ({ payments = [], loading = false }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="analytics-skeleton" />
        <div className="analytics-skeleton" style={{ width: '80%' }} />
        <div className="analytics-skeleton" style={{ width: '60%' }} />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="analytics-empty-state">
        <CreditCard size={28} />
        <p>{t('no_payments_yet')}</p>
      </div>
    );
  }

  return (
    <div className="payment-list">
      {payments.map((p, i) => {
        const amount = Number(p.fee || 0);
        const method = p.payment_method || t('cash');
        const date   = p.date || p.appointment_date || '—';

        return (
          <div key={p.id || i} className="payment-item">
            {/* Icon */}
            <div className="payment-avatar">
              <DollarSign size={15} />
            </div>

            {/* Info */}
            <div className="payment-info">
              <div className="payment-name">{p.patient_name || t('patient')}</div>
              <div className="payment-meta">
                {date} · <span className="payment-method">{method}</span>
              </div>
            </div>

            {/* Amount */}
            <div className="payment-amount">
              {isAr
                ? `${amount.toLocaleString()} ر.س`
                : `$${amount.toLocaleString()}`
              }
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RecentPayments;
