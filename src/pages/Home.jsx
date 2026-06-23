import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Calendar, Shield, Users, Search, ArrowRight, Star, Heart, Stethoscope, Bone, Baby, SmilePlus } from 'lucide-react';
import { specialties } from '../data/mockData';
import { useApp } from '../context/AppContext';
import DoctorCard from '../components/DoctorCard';

const Home = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { doctors, loading } = useApp();

  const stats = [
    { value: "15,200", label: t('patients_served') },
    { value: "24", label: t('specialists') },
    { value: "6", label: t('specialties') },
    { value: "98%", label: t('satisfaction') },
  ];

  const steps = [
    { icon: <Search size={28} />, title: t('step1_title'), desc: t('step1_desc') },
    { icon: <Calendar size={28} />, title: t('step2_title'), desc: t('step2_desc') },
    { icon: <Shield size={28} />, title: t('step3_title'), desc: t('step3_desc') },
  ];

  return (
    <div className="animate-in">
      {/* Hero */}
      <section className="hero" style={{ marginTop: '1rem' }}>
        <div className="hero-bg"></div>
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <h1 style={{ position: 'relative', zIndex: 1 }}>{t('hero_title')}</h1>
        <p style={{ position: 'relative', zIndex: 1, fontSize: '1.125rem', maxWidth: '600px', margin: '1rem auto 2.5rem' }}>
          {t('hero_subtitle')}
        </p>
        <div className="hero-actions">
          <Link to="/booking" className="btn btn-primary btn-lg">
            <Calendar size={20} />
            {t('get_started')}
          </Link>
          <a href="#doctors" className="btn btn-outline btn-lg">
            {t('explore_doctors')}
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-row">
        {stats.map((s, i) => (
          <div key={i} className="stat-card animate-in" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="stat-number">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section style={{ margin: '4rem 0' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>{t('how_it_works')}</h2>
        <p style={{ textAlign: 'center', marginBottom: '3rem' }}>{t('hero_subtitle')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          {steps.map((step, i) => (
            <div key={i} className="card animate-in" style={{ textAlign: 'center', padding: '2.5rem 2rem', animationDelay: `${i * 0.15}s` }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--primary-100)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}>
                {step.icon}
              </div>
              <h3 style={{ marginBottom: '0.5rem' }}>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Doctors */}
      <section id="doctors" style={{ margin: '4rem 0', paddingBottom: '4rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>{t('our_doctors')}</h2>
        <p style={{ textAlign: 'center', marginBottom: '2.5rem' }}>{t('our_doctors_subtitle')}</p>
        <div className="doctors-grid">
          {loading ? <p>{t('loading')}...</p> : doctors.slice(0, 4).map((doc, i) => (
            <div key={doc.id} className="animate-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <DoctorCard doctor={doc} />
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/booking" className="btn btn-outline">
            {t('book_appointment')}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
