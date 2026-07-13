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
    return (
      <div className="timeslots-empty">
        <p>{t('no_slots')}</p>
      </div>
    );
  }

  const groups = [
    { id: 'morning', label: isAr ? 'الصباح' : 'Morning', slots: slots.filter(slot => Number(slot.time.slice(0, 2)) < 12) },
    { id: 'afternoon', label: isAr ? 'بعد الظهر' : 'Afternoon', slots: slots.filter(slot => Number(slot.time.slice(0, 2)) >= 12) },
  ].filter(group => group.slots.length > 0);

  return (
    <div className="timeslots-panel">
      <div className="timeslots-panel__head">
        <h4>{t('available_slots')}</h4>
        <span>{slots.filter(slot => slot.status === 'available').length}</span>
      </div>
      {groups.map(group => (
        <section key={group.id} className="timeslot-group">
          <div className="timeslot-group__label">{group.label}</div>
          <div className="timeslots-grid">
            {group.slots.map(slot => {
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
                  <small>{stateLabel(slot, isAr)}</small>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default TimeSlotGrid;
