import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Activity, LayoutDashboard, CalendarDays, Users, Settings, Stethoscope, Globe, LogOut, User } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Sidebar = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { logout } = useApp();
  const isActive = (path) => location.pathname === path;

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en');
  };

  const items = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('overview') },
    { path: '/dashboard/appointments', icon: CalendarDays, label: t('appointments') },
    { path: '/dashboard/doctors', icon: Stethoscope, label: t('doctors_menu') },
    { path: '/dashboard/patients', icon: Users, label: t('patients_menu') },
    { path: '/dashboard/schedule', icon: CalendarDays, label: t('schedule_menu') },
    { path: '/dashboard/settings', icon: Settings, label: t('settings') || 'Settings' },
    { path: '/settings', icon: User, label: t('user_settings') || 'Account Settings' },
  ];

  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar-logo">
        <Activity size={26} />
        UrClinic
      </Link>

      <div className="sidebar-section-title">{t('clinic_panel')}</div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <Link key={item.path} to={item.path} className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}>
            <item.icon size={20} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ padding: '0.75rem', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={toggleLang} className="sidebar-item" style={{ width: '100%' }}>
          <Globe size={20} />
          {t('lang')}
        </button>
        <Link to="/" onClick={logout} className="sidebar-item">
          <LogOut size={20} />
          {t('logout')}
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
