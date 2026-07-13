import {
  doctors as demoDoctors,
  mockPatients,
  addAppointment,
  getAppointments,
  getNotifications,
  updateAppointmentStatus,
} from '../data/mockData';

export const getDemoDoctors = () =>
  demoDoctors.map(d => ({
    ...d,
    doctor_id: d.id,
    full_name: d.name,
    profile_id: null,
    clinic_id: 'demo-clinic',
    open_time: '09:00',
    close_time: '17:00',
    break_start: '12:00',
    break_end: '13:00',
    work_days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'],
  }));

export const getDemoPatients = () =>
  mockPatients.map(p => ({ ...p, clinic_id: 'demo-clinic' }));

export const getDemoAppointments = () =>
  getAppointments().map(a => ({
    ...a,
    doctor_id: a.doctor_id ?? a.doctorId,
    patient_name: a.patient_name ?? a.patient ?? a.patientAr,
    patient_phone: a.patient_phone ?? '',
    appointment_date: a.appointment_date ?? a.date,
    appointment_time: a.appointment_time ?? a.time,
    date: a.date ?? a.appointment_date,
    time: a.time ?? a.appointment_time,
    booking_code: a.booking_code ?? a.id,
    clinic_id: 'demo-clinic',
  }));

export const updateDemoAppointmentStatus = updateAppointmentStatus;

export const addDemoAppointment = addAppointment;

export const getDemoNotifications = () =>
  getNotifications().map((n, index) => ({
    id: n.id ?? `demo-notification-${index}`,
    type: n.type || 'info',
    title: n.title || n.titleKey || 'Demo notification',
    message: n.message || n.msgKey || '',
    is_read: Boolean(n.is_read ?? n.read),
    created_at: n.created_at || new Date(Date.now() - index * 3600000).toISOString(),
  }));
