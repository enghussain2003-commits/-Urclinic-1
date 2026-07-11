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

const stateLabel = (slot, isAr) => {
  if (slot.status === 'booked') return isAr ? 'محجوز' : 'Booked';
  if (slot.status === 'past') return isAr ? 'انتهى الوقت' : 'Past';
  if (slot.status === 'break') return isAr ? 'استراحة' : 'Break';
  if (slot.status === 'unavailable') return isAr ? 'غير متاح' : 'Unavailable';
  return isAr ? 'متاح' : 'Available';
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
        {slots.map(slot => {
          const disabled = slot.status !== 'available';
          return (
            <button
              key={slot.time}
              className={`timeslot timeslot--${slot.status || 'available'} ${selectedTime === slot.time ? 'selected' : ''}`}
              onClick={() => !disabled && onSelectTime(slot.time)}
              disabled={disabled}
              title={stateLabel(slot, isAr)}
            >
              <span>{to12Hour(slot.time, isAr)}</span>
              {slot.status !== 'available' && <small>{stateLabel(slot, isAr)}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TimeSlotGrid;
