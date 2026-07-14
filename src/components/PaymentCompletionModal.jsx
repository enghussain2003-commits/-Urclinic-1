import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CheckCircle,
  Clock,
  Coins,
  CreditCard,
  FileText,
  Gift,
  Hash,
  Landmark,
  MoreHorizontal,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { to12Hour } from './TimeSlotGrid';
import { useToast } from '../hooks/useToast';
import {
  DEFAULT_CURRENCY,
  formatMoney,
  normalizeCurrency,
  normalizeCurrencyAmount,
} from '../utils/money';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const PAYMENT_STATUSES = [
  {
    id: 'paid',
    tone: 'success',
    Icon: CheckCircle,
    en: 'Paid',
    ar: 'مدفوع',
    descEn: 'Full amount collected now',
    descAr: 'تم تحصيل كامل الرسوم',
  },
  {
    id: 'partially_paid',
    tone: 'warning',
    Icon: WalletCards,
    en: 'Partially paid',
    ar: 'مدفوع جزئياً',
    descEn: 'Collect part and keep a balance',
    descAr: 'تحصيل جزء مع وجود متبقي',
  },
  {
    id: 'unpaid',
    tone: 'neutral',
    Icon: FileText,
    en: 'Unpaid',
    ar: 'غير مدفوع',
    descEn: 'Complete visit without collection',
    descAr: 'إكمال الزيارة بدون تحصيل',
  },
  {
    id: 'waived',
    tone: 'soft',
    Icon: Gift,
    en: 'Waived',
    ar: 'معفى',
    descEn: 'Fee intentionally waived',
    descAr: 'تم إعفاء المريض من الرسوم',
  },
];

const PAYMENT_METHODS = [
  { id: 'cash', Icon: Banknote, en: 'Cash', ar: 'نقداً' },
  { id: 'card', Icon: CreditCard, en: 'Card', ar: 'بطاقة' },
  { id: 'transfer', Icon: Landmark, en: 'Transfer', ar: 'تحويل' },
  { id: 'other', Icon: MoreHorizontal, en: 'Other', ar: 'أخرى' },
];

const numberOrZero = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const amountForCurrency = (value, currency) => normalizeCurrencyAmount(value, currency);

const resolveFee = (appointment, doctors = [], currency = DEFAULT_CURRENCY) => {
  const appointmentFee = amountForCurrency(appointment?.fee, currency);
  if (appointmentFee > 0) return { value: appointmentFee, source: 'appointment' };

  const doctor = doctors.find(d => String(d.id) === String(appointment?.doctor_id));
  const doctorFee = amountForCurrency(doctor?.fee, currency);
  if (doctorFee > 0) return { value: doctorFee, source: 'doctor' };

  const clinicFee = amountForCurrency(appointment?.clinic?.default_consultation_fee, currency);
  if (clinicFee > 0) return { value: clinicFee, source: 'clinic' };

  return { value: 0, source: 'missing' };
};

const PaymentCompletionModalContent = ({
  appointment,
  doctors = [],
  user,
  onClose,
  onSubmit,
}) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const locale = isAr ? 'ar-IQ' : 'en-US';
  const toast = useToast();
  const closeRef = useRef(null);
  const currency = normalizeCurrency(appointment?.payment_currency || appointment?.clinic?.currency || DEFAULT_CURRENCY);
  const feeSource = useMemo(() => resolveFee(appointment, doctors, currency), [appointment, doctors, currency]);
  const initialFee = amountForCurrency(appointment?.payment?.consultation_fee ?? appointment?.consultation_fee ?? feeSource.value, currency);
  const initialStatus = appointment?.payment?.payment_status || 'paid';
  const initialPaid = amountForCurrency(appointment?.payment?.paid_amount ?? initialFee, currency);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [fee, setFee] = useState(initialFee);
  const [paidAmount, setPaidAmount] = useState(initialPaid);
  const [method, setMethod] = useState(appointment?.payment?.payment_method || 'cash');
  const [note, setNote] = useState(appointment?.payment?.note || '');
  const [error, setError] = useState('');

  const doctor = doctors.find(d => String(d.id) === String(appointment?.doctor_id));
  const doctorName = isAr
    ? (doctor?.nameAr || doctor?.full_name || doctor?.name || t('doctor'))
    : (doctor?.name || doctor?.full_name || doctor?.nameAr || t('doctor'));
  const patientName = appointment?.patient?.full_name || appointment?.patient_name || (isAr ? 'مريض غير معروف' : 'Unknown patient');
  const canAdjustFee = ['clinic_admin', 'super_admin'].includes(user?.role);
  const numericFee = amountForCurrency(fee, currency);
  const numericPaid = amountForCurrency(paidAmount, currency);
  const outstanding = status === 'waived' ? 0 : Math.max(numericFee - numericPaid, 0);
  const paidRequiresMethod = numericPaid > 0;
  const showPaymentMethod = status === 'paid' || status === 'partially_paid';
  const showPaidAmount = status === 'paid' || status === 'partially_paid';
  const noteLabel = status === 'waived'
    ? (isAr ? 'سبب الإعفاء' : 'Waiver reason')
    : (isAr ? 'ملاحظة الدفع' : 'Payment note');

  useEffect(() => {
    window.setTimeout(() => closeRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape' && !saving) onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  const feeSourceLabel = {
    appointment: isAr ? 'من الموعد' : 'Appointment snapshot',
    doctor: isAr ? 'من إعدادات الطبيب' : 'Doctor settings',
    clinic: isAr ? 'من إعدادات العيادة' : 'Clinic settings',
    missing: isAr ? 'غير محدد' : 'Not configured',
  }[feeSource.source];

  const applyStatus = nextStatus => {
    setStatus(nextStatus);
    setError('');

    if (nextStatus === 'paid') {
      setPaidAmount(amountForCurrency(fee, currency));
      setMethod(prev => prev || 'cash');
      return;
    }

    if (nextStatus === 'unpaid' || nextStatus === 'waived') {
      setPaidAmount(0);
      setMethod('');
      return;
    }

    const half = numericFee > 0 ? Math.floor(numericFee / 2) : 0;
    setPaidAmount(prev => {
      const current = amountForCurrency(prev, currency);
      if (current > 0 && current < numericFee) return current;
      return numericFee > 1 ? Math.max(Math.min(half, numericFee - 1), 1) : 0;
    });
    setMethod(prev => prev || 'cash');
  };

  const updateFee = value => {
    const nextFee = amountForCurrency(value, currency);
    setFee(value);
    setError('');
    if (status === 'paid') {
      setPaidAmount(nextFee);
    }
    if (status === 'partially_paid' && numericPaid >= nextFee) {
      setPaidAmount(nextFee > 1 ? Math.floor(nextFee / 2) : 0);
    }
  };

  const validate = () => {
    if (!Number.isFinite(numberOrZero(fee)) || numericFee < 0) {
      return isAr ? 'أدخل مبلغاً صحيحاً' : 'Enter a valid fee amount.';
    }
    if (!Number.isFinite(numberOrZero(paidAmount)) || numericPaid < 0) {
      return isAr ? 'أدخل مبلغاً صحيحاً' : 'Enter a valid paid amount.';
    }
    if (numericPaid > numericFee) {
      return isAr ? 'المبلغ المدفوع لا يمكن أن يتجاوز الرسوم' : 'Paid amount cannot exceed the fee.';
    }
    if (status === 'paid' && numericPaid !== numericFee) {
      return isAr ? 'حالة مدفوع تتطلب دفع كامل الرسوم' : 'Paid status requires the full fee.';
    }
    if ((status === 'unpaid' || status === 'waived') && numericPaid !== 0) {
      return isAr ? 'يجب أن يكون المبلغ المدفوع صفراً' : 'Paid amount must be zero.';
    }
    if (status === 'partially_paid' && !(numericPaid > 0 && numericPaid < numericFee)) {
      return isAr ? 'الدفع الجزئي يجب أن يكون أكبر من صفر وأقل من الرسوم' : 'Partial payment must be greater than zero and less than the fee.';
    }
    if (paidRequiresMethod && !method) {
      return isAr ? 'اختر طريقة الدفع' : 'Choose a payment method.';
    }
    return '';
  };

  const submit = async event => {
    event.preventDefault();
    if (saving) return;

    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSubmit?.(appointment.id, {
        consultation_fee: numericFee,
        paid_amount: numericPaid,
        payment_status: status,
        payment_method: paidRequiresMethod ? method : null,
        note,
        currency,
      });
      toast.success(isAr ? 'تم إكمال الموعد وتسجيل الدفعة بنجاح.' : 'Appointment completed and payment recorded successfully.');
      onClose?.();
    } catch (err) {
      console.error('Payment completion failed:', err);
      const message = getLocalizedErrorMessage(err, { isAr, fallback: 'payment' });
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const summaryItems = [
    { key: 'patient', Icon: UserRound, label: t('patient'), value: patientName },
    { key: 'doctor', Icon: Stethoscope, label: t('doctor'), value: doctorName },
    { key: 'date', Icon: CalendarDays, label: isAr ? 'التاريخ' : 'Date', value: appointment.date || appointment.appointment_date || '-' },
    { key: 'time', Icon: Clock, label: isAr ? 'الوقت' : 'Time', value: to12Hour(appointment.time || appointment.appointment_time, isAr) },
    { key: 'code', Icon: Hash, label: isAr ? 'رقم الحجز' : 'Booking code', value: appointment.booking_code || '-', dir: 'ltr' },
    { key: 'currency', Icon: Coins, label: isAr ? 'العملة' : 'Currency', value: currency, dir: 'ltr' },
  ];

  return (
    <div className="payment-modal-backdrop" role="presentation" onMouseDown={saving ? undefined : onClose}>
      <form className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" onSubmit={submit} onMouseDown={event => event.stopPropagation()} noValidate>
        <header className="payment-modal-head">
          <div className="payment-modal-title-row">
            <span className="payment-modal-badge"><ReceiptText size={18} /></span>
            <div>
              <span className="payment-modal-eyebrow">{isAr ? 'تسجيل مالي' : 'Payment record'}</span>
              <h2 id="payment-modal-title">{isAr ? 'إكمال الموعد وتسجيل الدفع' : 'Complete Appointment and Record Payment'}</h2>
              <p>{isAr ? 'راجع تفاصيل الموعد وحدد حالة الدفع قبل الإكمال' : 'Review appointment details and set payment status before completion.'}</p>
            </div>
          </div>
          <button ref={closeRef} type="button" className="payment-modal-close" onClick={onClose} disabled={saving} aria-label={isAr ? 'إغلاق' : 'Close'}>
            <X size={18} />
          </button>
        </header>

        <div className="payment-modal-body">
          <section className="payment-summary-card" aria-label={isAr ? 'ملخص الموعد' : 'Appointment summary'}>
            {summaryItems.map(item => (
              <div key={item.key} className="payment-summary-item">
                <span className="payment-summary-icon"><item.Icon size={16} /></span>
                <div>
                  <span>{item.label}</span>
                  <strong dir={item.dir}>{item.value}</strong>
                </div>
              </div>
            ))}
          </section>

          <section className="payment-fee-card">
            <div>
              <span className="payment-section-label"><Coins size={15} /> {isAr ? 'تفاصيل الرسوم' : 'Fee details'}</span>
              <strong>{formatMoney(numericFee, { currency, locale })}</strong>
              <em>{feeSourceLabel}</em>
            </div>
            <label>
              <span>{isAr ? 'الكشفية' : 'Consultation fee'}</span>
              <input className="payment-input" type="number" min="0" step="0.01" value={fee} onChange={event => updateFee(event.target.value)} readOnly={!canAdjustFee} inputMode="decimal" />
            </label>
          </section>

          <section className="payment-section">
            <div className="payment-section-head">
              <span className="payment-section-label"><ShieldCheck size={15} /> {isAr ? 'حالة الدفع' : 'Payment status'}</span>
            </div>
            <div className="payment-status-grid" role="radiogroup" aria-label={isAr ? 'حالة الدفع' : 'Payment status'}>
              {PAYMENT_STATUSES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`payment-status-card payment-status-card--${item.tone} ${status === item.id ? 'active' : ''}`}
                  onClick={() => applyStatus(item.id)}
                  disabled={saving}
                  role="radio"
                  aria-checked={status === item.id}
                >
                  <span><item.Icon size={18} /></span>
                  <strong>{isAr ? item.ar : item.en}</strong>
                  <em>{isAr ? item.descAr : item.descEn}</em>
                </button>
              ))}
            </div>
          </section>

          <section className="payment-section payment-dynamic-section">
            {showPaidAmount && (
              <label className="payment-field">
                <span>{isAr ? 'المبلغ المدفوع' : 'Paid amount'}</span>
                <input
                  className="payment-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidAmount}
                  onChange={event => {
                    setPaidAmount(event.target.value);
                    setError('');
                  }}
                  readOnly={status !== 'partially_paid'}
                  inputMode="decimal"
                />
              </label>
            )}

            {showPaymentMethod && (
              <div className="payment-field">
                <span>{isAr ? 'طريقة الدفع' : 'Payment method'}</span>
                <div className="payment-method-grid" role="radiogroup" aria-label={isAr ? 'طريقة الدفع' : 'Payment method'}>
                  {PAYMENT_METHODS.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className={method === item.id ? 'active' : ''}
                      onClick={() => setMethod(item.id)}
                      disabled={saving}
                      role="radio"
                      aria-checked={method === item.id}
                    >
                      <item.Icon size={16} />
                      {isAr ? item.ar : item.en}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="payment-field payment-note-field">
              <span>{noteLabel}</span>
              <textarea
                className="payment-input"
                rows="2"
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder={status === 'waived'
                  ? (isAr ? 'اختياري: سبب الإعفاء' : 'Optional: reason for waiver')
                  : (isAr ? 'اختياري: أضف ملاحظة قصيرة' : 'Optional: add a short note')}
              />
              <em>{isAr ? 'اختياري، ويظهر ضمن سجل الدفع.' : 'Optional, saved with the payment record.'}</em>
            </label>
          </section>

          <section className="payment-total-card" aria-label={isAr ? 'الملخص المالي' : 'Financial summary'}>
            <div>
              <span>{isAr ? 'الإجمالي' : 'Total fee'}</span>
              <strong>{formatMoney(numericFee, { currency, locale })}</strong>
            </div>
            <div>
              <span>{isAr ? 'المدفوع' : 'Paid now'}</span>
              <strong>{formatMoney(numericPaid, { currency, locale })}</strong>
            </div>
            <div>
              <span>{isAr ? 'المتبقي' : 'Remaining'}</span>
              <strong>{formatMoney(outstanding, { currency, locale })}</strong>
            </div>
          </section>

          {error && (
            <div className="payment-modal-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <footer className="payment-modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button type="submit" className="btn btn-primary payment-primary-action" disabled={saving}>
            <CheckCircle size={16} />
            {saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'إكمال الموعد وحفظ الدفع' : 'Complete and Save Payment')}
          </button>
        </footer>
      </form>
    </div>
  );
};

const PaymentCompletionModal = (props) => {
  if (!props.appointment) return null;
  return <PaymentCompletionModalContent key={props.appointment.id} {...props} />;
};

export default PaymentCompletionModal;
