import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Activity, Mail } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const isSubmittingRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmittingRef.current) return;
    
    setError('');
    setMessage('');

    if (!email) {
      setError(t('email') === 'البريد الإلكتروني' ? 'الرجاء إدخال البريد الإلكتروني' : 'Please enter your email');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      console.log("SENDING REQUEST: supabase.auth.resetPasswordForEmail for", email);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      console.log("SUCCESS: Reset link sent");
      setMessage(t('reset_link_sent'));
      setEmail('');
    } catch (err) {
      console.error("FULL SUPABASE ERROR OBJECT:", JSON.stringify(err, null, 2), err);
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="login-container bg-gradient">
      <div className="login-card animate-in">
        <div className="login-logo">
          <Activity size={36} color="var(--primary)" />
          <h2 style={{ marginBottom: '0.25rem' }}>{t('forgot_password_title')}</h2>
          <p>{t('forgot_password_subtitle')}</p>
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
            <label className="form-label">{t('email')}</label>
            <div style={{ position: 'relative' }}>
              {/* Fix Mail icon styling for RTL support */}
              <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [document.documentElement.dir === 'rtl' ? 'right' : 'left']: '1rem', color: 'var(--text-muted)' }}>
                <Mail size={18} />
              </div>
              <input 
                type="email" 
                className="input" 
                style={{ paddingInlineStart: '2.5rem' }}
                placeholder="example@email.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
              />
            </div>
          </div>
          
          <button type="submit" className="btn btn-primary w-full" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? (t('loading') || '...') : t('send_reset_link')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
           <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('previous')} - {t('login')}</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
