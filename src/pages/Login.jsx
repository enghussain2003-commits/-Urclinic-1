import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, AlertCircle, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';
import { routeForRole } from '../services/superAdminService';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('email') === 'البريد الإلكتروني' ? 'الرجاء إدخال البريد وكلمة المرور' : 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      // Real authentication against Supabase Auth (passwords are bcrypt-hashed server-side).
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Wrong credentials or account does not exist → reject.
        setError(t('email') === 'البريد الإلكتروني'
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          : 'Invalid email or password');
        setLoading(false);
        return;
      }

      // Fetch the user's profile to determine their real role from the database.
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const actualRole = profile?.role || 'patient';
      const isStaff = ['super_admin', 'clinic_admin', 'employee', 'doctor'].includes(actualRole);

      if (profile?.status === 'suspended') {
        setError(t('email') === 'البريد الإلكتروني'
          ? 'تم تعليق هذا الحساب. يرجى التواصل مع الإدارة.'
          : 'This account is suspended. Please contact administration.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (isStaff && actualRole !== 'super_admin' && profile?.clinic_id) {
        const { data: clinic } = await supabase
          .from('clinics')
          .select('is_active')
          .eq('id', profile.clinic_id)
          .single();
        if (clinic?.is_active === false) {
          setError(t('email') === 'البريد الإلكتروني'
            ? 'تم تعليق العيادة المرتبطة بهذا الحساب.'
            : 'The clinic linked to this account is suspended.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
      }

      const userData = {
        id: data.user.id,
        name: profile?.full_name || data.user.email,
        email: data.user.email,
        phone: profile?.phone_number || '',
        role: actualRole,
        clinic_id: profile?.clinic_id || null,
        status: profile?.status || 'active',
        must_change_password: Boolean(profile?.must_change_password),
      };

      login(userData);
      navigate(userData.must_change_password ? '/change-password' : routeForRole(actualRole), { replace: true });
    } catch (err) {
      console.error('Login failed:', err);
      setError(getLocalizedErrorMessage(err, { isAr: t('email') === 'البريد الإلكتروني', fallback: 'login' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page bg-gradient">
      <section className="auth-shell animate-in">
        <aside className="auth-brand-panel">
          <Link to="/" className="auth-brand">
            <Activity size={26} />
            <span>UrClinic</span>
          </Link>
          <div className="auth-brand-copy">
            <span className="eyebrow"><ShieldCheck size={15} /> {t('clinic_panel')}</span>
            <h1>{t('welcome_back')}</h1>
            <p>{t('login_subtitle')}</p>
          </div>
          <div className="auth-preview-card" aria-hidden="true">
            <div><span>{t('today_appointments')}</span><strong>12</strong></div>
            <div><span>{t('pending_appointments')}</span><strong>04</strong></div>
            <div className="auth-preview-line"><span>09:00</span><strong>{t('confirmed')}</strong></div>
          </div>
        </aside>

        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo-mark"><Activity size={24} /></div>
            <h2>{t('email') === 'البريد الإلكتروني' ? 'تسجيل الدخول إلى UrClinic' : 'Sign in to UrClinic'}</h2>
            <p>{t('login_subtitle')}</p>
          </div>

          <div className="auth-unified-note">
            <User size={18} />
            <span>{t('email') === 'البريد الإلكتروني' ? 'استخدم نفس صفحة الدخول لكل الأدوار.' : 'Use one sign-in for patients, staff, doctors, clinic admins, and Super Admins.'}</span>
          </div>

          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">{t('email')}</label>
              <div className="auth-input-wrap">
                <Mail size={18} />
                <input id="login-email" type="email" className="input auth-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
            </div>
            <div className="form-group">
              <div className="auth-label-row">
                <label className="form-label" htmlFor="login-password">{t('password')}</label>
                <Link to="/forgot-password">{t('forgot_password')}</Link>
              </div>
              <div className="auth-input-wrap">
                <LockKeyhole size={18} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input auth-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" className="auth-input-action" onClick={() => setShowPassword(prev => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary w-full auth-submit" disabled={loading}>
              {loading ? (t('loading') || '...') : t('sign_in')}
            </button>
          </form>

          <div className="auth-footer-link">
            <span>{t('no_account')}</span>
            <Link to="/signup">{t('sign_up')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Login;
