// ========== MOCK PATIENTS ==========
export const mockPatients = [
  { id: 'p-001', full_name: 'أحمد محمد العلي', email: 'ahmed@example.com', phone: '+964 771 234 5678', gender: 'male', date_of_birth: '1990-05-15', role: 'patient', created_at: '2026-01-10T08:00:00Z' },
  { id: 'p-002', full_name: 'سارة خالد الحسن', email: 'sara@example.com', phone: '+964 750 987 6543', gender: 'female', date_of_birth: '1995-09-22', role: 'patient', created_at: '2026-02-03T10:30:00Z' },
  { id: 'p-003', full_name: 'محمد علي الجابر', email: 'mohamad@example.com', phone: '+964 780 111 2233', gender: 'male', date_of_birth: '1985-12-01', role: 'patient', created_at: '2026-03-15T09:00:00Z' },
  { id: 'p-004', full_name: 'نور عبدالله الراشد', email: 'noor@example.com', phone: '+964 770 445 6677', gender: 'female', date_of_birth: '2000-03-08', role: 'patient', created_at: '2026-04-20T14:00:00Z' },
];

// ========== DOCTORS ==========
export const doctors = [
  { id: 1, name: "Dr. Ahmed Al-Rashid", nameAr: "د. أحمد الراشد", specialty: "cardiology", rating: 4.9, reviews: 214, duration: 20, fee: 50, avatar: "A", available: true, nextSlot: "Today, 2:00 PM" },
  { id: 2, name: "Dr. Sarah Mitchell", nameAr: "د. سارة ميتشل", specialty: "pediatrics", rating: 4.8, reviews: 189, duration: 15, fee: 40, avatar: "S", available: true, nextSlot: "Today, 3:00 PM" },
  { id: 3, name: "Dr. John Williams", nameAr: "د. جون ويليامز", specialty: "general", rating: 4.7, reviews: 312, duration: 15, fee: 35, avatar: "J", available: true, nextSlot: "Tomorrow, 9:00 AM" },
  { id: 4, name: "Dr. Fatima Hassan", nameAr: "د. فاطمة حسن", specialty: "dermatology", rating: 4.9, reviews: 156, duration: 25, fee: 60, avatar: "F", available: true, nextSlot: "Today, 4:00 PM" },
  { id: 5, name: "Dr. Omar Khalil", nameAr: "د. عمر خليل", specialty: "orthopedics", rating: 4.6, reviews: 98, duration: 30, fee: 55, avatar: "O", available: false, nextSlot: "Jun 12, 10:00 AM" },
  { id: 6, name: "Dr. Lina Nasser", nameAr: "د. لينا ناصر", specialty: "dentistry", rating: 4.8, reviews: 245, duration: 20, fee: 45, avatar: "L", available: true, nextSlot: "Today, 11:00 AM" },
];

// Icons are rendered via <SpecialtyIcon> (lucide), so no emoji here.
export const specialties = [
  { id: "cardiology" },
  { id: "pediatrics" },
  { id: "dermatology" },
  { id: "orthopedics" },
  { id: "general" },
  { id: "dentistry" },
];

// ========== TIME SLOTS ==========
export const generateTimeSlots = (doctorId, dateStr) => {
  const allSlots = ["09:00","09:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30"];
  const bookedKey = `booked_${doctorId}_${dateStr}`;
  const booked = JSON.parse(localStorage.getItem(bookedKey) || "[]");
  return allSlots.map(time => ({
    time,
    booked: booked.includes(time)
  }));
};

export const bookSlot = (doctorId, dateStr, time) => {
  const bookedKey = `booked_${doctorId}_${dateStr}`;
  const booked = JSON.parse(localStorage.getItem(bookedKey) || "[]");
  if (!booked.includes(time)) {
    booked.push(time);
    localStorage.setItem(bookedKey, JSON.stringify(booked));
  }
};

// ========== APPOINTMENTS ==========
const defaultAppointments = [
  { id: "BK-1001", patient: "John Doe", patientAr: "جون دو", doctorId: 1, date: "2026-06-10", time: "10:00", status: "confirmed", paid: true, fee: 50 },
  { id: "BK-1002", patient: "Jane Smith", patientAr: "جين سميث", doctorId: 2, date: "2026-06-10", time: "14:00", status: "pending", paid: false, fee: 40 },
  { id: "BK-1003", patient: "Ali Khan", patientAr: "علي خان", doctorId: 3, date: "2026-06-11", time: "09:00", status: "confirmed", paid: true, fee: 35 },
  { id: "BK-1004", patient: "Sara Ahmed", patientAr: "سارة أحمد", doctorId: 4, date: "2026-06-09", time: "11:00", status: "confirmed", paid: true, fee: 60 },
  { id: "BK-1005", patient: "Mike Johnson", patientAr: "مايك جونسون", doctorId: 1, date: "2026-06-08", time: "09:00", status: "no-show", paid: true, fee: 50 },
  { id: "BK-1006", patient: "Layla Farid", patientAr: "ليلى فريد", doctorId: 6, date: "2026-06-12", time: "13:00", status: "confirmed", paid: true, fee: 45 },
  { id: "BK-1007", patient: "Ahmad Nabil", patientAr: "أحمد نبيل", doctorId: 5, date: "2026-06-09", time: "15:00", status: "cancelled", paid: false, fee: 55 },
];

export const getAppointments = () => {
  const stored = localStorage.getItem("appointments");
  if (stored) return JSON.parse(stored);
  localStorage.setItem("appointments", JSON.stringify(defaultAppointments));
  return defaultAppointments;
};

export const addAppointment = (apt) => {
  const list = getAppointments();
  list.push(apt);
  localStorage.setItem("appointments", JSON.stringify(list));
  return list;
};

export const updateAppointmentStatus = (id, status) => {
  const list = getAppointments();
  const idx = list.findIndex(a => a.id === id);
  if (idx !== -1) {
    list[idx].status = status;
    localStorage.setItem("appointments", JSON.stringify(list));
  }
  return list;
};

// ========== NOTIFICATIONS ==========
const defaultNotifications = [
  { id: 1, type: "reminder", titleKey: "reminder", msgKey: "reminder_msg", doctor: "Dr. Ahmed", time: "2h ago", read: false },
  { id: 2, type: "waitlist", titleKey: "slot_available", msgKey: "slot_msg", doctor: "Dr. Fatima", time: "5h ago", read: false },
  { id: 3, type: "reminder", titleKey: "reminder", msgKey: "reminder_msg", doctor: "Dr. Sarah", time: "1d ago", read: true },
];

export const getNotifications = () => {
  const stored = localStorage.getItem("notifications");
  if (stored) return JSON.parse(stored);
  localStorage.setItem("notifications", JSON.stringify(defaultNotifications));
  return defaultNotifications;
};

export const markAllRead = () => {
  const list = getNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem("notifications", JSON.stringify(list));
  return list;
};

// ========== WAITLIST ==========
const defaultWaitlist = [
  { id: 1, patient: "Nora Ali", patientAr: "نورا علي", doctorId: 5, position: 1 },
  { id: 2, patient: "Samir Eid", patientAr: "سمير عيد", doctorId: 5, position: 2 },
];

export const getWaitlist = () => {
  const stored = localStorage.getItem("waitlist");
  if (stored) return JSON.parse(stored);
  localStorage.setItem("waitlist", JSON.stringify(defaultWaitlist));
  return defaultWaitlist;
};

// ========== PRESCRIPTIONS ==========
export const prescriptions = [
  {
    id: 1,
    doctorId: 1,
    patient: "John Doe",
    date: "2026-06-08",
    medications: [
      { name: "Amlodipine 5mg", dosage: "1 tablet daily", instructions: "Take with breakfast" },
      { name: "Aspirin 81mg", dosage: "1 tablet daily", instructions: "Take after lunch" },
    ]
  }
];

// ========== ANALYTICS ==========
export const weeklyRevenue = [
  { day: "Sat", value: 320 },
  { day: "Sun", value: 480 },
  { day: "Mon", value: 560 },
  { day: "Tue", value: 420 },
  { day: "Wed", value: 650 },
  { day: "Thu", value: 380 },
  { day: "Fri", value: 200 },
];

export const peakHours = [
  { hour: "9AM", count: 12 },
  { hour: "10AM", count: 18 },
  { hour: "11AM", count: 15 },
  { hour: "1PM", count: 10 },
  { hour: "2PM", count: 14 },
  { hour: "3PM", count: 20 },
  { hour: "4PM", count: 8 },
];

// ========== AUTH (Mock) ==========
export const mockLogin = (email, password, role) => {
  const user = { email, role, name: role === 'patient' ? 'John Doe' : 'Admin' };
  localStorage.setItem("user", JSON.stringify(user));
  return user;
};

export const getUser = () => {
  const stored = localStorage.getItem("user");
  return stored ? JSON.parse(stored) : null;
};

export const logoutUser = () => {
  localStorage.removeItem("user");
};
