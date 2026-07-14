import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronRight,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  User,
  X,
} from 'lucide-react';
import { specialties } from '../data/specialties';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import DoctorCard from '../components/DoctorCard';
import CalendarPicker from '../components/CalendarPicker';
import TimeSlotGrid, { to12Hour } from '../components/TimeSlotGrid';
import SpecialtyIcon from '../components/SpecialtyIcon';
import { normalizeIraqiPhone, validateIraqiPhone, validatePersonName } from '../utils/identityValidation';
import { getLocalizedErrorMessage } from '../utils/errorMessages';
import { IRAQI_GOVERNORATES, governorateLabel, normalizeGovernorate } from '../services/superAdminService';
import {
  evaluateAvailability,
  generateAvailabilitySlots,
  loadAvailabilityForClinics,
  localDateKey,
  periodsForDate,
} from '../services/availabilityService';

const BookingErrorMessage = ({ children }) => children ? (
  <div className="booking-error-message">
    <AlertCircle size={17} />
    <span>{children}</span>
  </div>
) : null;

const ALL_GOVERNORATES = 'all';

const normalizeSearchText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');

const Booking = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAr = i18n.language === 'ar';
  const { createAppointment, appointments, user } = useApp();

  const [step, setStep] = useState(1);

  // Step 1: Governorate-based doctor discovery
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [discoveryDoctors, setDiscoveryDoctors] = useState([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [debouncedDoctorSearch, setDebouncedDoctorSearch] = useState('');

  // Step 2: Doctors for selected clinic
  const [clinicDoctors, setClinicDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  
  const [patientData, setPatientData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || ''
  });

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [bookingCode, setBookingCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookedSlotsByDate, setBookedSlotsByDate] = useState({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityPeriods, setAvailabilityPeriods] = useState([]);
  const [availabilityClosures, setAvailabilityClosures] = useState([]);

  const paymentMethods = [
    { id: 'cash', Icon: Banknote, label: 'Cash at Clinic', labelAr: 'كاش في العيادة', desc: 'Pay on arrival', descAr: 'الدفع عند الحضور' },
    { id: 'zaincash', Icon: Smartphone, label: 'ZainCash', labelAr: 'زين كاش', desc: 'Mobile wallet', descAr: 'محفظة إلكترونية' },
    { id: 'card', Icon: CreditCard, label: 'Credit Card', labelAr: 'بطاقة ائتمان', desc: 'Visa / Mastercard', descAr: 'فيزا / ماستركارد' },
  ];

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedDoctorSearch(doctorSearch), 300);
    return () => window.clearTimeout(timer);
  }, [doctorSearch]);

  const toBookingDoctor = (row, availability = { periods: [], closures: [] }) => {
    const clinic = Array.isArray(row.clinic) ? row.clinic[0] : row.clinic;
    const clinicGovernorate = normalizeGovernorate(clinic?.governorate || '');
    const clinicPeriods = availability.periods.filter(period => String(period.clinic_id) === String(row.clinic_id) && !period.doctor_id);
    const doctorPeriods = availability.periods.filter(period => String(period.doctor_id || '') === String(row.id));
    const status = evaluateAvailability({
      clinicPeriods,
      doctorPeriods,
      closures: availability.closures.filter(closure => String(closure.clinic_id) === String(row.clinic_id)),
      doctor: row,
      dateKey: localDateKey(),
      isAr,
    });
    return {
      ...row,
      clinic,
      clinic_id: row.clinic_id,
      clinic_name: clinic?.name || '',
      clinic_address: row.clinic_address || clinic?.address || '',
      governorate: clinicGovernorate,
      governorate_label: governorateLabel(clinicGovernorate, isAr),
      fee: row.fee ?? clinic?.default_consultation_fee ?? 0,
      name: row.full_name || row.name,
      nameAr: row.full_name || row.nameAr,
      avatar: (row.full_name || '?').charAt(0).toUpperCase(),
      availability_status: status,
      availability_periods: doctorPeriods,
      clinic_availability_periods: clinicPeriods,
      availability_closures: availability.closures.filter(closure => String(closure.clinic_id) === String(row.clinic_id)),
      available: status.available !== false,
      nextSlot: status.label || (isAr ? 'متاح' : 'Available'),
    };
  };

  // Fetch active doctors with their active clinic's public booking fields.
  useEffect(() => {
    let cancelled = false;
    const loadDiscoveryDoctors = async () => {
      setLoadingClinics(true);
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          id,
          clinic_id,
          full_name,
          specialty,
          clinic_address,
          fee,
          open_time,
          close_time,
          break_start,
          break_end,
          work_days,
          is_active,
          clinic:clinics!inner (
            id,
            name,
            address,
            governorate,
            default_consultation_fee,
            is_active
          )
        `)
        .eq('is_active', true)
        .eq('clinic.is_active', true)
        .order('full_name', { ascending: true });

        if (cancelled) return;
        if (error) {
          console.warn('doctor discovery fetch error:', error.message);
          setDiscoveryDoctors([]);
          setClinics([]);
        } else {
          const clinicIds = Array.from(new Set((data || []).map(row => row.clinic_id).filter(Boolean)));
          const availability = await loadAvailabilityForClinics(clinicIds);
          if (cancelled) return;
          setAvailabilityPeriods(availability.periods);
          setAvailabilityClosures(availability.closures);
          const doctors = (data || []).map(row => toBookingDoctor(row, availability));
          setDiscoveryDoctors(doctors);
          const clinicMap = new Map();
          doctors.forEach(doc => {
            if (doc.clinic?.id) clinicMap.set(String(doc.clinic.id), doc.clinic);
          });
          setClinics(Array.from(clinicMap.values()));
        }
        setLoadingClinics(false);
    };

    const timer = window.setTimeout(loadDiscoveryDoctors, 0);

    return () => { cancelled = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAr]);

  // When clinic is selected, load its doctors
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedClinic) { setClinicDoctors([]); return; }
    setLoadingDoctors(false);
    setClinicDoctors(discoveryDoctors.filter(doc => String(doc.clinic_id) === String(selectedClinic.id)));
  }, [discoveryDoctors, selectedClinic]);

  const [formError, setFormError] = useState('');
  const identityLocked = user?.role === 'patient';

  useEffect(() => {
    let cancelled = false;
    const loadCanonicalIdentity = async () => {
      if (!user?.id || user.role !== 'patient') return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, phone_number, governorate')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setPatientData(prev => ({
        ...prev,
        name: data?.full_name || user.name || prev.name,
        phone: normalizeIraqiPhone(data?.phone_number || user.phone || prev.phone) || data?.phone_number || user.phone || prev.phone,
        email: data?.email || user.email || prev.email,
      }));
      const patientGovernorate = normalizeGovernorate(data?.governorate || user.governorate || '');
      if (IRAQI_GOVERNORATES.some(g => g.id === patientGovernorate)) setSelectedGovernorate(patientGovernorate);
    };
    loadCanonicalIdentity();
    return () => { cancelled = true; };
  }, [user?.id, user?.role, user?.name, user?.phone, user?.email, user?.governorate]);

  const handleSelectDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setSelectedDate('');
    setSelectedTime('');
    setBookedSlotsByDate({});
  };

  const handleSelectDiscoveryDoctor = (doctor) => {
    setSelectedClinic(doctor.clinic || clinics.find(clinic => String(clinic.id) === String(doctor.clinic_id)) || null);
    setSelectedSpecialty('');
    handleSelectDoctor(doctor);
  };

  const groupOccupiedSlots = (rows) => {
    const grouped = {};
    (rows || []).forEach(row => {
      const date = row.appointment_date;
      const time = String(row.appointment_time || '').slice(0, 5);
      if (!date || !time) return;
      if (!grouped[date]) grouped[date] = new Set();
      grouped[date].add(time);
    });
    return Object.fromEntries(
      Object.entries(grouped).map(([date, set]) => [date, Array.from(set)])
    );
  };

  const fetchOccupiedSlots = async (startDate, endDate = startDate) => {
    if (!selectedDoctor?.id || !startDate) return {};
    setAvailabilityLoading(true);
    const { data, error } = await supabase.rpc('active_appointment_slots', {
      p_doctor_id: selectedDoctor.id,
      p_start: startDate,
      p_end: endDate,
    });
    setAvailabilityLoading(false);
    if (error) {
      console.warn('availability fetch error:', error.message);
      return {};
    }
    const grouped = groupOccupiedSlots(data);
    setBookedSlotsByDate(prev => ({ ...prev, ...grouped, [startDate]: grouped[startDate] || [] }));
    return grouped;
  };

  useEffect(() => {
    if (!selectedDoctor?.id) return;

    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + 90);
    const fmt = (d) => d.toISOString().slice(0, 10);

    const timer = window.setTimeout(() => {
      fetchOccupiedSlots(fmt(start), fmt(end));
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor]);

  useEffect(() => {
    if (!selectedDoctor?.id || !selectedDate) return;
    const timer = window.setTimeout(() => {
      fetchOccupiedSlots(selectedDate);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor?.id, selectedDate]);

  const nameValidation = validatePersonName(patientData.name, { isAr });
  const phoneValidation = validateIraqiPhone(patientData.phone, { isAr });
  const nameIsValid = nameValidation.valid;
  const phoneIsValid = phoneValidation.valid;

  const validateStep3 = () => {
    const checkedName = validatePersonName(patientData.name, { isAr });
    const checkedPhone = validateIraqiPhone(patientData.phone, { isAr });
    if (!checkedName.valid) {
      setFormError(checkedName.error);
      return false;
    }
    if (!checkedPhone.valid) {
      setFormError(checkedPhone.error);
      return false;
    }
    // Professional lifecycle: a patient may have only one active appointment at a time.
    const activeAppointment = appointments.find(a =>
      (normalizeIraqiPhone(a.patient_phone || '') === checkedPhone.value || a.patient_name === checkedName.value) &&
      ['pending', 'approved', 'in_progress', 'confirmed'].includes(a.status)
    );
    if (activeAppointment) {
      setFormError(isAr
        ? 'لديك موعد نشط بالفعل. يرجى الانتظار حتى تكتمل زيارتك الحالية.'
        : 'You already have an active appointment. Please wait until your current visit is completed.');
      return false;
    }
    setFormError('');
    setPatientData(prev => ({ ...prev, name: checkedName.value, phone: checkedPhone.value }));
    return true;
  };

  const validateSelectedSlot = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) return false;
    const latest = await fetchOccupiedSlots(selectedDate);
    const occupied = latest[selectedDate] || bookedSlotsByDate[selectedDate] || [];
    const slots = generateTimeSlots(selectedDoctor, selectedDate, occupied);
    const slot = slots.find(s => s.time === selectedTime);
    if (!slot || slot.status !== 'available') {
      setSelectedTime('');
      setFormError(isAr
        ? 'هذا الموعد غير متاح الآن. يرجى اختيار وقت آخر.'
        : 'This appointment time is no longer available. Please choose another time.');
      return false;
    }
    setFormError('');
    return true;
  };

  const handleNext = async () => {
    if (step === 3 && !(await validateSelectedSlot())) return;
    if (step === 4 && !validateStep3()) return;
    setStep(step + 1);
  };
  const handlePrev = () => { setFormError(''); setStep(step - 1); };

  const confirmBooking = async () => {
    // Defense in depth: only patients may create bookings (route is also protected).
    if (!user || user.role !== 'patient') {
      setFormError(isAr ? 'فقط حسابات المرضى يمكنها الحجز' : 'Only patient accounts can book');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const created = await createAppointment({
        clinic_id: selectedClinic?.id,
        patient_name: nameValidation.value,
        patient_phone: phoneValidation.value,
        patient_email: patientData.email || null,
        doctor_id: selectedDoctor.id,
        date: selectedDate,
        time: selectedTime,
        status: 'pending',
        paid: paymentMethod !== 'cash',
        payment_method: paymentMethod,
        fee: selectedDoctor.fee,
      });

      // Send confirmation email if email is provided
      if (patientData.email) {
        import('../services/emailService').then(({ sendAppointmentConfirmation }) => {
          sendAppointmentConfirmation(
            patientData.email,
            nameValidation.value,
            selectedDate,
            to12Hour(selectedTime, isAr),
            isAr ? selectedDoctor.nameAr : selectedDoctor.name
          ).catch(err => console.error('Failed to send confirmation email', err));
        });
      }

      setBookingCode(created?.booking_code || (isAr ? 'قيد الإنشاء' : 'Pending'));
      setStep(6);
    } catch (err) {
      console.error('Booking failed:', err);
      setFormError(getLocalizedErrorMessage(err, { isAr, fallback: 'booking' }));
    } finally {
      setSubmitting(false);
    }
  };

  const governorateOptions = [
    { id: ALL_GOVERNORATES, label: t('all_iraq') },
    ...IRAQI_GOVERNORATES.map(g => ({ id: g.id, label: isAr ? g.ar : g.en })),
  ];

  const filteredDiscoveryDoctors = useMemo(() => {
    const search = normalizeSearchText(debouncedDoctorSearch);
    return discoveryDoctors.filter(doc => {
      const hasGovernorate = Boolean(doc.governorate);
      const matchesGovernorate =
        selectedGovernorate === ALL_GOVERNORATES
        || (hasGovernorate && doc.governorate === selectedGovernorate);
      if (!matchesGovernorate) return false;

      if (selectedSpecialty && doc.specialty !== selectedSpecialty) return false;
      if (!search) return true;

      const haystack = normalizeSearchText([
        doc.full_name,
        doc.name,
        doc.nameAr,
        doc.clinic_name,
        doc.specialty,
        t(doc.specialty),
        doc.clinic_address,
        doc.governorate_label,
      ].filter(Boolean).join(' '));
      return haystack.includes(search);
    });
  }, [debouncedDoctorSearch, discoveryDoctors, selectedGovernorate, selectedSpecialty, t]);

  const clearDiscoveryFilters = () => {
    setSelectedGovernorate('');
    setDoctorSearch('');
    setDebouncedDoctorSearch('');
    setSelectedSpecialty('');
  };

  // Filter selected clinic's doctors by selected specialty.
  const filteredDoctors = selectedSpecialty
    ? clinicDoctors.filter(d => d.specialty === selectedSpecialty)
    : clinicDoctors;

  // Build slots from the normalized availability tables with legacy doctor hours as fallback.
  const generateTimeSlots = (doc, dateStr, occupiedOverride = null) => {
    const doctorPeriods = availabilityPeriods.filter(period => String(period.doctor_id || '') === String(doc.id));
    const clinicPeriods = availabilityPeriods.filter(period => String(period.clinic_id || '') === String(doc.clinic_id) && !period.doctor_id);
    return generateAvailabilitySlots({
      doctor: doc,
      dateKey: dateStr,
      doctorPeriods,
      clinicPeriods,
      closures: availabilityClosures.filter(closure => String(closure.clinic_id) === String(doc.clinic_id)),
      occupied: occupiedOverride || bookedSlotsByDate[dateStr] || [],
      step: doc.appointment_duration || doc.clinic?.appointment_duration || 30,
    });
  };

  const getDateMeta = (dateStr) => {
    if (!selectedDoctor) return null;
    const doctorPeriods = availabilityPeriods.filter(period => String(period.doctor_id || '') === String(selectedDoctor.id));
    const clinicPeriods = availabilityPeriods.filter(period => String(period.clinic_id || '') === String(selectedDoctor.clinic_id) && !period.doctor_id);
    const closures = availabilityClosures.filter(closure => String(closure.clinic_id) === String(selectedDoctor.clinic_id));
    const status = evaluateAvailability({
      clinicPeriods,
      doctorPeriods,
      closures,
      doctor: selectedDoctor,
      dateKey: dateStr,
      isAr,
    });
    const effectivePeriods = periodsForDate({ periods: doctorPeriods, doctor: selectedDoctor, dateKey: dateStr, doctorOnly: true });
    if (status.available === false || effectivePeriods.length === 0) {
      return { status: 'closed', disabled: true, label: isAr ? 'عطلة' : 'Closed' };
    }
    const slots = generateTimeSlots(selectedDoctor, dateStr);
    const bookable = slots.filter(s => s.status === 'available').length;
    if (bookable === 0) {
      const schedulable = slots.filter(s => s.status !== 'break' && s.status !== 'unavailable');
      const allBooked = schedulable.length > 0 && schedulable.every(s => s.status === 'booked');
      return {
        status: allBooked ? 'full' : 'closed',
        disabled: true,
        label: allBooked ? (isAr ? 'مكتمل الحجز' : 'Full') : (isAr ? 'غير متاح' : 'Unavailable'),
      };
    }
    return {
      status: 'available',
      disabled: false,
      label: isAr ? `متبقي ${bookable}` : `${bookable} left`,
    };
  };

  const availableSlots = selectedDoctor && selectedDate
    ? generateTimeSlots(selectedDoctor, selectedDate)
    : [];

  const selectedDoctorName = selectedDoctor
    ? (isAr ? (selectedDoctor.nameAr || selectedDoctor.name) : (selectedDoctor.name || selectedDoctor.nameAr))
    : '';
  const selectedPayment = paymentMethods.find(p => p.id === paymentMethod);
  const stepLabels = [
    isAr ? 'الطبيب' : 'Doctor',
    isAr ? 'الطبيب' : 'Doctor',
    isAr ? 'الموعد' : 'Date',
    isAr ? 'البيانات' : 'Details',
    isAr ? 'التأكيد' : 'Confirm',
    isAr ? 'تم' : 'Done',
  ];
  const activeStepLabel = stepLabels[Math.min(step - 1, stepLabels.length - 1)];

  return (
    <div className="page-padding booking-page">
      <div className="booking-shell">
        <header className="booking-hero">
          <div>
            <span className="booking-kicker"><ShieldCheck size={15} /> {isAr ? 'حجز طبي آمن' : 'Secure medical booking'}</span>
            <h1>{t('booking_title')}</h1>
            <p>{isAr ? 'اختر العيادة والطبيب والوقت المناسب بخطوات واضحة.' : 'Choose a clinic, doctor, and time in a clear guided flow.'}</p>
          </div>
          <div className="booking-hero-card">
            <span>{isAr ? 'الخطوة الحالية' : 'Current step'}</span>
            <strong>{step}/6</strong>
            <em>{activeStepLabel}</em>
          </div>
        </header>

        <nav className="booking-stepper" aria-label={isAr ? 'خطوات الحجز' : 'Booking progress'}>
          {stepLabels.map((label, index) => {
            const num = index + 1;
            const state = step === num ? 'active' : step > num ? 'completed' : 'pending';
            return (
              <div key={`${label}-${num}`} className={`booking-step booking-step--${state}`}>
                <span>{step > num ? <CheckCircle size={16} /> : num}</span>
                <strong>{label}</strong>
              </div>
            );
          })}
        </nav>

        <div className="booking-layout">
          <main className="booking-workspace">
          
          {/* STEP 1: Governorate doctor discovery */}
          {step === 1 && (
            <section className="booking-panel">
              <div className="booking-panel-head">
                <div>
                  <span>{isAr ? 'الخطوة 1' : 'Step 1'}</span>
                  <h2><Stethoscope size={20} /> {isAr ? 'اكتشف الأطباء' : 'Discover doctors'}</h2>
                </div>
                <p>{isAr ? 'اختر المحافظة أو اعرض جميع العراق ثم ابحث عن الطبيب أو العيادة.' : 'Choose a governorate or view all Iraq, then search for a doctor or clinic.'}</p>
              </div>
              {loadingClinics ? (
                <div className="booking-loading"><span></span><span></span><span></span></div>
              ) : (
                <>
                <div className="booking-discovery-toolbar">
                  <div className="form-group">
                    <label className="form-label" htmlFor="booking-governorate">{t('governorate')}</label>
                    <select
                      id="booking-governorate"
                      className="input"
                      value={selectedGovernorate}
                      onChange={event => {
                        setSelectedGovernorate(event.target.value);
                        setSelectedClinic(null);
                        setSelectedDoctor(null);
                        setSelectedDate('');
                        setSelectedTime('');
                      }}
                    >
                      <option value="">{isAr ? 'اختر المحافظة' : 'Choose governorate'}</option>
                      {governorateOptions.map(option => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group booking-search-group">
                    <label className="form-label" htmlFor="booking-doctor-search">{t('search_doctor_clinic')}</label>
                    <div className="booking-search-input">
                      <Search size={18} />
                      <input
                        id="booking-doctor-search"
                        className="input"
                        value={doctorSearch}
                        onChange={event => setDoctorSearch(event.target.value)}
                        placeholder={t('search_doctor_clinic')}
                      />
                    </div>
                  </div>
                  <button type="button" className="btn btn-outline booking-clear-filters" onClick={clearDiscoveryFilters}>
                    <X size={16} /> {t('clear_filters')}
                  </button>
                </div>

                <div className="specialty-row booking-specialties">
                  <button className={`chip ${selectedSpecialty === '' ? 'chip-active' : ''}`} onClick={() => setSelectedSpecialty('')}>
                    {isAr ? 'الكل' : 'All'}
                  </button>
                  {specialties.map(spec => (
                    <button
                      key={spec.id}
                      className={`chip ${selectedSpecialty === spec.id ? 'chip-active' : ''}`}
                      onClick={() => setSelectedSpecialty(spec.id)}
                    >
                      <SpecialtyIcon id={spec.id} size={15} />
                      {t(spec.id)}
                    </button>
                  ))}
                </div>

                {!selectedGovernorate ? (
                  <div className="booking-empty-state">
                    <MapPin size={30} />
                    <p>{isAr ? 'اختر محافظة لعرض الأطباء، أو اختر جميع العراق.' : 'Choose a governorate to view doctors, or select All Iraq.'}</p>
                  </div>
                ) : filteredDiscoveryDoctors.length === 0 ? (
                  <div className="booking-empty-state">
                    <Stethoscope size={30} />
                    <p>{t('no_results')}</p>
                    <span>{isAr ? 'لا يوجد أطباء مطابقون في هذه المحافظة. جرّب تغيير المحافظة أو اختر عرض جميع العراق.' : 'No matching doctors were found in this governorate. Try another governorate or view all Iraq.'}</span>
                  </div>
                ) : (
                  <div className="doctors-grid booking-discovery-grid">
                    {filteredDiscoveryDoctors.map(doc => (
                      <DoctorCard
                        key={doc.id}
                        doctor={doc}
                        selected={selectedDoctor?.id === doc.id}
                        onSelect={handleSelectDiscoveryDoctor}
                        bookingVariant
                      />
                    ))}
                  </div>
                )}
                </>
              )}
              <div className="booking-actions booking-actions--end">
                <button className="btn btn-primary" disabled={!selectedClinic || !selectedDoctor} onClick={handleNext}>
                  {t('next_step')} <ChevronRight size={18} />
                </button>
              </div>
            </section>
          )}

          {/* STEP 2: Specialty & Doctor */}
          {step === 2 && (
            <section className="booking-panel">
              <div className="booking-panel-head">
                <div>
                  <span>{isAr ? 'الخطوة 2' : 'Step 2'}</span>
                  <h2><Stethoscope size={20} /> {t('choose_doctor')}</h2>
                </div>
                <p>{isAr ? 'صفّ الأطباء حسب التخصص ثم اختر الطبيب المناسب.' : 'Filter by specialty and select the right doctor.'}</p>
              </div>
              <div className="specialty-row booking-specialties">
                <button className={`chip ${selectedSpecialty === '' ? 'chip-active' : ''}`} onClick={() => setSelectedSpecialty('')}>
                  {isAr ? 'الكل' : 'All'}
                </button>
                {specialties.map(spec => (
                  <button
                    key={spec.id}
                    className={`chip ${selectedSpecialty === spec.id ? 'chip-active' : ''}`}
                    onClick={() => setSelectedSpecialty(spec.id)}
                  >
                    <SpecialtyIcon id={spec.id} size={15} />
                    {t(spec.id)}
                  </button>
                ))}
              </div>

              {loadingDoctors ? (
                <div className="booking-loading"><span></span><span></span><span></span></div>
              ) : filteredDoctors.length === 0 ? (
                <div className="booking-empty-state">
                  <Stethoscope size={30} />
                  <p>{isAr ? 'لا يوجد أطباء في هذه العيادة' : 'No doctors in this clinic'}</p>
                </div>
              ) : (
                <div className="doctors-grid">
                  {filteredDoctors.map(doc => (
                    <DoctorCard
                      key={doc.id}
                      doctor={doc}
                      selected={selectedDoctor?.id === doc.id}
                      onSelect={handleSelectDoctor}
                      bookingVariant
                    />
                  ))}
                </div>
              )}

              <div className="booking-actions">
                <button className="btn btn-ghost" onClick={handlePrev}>{t('previous')}</button>
                <button className="btn btn-primary" disabled={!selectedDoctor} onClick={handleNext}>
                  {t('next_step')} <ChevronRight size={18} />
                </button>
              </div>
            </section>
          )}

          {/* STEP 3: Date & Time */}
          {step === 3 && (
            <section className="booking-panel">
              <div className="booking-panel-head">
                <div>
                  <span>{isAr ? 'الخطوة 3' : 'Step 3'}</span>
                  <h2><CalendarIcon size={20} /> {t('select_date_time')}</h2>
                </div>
                <p>{isAr ? 'الأيام غير المتاحة والمواعيد المحجوزة تظهر بوضوح.' : 'Unavailable days and occupied times are clearly marked.'}</p>
              </div>
              <div className="booking-date-time-grid">
                <div>
                  <CalendarPicker selectedDate={selectedDate} onSelectDate={(date) => { setSelectedDate(date); setSelectedTime(''); }} getDateMeta={getDateMeta} />
                </div>
                <div>
                  {selectedDate ? (
                    <>
                      {availabilityLoading && (
                        <p className="booking-refreshing">{isAr ? 'جارٍ تحديث المواعيد المتاحة...' : 'Refreshing availability...'}</p>
                      )}
                      <TimeSlotGrid slots={availableSlots} selectedTime={selectedTime} onSelectTime={(time) => { setFormError(''); setSelectedTime(time); }} />
                    </>
                  ) : (
                    <div className="booking-empty-state booking-empty-state--tall">
                      <CalendarIcon size={34} />
                      <p>{isAr ? 'اختر التاريخ أولاً' : 'Choose a date first'}</p>
                    </div>
                  )}
                </div>
              </div>
              <BookingErrorMessage>{formError}</BookingErrorMessage>
              <div className="booking-actions">
                <button className="btn btn-ghost" onClick={handlePrev}>{t('previous')}</button>
                <button className="btn btn-primary" disabled={!selectedDate || !selectedTime || availabilityLoading} onClick={handleNext}>
                  {t('next_step')} <ChevronRight size={18} />
                </button>
              </div>
            </section>
          )}

          {/* STEP 4: Patient Details */}
          {step === 4 && (
            <section className="booking-panel">
              <div className="booking-panel-head">
                <div>
                  <span>{isAr ? 'الخطوة 4' : 'Step 4'}</span>
                  <h2><User size={20} /> {isAr ? 'بيانات المريض' : 'Patient details'}</h2>
                </div>
                <p>{isAr ? 'سنستخدم هذه البيانات لإرسال الطلب للعيادة.' : 'These details are used to send the request to the clinic.'}</p>
              </div>

              <BookingErrorMessage>{formError}</BookingErrorMessage>

              <div className="booking-form-grid">
                <div className="form-group">
                  <label className="form-label">{t('full_name')} *</label>
                  <input
                    className="input"
                    type="text"
                    placeholder={isAr ? 'أحمد محمد العلي' : 'John Doe'}
                    value={patientData.name}
                    onChange={e => setPatientData({...patientData, name: e.target.value})}
                    readOnly={identityLocked}
                    aria-invalid={Boolean(patientData.name && !nameIsValid)}
                  />
                  {patientData.name && !nameIsValid && (
                    <span className="booking-field-hint booking-field-hint--error">{nameValidation.error}</span>
                  )}
                  {identityLocked && nameIsValid && (
                    <span className="booking-field-hint">{isAr ? 'لا يمكن تغيير بيانات المريض من نموذج الحجز' : 'Patient identity cannot be changed from the booking form.'}</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">{t('phone_number')} *</label>
                  <input
                    className="input"
                    type="tel"
                    inputMode="tel"
                    placeholder="07XXXXXXXXX"
                    value={patientData.phone}
                    onChange={e => setPatientData({...patientData, phone: e.target.value})}
                    readOnly={identityLocked}
                    aria-invalid={Boolean(patientData.phone && !phoneIsValid)}
                  />
                  <span className={`booking-field-hint ${patientData.phone && !phoneIsValid ? 'booking-field-hint--error' : ''}`}>
                    {patientData.phone && phoneIsValid ? phoneValidation.value : (isAr ? 'مثال: 07701234567 أو +9647701234567' : 'Example: 07701234567 or +9647701234567')}
                  </span>
                </div>
                <div className="form-group booking-form-grid__wide">
                  <label className="form-label">{t('email')} <span className="booking-field-optional">({isAr ? 'اختياري' : 'optional'})</span></label>
                  <input className="input" type="email" placeholder="example@email.com" value={patientData.email} onChange={e => setPatientData({...patientData, email: e.target.value})} />
                </div>
              </div>
              <div className="booking-actions">
                <button className="btn btn-ghost" onClick={handlePrev}>{t('previous')}</button>
                <button className="btn btn-primary" disabled={!nameIsValid || !phoneIsValid} onClick={handleNext}>
                  {t('next_step')} <ChevronRight size={18} />
                </button>
              </div>
            </section>
          )}

          {/* STEP 5: Payment */}
          {step === 5 && (
            <section className="booking-panel">
              <div className="booking-panel-head">
                <div>
                  <span>{isAr ? 'الخطوة 5' : 'Step 5'}</span>
                  <h2><CreditCard size={20} /> {isAr ? 'تأكيد الحجز' : 'Confirm booking'}</h2>
                </div>
                <p>{isAr ? 'راجع التفاصيل واختر طريقة الدفع قبل إرسال الطلب.' : 'Review the details and choose a payment method before submitting.'}</p>
              </div>

              {/* Payment Methods */}
              <div className="booking-payment-grid">
                {paymentMethods.map(pm => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`booking-payment-card ${paymentMethod === pm.id ? 'selected' : ''}`}
                  >
                    <pm.Icon size={24} />
                    <strong>{isAr ? pm.labelAr : pm.label}</strong>
                    <span>{isAr ? pm.descAr : pm.desc}</span>
                  </button>
                ))}
              </div>

              {/* Card details — only when card selected */}
              {paymentMethod === 'card' && (
                <div className="payment-card animate-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Credit Card</span>
                    <CreditCard size={24} />
                  </div>
                  <div className="payment-card-number">•••• •••• •••• 4242</div>
                  <div className="payment-card-row">
                    <div>
                      <div style={{ fontSize: '0.6875rem', opacity: 0.7, textTransform: 'uppercase' }}>{t('cardholder')}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{patientData.name.toUpperCase() || 'JOHN DOE'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.6875rem', opacity: 0.7, textTransform: 'uppercase' }}>{t('expiry')}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>12/28</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="booking-confirm-card">
                <h3>{t('booking_summary')}</h3>
                <div><span>{isAr ? 'العيادة' : 'Clinic'}</span><strong>{selectedClinic?.name || '-'}</strong></div>
                <div><span>{t('doctor')}</span><strong>{selectedDoctorName || '-'}</strong></div>
                <div><span>{isAr ? 'التاريخ والوقت' : 'Date and time'}</span><strong>{selectedDate} · {to12Hour(selectedTime, isAr)}</strong></div>
                <div><span>{t('patient')}</span><strong>{patientData.name}</strong></div>
                <div><span>{isAr ? 'طريقة الدفع' : 'Payment'}</span><strong>{isAr ? selectedPayment?.labelAr : selectedPayment?.label}</strong></div>
                <div className="booking-confirm-total"><span>{t('total')}</span><strong>${selectedDoctor?.fee}</strong></div>
              </div>

              <BookingErrorMessage>{formError}</BookingErrorMessage>

              <div className="booking-actions">
                <button className="btn btn-ghost" onClick={handlePrev} disabled={submitting}>{t('previous')}</button>
                <button className="btn btn-primary btn-lg" onClick={confirmBooking} disabled={submitting}>
                  {submitting
                    ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                    : (paymentMethod === 'cash'
                        ? (isAr ? 'تأكيد الحجز' : 'Confirm Booking')
                        : t('pay_now'))}
                </button>
              </div>
            </section>
          )}

          {/* STEP 6: Success */}
          {step === 6 && (
            <section className="booking-panel booking-success-panel">
              <div className="booking-success-icon">
                <Clock size={44} />
              </div>
              <h2>
                {isAr ? 'طلب الحجز قيد المراجعة' : 'Booking Request Received'}
              </h2>
              <p>
                {isAr
                  ? 'تم إرسال طلب حجزك بنجاح. سيقوم فريق العيادة بمراجعته وتأكيده في أقرب وقت.'
                  : 'Your booking request has been sent. The clinic team will review and confirm it shortly.'}
              </p>
              <div className="booking-success-summary">
                <div><span>{isAr ? 'رقم الحجز' : t('booking_id')}</span><strong dir="ltr">{bookingCode}</strong></div>
                <div><span>{t('patient')}</span><strong>{patientData.name}</strong></div>
                <div><span>{isAr ? 'الهاتف' : 'Phone'}</span><strong dir="ltr">{patientData.phone}</strong></div>
                <div><span>{isAr ? 'العيادة' : 'Clinic'}</span><strong>{selectedClinic?.name || '-'}</strong></div>
                <div><span>{t('doctor')}</span><strong>{selectedDoctorName}</strong></div>
                <div><span>{isAr ? 'التاريخ والوقت' : 'Date & Time'}</span><strong>{selectedDate} · {to12Hour(selectedTime, isAr)}</strong></div>
                <div>
                  <span>{isAr ? 'طريقة الدفع' : 'Payment'}</span>
                  <strong>
                    {(() => { const PM = paymentMethods.find(p => p.id === paymentMethod); return PM ? <><PM.Icon size={16} /> {isAr ? PM.labelAr : PM.label}</> : null; })()}
                  </strong>
                </div>
                <div><span>{isAr ? 'المبلغ' : 'Amount'}</span><strong>${selectedDoctor?.fee}</strong></div>
                <div><span>{t('status')}</span><strong><span className="badge badge-warning">{isAr ? 'بانتظار التأكيد' : 'Pending'}</span></strong></div>
              </div>
              <div className="booking-success-actions">
                <button className="btn btn-outline" onClick={() => navigate('/')}>{t('back_to_home')}</button>
                <button className="btn btn-primary" onClick={() => navigate('/profile')}>{t('my_appointments')}</button>
              </div>
            </section>
          )}

          </main>

          {step < 6 && (
            <aside className="booking-summary-rail">
              <div className="booking-rail-card">
                <span>{t('booking_summary')}</span>
                <h2>{activeStepLabel}</h2>
                <div className="booking-rail-list">
                  <div><Building2 size={15} /><span>{selectedClinic?.name || (isAr ? 'اختر العيادة' : 'Choose clinic')}</span></div>
                  <div><Stethoscope size={15} /><span>{selectedDoctorName || (isAr ? 'اختر الطبيب' : 'Choose doctor')}</span></div>
                  <div><CalendarIcon size={15} /><span>{selectedDate || (isAr ? 'اختر التاريخ' : 'Choose date')}</span></div>
                  <div><Clock size={15} /><span>{selectedTime ? to12Hour(selectedTime, isAr) : (isAr ? 'اختر الوقت' : 'Choose time')}</span></div>
                  <div><User size={15} /><span>{patientData.name || (isAr ? 'بيانات المريض' : 'Patient details')}</span></div>
                  {patientData.email && <div><Mail size={15} /><span>{patientData.email}</span></div>}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default Booking;
