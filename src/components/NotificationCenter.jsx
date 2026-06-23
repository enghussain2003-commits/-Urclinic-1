import React from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { Bell, Clock } from 'lucide-react';

// Relative "x ago" label from a timestamp (DB created_at).
const timeAgo = (dateStr, ar) => {
  if (!dateStr) return '';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return ar ? 'الآن' : 'just now';
  if (mins < 60) return ar ? `قبل ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return ar ? `قبل ${hrs} س` : `${hrs}h ago`;
  return ar ? `قبل ${Math.floor(hrs / 24)} يوم` : `${Math.floor(hrs / 24)}d ago`;
};

const NotificationCenter = () => {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();

  return (
    <div className="notif-dropdown">
      <div className="notif-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{t('notifications')}</span>
        {notifications.some(n => !n.is_read) && (
          <button className="btn btn-ghost btn-sm" onClick={markAllNotificationsRead} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
            {t('mark_read')}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Bell size={28} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
          <div style={{ fontSize: '0.85rem' }}>{t('no_notifications')}</div>
        </div>
      ) : (
        notifications.slice(0, 20).map(n => (
          <div
            key={n.id}
            className="notif-item"
            onClick={() => { if (!n.is_read) markNotificationRead(n.id); }}
            style={{ cursor: n.is_read ? 'default' : 'pointer' }}
          >
            {!n.is_read
              ? <span className="notif-dot"></span>
              : <span style={{ width: 8, height: 8, flexShrink: 0 }}></span>}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.875rem', color: 'var(--text)', marginBottom: '0.125rem' }}>
                {n.title}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {n.message}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={10} /> {timeAgo(n.created_at, ar)}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default NotificationCenter;
