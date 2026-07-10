import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, User, Phone, Mail, Lock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';

const SignUp = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useApp();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create user in Supabase Auth — pass profile data as metadata.
      // The DB trigger (handle_new_user) creates the profile row automatically,
      // so we do NOT insert into profiles here (avoids duplicate-key race condition).
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone: phone }
        }
      });

      if (authError) throw authError;

      if (authData?.user) {
        if (authData.session) {
          const userData = {
            id: authData.user.id,
            name: fullName,
            email,
            phone,
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
      setError(err.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container bg-gradient">
      <div className="login-card animate-in">
        <div className="login-logo">
          <Activity size={36} color="var(--primary)" />
          <h2 style={{ marginBottom: '0.25rem' }}>{t('sign_up')}</h2>
          <p>{t('create_new_account') || 'Create a new account'}</p>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem', color: 'red' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('full_name') || 'Full Name'}</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0 0.75rem' }}>
               <User size={18} color="var(--text-secondary)" />
               <input type="text" required className="input" style={{ border: 'none', background: 'transparent' }} placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('email')}</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0 0.75rem' }}>
               <Mail size={18} color="var(--text-secondary)" />
               <input type="email" required className="input" style={{ border: 'none', background: 'transparent' }} placeholder="john@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('phone') || 'Phone Number'}</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0 0.75rem' }}>
               <Phone size={18} color="var(--text-secondary)" />
               <input type="tel" required className="input" style={{ border: 'none', background: 'transparent' }} placeholder="+964..." value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('password')}</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0 0.75rem' }}>
               <Lock size={18} color="var(--text-secondary)" />
               <input type="password" required className="input" style={{ border: 'none', background: 'transparent' }} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>
          
          <button type="submit" disabled={loading} className="btn btn-primary w-full" style={{ marginTop: '1rem' }}>
            {loading ? t('loading') || 'Loading...' : t('sign_up')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
          {t('already_have_account') || 'Already have an account?'} <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('sign_in')}</Link>
        </p>
      </div>
    </div>
  );
};

export default SignUp;
