import { useTranslation } from 'react-i18next';

/**
 * DateRangeFilter — segmented control for dashboard date range.
 *
 * The onChange callback receives the range id string — consumers decide what to do with it.
 */

const DATE_RANGE_OPTIONS = [
  { id: 'today',  labelEn: 'Today',      labelAr: 'اليوم' },
  { id: 'week',   labelEn: 'This Week',  labelAr: 'هذا الأسبوع' },
  { id: 'month',  labelEn: 'This Month', labelAr: 'هذا الشهر' },
  { id: 'year',   labelEn: 'This Year',  labelAr: 'هذا العام' },
  { id: 'all',    labelEn: 'All Time',   labelAr: 'كل الوقت' },
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
          ].filter(Boolean).join(' ')}
          onClick={() => onChange?.(opt.id)}
          aria-pressed={value === opt.id}
        >
          {isAr ? opt.labelAr : opt.labelEn}
        </button>
      ))}
    </div>
  );
};

export default DateRangeFilter;
