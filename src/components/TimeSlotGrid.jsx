/* eslint-disable react-refresh/only-export-components */
import { useTranslation } from 'react-i18next';

// Convert "HH:MM" (24h) to a 12-hour label with AM/PM (Arabic: صباحاً/مساءً).
export const to12Hour = (time, isAr = false) => {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const suffix = isAr ? (h < 12 ? 'صباحاً' : 'مساءً') : (h < 12 ? 'AM' : 'PM');
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
};

const TimeSlotGrid = ({ slots, selectedTime, onSelectTime }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  if (!slots || slots.length === 0) {
    return <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>{t('no_slots')}</p>;
  }

  return (
    <div>
      <h4 style={{ marginBottom: '0.75rem' }}>{t('available_slots')}</h4>
      <div className="timeslots-grid">
        {slots.map(slot => (
          <button
            key={slot.time}
            className={`timeslot ${slot.booked ? 'booked' : ''} ${selectedTime === slot.time ? 'selected' : ''}`}
            onClick={() => !slot.booked && onSelectTime(slot.time)}
            disabled={slot.booked}
          >
            {to12Hour(slot.time, isAr)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeSlotGrid;
