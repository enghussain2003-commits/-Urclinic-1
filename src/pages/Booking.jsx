import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, CreditCard, User, Stethoscope, Calendar as CalendarIcon, Clock, ChevronRight, Banknote, Smartphone, Building2 } from 'lucide-react';
import { specialties } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import DoctorCard from '../components/DoctorCard';
import CalendarPicker from '../components/CalendarPicker';
import TimeSlotGrid, { to12Hour } from '../components/TimeSlotGrid';
import SpecialtyIcon from '../components/SpecialtyIcon';

const Booking = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAr = i18n.language === 'ar';
  const { createAppointment, appointments, user } = useApp();

  const [step, setStep] = useState(1);

  // Step 1: Clinic selection
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [loadingClinics, setLoadingClinics] = useState(true);

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

  const paymentMethods = [
    { id: 'cash', Icon: Banknote, label: 'Cash at Clinic', labelAr: 'كاش في العيادة', desc: 'Pay on arrival', descAr: 'الدفع عند الحضور' },
    { id: 'zaincash', Icon: Smartphone, label: 'ZainCash', labelAr: 'زين كاش', desc: 'Mobile wallet', descAr: 'محفظة إلكترونية' },
    { id: 'card', Icon: CreditCard, label: 'Credit Card', labelAr: 'بطاقة ائتمان', desc: 'Visa / Mastercard', descAr: 'فيزا / ماستركارد' },
  ];

  // Fetch active clinics on mount
  useEffect(() => {
    supabase.from('clinics').select('*').eq('is_active', true)
      .then(({ data }) => { setClinics(data || []); setLoadingClinics(false); });
  }, []);

  // When clinic is selected, load its doctors
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedClinic) { setClinicDoctors([]); return; }
    setLoadingDoctors(true);
    supabase.from('doctors').select('*')
      .eq('clinic_id', selectedClinic.id)
      .eq('is_active', true)
      .then(({ data }) => {
        setClinicDoctors((data || []).map(d => ({
          ...d,
          name: d.full_name || d.name,
          nameAr: d.full_name || d.nameAr,
          avatar: (d.full_name || '?').charAt(0).toUpperCase(),
          available: true,
          nextSlot: 'Available',
        })));
        setLoadingDoctors(false);
      });
  }, [selectedClinic]);

  const [formError, setFormError] = useState('');

  const handleSelectDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setSelectedDate('');
    setSelectedTime('');
    setBookedSlotsByDate({});
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

  // Validation helpers
  const cleanPhone = patientData.phone.replace(/\D/g, ''); // digits only
  const nameIsValid = /^[؀-ۿa-zA-Z\s]{3,}$/.test(patientData.name.trim()); // letters only, min 3
  const phoneIsValid = cleanPhone.length === 11;

  const validateStep3 = () => {
    if (!nameIsValid) {
      setFormError(isAr ? 'الرجاء إدخال اسم حقيقي صحيح (أحرف فقط)' : 'Please enter a valid real name (letters only)');
      return false;
    }
    if (!phoneIsValid) {
      setFormError(isAr ? 'رقم الهاتف يجب أن يتكون من 11 رقماً' : 'Phone number must be exactly 11 digits');
      return false;
    }
    // Prevent double-booking: same phone with an active (pending/confirmed) appointment for the same doctor
    const activeWithDoctor = appointments.find(a =>
      a.doctor_id === selectedDoctor?.id &&
      (a.patient_phone === patientData.phone || a.patient_name === patientData.name.trim()) &&
      (a.status === 'pending' || a.status === 'confirmed')
    );
    if (activeWithDoctor) {
      setFormError(isAr
        ? `لديك حجز نشط بالفعل مع هذا الطبيب (${activeWithDoctor.date} - ${activeWithDoctor.time}). لا يمكنك الحجز مرة أخرى حتى ينتهي موعدك الحالي.`
        : `You already have an active booking with this doctor (${activeWithDoctor.date} - ${activeWithDoctor.time}). You cannot book again until it is completed.`);
      return false;
    }
    setFormError('');
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
        patient_name: patientData.name,
        patient_phone: patientData.phone,
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
            patientData.name,
            selectedDate,
            to12Hour(selectedTime, isAr),
            isAr ? selectedDoctor.nameAr : selectedDoctor.name
          ).catch(err => console.error('Failed to send confirmation email', err));
        });
      }

      setBookingCode(created?.booking_code || (isAr ? 'قيد الإنشاء' : 'Pending'));
      setStep(6);
    } catch (err) {
      // Show the real error instead of silently falling back to localStorage.
      const msg = err?.message || (isAr ? 'تعذّر إكمال الحجز' : 'Booking failed');
      const conflictMsg = isAr ? 'عذراً، تم حجز هذا الموعد قبل لحظات.' : 'Sorry, this appointment was just booked.';
      setFormError(msg.includes(conflictMsg)
        ? msg
        : (isAr ? `تعذّر إكمال الحجز: ${msg}` : `Booking failed: ${msg}`));
    } finally {
      setSubmitting(false);
    }
  };

  // Filter clinic's doctors by selected specialty
  const filteredDoctors = selectedSpecialty
    ? clinicDoctors.filter(d => d.specialty === selectedSpecialty)
    : clinicDoctors;

  // JS getDay(): 0=Sun..6=Sat → our day ids
  const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const toHHMM = (mins) => {
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m}`;
  };

  const isToday = (dateStr) => dateStr === new Date().toISOString().slice(0, 10);
  const nowMinutes = () => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  };

  const doctorWorkDays = (doc) => Array.isArray(doc?.work_days) && doc.work_days.length
    ? doc.work_days
    : ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'];

  // #3: Build slots from the doctor's working-hours settings.
  const generateTimeSlots = (doc, dateStr, occupiedOverride = null) => {
    const open = doc.open_time || '09:00';
    const close = doc.close_time || '17:00';
    const breakStart = doc.break_start || null;
    const breakEnd = doc.break_end || null;
    const workDays = doctorWorkDays(doc);

    // Closed on this weekday?
    const dayId = DAY_IDS[new Date(dateStr).getDay()];
    if (!workDays.includes(dayId)) return [];

    const step = 30;
    const slots = [];
    for (let m = toMinutes(open); m + step <= toMinutes(close); m += step) {
      const time = toHHMM(m);
      const inBreak = breakStart && breakEnd && m >= toMinutes(breakStart) && m < toMinutes(breakEnd);
      const booked = (occupiedOverride || bookedSlotsByDate[dateStr] || []).includes(time);
      const past = isToday(dateStr) && m <= nowMinutes();
      const status = inBreak ? 'break' : past ? 'past' : booked ? 'booked' : 'available';
      slots.push({ time, status });
    }

    return slots.length ? slots : [{ time: open, status: 'unavailable' }];
  };

  const getDateMeta = (dateStr) => {
    if (!selectedDoctor) return null;
    const dayId = DAY_IDS[new Date(dateStr).getDay()];
    if (!doctorWorkDays(selectedDoctor).includes(dayId)) {
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

  return (
    <div className="page-padding">
      <div className="container" style={{ maxWidth: 900 }}>
        <h2 className="text-center mb-xl">{t('booking_title')}</h2>

        {/* Stepper */}
        <div className="stepper">
          {[1, 2, 3, 4, 5, 6].map(num => (
            <Fragment key={num}>
              <div className={`step-circle ${step === num ? 'active' : step > num ? 'completed' : 'pending'}`}>
                {step > num ? <CheckCircle size={20} /> : num}
              </div>
              {num < 6 && <div className={`step-line ${step > num ? 'active' : ''}`}></div>}
            </Fragment>
          ))}
        </div>

        <div className="glass p-8">
          
          {/* STEP 1: Choose Clinic */}
          {step === 1 && (
            <div className="animate-in">
              <h3 className="mb-md">
                <Building2 size={20} style={{ display: 'inline', verticalAlign: 'text-bottom', marginInlineEnd: 8 }} />
                {isAr ? 'اختر العيادة' : 'Choose Clinic'}
              </h3>
              {loadingClinics ? (
                <p className="text-center text-muted">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
              ) : clinics.length === 0 ? (
                <p className="text-center text-muted">{isAr ? 'لا توجد عيادات متاحة حالياً' : 'No clinics available'}</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  {clinics.map(clinic => (
                    <button
                      key={clinic.id}
                      type="button"
                      onClick={() => { setSelectedClinic(clinic); setSelectedDoctor(null); setSelectedDate(''); setSelectedTime(''); setBookedSlotsByDate({}); setSelectedSpecialty(''); }}
                      className="card-flat"
                      style={{
                        cursor: 'pointer', textAlign: isAr ? 'right' : 'left', padding: '1.25rem',
                        border: `2px solid ${selectedClinic?.id === clinic.id ? 'var(--primary)' : 'var(--border)'}`,
                        background: selectedClinic?.id === clinic.id ? 'var(--primary-50)' : 'var(--surface)',
                        transition: 'var(--transition)', borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem'
                      }}>
                        {(clinic.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{clinic.name}</div>
                      {clinic.address && <div className="text-sm text-muted">{clinic.address}</div>}
                      {clinic.phone && <div className="text-sm text-muted" dir="ltr">{clinic.phone}</div>}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex justify-center mt-xl">
                <button className="btn btn-primary" disabled={!selectedClinic} onClick={handleNext}>
                  {t('next_step')} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Specialty & Doctor */}
          {step === 2 && (
            <div className="animate-in">
              <h3 className="mb-md"><Stethoscope size={20} style={{ display: 'inline', verticalAlign: 'text-bottom', marginInlineEnd: 8 }}/> {t('choose_specialty')}</h3>
              <div className="specialty-row mb-xl">
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

              <h3 className="mb-md">{t('choose_doctor')}</h3>
              {loadingDoctors ? (
                <p className="text-center text-muted">{isAr ? 'جارٍ تحميل الأطباء...' : 'Loading doctors...'}</p>
              ) : filteredDoctors.length === 0 ? (
                <p className="text-center text-muted">{isAr ? 'لا يوجد أطباء في هذه العيادة' : 'No doctors in this clinic'}</p>
              ) : (
                <div className="doctors-grid">
                  {filteredDoctors.map(doc => (
                    <DoctorCard
                      key={doc.id}
                      doctor={doc}
                      selected={selectedDoctor?.id === doc.id}
                      onSelect={handleSelectDoctor}
                    />
                  ))}
                </div>
              )}

              <div className="flex justify-between mt-xl">
                <button className="btn btn-ghost" onClick={handlePrev}>{t('previous')}</button>
                <button className="btn btn-primary" disabled={!selectedDoctor} onClick={handleNext}>
                  {t('next_step')} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Date & Time */}
          {step === 3 && (
            <div className="animate-in">
              <h3 className="mb-md"><CalendarIcon size={20} style={{ display: 'inline', verticalAlign: 'text-bottom', marginInlineEnd: 8 }}/> {t('select_date_time')}</h3>
              <div className="flex gap-xl flex-wrap">
                <div style={{ flex: '1 1 300px' }}>
                  <CalendarPicker selectedDate={selectedDate} onSelectDate={(date) => { setSelectedDate(date); setSelectedTime(''); }} getDateMeta={getDateMeta} />
                </div>
                <div style={{ flex: '1 1 300px' }}>
                  {selectedDate ? (
                    <>
                      {availabilityLoading && (
                        <p className="text-sm text-muted mb-sm">{isAr ? 'جارٍ تحديث المواعيد المتاحة...' : 'Refreshing availability...'}</p>
                      )}
                      <TimeSlotGrid slots={availableSlots} selectedTime={selectedTime} onSelectTime={(time) => { setFormError(''); setSelectedTime(time); }} />
                    </>
                  ) : (
                    <div className="text-center text-muted mt-xl">
                      <CalendarIcon size={48} opacity={0.2} className="mb-sm" style={{ margin: '0 auto' }}/>
                      <p>{t('choose_date')} first</p>
                    </div>
                  )}
                </div>
              </div>
              {formError && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid var(--danger)',
                  color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                  marginTop: '1rem', fontSize: '0.9rem', whiteSpace: 'pre-line'
                }}>
                  {formError}
                </div>
              )}
              <div className="flex justify-between mt-xl">
                <button className="btn btn-ghost" onClick={handlePrev}>{t('previous')}</button>
                <button className="btn btn-primary" disabled={!selectedDate || !selectedTime || availabilityLoading} onClick={handleNext}>
                  {t('next_step')} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Patient Details */}
          {step === 4 && (
            <div className="animate-in">
              <h3 className="mb-xl" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={22} color="var(--primary)" />
                {isAr ? 'بيانات المريض' : 'Patient Details'}
              </h3>

              {formError && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid var(--danger)',
                  color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem', fontSize: '0.9rem', whiteSpace: 'pre-line'
                }}>
                  {formError}
                </div>
              )}

              <div className="flex gap-md flex-wrap mb-md">
                <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
                  <label className="form-label">{t('full_name')} *</label>
                  <input
                    className="input"
                    type="text"
                    placeholder={isAr ? 'أحمد محمد العلي' : 'John Doe'}
                    value={patientData.name}
                    onChange={e => setPatientData({...patientData, name: e.target.value})}
                    style={{ borderColor: patientData.name && !nameIsValid ? 'var(--danger)' : undefined }}
                  />
                  {patientData.name && !nameIsValid && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{isAr ? 'أحرف فقط، 3 على الأقل' : 'Letters only, min 3'}</span>
                  )}
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
                  <label className="form-label">{t('phone_number')} *</label>
                  <input
                    className="input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="07XXXXXXXXX"
                    value={patientData.phone}
                    onChange={e => setPatientData({...patientData, phone: e.target.value.replace(/\D/g, '')})}
                    style={{ borderColor: patientData.phone && !phoneIsValid ? 'var(--danger)' : undefined }}
                  />
                  <span style={{ color: patientData.phone && !phoneIsValid ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {isAr ? `11 رقماً (${cleanPhone.length}/11)` : `11 digits (${cleanPhone.length}/11)`}
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('email')} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({isAr ? 'اختياري' : 'optional'})</span></label>
                <input className="input" type="email" placeholder="example@email.com" value={patientData.email} onChange={e => setPatientData({...patientData, email: e.target.value})} />
              </div>
              <div className="flex justify-between mt-xl">
                <button className="btn btn-ghost" onClick={handlePrev}>{t('previous')}</button>
                <button className="btn btn-primary" disabled={!nameIsValid || !phoneIsValid} onClick={handleNext}>
                  {t('next_step')} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Payment */}
          {step === 5 && (
            <div className="animate-in">
              <h3 className="mb-xl text-center">
                <CreditCard size={24} style={{ display: 'inline', verticalAlign: 'text-bottom', marginInlineEnd: 8 }}/>
                {isAr ? 'اختر طريقة الدفع' : 'Choose Payment Method'}
              </h3>

              {/* Payment Methods */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {paymentMethods.map(pm => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className="card-flat"
                    style={{
                      cursor: 'pointer', textAlign: 'center', padding: '1.5rem 1rem',
                      border: `2px solid ${paymentMethod === pm.id ? 'var(--primary)' : 'var(--border)'}`,
                      background: paymentMethod === pm.id ? 'var(--primary-50)' : 'var(--surface)',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                      <pm.Icon size={28} color={paymentMethod === pm.id ? 'var(--primary)' : 'var(--text-secondary)'} />
                    </div>
                    <div style={{ fontWeight: 700 }}>{isAr ? pm.labelAr : pm.label}</div>
                    <div className="text-sm text-muted">{isAr ? pm.descAr : pm.desc}</div>
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
              <div className="card-flat bg-alt text-center mb-xl">
                <h4 className="mb-sm">{t('booking_summary')}</h4>
                <p>{isAr ? selectedDoctor?.nameAr : selectedDoctor?.name}</p>
                <p className="mb-sm">{selectedDate} — {to12Hour(selectedTime, isAr)}</p>
                <p className="text-sm text-muted mb-md">
                  {isAr ? 'طريقة الدفع: ' : 'Payment: '}
                  {isAr
                    ? paymentMethods.find(p => p.id === paymentMethod)?.labelAr
                    : paymentMethods.find(p => p.id === paymentMethod)?.label}
                </p>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {t('total')}: ${selectedDoctor?.fee}
                </div>
              </div>

              {formError && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid var(--danger)',
                  color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem', fontSize: '0.9rem', whiteSpace: 'pre-line'
                }}>
                  {formError}
                </div>
              )}

              <div className="flex justify-between">
                <button className="btn btn-ghost" onClick={handlePrev} disabled={submitting}>{t('previous')}</button>
                <button className="btn btn-primary btn-lg" onClick={confirmBooking} disabled={submitting}>
                  {submitting
                    ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                    : (paymentMethod === 'cash'
                        ? (isAr ? 'تأكيد الحجز' : 'Confirm Booking')
                        : t('pay_now'))}
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Success */}
          {step === 6 && (
            <div className="animate-in text-center py-xl">
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                background: 'rgba(245,158,11,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}>
                <Clock size={48} color="#f59e0b" />
              </div>
              <h2 className="mb-md" style={{ color: '#f59e0b' }}>
                {isAr ? 'طلب الحجز قيد المراجعة' : 'Booking Request Received'}
              </h2>
              <p className="text-muted mb-xl" style={{ maxWidth: 400, margin: '0 auto 2rem' }}>
                {isAr
                  ? 'تم إرسال طلب حجزك بنجاح. سيقوم فريق العيادة بمراجعته وتأكيده في أقرب وقت.'
                  : 'Your booking request has been sent. The clinic team will review and confirm it shortly.'}
              </p>
              <div className="card-flat bg-alt mb-xl" style={{ display: 'inline-block', minWidth: 340, textAlign: isAr ? 'right' : 'left' }}>
                <p className="mb-sm" style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <strong>{isAr ? 'رقم الحجز' : t('booking_id')}:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>{bookingCode}</span>
                </p>
                <p className="mb-sm" style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <strong>{t('patient')}:</strong> <span>{patientData.name}</span>
                </p>
                <p className="mb-sm" style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <strong>{isAr ? 'الهاتف' : 'Phone'}:</strong> <span dir="ltr">{patientData.phone}</span>
                </p>
                <p className="mb-sm" style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <strong>{t('doctor')}:</strong> <span>{isAr ? selectedDoctor?.nameAr : selectedDoctor?.name}</span>
                </p>
                <p className="mb-sm" style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <strong>{isAr ? 'التاريخ والوقت' : 'Date & Time'}:</strong> <span>{selectedDate} — {to12Hour(selectedTime, isAr)}</span>
                </p>
                <p className="mb-sm" style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', alignItems: 'center' }}>
                  <strong>{isAr ? 'طريقة الدفع' : 'Payment'}:</strong>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {(() => { const PM = paymentMethods.find(p => p.id === paymentMethod); return PM ? <><PM.Icon size={16} /> {isAr ? PM.labelAr : PM.label}</> : null; })()}
                  </span>
                </p>
                <p className="mb-sm" style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <strong>{isAr ? 'المبلغ' : 'Amount'}:</strong> <span style={{ fontWeight: 700 }}>${selectedDoctor?.fee}</span>
                </p>
                <p style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <strong>{t('status')}:</strong> <span className="badge badge-warning">{isAr ? 'بانتظار التأكيد' : 'Pending'}</span>
                </p>
              </div>
              <div className="flex justify-center gap-md">
                <button className="btn btn-outline" onClick={() => navigate('/')}>{t('back_to_home')}</button>
                <button className="btn btn-primary" onClick={() => navigate('/profile')}>{t('my_appointments')}</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Booking;
