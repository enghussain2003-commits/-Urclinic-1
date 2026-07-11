import { useTranslation } from 'react-i18next';

/**
 * DateRangeFilter — segmented control for dashboard date range.
 *
 * Architecture: ALL future ranges are declared here.
 * Set active=true to enable a range, active=false to show it as "coming soon".
 * The onChange callback receives the range id string — consumers decide what to do with it.
 */

const DATE_RANGE_OPTIONS = [
  { id: 'today',  labelEn: 'Today',      labelAr: 'اليوم',        active: true  },
  { id: 'week',   labelEn: 'This Week',  labelAr: 'هذا الأسبوع',  active: false }, // future
  { id: 'month',  labelEn: 'This Month', labelAr: 'هذا الشهر',    active: true  },
  { id: 'year',   labelEn: 'This Year',  labelAr: 'هذا العام',    active: false }, // future
];

const DateRangeFilter = ({ value = 'month', onChange }) => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  return (
    <div className="date-range-filter" role="group" aria-label="Date range">
      {DATE_RANGE_OPTIONS.map(opt => (
        <button
          key={opt.id}
          className={[
            'date-range-btn',
            value === opt.id ? 'active' : '',
            !opt.active    ? 'soon'   : '',
          ].filter(Boolean).join(' ')}
          onClick={() => opt.active && onChange?.(opt.id)}
          disabled={!opt.active}
          title={!opt.active ? (isAr ? 'قريباً' : 'Coming soon') : undefined}
          aria-pressed={value === opt.id}
        >
          {isAr ? opt.labelAr : opt.labelEn}
        </button>
      ))}
    </div>
  );
};

export default DateRangeFilter;
