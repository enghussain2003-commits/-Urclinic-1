import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const ResetPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if we have a session. Supabase magic link logs the user in automatically.
    // If not, there might be an issue with the link or it's expired.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Option to handle invalid session or show an error
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError(t('passwords_do_not_match'));
      return;
    }

    if (password.length < 6) {
      setError(t('email') === 'البريد الإلكتروني' 
        ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' 
        : 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error(t('email') === 'البريد الإلكتروني' 
          ? 'انتهت صلاحية رابط الاستعادة أو الجلسة. يرجى طلب رابط جديد.' 
          : 'Reset link or session expired. Please request a new link.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      setMessage(t('password_reset_success'));
      
      // Optionally logout the user and redirect to login, 
      // or redirect directly since they are logged in.
      // Usually, resetting password logs them in, but we can force them to login again for security.
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/login');
      }, 3000);

    } catch (err) {
      console.error('Password reset failed:', err);
      setError(getLocalizedErrorMessage(err, { isAr: t('email') === 'البريد الإلكتروني', fallback: 'request' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page bg-gradient">
      <section className="auth-shell auth-shell--compact animate-in">
        <aside className="auth-brand-panel">
          <Link to="/" className="auth-brand">
            <Activity size={26} />
            <span>UrClinic</span>
          </Link>
          <div className="auth-brand-copy">
            <span className="eyebrow"><ShieldCheck size={15} /> {t('user_settings')}</span>
            <h1>{t('reset_password')}</h1>
            <p>{t('new_password')}</p>
          </div>
        </aside>

        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo-mark"><LockKeyhole size={24} /></div>
            <h2>{t('reset_password')}</h2>
            <p>{t('new_password')}</p>
          </div>

          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="auth-alert auth-alert--success" role="status">
              <CheckCircle2 size={17} />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="reset-password">{t('new_password')}</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={18} />
                <input 
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input auth-input" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="auth-input-action" onClick={() => setShowPassword(prev => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="reset-confirm-password">{t('confirm_password')}</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={18} />
                <input 
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input auth-input" 
                  placeholder="••••••••" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="auth-input-action" onClick={() => setShowConfirmPassword(prev => !prev)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary w-full auth-submit" disabled={loading}>
              {loading ? (t('loading') || '...') : t('update_password')}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default ResetPassword;
