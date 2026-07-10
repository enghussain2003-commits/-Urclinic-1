import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Activity, Lock } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ResetPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container bg-gradient">
      <div className="login-card animate-in">
        <div className="login-logo">
          <Activity size={36} color="var(--primary)" />
          <h2 style={{ marginBottom: '0.25rem' }}>{t('reset_password')}</h2>
          <p>{t('new_password')}</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid var(--danger)',
            color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
            marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{
            background: 'rgba(16,185,129,0.08)', border: '1px solid var(--success)',
            color: 'var(--success)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
            marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('new_password')}</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [document.documentElement.dir === 'rtl' ? 'right' : 'left']: '1rem', color: 'var(--text-muted)' }}>
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                className="input" 
                style={{ paddingInlineStart: '2.5rem' }}
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">{t('confirm_password')}</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [document.documentElement.dir === 'rtl' ? 'right' : 'left']: '1rem', color: 'var(--text-muted)' }}>
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                className="input" 
                style={{ paddingInlineStart: '2.5rem' }}
                placeholder="••••••••" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required
              />
            </div>
          </div>
          
          <button type="submit" className="btn btn-primary w-full" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? (t('loading') || '...') : t('update_password')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
