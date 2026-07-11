import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CalendarPicker = ({ selectedDate, onSelectDate, getDateMeta }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthsAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const formatDate = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const isPast = (y, m, d) => new Date(y, m, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const cells = [];
  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, type: 'other-month' });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(viewYear, viewMonth, d);
    const past = isPast(viewYear, viewMonth, d);
    cells.push({
      day: d,
      dateStr,
      type: past ? 'disabled' : dateStr === todayStr ? 'today' : 'normal',
      selected: selectedDate === dateStr,
      meta: getDateMeta ? getDateMeta(dateStr) : null
    });
  }
  // Next month padding
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, type: 'other-month' });
  }

  return (
    <div className="calendar">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button onClick={isRtl ? goNext : goPrev}><ChevronLeft size={16} /></button>
        </div>
        <span className="calendar-title">
          {isRtl ? monthsAr[viewMonth] : months[viewMonth]} {viewYear}
        </span>
        <div className="calendar-nav">
          <button onClick={isRtl ? goPrev : goNext}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="calendar-grid">
        {dayNames.map(d => (
          <div key={d} className="calendar-day-name">{t(d)}</div>
        ))}
        {cells.map((cell, i) => {
          const disabled = cell.type === 'disabled'
            || cell.type === 'other-month'
            || cell.meta?.disabled;
          return (
            <button
              key={i}
              className={`calendar-day ${cell.type} ${cell.selected ? 'selected' : ''} ${cell.meta?.status ? `calendar-day--${cell.meta.status}` : ''}`}
              onClick={() => cell.dateStr && !disabled && onSelectDate(cell.dateStr)}
              disabled={disabled}
              title={cell.meta?.label || ''}
            >
              <span>{cell.day}</span>
              {cell.meta?.label && <small>{cell.meta.label}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarPicker;
