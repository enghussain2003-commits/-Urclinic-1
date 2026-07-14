import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { passwordScore, routeForRole } from '../services/superAdminService';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const ForceChangePassword = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const { user, login } = useApp();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const strength = passwordScore(password);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password !== confirmPassword) {
      setError(t('passwords_do_not_match'));
      return;
    }
    if (strength < 3) {
      setError(isAr ? 'اختر كلمة مرور أقوى.' : 'Choose a stronger password.');
      return;
    }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      const { error: profileError } = await supabase.rpc('clear_own_must_change_password');
      if (profileError) throw profileError;
      const nextUser = { ...user, must_change_password: false };
      login(nextUser);
      setMessage(isAr ? 'تم تغيير كلمة المرور بنجاح.' : 'Password changed successfully.');
      setTimeout(() => navigate(routeForRole(user.role), { replace: true }), 600);
    } catch (err) {
      console.error('Forced password change failed:', err);
      setError(getLocalizedErrorMessage(err, { isAr, fallback: 'request' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page bg-gradient">
      <section className="auth-shell auth-shell--compact animate-in">
        <aside className="auth-brand-panel">
          <div className="auth-brand"><ShieldCheck size={26} /><span>UrClinic</span></div>
          <div className="auth-brand-copy">
            <span className="eyebrow"><LockKeyhole size={15} /> {isAr ? 'كلمة مرور مؤقتة' : 'Temporary password'}</span>
            <h1>{isAr ? 'غيّر كلمة المرور' : 'Change your password'}</h1>
            <p>{isAr ? 'يجب اختيار كلمة مرور جديدة قبل استخدام النظام.' : 'You must choose a new password before using the application.'}</p>
          </div>
        </aside>
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo-mark"><LockKeyhole size={24} /></div>
            <h2>{isAr ? 'تعيين كلمة مرور جديدة' : 'Set a new password'}</h2>
            <p>{isAr ? 'لن يعرف المشرف العام كلمة المرور الجديدة.' : 'The Super Admin will not know your new password.'}</p>
          </div>
          {error && <div className="auth-alert auth-alert--error"><AlertCircle size={17} /><span>{error}</span></div>}
          {message && <div className="auth-alert auth-alert--success"><CheckCircle2 size={17} /><span>{message}</span></div>}
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t('new_password')}</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={18} />
                <input className="input auth-input" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
                <button type="button" className="auth-input-action" onClick={() => setShowPassword(prev => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="super-admin-password-strength"><span style={{ width: `${Math.max(strength, 1) * 20}%` }} /><em>{isAr ? 'قوة كلمة المرور' : 'Password strength'}</em></div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('confirm_password')}</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={18} />
                <input className="input auth-input" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
              </div>
            </div>
            <button className="btn btn-primary w-full auth-submit" disabled={loading}>
              {loading ? t('loading') : t('update_password')}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default ForceChangePassword;
