import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  HeartPulse,
  Laptop,
  LockKeyhole,
  Shield,
  Sparkles,
  Stethoscope,
  TabletSmartphone,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import DoctorCard from '../components/DoctorCard';

const Home = () => {
  const { t } = useTranslation();
  const { doctors, loading } = useApp();

  const trustProofs = [
    { icon: <Stethoscope size={20} />, title: t('trust_specialties'), desc: t('trust_specialties_desc') },
    { icon: <TabletSmartphone size={20} />, title: t('trust_devices'), desc: t('trust_devices_desc') },
    { icon: <LockKeyhole size={20} />, title: t('trust_roles'), desc: t('trust_roles_desc') },
    { icon: <HeartPulse size={20} />, title: t('trust_records'), desc: t('trust_records_desc') },
  ];

  const steps = [
    { icon: <Stethoscope size={22} />, title: t('step1_title'), desc: t('step1_desc') },
    { icon: <Calendar size={22} />, title: t('step2_title'), desc: t('step2_desc') },
    { icon: <Shield size={22} />, title: t('step3_title'), desc: t('step3_desc') },
  ];

  const platformHighlights = [
    { icon: <Clock3 size={18} />, label: t('available_slots') },
    { icon: <Shield size={18} />, label: t('checkout') },
    { icon: <Users size={18} />, label: t('patients') },
  ];

  return (
    <div className="home-page animate-in">
      <section className="hero hero-premium">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={16} />
            <span>{t('clinic_panel')}</span>
          </div>
          <h1>{t('hero_title')}</h1>
          <p>{t('hero_subtitle')}</p>
          <div className="hero-actions">
            <Link to="/booking" className="btn btn-primary btn-lg">
              <Calendar size={19} />
              {t('get_started')}
            </Link>
            <a href="#doctors" className="btn btn-outline btn-lg">
              {t('explore_doctors')}
              <ArrowRight size={18} />
            </a>
          </div>
          <div className="hero-trust-row">
            {platformHighlights.map(item => (
              <span key={item.label}>
                {item.icon}
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="hero-product-preview" aria-hidden="true">
          <div className="preview-topbar">
            <div className="preview-window-controls">
              <span></span><span></span><span></span>
            </div>
            <div className="preview-brand">
              <HeartPulse size={15} />
              <strong>UrClinic</strong>
            </div>
            <div className="preview-user">
              <span>DR</span>
            </div>
          </div>
          <div className="preview-header">
            <div className="preview-stat preview-stat--primary">
              <span className="preview-stat-icon"><Calendar size={17} /></span>
              <small>{t('today_appointments')}</small>
              <strong>12</strong>
              <em>+3 {t('this_week')}</em>
            </div>
            <div className="preview-stat">
              <span className="preview-stat-icon"><UserRoundCheck size={17} /></span>
              <small>{t('pending_appointments')}</small>
              <strong>04</strong>
              <em>{t('pending_approval')}</em>
            </div>
          </div>
          <div className="preview-chart-card">
            <div>
              <small>{t('appointments_per_week')}</small>
              <strong>{t('weekly_view')}</strong>
            </div>
            <div className="preview-bars" role="presentation">
              <span style={{ height: '42%' }}></span>
              <span style={{ height: '68%' }}></span>
              <span style={{ height: '54%' }}></span>
              <span style={{ height: '82%' }}></span>
              <span style={{ height: '64%' }}></span>
              <span style={{ height: '74%' }}></span>
            </div>
          </div>
          <div className="preview-schedule">
            <div className="preview-row active">
              <span className="preview-time">09:00</span>
              <span className="preview-avatar">س</span>
              <div className="preview-person">
                <strong>{t('cardiology')}</strong>
                <em>{t('doctor')} سامر الهاشمي</em>
              </div>
              <span className="preview-status preview-status--approved">{t('confirmed')}</span>
            </div>
            <div className="preview-row">
              <span className="preview-time">10:30</span>
              <span className="preview-avatar preview-avatar--patient">م</span>
              <div className="preview-person">
                <strong>{t('dermatology')}</strong>
                <em>{t('patient')} مريم علي</em>
              </div>
              <span className="preview-status preview-status--pending">{t('pending')}</span>
            </div>
            <div className="preview-row soft">
              <span className="preview-time">12:00</span>
              <span className="preview-avatar preview-avatar--soft"><Laptop size={15} /></span>
              <div className="preview-person">
                <strong>{t('telehealth')}</strong>
                <em>{t('schedule')} - {t('break_time')}</em>
              </div>
              <span className="preview-status preview-status--neutral">{t('available_slot')}</span>
            </div>
          </div>
          <div className="preview-footer">
            <CheckCircle2 size={17} />
            <span>{t('appointment_time_reached')}</span>
          </div>
        </div>
      </section>

      <section className="landing-trust-section" aria-label={t('landing_trust_label')}>
        {trustProofs.map((item, i) => (
          <article key={item.title} className="landing-trust-card animate-in" style={{ animationDelay: `${i * 0.07}s` }}>
            <span>{item.icon}</span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <span>{t('how_it_works')}</span>
          <h2>{t('how_it_works')}</h2>
          <p>{t('hero_subtitle')}</p>
        </div>
        <div className="process-grid">
          {steps.map((step, i) => (
            <article key={step.title} className="process-card animate-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="process-icon">
                {step.icon}
              </div>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="doctors" className="section-block section-block--doctors">
        <div className="section-heading">
          <span>{t('our_doctors')}</span>
          <h2>{t('our_doctors')}</h2>
          <p>{t('our_doctors_subtitle')}</p>
        </div>
        <div className="doctors-grid">
          {loading ? (
            <div className="premium-empty-state">{t('loading')}...</div>
          ) : doctors.length === 0 ? (
            <div className="premium-empty-state">{t('no_data_available')}</div>
          ) : doctors.slice(0, 4).map((doc, i) => (
            <div key={doc.id} className="animate-in" style={{ animationDelay: `${i * 0.08}s` }}>
              <DoctorCard doctor={doc} />
            </div>
          ))}
        </div>
        <div className="section-action">
          <Link to="/booking" className="btn btn-outline btn-lg">
            {t('book_appointment')}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
