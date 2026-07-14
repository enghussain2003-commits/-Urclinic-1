import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Activity, AlertCircle, ArrowLeft, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

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
      setError(getLocalizedErrorMessage(err, { isAr: t('email') === 'البريد الإلكتروني', fallback: 'request' }));
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
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
            <h1>{t('forgot_password_title')}</h1>
            <p>{t('forgot_password_subtitle')}</p>
          </div>
        </aside>

        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo-mark"><Mail size={24} /></div>
            <h2>{t('forgot_password_title')}</h2>
            <p>{t('forgot_password_subtitle')}</p>
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
              <label className="form-label" htmlFor="forgot-email">{t('email')}</label>
              <div className="auth-input-wrap">
                <Mail size={18} />
                <input 
                  id="forgot-email"
                  type="email" 
                  className="input auth-input" 
                  placeholder="example@email.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary w-full auth-submit" disabled={loading}>
              {loading ? (t('loading') || '...') : t('send_reset_link')}
            </button>
          </form>

          <div className="auth-footer-link">
            <Link to="/login"><ArrowLeft size={16} /> {t('previous')} - {t('login')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ForgotPassword;
