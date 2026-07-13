import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, AlertCircle, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Stethoscope, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useApp();
  const [role, setRole] = useState('patient');
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

      // Enforce: a patient account cannot log in through the clinic-staff tab and vice-versa.
      const isStaff = ['super_admin', 'clinic_admin', 'employee', 'doctor'].includes(actualRole);
      if (role === 'clinic' && !isStaff) {
        setError(t('email') === 'البريد الإلكتروني'
          ? 'هذا الحساب ليس لديه صلاحية موظف عيادة'
          : 'This account does not have clinic staff access');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      const userData = {
        id: data.user.id,
        name: profile?.full_name || data.user.email,
        email: data.user.email,
        phone: profile?.phone_number || '',
        role: actualRole,
        clinic_id: profile?.clinic_id || null,
      };

      login(userData);
      navigate(isStaff ? '/dashboard' : '/');
    } catch (err) {
      setError(err.message || 'Login failed');
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
            <h2>{t('welcome_back')}</h2>
            <p>{t('login_subtitle')}</p>
          </div>

          <div className="role-select" role="group" aria-label="Account type">
            <button type="button" className={`role-btn ${role === 'patient' ? 'active' : ''}`} onClick={() => setRole('patient')}>
              <User size={20} />
              <span>{t('as_patient')}</span>
            </button>
            <button type="button" className={`role-btn ${role === 'clinic' ? 'active' : ''}`} onClick={() => setRole('clinic')}>
              <Stethoscope size={20} />
              <span>{t('as_clinic')}</span>
            </button>
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
