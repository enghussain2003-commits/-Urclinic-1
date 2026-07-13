import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  Clock3,
  Cloud,
  Database,
  FileText,
  HeartPulse,
  KeyRound,
  LockKeyhole,
  NotebookPen,
  Shield,
  Sparkles,
  Stethoscope,
  TabletSmartphone,
  Timer,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import DoctorCard from '../components/DoctorCard';

const ShowcaseScreen = ({ type, t }) => {
  if (type === 'patient') {
    return (
      <div className="showcase-ui showcase-ui--patient">
        <div className="showcase-phone">
          <div className="showcase-phone-top">
            <span>UrClinic</span>
            <Bell size={14} />
          </div>
          <div className="booking-card">
            <small>{t('showcase_patient_booking')}</small>
            <strong>Dr. Sara Ali</strong>
            <div className="booking-slots">
              <span>09:00</span><span className="active">10:30</span><span>12:00</span>
            </div>
          </div>
          <div className="mini-prescription">
            <FileText size={15} />
            <div>
              <strong>{t('prescription')}</strong>
              <small>2 {t('medicines')}</small>
            </div>
          </div>
          <div className="reminder-pill">
            <Timer size={14} />
            <span>{t('reminder_msg')}</span>
          </div>
        </div>
        <div className="showcase-side-panel">
          <div className="panel-title-row">
            <HeartPulse size={16} />
            <strong>{t('my_appointments')}</strong>
          </div>
          <div className="history-line complete"><span></span>{t('past_visits')}</div>
          <div className="history-line active"><span></span>{t('medical_history')}</div>
          <div className="history-line"><span></span>{t('download_invoice')}</div>
        </div>
      </div>
    );
  }

  if (type === 'clinic') {
    return (
      <div className="showcase-ui showcase-ui--clinic">
        <div className="clinic-board">
          <div className="board-header">
            <strong>{t('clinic_admin_panel')}</strong>
            <span>{t('today')}</span>
          </div>
          <div className="clinic-kpis">
            <div><small>{t('today_appointments')}</small><strong>18</strong></div>
            <div><small>{t('patients_menu')}</small><strong>126</strong></div>
            <div><small>{t('revenue')}</small><strong>$4.8k</strong></div>
          </div>
          <div className="workflow-list">
            <div><span className="dot approved"></span><strong>09:30</strong><em>{t('approved')}</em></div>
            <div><span className="dot pending"></span><strong>10:15</strong><em>{t('pending')}</em></div>
            <div><span className="dot neutral"></span><strong>11:00</strong><em>{t('send_reminder')}</em></div>
          </div>
        </div>
        <div className="staff-card">
          <Users size={17} />
          <strong>{t('total_employees')}</strong>
          <div><span></span><span></span><span></span></div>
        </div>
      </div>
    );
  }

  if (type === 'doctor') {
    return (
      <div className="showcase-ui showcase-ui--doctor">
        <div className="doctor-workspace">
          <div className="patient-strip">
            <span className="avatar">م</span>
            <div>
              <strong>Maryam Ali</strong>
              <small>{t('dermatology')} · {t('last_visit')}</small>
            </div>
          </div>
          <div className="clinical-grid">
            <div className="timeline-card">
              <small>{t('patient_timeline')}</small>
              <span></span><span></span><span></span>
            </div>
            <div className="diagnosis-card">
              <small>{t('diagnosis')}</small>
              <strong>{t('clinical_notes')}</strong>
              <p>{t('showcase_doctor_note')}</p>
            </div>
          </div>
          <div className="prescription-row">
            <NotebookPen size={16} />
            <span>{t('new_prescription')}</span>
            <strong>{t('save')}</strong>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'analytics') {
    return (
      <div className="showcase-ui showcase-ui--analytics">
        <div className="analytics-hero-card">
          <small>{t('monthly_revenue')}</small>
          <strong>$28,420</strong>
          <span>{t('from_paid_appointments')}</span>
        </div>
        <div className="analytics-bars">
          {[42, 68, 55, 82, 62, 76, 58].map(height => <span key={height} style={{ height: `${height}%` }}></span>)}
        </div>
        <div className="activity-overview">
          <div><Activity size={14} /><span>{t('recent_activity')}</span></div>
          <div><BarChart3 size={14} /><span>{t('performance_charts')}</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="showcase-ui showcase-ui--platform">
      <div className="platform-cloud">
        <Cloud size={26} />
        <strong>{t('cloud_sync')}</strong>
      </div>
      <div className="security-grid">
        <div><KeyRound size={16} /><span>{t('role_permissions')}</span></div>
        <div><Database size={16} /><span>{t('secure_backups')}</span></div>
        <div><TabletSmartphone size={16} /><span>{t('multi_device_support')}</span></div>
        <div><Activity size={16} /><span>{t('fast_performance')}</span></div>
      </div>
      <div className="sync-line"><span></span></div>
    </div>
  );
};

const ProductShowcase = ({ t }) => {
  const scenes = [
    {
      id: 'patient',
      icon: <UserRoundCheck size={16} />,
      title: t('showcase_patient_title'),
      eyebrow: t('showcase_patient_eyebrow'),
      features: [t('showcase_patient_booking'), t('prescription'), t('reminder'), t('medical_history')],
    },
    {
      id: 'clinic',
      icon: <Users size={16} />,
      title: t('showcase_clinic_title'),
      eyebrow: t('showcase_clinic_eyebrow'),
      features: [t('reception_workflow'), t('patients_management'), t('staff_management'), t('financial_reports')],
    },
    {
      id: 'doctor',
      icon: <Stethoscope size={16} />,
      title: t('showcase_doctor_title'),
      eyebrow: t('showcase_doctor_eyebrow'),
      features: [t('patient_timeline'), t('medical_records'), t('diagnosis'), t('clinical_notes')],
    },
    {
      id: 'analytics',
      icon: <BarChart3 size={16} />,
      title: t('showcase_analytics_title'),
      eyebrow: t('showcase_analytics_eyebrow'),
      features: [t('revenue'), t('appointments_per_week'), t('performance_charts'), t('activity_overview')],
    },
    {
      id: 'platform',
      icon: <Shield size={16} />,
      title: t('showcase_platform_title'),
      eyebrow: t('showcase_platform_eyebrow'),
      features: [t('cloud_sync'), t('role_permissions'), t('secure_backups'), t('multi_device_support')],
    },
  ];
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (paused || reduceMotion) return undefined;
    const timer = window.setInterval(() => {
      setActive(index => (index + 1) % scenes.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [paused, scenes.length]);

  const scene = scenes[active];

  return (
    <div
      className="product-showcase"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="showcase-shell" key={scene.id}>
        <div className="showcase-chrome">
          <div className="preview-window-controls">
            <span></span><span></span><span></span>
          </div>
          <div className="preview-brand">
            <HeartPulse size={15} />
            <strong>UrClinic</strong>
          </div>
          <span className="showcase-live">{t('live_product')}</span>
        </div>
        <div className="showcase-content">
          <div className="showcase-copy">
            <span className="showcase-eyebrow">{scene.icon}{scene.eyebrow}</span>
            <h2>{scene.title}</h2>
            <div className="showcase-feature-list">
              {scene.features.map(feature => (
                <span key={feature}><CheckCircle2 size={14} />{feature}</span>
              ))}
            </div>
          </div>
          <ShowcaseScreen type={scene.id} t={t} />
        </div>
      </div>
      <div className="showcase-controls" aria-label={t('showcase_navigation')}>
        {scenes.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={index === active ? 'active' : ''}
            onClick={() => setActive(index)}
            aria-label={item.title}
            aria-pressed={index === active}
          >
            <span></span>
          </button>
        ))}
      </div>
    </div>
  );
};

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

        <ProductShowcase t={t} />
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
