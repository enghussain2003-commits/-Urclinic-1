import { useTranslation } from 'react-i18next';
import { CreditCard, DollarSign } from 'lucide-react';
import { formatMoney } from '../../utils/money';

/**
 * RecentPayments — displays persisted appointment payment records.
 */
const RecentPayments = ({ payments = [], loading = false }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const methodLabel = method => ({
    cash: isAr ? 'نقداً' : 'Cash',
    card: isAr ? 'بطاقة' : 'Card',
    transfer: isAr ? 'تحويل بنكي' : 'Bank transfer',
    other: isAr ? 'أخرى' : 'Other',
  }[method] || method || t('cash'));

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
        const amount = Number(p.paid_amount || 0);
        const method = methodLabel(p.payment_method);
        const date = p.paid_at?.slice(0, 10) || p.appointment?.appointment_date || '—';
        const patientName = p.patient?.full_name || p.patient_name || t('patient');

        return (
          <div key={p.id || i} className="payment-item">
            {/* Icon */}
            <div className="payment-avatar">
              <DollarSign size={15} />
            </div>

            {/* Info */}
            <div className="payment-info">
              <div className="payment-name">{patientName}</div>
              <div className="payment-meta">
                {date} · <span className="payment-method">{method}</span>
              </div>
            </div>

            {/* Amount */}
            <div className="payment-amount">
              {formatMoney(amount, { currency: p.currency, locale: isAr ? 'ar-IQ' : 'en-US' })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RecentPayments;
