import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Live countdown to a target appointment (date 'YYYY-MM-DD' + time 'HH:MM').
// Renders days / hours / minutes / seconds, or a "reached" label once the time passes.
const pad = (n) => String(n).padStart(2, '0');

const Box = ({ value, label }) => (
  <div style={{ textAlign: 'center', minWidth: 48 }}>
    <div style={{
      fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)',
      background: 'var(--primary-100)', borderRadius: 'var(--radius-md, 8px)',
      padding: '0.35rem 0.5rem', fontVariantNumeric: 'tabular-nums',
    }}>{pad(value)}</div>
    <div className="text-sm text-muted" style={{ marginTop: 2 }}>{label}</div>
  </div>
);

const Countdown = ({ date, time }) => {
  const { t } = useTranslation();
  const target = new Date(`${date}T${(time || '00:00')}:00`).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = target - now;

  if (isNaN(target)) return null;

  if (diff <= 0) {
    return (
      <span className="badge badge-info" style={{ fontWeight: 700 }}>
        {t('appointment_time_reached')}
      </span>
    );
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex gap-sm items-center" dir="ltr">
      {days > 0 && <Box value={days} label={t('days')} />}
      <Box value={hours} label={t('hours')} />
      <Box value={mins} label={t('minutes')} />
      <Box value={secs} label={t('seconds')} />
    </div>
  );
};

export default Countdown;
