import React from 'react';
import { useTranslation } from 'react-i18next';
import { doctors } from '../data/mockData';

const ScheduleView = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const times = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

  return (
    <div className="page-padding animate-in">
      <h2 className="mb-xl">{t('schedule_menu')} - {t('weekly_view')}</h2>

      <div className="schedule-grid">
        <div className="schedule-header" style={{ borderBottom: '1px solid var(--border)' }}>Time</div>
        {days.map(d => (
          <div key={d} className="schedule-header" style={{ borderBottom: '1px solid var(--border)' }}>
            {t(d)}
          </div>
        ))}

        {times.map((time, i) => (
          <React.Fragment key={time}>
            <div className="schedule-time">{time}</div>
            {days.map((d, j) => {
              // Mock logic for visuals
              const isBreak = time === '12:00';
              const isBooked = (i + j) % 3 === 0 && !isBreak;
              
              return (
                <div key={`${time}-${d}`} className="schedule-cell">
                  {isBreak ? (
                    <div className="schedule-slot break">{t('break_time')}</div>
                  ) : isBooked ? (
                    <div className="schedule-slot booked">{t('booked')} (Dr. Ahmed)</div>
                  ) : (
                    <div className="schedule-slot available">{t('available_slot')}</div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ScheduleView;
