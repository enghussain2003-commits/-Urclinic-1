import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Volume2, CalendarPlus, RefreshCw, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

const NotificationBell = () => {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

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
      default: return <Bell size={18} color="var(--text-secondary)" />;
    }
  };

  const getTimeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => setIsOpen(!isOpen)}
        style={{ position: 'relative' }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 18, height: 18, borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: '0.7rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-primary)',
            animation: 'pulse 2s infinite'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="animate-in" style={{
          position: 'absolute',
          top: '100%',
          // Use the logical "end" edge so the dropdown anchors correctly in BOTH
          // directions: right edge in LTR, left edge in RTL. Previously hard-coded
          // `right: 0` made the dropdown overflow off-screen in Arabic mode.
          insetInlineEnd: 0,
          width: 360,
          maxHeight: 420,
          overflowY: 'auto',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          zIndex: 9999,
          marginTop: 8
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>Notifications</h4>
            {unreadCount > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => markAllNotificationsRead()}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          {notifications.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Bell size={32} style={{ opacity: 0.2, margin: '0 auto 0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>No notifications yet</p>
            </div>
          ) : (
            notifications.slice(0, 20).map(notif => (
              <div
                key={notif.id}
                onClick={() => { if (!notif.is_read) markNotificationRead(notif.id); }}
                style={{
                  padding: '0.875rem 1.25rem',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: notif.is_read ? 'transparent' : 'rgba(var(--primary-rgb, 45,139,127), 0.04)',
                  transition: 'background 0.2s',
                  display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseOut={e => e.currentTarget.style.background = notif.is_read ? 'transparent' : 'rgba(var(--primary-rgb, 45,139,127), 0.04)'}
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
                    {notif.title}
                  </div>
                  <p style={{ 
                    margin: 0, fontSize: '0.8rem', 
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                  }}>
                    {notif.message}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    {getTimeAgo(notif.created_at)}
                  </span>
                </div>
                {!notif.is_read && (
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--primary)', flexShrink: 0, marginTop: 8
                  }} />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
