import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  Clock3,
  Filter,
  MapPin,
  Search,
  ShieldAlert,
  UserRoundCog,
  Users,
} from 'lucide-react';
import { IRAQI_GOVERNORATES, callSuperAdmin } from '../services/superAdminService';
import { getLocalizedErrorMessage } from '../utils/errorMessages';

const ACTIVE_STATUSES = ['pending', 'approved', 'confirmed', 'in_progress'];

const dateOnly = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const SuperAdminPatients = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [patients, setPatients] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [clinicId, setClinicId] = useState('all');
  const [governorate, setGovernorate] = useState('all');
  const [activeOnly, setActiveOnly] = useState('all');
  const [registrationDate, setRegistrationDate] = useState('');
  const [recentOnly, setRecentOnly] = useState(false);
  const [clock] = useState(() => {
    const now = new Date();
    return { today: now.toISOString().slice(0, 10), recentCutoff: now.getTime() - (7 * 24 * 60 * 60 * 1000) };
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await callSuperAdmin('list_patient_accounts');
        if (!active) return;
        setProfiles(data.profiles || []);
        setPatients(data.patients || []);
        setClinics(data.clinics || []);
        setAppointments(data.appointments || []);
      } catch (err) {
        if (active) {
          console.error('Super admin patients load failed:', err);
          setError(getLocalizedErrorMessage(err, { isAr, fallback: 'load' }));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [isAr]);

  const rows = useMemo(() => {
    const clinicById = new Map(clinics.map(c => [String(c.id), c]));
    const patientRowsByProfile = new Map();
    patients.forEach(row => {
      if (!row.auth_user_id) return;
      const key = String(row.auth_user_id);
      patientRowsByProfile.set(key, [...(patientRowsByProfile.get(key) || []), row]);
    });
    const appointmentsByPatient = new Map();
    appointments.forEach(apt => {
      const key = String(apt.patient_id);
      appointmentsByPatient.set(key, [...(appointmentsByPatient.get(key) || []), apt]);
    });

    return profiles.map(profile => {
      const patientRows = patientRowsByProfile.get(String(profile.id)) || [];
      const patientAppointments = patientRows.flatMap(row => appointmentsByPatient.get(String(row.id)) || []);
      const activeAppointments = patientAppointments.filter(apt => ACTIVE_STATUSES.includes(String(apt.status)));
      const firstPatientRow = patientRows[0];
      const firstClinic = firstPatientRow ? clinicById.get(String(firstPatientRow.clinic_id)) : null;
      const governorateValue = profile.governorate || firstClinic?.governorate || '';
      const searchText = [
        profile.full_name,
        profile.phone_number,
        profile.email ?? profile.profile?.email,
        profile.id,
        ...patientRows.map(row => row.id),
        ...patientAppointments.map(apt => apt.booking_code),
      ].filter(Boolean).join(' ').toLowerCase();
      return {
        profile,
        patientRows,
        appointments: patientAppointments,
        activeAppointments,
        clinic: firstClinic,
        clinicIds: new Set(patientRows.map(row => String(row.clinic_id))),
        governorate: governorateValue,
        searchText,
        createdDate: dateOnly(profile.created_at),
        createdToday: dateOnly(profile.created_at) === clock.today,
        recentlyCreated: new Date(profile.created_at).getTime() >= clock.recentCutoff,
      };
    }).filter(row => {
      const matchesQuery = !debouncedQuery || row.searchText.includes(debouncedQuery);
      const matchesStatus = status === 'all' || row.profile.status === status;
      const matchesClinic = clinicId === 'all' || row.clinicIds.has(String(clinicId));
      const matchesGovernorate = governorate === 'all' || row.governorate === governorate;
      const matchesActive = activeOnly === 'all'
        || (activeOnly === 'yes' && row.activeAppointments.length > 0)
        || (activeOnly === 'no' && row.activeAppointments.length === 0);
      const matchesDate = !registrationDate || row.createdDate === registrationDate;
      const matchesRecent = !recentOnly || row.recentlyCreated;
      return matchesQuery && matchesStatus && matchesClinic && matchesGovernorate && matchesActive && matchesDate && matchesRecent;
    });
  }, [appointments, clinics, clock, debouncedQuery, activeOnly, governorate, patients, profiles, clinicId, recentOnly, registrationDate, status]);

  const stats = useMemo(() => ({
    total: profiles.length,
    active: profiles.filter(p => p.status !== 'suspended').length,
    suspended: profiles.filter(p => p.status === 'suspended').length,
    withActiveAppointments: profiles.filter(profile => {
      const patientIds = patients
        .filter(row => String(row.auth_user_id) === String(profile.id))
        .map(row => String(row.id));
      return appointments.some(apt => patientIds.includes(String(apt.patient_id)) && ACTIVE_STATUSES.includes(String(apt.status)));
    }).length,
    createdToday: profiles.filter(p => dateOnly(p.created_at) === clock.today).length,
  }), [appointments, clock.today, patients, profiles]);

  return (
    <div className="super-admin-page animate-in">
      <section className="super-admin-hero">
        <div>
          <span><UserRoundCog size={16} /> {isAr ? 'إدارة حسابات المرضى' : 'Patient Accounts'}</span>
          <h1>{isAr ? 'حسابات المرضى والدعم' : 'Patient Accounts & Support'}</h1>
          <p>{isAr ? 'إدارة آمنة لحسابات المرضى ومواعيدهم عبر كل العيادات.' : 'Securely manage patient accounts and appointment support across all clinics.'}</p>
        </div>
      </section>

      <section className="super-admin-stats">
        <Stat icon={<Users />} label={isAr ? 'كل الحسابات' : 'Total accounts'} value={stats.total} />
        <Stat icon={<UserRoundCog />} label={isAr ? 'نشطة' : 'Active'} value={stats.active} />
        <Stat icon={<ShieldAlert />} label={isAr ? 'معلقة' : 'Suspended'} value={stats.suspended} />
        <Stat icon={<CalendarCheck />} label={isAr ? 'لديها موعد نشط' : 'Active appointments'} value={stats.withActiveAppointments} />
        <Stat icon={<Clock3 />} label={isAr ? 'أُنشئت اليوم' : 'Created today'} value={stats.createdToday} />
      </section>

      <section className="super-admin-toolbar super-admin-toolbar--patient">
        <label className="super-admin-search">
          <Search size={18} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={isAr ? 'ابحث بالاسم أو الهاتف أو البريد أو رقم المريض أو رمز الحجز' : 'Search name, phone, email, patient ID, or booking code'} />
        </label>
        <select className="input" value={status} onChange={event => setStatus(event.target.value)} aria-label={isAr ? 'حالة الحساب' : 'Account status'}>
          <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="active">{isAr ? 'نشط' : 'Active'}</option>
          <option value="suspended">{isAr ? 'معلق' : 'Suspended'}</option>
        </select>
        <select className="input" value={clinicId} onChange={event => setClinicId(event.target.value)} aria-label={isAr ? 'العيادة' : 'Clinic'}>
          <option value="all">{isAr ? 'كل العيادات' : 'All clinics'}</option>
          {clinics.map(clinic => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
        </select>
        <select className="input" value={governorate} onChange={event => setGovernorate(event.target.value)} aria-label={isAr ? 'المحافظة' : 'Governorate'}>
          <option value="all">{isAr ? 'كل المحافظات' : 'All governorates'}</option>
          {IRAQI_GOVERNORATES.map(g => <option key={g.id} value={g.id}>{isAr ? g.ar : g.en}</option>)}
        </select>
        <select className="input" value={activeOnly} onChange={event => setActiveOnly(event.target.value)} aria-label={isAr ? 'المواعيد النشطة' : 'Active appointment'}>
          <option value="all">{isAr ? 'كل المواعيد' : 'Any appointment state'}</option>
          <option value="yes">{isAr ? 'لديه موعد نشط' : 'Has active appointment'}</option>
          <option value="no">{isAr ? 'بدون موعد نشط' : 'No active appointment'}</option>
        </select>
        <input className="input" type="date" value={registrationDate} onChange={event => setRegistrationDate(event.target.value)} aria-label={isAr ? 'تاريخ التسجيل' : 'Registration date'} />
        <label className="super-admin-check super-admin-check--inline">
          <input type="checkbox" checked={recentOnly} onChange={event => setRecentOnly(event.target.checked)} />
          <span>{isAr ? 'الأحدث فقط' : 'Recently created'}</span>
        </label>
      </section>

      <section className="super-admin-card super-admin-card--flush">
        <div className="super-admin-card-head">
          <span><Filter /></span>
          <h2>{isAr ? `${rows.length} حساب مريض` : `${rows.length} patient accounts`}</h2>
        </div>
        {error && <div className="super-admin-alert super-admin-alert--error">{error}</div>}
        {loading ? (
          <div className="super-admin-loading"><span /><span /><span /></div>
        ) : rows.length === 0 ? (
          <div className="super-admin-empty"><Users size={34} /><p>{isAr ? 'لا توجد حسابات مطابقة.' : 'No matching patient accounts.'}</p></div>
        ) : (
          <>
            <div className="super-admin-table-wrap">
              <table className="super-admin-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'المريض' : 'Patient'}</th>
                    <th>{isAr ? 'الهاتف' : 'Phone'}</th>
                    <th>{isAr ? 'العيادة' : 'Clinic'}</th>
                    <th>{isAr ? 'الحالة' : 'Status'}</th>
                    <th>{isAr ? 'موعد نشط' : 'Active appointment'}</th>
                    <th>{isAr ? 'تاريخ التسجيل' : 'Registered'}</th>
                    <th>{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => <PatientRow key={row.profile.id} row={row} isAr={isAr} navigate={navigate} />)}
                </tbody>
              </table>
            </div>
            <div className="super-admin-mobile-list">
              {rows.map(row => <PatientCard key={row.profile.id} row={row} isAr={isAr} navigate={navigate} />)}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

const formatDateTime = (value, isAr) => value
  ? new Intl.DateTimeFormat(isAr ? 'ar-IQ' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-';

const Stat = ({ icon, label, value }) => <div className="super-admin-stat"><span>{icon}</span><p>{label}</p><strong>{value}</strong></div>;

const AccountStatus = ({ status, isAr }) => {
  const suspended = status === 'suspended';
  return <span className={`super-admin-status ${suspended ? 'suspended' : 'active'}`}>{suspended ? (isAr ? 'معلق' : 'Suspended') : (isAr ? 'نشط' : 'Active')}</span>;
};

const ActiveAppointment = ({ count, isAr }) => (
  <span className={`super-admin-status ${count > 0 ? 'active' : 'neutral'}`}>
    {count > 0 ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')}
  </span>
);

const PatientRow = ({ row, isAr, navigate }) => (
  <tr>
    <td><strong>{row.profile.full_name || '-'}</strong><small>{row.profile.email ?? row.profile.profile?.email ?? '-'}</small></td>
    <td dir="ltr">{row.profile.phone_number || '-'}</td>
    <td><MapPin size={14} /> {row.clinic?.name || (isAr ? 'غير مرتبطة' : 'Not linked')}</td>
    <td><AccountStatus status={row.profile.status} isAr={isAr} /></td>
    <td><ActiveAppointment count={row.activeAppointments.length} isAr={isAr} /></td>
    <td>{formatDateTime(row.profile.created_at, isAr)}</td>
    <td><button className="btn btn-sm btn-primary" onClick={() => navigate(`/dashboard/super-admin/patients/${row.profile.id}`)}>{isAr ? 'التفاصيل' : 'Details'}</button></td>
  </tr>
);

const PatientCard = ({ row, isAr, navigate }) => (
  <article className="super-admin-mobile-card">
    <div>
      <strong>{row.profile.full_name || '-'}</strong>
      <AccountStatus status={row.profile.status} isAr={isAr} />
    </div>
    <p>{row.profile.email ?? row.profile.profile?.email ?? '-'} · <span dir="ltr">{row.profile.phone_number || row.profile.phone || '-'}</span></p>
    <p><MapPin size={14} /> {row.clinic?.name || (isAr ? 'غير مرتبطة' : 'Not linked')}</p>
    <p>{isAr ? 'موعد نشط' : 'Active appointment'}: {row.activeAppointments.length > 0 ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')}</p>
    <p>{isAr ? 'تاريخ التسجيل' : 'Registered'}: {formatDateTime(row.profile.created_at, isAr)}</p>
    <button className="btn btn-primary" onClick={() => navigate(`/dashboard/super-admin/patients/${row.profile.id}`)}>{isAr ? 'فتح التفاصيل' : 'Open details'}</button>
  </article>
);

export default SuperAdminPatients;
