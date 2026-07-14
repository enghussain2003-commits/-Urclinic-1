import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, AlertCircle, Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';
import { validateIraqiPhone, validatePersonName } from '../utils/identityValidation';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const SignUp = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const { login } = useApp();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const nameValidation = validatePersonName(fullName, { isAr });
  const phoneValidation = validateIraqiPhone(phone, { isAr });
  const canSubmit = nameValidation.valid && phoneValidation.valid && email && password && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const checkedName = validatePersonName(fullName, { isAr });
    if (!checkedName.valid) {
      setError(checkedName.error);
      return;
    }

    const checkedPhone = validateIraqiPhone(phone, { isAr });
    if (!checkedPhone.valid) {
      setError(checkedPhone.error);
      return;
    }

    setLoading(true);

    try {
      const { data: phoneAvailable, error: phoneCheckError } = await supabase.rpc('is_patient_phone_available', {
        p_phone: checkedPhone.value,
      });
      if (phoneCheckError) throw phoneCheckError;
      if (phoneAvailable === false) {
        throw new Error(isAr ? 'رقم الهاتف مستخدم مسبقاً' : 'Phone number is already in use.');
      }

      // Create user in Supabase Auth — pass profile data as metadata.
      // The DB trigger (handle_new_user) creates the profile row automatically,
      // so we do NOT insert into profiles here (avoids duplicate-key race condition).
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: checkedName.value, phone: checkedPhone.value }
        }
      });

      if (authError) throw authError;

      if (authData?.user) {
        if (authData.session) {
          const userData = {
            id: authData.user.id,
            name: checkedName.value,
            email,
            phone: checkedPhone.value,
            role: 'patient',
            clinic_id: null,
          };
          login(userData);
          navigate('/');
        } else {
          // If session is null, email confirmation is required by Supabase
          setError(t('email') === 'البريد الإلكتروني' 
            ? 'يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب قبل تسجيل الدخول.' 
            : 'Please check your email to verify your account before logging in.');
        }
      }
    } catch (err) {
      console.error('Signup failed:', err);
      setError(getLocalizedErrorMessage(err, { isAr, fallback: 'auth' }));
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
            <span className="eyebrow"><ShieldCheck size={15} /> {t('book_now')}</span>
            <h1>{t('create_new_account')}</h1>
            <p>{t('hero_subtitle')}</p>
          </div>
          <div className="auth-preview-card" aria-hidden="true">
            <div><span>{t('patients_served')}</span><strong>15k+</strong></div>
            <div><span>{t('specialists')}</span><strong>24</strong></div>
            <div className="auth-preview-line"><span>{t('checkout')}</span><strong>{t('available')}</strong></div>
          </div>
        </aside>

        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo-mark"><Activity size={24} /></div>
            <h2>{t('sign_up')}</h2>
            <p>{t('create_new_account') || 'Create a new account'}</p>
          </div>

          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">{t('full_name') || 'Full Name'}</label>
              <div className="auth-input-wrap">
                <UserRound size={18} />
                <input id="signup-name" type="text" required className="input auth-input" placeholder={isAr ? 'أحمد حسن علي' : 'Ahmed Hassan'} value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" aria-invalid={Boolean(fullName && !nameValidation.valid)} />
              </div>
              {fullName && !nameValidation.valid && <span className="booking-field-hint booking-field-hint--error">{nameValidation.error}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">{t('email')}</label>
              <div className="auth-input-wrap">
                <Mail size={18} />
                <input id="signup-email" type="email" required className="input auth-input" placeholder="john@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-phone">{t('phone') || 'Phone Number'}</label>
              <div className="auth-input-wrap">
                <Phone size={18} />
                <input id="signup-phone" type="tel" required className="input auth-input" placeholder="07701234567" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" aria-invalid={Boolean(phone && !phoneValidation.valid)} />
              </div>
              <span className={`booking-field-hint ${phone && !phoneValidation.valid ? 'booking-field-hint--error' : ''}`}>
                {phone && phoneValidation.valid ? phoneValidation.value : (isAr ? 'مثال: 07701234567 أو +9647701234567' : 'Example: 07701234567 or +9647701234567')}
              </span>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">{t('password')}</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={18} />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input auth-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" className="auth-input-action" onClick={() => setShowPassword(prev => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button type="submit" disabled={!canSubmit} className="btn btn-primary w-full auth-submit">
              {loading ? t('loading') || 'Loading...' : t('sign_up')}
            </button>
          </form>

          <div className="auth-footer-link">
            <span>{t('already_have_account') || 'Already have an account?'}</span>
            <Link to="/login">{t('sign_in')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SignUp;
