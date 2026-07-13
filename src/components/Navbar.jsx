import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Globe, User, LogOut, Settings, X, Menu } from 'lucide-react';
import { useApp } from '../context/AppContext';
import NotificationBell from './NotificationBell';
import { LANGUAGE_PREFERENCE_KEY } from '../i18n';

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isStaff = user && ['super_admin', 'clinic_admin', 'employee', 'doctor'].includes(user.role);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileOpen(false);
  };

  const toggleLang = () => {
    const nextLanguage = i18n.language === 'en' ? 'ar' : 'en';
    try {
      window.localStorage.setItem(LANGUAGE_PREFERENCE_KEY, nextLanguage);
    } catch {
      // Language preference is local-only and best-effort.
    }
    i18n.changeLanguage(nextLanguage);
  };

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Close mobile menu on route change
  useEffect(() => {
    const id = requestAnimationFrame(() => setMobileOpen(false));
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  // Lock body scroll when mobile nav is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <Link to="/" className="navbar-logo">
        <Activity size={28} />
        UrClinic
      </Link>

      {/* Desktop links */}
      <div className="navbar-links navbar-links--desktop">
        <Link to="/" className={`navbar-link ${isActive('/') ? 'active' : ''}`}>{t('home')}</Link>
        {!isStaff && (
          <Link to="/booking" className={`navbar-link ${isActive('/booking') ? 'active' : ''}`}>{t('book_now')}</Link>
        )}
        {isStaff && (
          <Link to="/dashboard" className={`navbar-link ${isActive('/dashboard') ? 'active' : ''}`}>{t('dashboard')}</Link>
        )}

        <NotificationBell />

        {user ? (
          <>
            <Link to="/profile" className="btn btn-ghost btn-sm" style={{ gap: '0.375rem' }}>
              <User size={18} />
              <span className="nav-user-name">{user.name || t('profile')}</span>
            </Link>
            <Link to="/settings" className="btn btn-ghost btn-sm" style={{ gap: '0.375rem' }} title={t('user_settings')}>
              <Settings size={18} />
            </Link>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ gap: '0.375rem', color: 'var(--danger)' }}>
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">{t('login')}</Link>
        )}

        <button onClick={toggleLang} className="lang-toggle">
          <Globe size={16} />
          {t('lang')}
        </button>
      </div>

      {/* Mobile right controls */}
      <div className="navbar-mobile-controls">
        <NotificationBell />
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile menu panel */}
      <div className={`mobile-nav-panel ${mobileOpen ? 'open' : ''}`} role="dialog" aria-modal="true">
        <div className="mobile-nav-header">
          <span className="navbar-logo" style={{ fontSize: '1.2rem' }}>
            <Activity size={22} />
            UrClinic
          </span>
          <button className="btn btn-ghost btn-icon" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="mobile-nav-links">
          <Link to="/" className={`mobile-nav-link ${isActive('/') ? 'active' : ''}`}>{t('home')}</Link>
          {!isStaff && (
            <Link to="/booking" className={`mobile-nav-link ${isActive('/booking') ? 'active' : ''}`}>{t('book_now')}</Link>
          )}
          {isStaff && (
            <Link to="/dashboard" className={`mobile-nav-link ${isActive('/dashboard') ? 'active' : ''}`}>{t('dashboard')}</Link>
          )}
          {user ? (
            <>
              <Link to="/profile" className="mobile-nav-link">
                <User size={18} /> {user.name || t('profile')}
              </Link>
              <Link to="/settings" className="mobile-nav-link">
                <Settings size={18} /> {t('user_settings')}
              </Link>
              <button onClick={handleLogout} className="mobile-nav-link mobile-nav-link--danger">
                <LogOut size={18} /> {t('logout')}
              </button>
            </>
          ) : (
            <Link to="/login" className="mobile-nav-link mobile-nav-link--primary">{t('login')}</Link>
          )}
        </div>

        <div className="mobile-nav-footer">
          <button onClick={toggleLang} className="mobile-nav-link" style={{ width: '100%' }}>
            <Globe size={18} /> {t('lang')}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
