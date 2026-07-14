import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity, LayoutDashboard, CalendarDays, Users,
  Settings, Stethoscope, Globe, LogOut, User, X, Building2, PlusCircle, ShieldCheck, UserRoundCog, Headset,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { logout, user, supportUnreadCount } = useApp();
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en');
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose?.();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trap scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const staffItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('overview') },
    { path: '/dashboard/appointments', icon: CalendarDays, label: t('appointments') },
    { path: '/dashboard/doctors', icon: Stethoscope, label: t('doctors_menu') },
    { path: '/dashboard/patients', icon: Users, label: t('patients_menu') },
    { path: '/dashboard/schedule', icon: CalendarDays, label: t('schedule_menu') },
    { path: '/dashboard/settings', icon: Settings, label: t('settings') || 'Settings' },
  ];
  const canUseRegularSupport = ['clinic_admin', 'doctor', 'employee', 'patient'].includes(user?.role);

  const items = [
    ...(user?.role === 'patient' ? [] : staffItems),
    ...(canUseRegularSupport ? [{
      path: '/dashboard/support',
      icon: Headset,
      label: i18n.language === 'ar' ? 'الدعم الفني' : 'Support',
      badge: supportUnreadCount,
    }] : []),
    { path: '/settings', icon: User, label: t('user_settings') || 'Account Settings' },
  ];

  const superAdminItems = [
    { path: '/dashboard/super-admin/clinics', icon: Building2, label: i18n.language === 'ar' ? 'العيادات' : 'Clinics' },
    { path: '/dashboard/super-admin/clinics/new', icon: PlusCircle, label: i18n.language === 'ar' ? 'إضافة عيادة' : 'Add New Clinic' },
    { path: '/dashboard/super-admin/patients', icon: UserRoundCog, label: i18n.language === 'ar' ? 'إدارة حسابات المرضى' : 'Patient Accounts' },
    { path: '/dashboard/super-admin/support', icon: Headset, label: i18n.language === 'ar' ? 'فريق الدعم' : 'Support Center', badge: supportUnreadCount },
    { path: '/dashboard/super-admin/clinics', icon: ShieldCheck, label: i18n.language === 'ar' ? 'إدارة الحسابات' : 'Account Management' },
  ];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="Main navigation">
        {/* Logo row + close button */}
        <div className="sidebar-logo-row">
          <Link to="/" className="sidebar-logo">
            <Activity size={26} />
            UrClinic
          </Link>
          {/* Close button — only visible on mobile */}
          <button
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-section-title">{t('clinic_panel')}</div>
        <nav className="sidebar-nav">
          {user?.role === 'super_admin' && (
            <>
              <div className="sidebar-section-title sidebar-section-title--nested">
                {i18n.language === 'ar' ? 'إدارة العيادات' : 'Clinic Management'}
              </div>
              {superAdminItems.map(item => (
                <Link
                  key={`${item.path}-${item.label}`}
                  to={item.path}
                  className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                  {item.badge > 0 && <em className="sidebar-badge">{item.badge > 9 ? '9+' : item.badge}</em>}
                </Link>
              ))}
            </>
          )}
          {items.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {item.badge > 0 && <em className="sidebar-badge">{item.badge > 9 ? '9+' : item.badge}</em>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={toggleLang} className="sidebar-item" style={{ width: '100%' }}>
            <Globe size={20} />
            <span>{t('lang')}</span>
          </button>
          <Link to="/" onClick={logout} className="sidebar-item sidebar-item--danger">
            <LogOut size={20} />
            <span>{t('logout')}</span>
          </Link>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
