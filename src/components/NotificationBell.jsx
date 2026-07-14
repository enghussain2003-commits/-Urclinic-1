import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Volume2, CalendarPlus, RefreshCw, XCircle, UserRoundCog, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { localizedSupportText, markSupportTicketRead, supportRouteForNotification } from '../services/supportService';

const NotificationBell = () => {
  const { t, i18n } = useTranslation();
  const { notifications, unreadCount, refreshNotifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotifIcon = (type) => {
    switch(type) {
      case 'call': return <Volume2 size={18} color="var(--primary)" />;
      case 'appointment_new': return <CalendarPlus size={18} color="var(--success)" />;
      case 'appointment_update': return <RefreshCw size={18} color="var(--info)" />;
      case 'appointment_cancel': return <XCircle size={18} color="var(--danger)" />;
      case 'new_patient_account': return <UserRoundCog size={18} color="var(--primary)" />;
      case 'support_appointment_cancelled': return <XCircle size={18} color="var(--danger)" />;
      case 'support_password_reset': return <KeyRound size={18} color="var(--warning)" />;
      case 'support_message': return <Bell size={18} color="var(--primary)" />;
      case 'support_ticket_created':
      case 'support_user_reply':
      case 'support_admin_reply':
      case 'support_status_in_progress':
      case 'support_status_waiting':
      case 'support_status_resolved':
      case 'support_status_closed':
      case 'support_status_reopened':
        return <Bell size={18} color="var(--primary)" />;
      default: return <Bell size={18} color="var(--text-secondary)" />;
    }
  };

  const getTimeAgo = (dateStr) => {
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isAr ? 'الآن' : 'Just now';
    if (mins < 60) return isAr ? `قبل ${mins} د` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isAr ? `قبل ${hours} س` : `${hours}h ago`;
    return isAr ? `قبل ${Math.floor(hours / 24)} يوم` : `${Math.floor(hours / 24)}d ago`;
  };

  const toggleOpen = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) refreshNotifications();
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) await markNotificationRead(notif.id);
    const route = supportRouteForNotification(notif);
    if (route) {
      const ticketId = notif.support_ticket_id || notif.metadata?.ticket_id;
      if (ticketId) {
        try { await markSupportTicketRead(ticketId); } catch { /* RLS handles inaccessible tickets. */ }
      }
      setIsOpen(false);
      navigate(route);
      refreshNotifications();
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        className="notif-btn"
        onClick={toggleOpen}
        aria-label={t('notifications')}
        aria-expanded={isOpen}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notif-count-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown animate-in">
          {/* Header */}
          <div className="notif-header">
            <h4 style={{ margin: 0, fontSize: '1rem' }}>{t('notifications')}</h4>
            {unreadCount > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => markAllNotificationsRead()}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                <CheckCheck size={14} /> {t('mark_read')}
              </button>
            )}
          </div>

          <div className="notif-list" tabIndex={0} role="list" aria-label={t('notifications')}>
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <Bell size={32} />
                <p>{t('no_notifications')}</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`notif-item ${notif.is_read ? '' : 'unread'}`}
                  role="listitem"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleNotificationClick(notif);
                    }
                  }}
                >
                  <span style={{ fontSize: '1.25rem', flexShrink: 0, marginTop: 2 }}>
                    {getNotifIcon(notif.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: notif.is_read ? 500 : 700, 
                      fontSize: '0.875rem',
                      marginBottom: 2
                    }}>
                      {localizedSupportText(notif, 'title', isAr)}
                    </div>
                    <p style={{ 
                      margin: 0, fontSize: '0.8rem', 
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                    }}>
                      {localizedSupportText(notif, 'message', isAr)}
                    </p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                      {getTimeAgo(notif.created_at)}
                    </span>
                  </div>
                  {!notif.is_read && <div className="notif-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
