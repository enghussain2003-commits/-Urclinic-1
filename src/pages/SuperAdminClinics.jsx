import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  Filter,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { IRAQI_GOVERNORATES } from '../services/superAdminService';

const SuperAdminClinics = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const [clinics, setClinics] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [governorate, setGovernorate] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('created_desc');

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = isAr ? 'ar' : 'en';
  }, [isAr]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [clinicRes, profileRes, doctorRes, patientRes, appointmentRes] = await Promise.all([
          supabase.from('clinics').select('*').order('created_at', { ascending: false }),
          supabase.from('profiles').select('id, clinic_id, full_name, email, phone_number, role, status, created_at'),
          supabase.from('doctors').select('*'),
          supabase.from('patients').select('id, clinic_id'),
          supabase.from('appointments').select('id, clinic_id, status'),
        ]);
        const firstError = [clinicRes, profileRes, doctorRes, patientRes, appointmentRes].find(res => res.error)?.error;
        if (firstError) throw firstError;
        if (!active) return;
        setClinics(clinicRes.data || []);
        setProfiles(profileRes.data || []);
        setDoctors(doctorRes.data || []);
        setPatients(patientRes.data || []);
        setAppointments(appointmentRes.data || []);
      } catch (err) {
        if (active) setError(err.message || (isAr ? 'تعذر تحميل العيادات' : 'Could not load clinics'));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [isAr]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = clinics.map(clinic => {
      const clinicProfiles = profiles.filter(p => String(p.clinic_id) === String(clinic.id));
      const clinicDoctors = doctors.filter(d => String(d.clinic_id) === String(clinic.id));
      const clinicAdmin = clinicProfiles.find(p => p.role === 'clinic_admin');
      const mainDoctor = clinicDoctors[0];
      const clinicPatients = patients.filter(p => String(p.clinic_id) === String(clinic.id));
      const clinicAppointments = appointments.filter(a => String(a.clinic_id) === String(clinic.id));
      return {
        clinic,
        clinicAdmin,
        mainDoctor,
        doctorsCount: clinicDoctors.length,
        employeesCount: clinicProfiles.filter(p => p.role === 'employee').length,
        patientsCount: clinicPatients.length,
        appointmentsCount: clinicAppointments.length,
        search: [
          clinic.name,
          clinic.governorate,
          clinic.address,
          clinic.phone,
          clinicAdmin?.full_name,
          clinicAdmin?.email,
          mainDoctor?.full_name,
          mainDoctor?.email,
        ].filter(Boolean).join(' ').toLowerCase(),
      };
    }).filter(row => {
      const matchesQuery = !q || row.search.includes(q);
      const matchesGovernorate = governorate === 'all' || row.clinic.governorate === governorate;
      const rowStatus = row.clinic.is_active === false ? 'suspended' : 'active';
      const matchesStatus = status === 'all' || rowStatus === status;
      return matchesQuery && matchesGovernorate && matchesStatus;
    });

    result.sort((a, b) => {
      if (sort === 'name_asc') return (a.clinic.name || '').localeCompare(b.clinic.name || '');
      if (sort === 'name_desc') return (b.clinic.name || '').localeCompare(a.clinic.name || '');
      if (sort === 'doctors_desc') return b.doctorsCount - a.doctorsCount;
      return (b.clinic.created_at || '').localeCompare(a.clinic.created_at || '');
    });
    return result;
  }, [appointments, clinics, doctors, governorate, patients, profiles, query, sort, status]);

  return (
    <div className="super-admin-page animate-in">
      <section className="super-admin-hero">
        <div>
          <span><ShieldCheck size={16} /> {isAr ? 'إدارة العيادات' : 'Clinic Management'}</span>
          <h1>{isAr ? 'كل العيادات' : 'Clinics'}</h1>
          <p>{isAr ? 'اعرض العيادات وحساباتها وحالتها التشغيلية من مكان واحد.' : 'View every clinic, its accounts, and operational status in one place.'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard/super-admin/clinics/new')}>
          <Plus size={18} /> {isAr ? 'إضافة عيادة' : 'Add New Clinic'}
        </button>
      </section>

      <section className="super-admin-stats">
        <Stat icon={<Building2 />} label={isAr ? 'العيادات' : 'Clinics'} value={clinics.length} />
        <Stat icon={<Stethoscope />} label={isAr ? 'الأطباء' : 'Doctors'} value={doctors.length} />
        <Stat icon={<Users />} label={isAr ? 'الموظفون' : 'Employees'} value={profiles.filter(p => p.role === 'employee').length} />
        <Stat icon={<CalendarDays />} label={isAr ? 'المواعيد' : 'Appointments'} value={appointments.length} />
      </section>

      <section className="super-admin-toolbar">
        <label className="super-admin-search">
          <Search size={18} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={isAr ? 'ابحث باسم العيادة أو الطبيب أو المدير أو الهاتف' : 'Search clinic, doctor, admin, email, phone, or address'} />
        </label>
        <select className="input" value={governorate} onChange={event => setGovernorate(event.target.value)} aria-label={isAr ? 'تصفية المحافظة' : 'Governorate filter'}>
          <option value="all">{isAr ? 'كل المحافظات' : 'All governorates'}</option>
          {IRAQI_GOVERNORATES.map(g => <option key={g.id} value={g.id}>{isAr ? g.ar : g.en}</option>)}
        </select>
        <select className="input" value={status} onChange={event => setStatus(event.target.value)} aria-label={isAr ? 'تصفية الحالة' : 'Status filter'}>
          <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="active">{isAr ? 'نشطة' : 'Active'}</option>
          <option value="suspended">{isAr ? 'معلقة' : 'Suspended'}</option>
        </select>
        <select className="input" value={sort} onChange={event => setSort(event.target.value)} aria-label={isAr ? 'الترتيب' : 'Sort'}>
          <option value="created_desc">{isAr ? 'الأحدث' : 'Newest'}</option>
          <option value="name_asc">{isAr ? 'الاسم تصاعدياً' : 'Name A-Z'}</option>
          <option value="name_desc">{isAr ? 'الاسم تنازلياً' : 'Name Z-A'}</option>
          <option value="doctors_desc">{isAr ? 'الأكثر أطباء' : 'Most doctors'}</option>
        </select>
      </section>

      <section className="super-admin-card super-admin-card--flush">
        <div className="super-admin-card-head">
          <span><Filter /></span>
          <h2>{isAr ? `${rows.length} عيادة` : `${rows.length} clinics`}</h2>
        </div>
        {error && <div className="super-admin-alert super-admin-alert--error">{error}</div>}
        {loading ? (
          <div className="super-admin-loading"><span /><span /><span /></div>
        ) : rows.length === 0 ? (
          <div className="super-admin-empty"><Building2 size={34} /><p>{isAr ? 'لا توجد عيادات مطابقة.' : 'No matching clinics.'}</p></div>
        ) : (
          <>
            <div className="super-admin-table-wrap">
              <table className="super-admin-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'العيادة' : 'Clinic'}</th>
                    <th>{isAr ? 'المحافظة' : 'Governorate'}</th>
                    <th>{isAr ? 'مدير العيادة' : 'Clinic Admin'}</th>
                    <th>{isAr ? 'الطبيب الرئيسي' : 'Main Doctor'}</th>
                    <th>{isAr ? 'الحسابات' : 'Accounts'}</th>
                    <th>{isAr ? 'الحالة' : 'Status'}</th>
                    <th>{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => <ClinicRow key={row.clinic.id} row={row} isAr={isAr} navigate={navigate} />)}
                </tbody>
              </table>
            </div>
            <div className="super-admin-mobile-list">
              {rows.map(row => <ClinicCard key={row.clinic.id} row={row} isAr={isAr} navigate={navigate} />)}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

const Stat = ({ icon, label, value }) => (
  <div className="super-admin-stat"><span>{icon}</span><p>{label}</p><strong>{value}</strong></div>
);

const Status = ({ active, isAr }) => (
  <span className={`super-admin-status ${active ? 'active' : 'suspended'}`}>
    {active ? (isAr ? 'نشطة' : 'Active') : (isAr ? 'معلقة' : 'Suspended')}
  </span>
);

const ClinicRow = ({ row, isAr, navigate }) => (
  <tr>
    <td><strong>{row.clinic.name}</strong><small>{row.clinic.phone || '-'}</small></td>
    <td><MapPin size={14} /> {row.clinic.governorate || '-'}</td>
    <td><strong>{row.clinicAdmin?.full_name || '-'}</strong><small>{row.clinicAdmin?.email || ''}</small></td>
    <td><strong>{row.mainDoctor?.full_name || '-'}</strong><small>{row.mainDoctor?.specialty || ''}</small></td>
    <td>{row.doctorsCount} {isAr ? 'أطباء' : 'doctors'} · {row.employeesCount} {isAr ? 'موظف' : 'employees'} · {row.patientsCount} {isAr ? 'مرضى' : 'patients'}</td>
    <td><Status active={row.clinic.is_active !== false} isAr={isAr} /></td>
    <td><button className="btn btn-sm btn-primary" onClick={() => navigate(`/dashboard/super-admin/clinics/${row.clinic.id}`)}>{isAr ? 'التفاصيل' : 'Details'}</button></td>
  </tr>
);

const ClinicCard = ({ row, isAr, navigate }) => (
  <article className="super-admin-mobile-card">
    <div>
      <strong>{row.clinic.name}</strong>
      <Status active={row.clinic.is_active !== false} isAr={isAr} />
    </div>
    <p><MapPin size={14} /> {row.clinic.governorate || '-'} · {row.clinic.address || '-'}</p>
    <p>{isAr ? 'مدير العيادة' : 'Clinic Admin'}: {row.clinicAdmin?.full_name || '-'}</p>
    <p>{isAr ? 'الطبيب الرئيسي' : 'Main Doctor'}: {row.mainDoctor?.full_name || '-'}</p>
    <p>{row.doctorsCount} {isAr ? 'أطباء' : 'doctors'} · {row.employeesCount} {isAr ? 'موظف' : 'employees'} · {row.patientsCount} {isAr ? 'مرضى' : 'patients'}</p>
    <button className="btn btn-primary" onClick={() => navigate(`/dashboard/super-admin/clinics/${row.clinic.id}`)}>{isAr ? 'فتح التفاصيل' : 'Open details'}</button>
  </article>
);

export default SuperAdminClinics;
