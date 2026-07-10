import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, User, Stethoscope } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useApp();
  const [role, setRole] = useState('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="login-container bg-gradient">
      <div className="login-card animate-in">
        <div className="login-logo">
          <Activity size={36} color="var(--primary)" />
          <h2 style={{ marginBottom: '0.25rem' }}>{t('welcome_back')}</h2>
          <p>{t('login_subtitle')}</p>
        </div>

        {/* Role Selection */}
        <div className="role-select">
          <button type="button" className={`role-btn ${role === 'patient' ? 'active' : ''}`} onClick={() => setRole('patient')}>
            <User size={24} />
            {t('as_patient')}
          </button>
          <button type="button" className={`role-btn ${role === 'clinic' ? 'active' : ''}`} onClick={() => setRole('clinic')}>
            <Stethoscope size={24} />
            {t('as_clinic')}
          </button>
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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('email')}</label>
            <input type="email" className="input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('password')}</label>
            <input type="password" className="input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            <div style={{ textAlign: 'right', marginTop: '0.25rem' }}>
              <Link to="/forgot-password" style={{ color: 'var(--primary)', fontSize: '0.875rem' }}>
                {t('forgot_password')}
              </Link>
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-full" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? (t('loading') || '...') : t('sign_in')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
          {t('no_account')} <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('sign_up')}</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
