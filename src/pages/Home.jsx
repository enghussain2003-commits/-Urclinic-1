import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, CheckCircle2, Clock3, Shield, Sparkles, Stethoscope, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import DoctorCard from '../components/DoctorCard';

const Home = () => {
  const { t } = useTranslation();
  const { doctors, loading } = useApp();

  const stats = [
    { value: "15,200", label: t('patients_served') },
    { value: "24", label: t('specialists') },
    { value: "6", label: t('specialties') },
    { value: "98%", label: t('satisfaction') },
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
            <span></span><span></span><span></span>
          </div>
          <div className="preview-header">
            <div>
              <small>{t('today_appointments')}</small>
              <strong>12</strong>
            </div>
            <div>
              <small>{t('pending_appointments')}</small>
              <strong>04</strong>
            </div>
          </div>
          <div className="preview-schedule">
            <div className="preview-row active">
              <span>09:00</span>
              <strong>{t('confirmed')}</strong>
              <em>{t('doctor')}</em>
            </div>
            <div className="preview-row">
              <span>10:30</span>
              <strong>{t('pending')}</strong>
              <em>{t('patient')}</em>
            </div>
            <div className="preview-row soft">
              <span>12:00</span>
              <strong>{t('break_time')}</strong>
              <em>{t('schedule')}</em>
            </div>
          </div>
          <div className="preview-footer">
            <CheckCircle2 size={17} />
            <span>{t('appointment_time_reached')}</span>
          </div>
        </div>
      </section>

      <section className="stats-row premium-stats">
        {stats.map((s, i) => (
          <div key={s.label} className="stat-card animate-in" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="stat-number">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
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
