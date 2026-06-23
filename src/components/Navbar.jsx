import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Globe, Bell, User, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import NotificationCenter from './NotificationCenter';

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, unreadCount, logout } = useApp();
  const [showNotif, setShowNotif] = React.useState(false);
  const isStaff = user && ['super_admin', 'clinic_admin', 'employee', 'doctor'].includes(user.role);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en');
  };

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        <Activity size={28} />
        CareClinic
      </Link>
      <div className="navbar-links">
        <Link to="/" className={`navbar-link ${isActive('/') ? 'active' : ''}`}>{t('home')}</Link>
        {/* Booking is for patients (and visitors who'll be asked to log in); staff don't book. */}
        {!isStaff && (
          <Link to="/booking" className={`navbar-link ${isActive('/booking') ? 'active' : ''}`}>{t('book_now')}</Link>
        )}
        {/* Dashboard only for clinic staff. */}
        {isStaff && (
          <Link to="/dashboard" className={`navbar-link ${isActive('/dashboard') ? 'active' : ''}`}>{t('dashboard')}</Link>
        )}

        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button className="notif-btn" onClick={() => setShowNotif(!showNotif)}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="notif-badge"></span>}
          </button>
          {showNotif && <NotificationCenter onClose={() => setShowNotif(false)} />}
        </div>

        {/* User */}
        {user ? (
          <>
            <Link to="/profile" className="btn btn-ghost btn-sm" style={{ gap: '0.375rem' }}>
              <User size={18} />
              {user.name || t('profile')}
            </Link>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ gap: '0.375rem', color: 'var(--danger)' }} title={t('logout')}>
              <LogOut size={18} />
              {t('logout')}
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">{t('login')}</Link>
        )}

        {/* Language Toggle */}
        <button onClick={toggleLang} className="lang-toggle">
          <Globe size={16} />
          {t('lang')}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
