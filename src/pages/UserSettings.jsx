import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Lock, LogOut, Volume2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const UserSettings = () => {
  const { t } = useTranslation();
  const isAr = t('email') === 'البريد الإلكتروني';
  const { user, logout, patientCallSoundEnabled, setPatientCallSoundEnabled } = useApp();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handlePasswordChange = async (e) => {
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
          ? 'انتهت صلاحية الجلسة أو مفقودة. يرجى تسجيل الخروج وتسجيل الدخول مرة أخرى.' 
          : 'Auth session missing! Please log out and log in again.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      setMessage(t('password_reset_success') || 'Password updated successfully.');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('User password update failed:', err);
      setError(getLocalizedErrorMessage(err, { isAr, fallback: 'request' }));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    return null; // Layout ProtectedRoute handles redirect for unauthenticated
  }

  return (
    <div className="page-padding user-settings-page animate-in">
      <div className="user-settings-shell">
        <header className="user-settings-header">
          <span className="user-settings-icon">
            <Settings size={26} />
          </span>
          <h2>{t('user_settings')}</h2>
        </header>

        <div className="glass user-settings-card">
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid var(--danger)',
            color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
            marginBottom: '1rem', fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{
            background: 'rgba(16,185,129,0.08)', border: '1px solid var(--success)',
            color: 'var(--success)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
            marginBottom: '1rem', fontSize: '0.875rem'
          }}>
            {message}
          </div>
        )}

        <h4 className="user-settings-section-title"><Lock size={18} /> {t('change_password')}</h4>
        
        <form onSubmit={handlePasswordChange} className="card-flat bg-alt user-settings-password-card">
          <div className="form-group">
            <label className="form-label">{t('new_password')}</label>
            <input 
              type="password" 
              className="input" 
              placeholder="••••••••" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">{t('confirm_password')}</label>
            <input 
              type="password" 
              className="input" 
              placeholder="••••••••" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              required
            />
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (t('loading') || '...') : t('update_password')}
            </button>
          </div>
        </form>

        <hr className="user-settings-divider" />

        <div className="user-settings-row">
          <div>
            <h4>
              <Volume2 size={18} />
              {t('patient_call_sound')}
            </h4>
            <p className="text-sm text-muted">
              {t('patient_call_sound_desc')}
            </p>
          </div>
          <label className="patient-call-sound-toggle">
            <input
              type="checkbox"
              checked={patientCallSoundEnabled}
              onChange={event => setPatientCallSoundEnabled(event.target.checked)}
            />
            <span>{patientCallSoundEnabled ? t('enabled') : t('disabled')}</span>
          </label>
        </div>

        <hr className="user-settings-divider" />

        <div className="user-settings-row">
          <div>
            <h4>{t('logout')}</h4>
            <p className="text-sm text-muted">
              {t('email') === 'البريد الإلكتروني' ? 'تسجيل الخروج من حسابك الحالي' : 'Sign out of your current account'}
            </p>
          </div>
          <button onClick={handleLogout} className="btn" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', minWidth: 140 }}>
            <LogOut size={18} /> {t('logout')}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
