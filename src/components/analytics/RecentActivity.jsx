import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchRecentActivity } from '../../services/activityService';
import { Activity, Bell, CalendarCheck, CheckCircle, XCircle, FileText, Info } from 'lucide-react';

/**
 * RecentActivity — reads from activityService (decoupled from notifications/audit_log).
 *
 * To switch to audit_log in the future: update activityService.js ONLY — this component stays unchanged.
 */

const TYPE_CONFIG = {
  appointment_new:       { Icon: CalendarCheck, color: '#6366f1' },
  appointment_confirmed: { Icon: CheckCircle,   color: '#10b981' },
  appointment_rejected:  { Icon: XCircle,       color: '#ef4444' },
  appointment_cancelled: { Icon: XCircle,       color: '#ef4444' },
  prescription_new:      { Icon: FileText,      color: '#0d9488' },
  info:                  { Icon: Info,          color: '#3b82f6' },
};
const DEFAULT_CONFIG = { Icon: Bell, color: '#64748b' };

const timeAgo = (ts, isAr) => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins <  1)  return isAr ? 'الآن'              : 'Just now';
  if (mins < 60)  return isAr ? `${mins} د`         : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return isAr ? `${hrs} س`          : `${hrs}h ago`;
  const days = Math.floor(hrs  / 24);
  return              isAr ? `${days} ي`             : `${days}d ago`;
};

const RecentActivity = ({ userId, limit = 7 }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (!cancelled) setLoading(true);
    });

    fetchRecentActivity({ userId, limit }).then(({ data }) => {
      if (!cancelled) { setItems(data); setLoading(false); }
    });

    return () => { cancelled = true; cancelAnimationFrame(id); };
  }, [userId, limit]);

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="analytics-skeleton" />
        <div className="analytics-skeleton" style={{ width: '85%' }} />
        <div className="analytics-skeleton" style={{ width: '70%' }} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="analytics-empty-state">
        <Activity size={28} />
        <p>{t('no_activity_yet')}</p>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      {items.map(item => {
        const { Icon, color } = TYPE_CONFIG[item.type] || DEFAULT_CONFIG;
        return (
          <div key={item.id} className="activity-item">
            <div
              className="activity-icon"
              style={{ background: `${color}1a`, color }}
            >
              <Icon size={15} />
            </div>
            <div className="activity-content">
              <div className="activity-title">{item.title}</div>
              {item.description && (
                <div className="activity-desc">{item.description}</div>
              )}
            </div>
            <div className="activity-time">{timeAgo(item.timestamp, isAr)}</div>
          </div>
        );
      })}
    </div>
  );
};

export default RecentActivity;
