import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navbar
      home: "Home",
      book_now: "Book Now",
      dashboard: "Dashboard",
      login: "Login",
      logout: "Logout",
      profile: "My Profile",
      lang: "العربية",

      // Hero
      hero_title: "Your Health, Simplified",
      hero_subtitle: "Book appointments with top specialists in seconds. Secure payments, instant confirmations, and smart reminders — all in one place.",
      get_started: "Get Started",
      explore_doctors: "Explore Doctors",

      // How it works
      how_it_works: "How It Works",
      step1_title: "Choose a Specialist",
      step1_desc: "Browse our network of certified doctors across various specialties.",
      step2_title: "Pick Date & Time",
      step2_desc: "Select a convenient slot from our real-time availability calendar.",
      step3_title: "Confirm & Pay",
      step3_desc: "Pay securely online and receive instant confirmation.",

      // Stats
      patients_served: "Patients Served",
      specialists: "Specialists",
      specialties: "Specialties",
      satisfaction: "Satisfaction",

      // Doctors
      our_doctors: "Our Doctors",
      our_doctors_subtitle: "Meet our team of experienced and certified medical professionals.",
      available: "Available",
      next_available: "Next Available",
      book_appointment: "Book Appointment",
      rating: "Rating",

      // Booking
      booking_title: "Book Your Appointment",
      select_specialty: "Select Specialty",
      select_doctor: "Select Doctor",
      select_date_time: "Select Date & Time",
      payment: "Payment",
      confirmation: "Confirmation",
      choose_specialty: "Choose Specialty",
      choose_doctor: "Choose Doctor",
      choose_date: "Choose Date",
      choose_time: "Choose Time",
      available_slots: "Available Slots",
      next_step: "Next Step",
      previous: "Previous",
      no_slots: "No available slots for this date",
      
      // Patient form
      full_name: "Full Name",
      phone_number: "Phone Number",
      email: "Email Address",

      // Payment
      checkout: "Secure Checkout",
      card_number: "Card Number",
      expiry: "Expiry Date",
      cvc: "CVC",
      cardholder: "Cardholder Name",
      total: "Total",
      pay_now: "Pay Now",
      booking_summary: "Booking Summary",
      consultation_fee: "Consultation Fee",

      // Confirmation
      booking_confirmed: "Booking Confirmed!",
      confirmation_msg: "Your appointment has been successfully booked. A confirmation and reminder will be sent to your phone.",
      booking_id: "Booking ID",
      add_to_calendar: "Add to Calendar",
      back_to_home: "Back to Home",

      // Dashboard
      dashboard_title: "Clinic Dashboard",
      today_appointments: "Today's Appointments",
      total_patients: "Total Patients",
      revenue: "Revenue",
      cancellation_rate: "Cancellation Rate",
      recent_appointments: "Recent Appointments",
      patient: "Patient",
      doctor: "Doctor",
      date_time: "Date & Time",
      status: "Status",
      actions: "Actions",
      confirmed: "Approved",
      pending: "Pending Approval",
      cancelled: "Cancelled",
      rejected: "Rejected",
      no_show: "No-Show",
      approve: "Approve",
      cancel: "Cancel",
      reschedule: "Reschedule",
      send_reminder: "Send Reminder",
      weekly_revenue: "Weekly Revenue",
      peak_hours: "Peak Hours",

      // Doctor Management
      manage_doctors: "Manage Doctors",
      add_doctor: "Add Doctor",
      edit_doctor: "Edit Doctor",
      doctor_name: "Doctor Name",
      specialty: "Specialty",
      working_hours: "Working Hours",
      appointment_duration: "Appointment Duration",
      minutes: "minutes",
      save: "Save",
      delete: "Delete",
      vacation_days: "Vacation Days",

      // Schedule
      schedule: "Schedule",
      weekly_view: "Weekly View",
      today: "Today",
      booked: "Booked",
      available_slot: "Available",
      break_time: "Break",

      // Patient Profile
      my_appointments: "My Appointments",
      upcoming: "Upcoming",
      past_visits: "Past Visits",
      invoices: "Invoices",
      prescriptions: "Prescriptions",
      cancel_appointment: "Cancel Appointment",
      view_prescription: "View Prescription",
      download_invoice: "Download Invoice",
      no_upcoming: "No upcoming appointments.",

      // Notifications
      notifications: "Notifications",
      reminder: "Reminder",
      reminder_msg: "Your appointment is in 24 hours",
      slot_available: "Slot Available!",
      slot_msg: "A slot just opened up with",
      mark_read: "Mark all as read",

      // Waitlist
      waitlist: "Waitlist",
      join_waitlist: "Join Waitlist",
      leave_waitlist: "Leave Waitlist",
      position: "Position",
      waitlist_info: "You'll be notified automatically when a slot becomes available.",

      // Telehealth
      telehealth: "Virtual Consultation",
      join_call: "Join Video Call",
      telehealth_info: "Connect with your doctor from anywhere through secure video consultation.",

      // Prescription
      prescription: "Prescription",
      prescribed_by: "Prescribed by",
      prescribed_on: "Date",
      medication: "Medication",
      dosage: "Dosage",
      instructions: "Instructions",
      download_pdf: "Download PDF",

      // Specialties
      cardiology: "Cardiology",
      pediatrics: "Pediatrics",
      dermatology: "Dermatology",
      orthopedics: "Orthopedics",
      general: "General Medicine",
      dentistry: "Dentistry",

      // Sidebar
      overview: "Overview",
      appointments: "Appointments",
      doctors_menu: "Doctors",
      schedule_menu: "Schedule",
      patients_menu: "Patients",
      analytics: "Analytics",
      settings: "Settings",
      clinic_panel: "Clinic Panel",

      // Login
      welcome_back: "Welcome Back",
      login_subtitle: "Sign in to your account to continue",
      password: "Password",
      sign_in: "Sign In",
      no_account: "Don't have an account?",
      sign_up: "Sign Up",
      as_patient: "As Patient",
      as_clinic: "As Clinic Staff",
      create_new_account: "Create a new account",
      already_have_account: "Already have an account?",
      phone: "Phone Number",
      loading: "Loading...",
      patients: "Patients",
      settings: "Settings",

      // Doctor Dashboard
      doctor_dashboard: "Doctor Dashboard",
      time: "Time",
      completed: "Completed",
      in_progress: "In Progress",
      completed_visits: "Completed Visits",
      waiting_appointments: "Waiting",
      patients_visited: "Patients Visited Today",
      this_week: "This Week",
      this_month: "This Month",
      total_appointments: "Total Appointments",
      new_patients: "New Patients",
      start_visit: "Start Visit",
      complete_visit: "Complete",
      recent_patients: "Recent Patients",
      last_visit: "Last Visit",
      open_profile: "Open Profile",
      visits_last_7: "Visits — Last 7 Days",
      no_appointments_today: "No appointments scheduled today.",
      no_recent_patients: "No patients yet.",

      // Days
      sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat",

      // Clinic management dashboard
      clinic_admin_panel: "Clinic Administration",
      employee_panel: "Clinic Operations",
      total_doctors: "Total Doctors",
      pending_appointments: "Pending Appointments",
      appointments_management: "Appointments Management",
      patients_management: "Patients Management",
      manage_bookings_desc: "Review, approve and reject bookings",
      manage_patients_desc: "View patient records and history",
      todays_schedule: "Today's Schedule",
      reject: "Reject",

      // Countdown
      days: "Days",
      hours: "Hours",
      seconds: "Seconds",
      appointment_time_reached: "It's time!",

      // Patient appointments
      pending_approval: "Pending approval",
      time_until_appointment: "Time until your appointment",
      appointment_rejected_note: "This appointment request was rejected.",
      no_prescriptions: "No prescriptions yet.",
      no_notifications: "No notifications yet",

      // Prescriptions
      diagnosis: "Diagnosis",
      medicines: "Medicines",
      medicine_name: "Medicine name",
      add_medicine: "Add medicine",
      new_prescription: "New Prescription",
      save_prescription: "Save Prescription",
      saving: "Saving...",
    }
  },
  ar: {
    translation: {
      // Navbar
      home: "الرئيسية",
      book_now: "احجز الآن",
      dashboard: "لوحة التحكم",
      login: "تسجيل الدخول",
      logout: "تسجيل الخروج",
      profile: "حسابي",
      lang: "English",

      // Hero
      hero_title: "صحتك، ببساطة",
      hero_subtitle: "احجز مواعيدك مع أفضل المتخصصين في ثوانٍ. دفع آمن، تأكيد فوري، وتذكيرات ذكية — كل شيء في مكان واحد.",
      get_started: "ابدأ الآن",
      explore_doctors: "تصفح الأطباء",

      // How it works
      how_it_works: "كيف يعمل النظام",
      step1_title: "اختر التخصص",
      step1_desc: "تصفح شبكتنا من الأطباء المعتمدين في مختلف التخصصات.",
      step2_title: "حدد التاريخ والوقت",
      step2_desc: "اختر موعداً مناسباً من تقويم التوفر المباشر.",
      step3_title: "أكّد وادفع",
      step3_desc: "ادفع بأمان عبر الإنترنت واحصل على تأكيد فوري.",

      // Stats
      patients_served: "مريض تمت خدمتهم",
      specialists: "أطباء متخصصون",
      specialties: "تخصصات طبية",
      satisfaction: "نسبة الرضا",

      // Doctors
      our_doctors: "أطباؤنا",
      our_doctors_subtitle: "تعرّف على فريقنا من المتخصصين ذوي الخبرة والشهادات المعتمدة.",
      available: "متاح",
      next_available: "أقرب موعد",
      book_appointment: "احجز موعدك",
      rating: "التقييم",

      // Booking
      booking_title: "احجز موعدك",
      select_specialty: "اختر التخصص",
      select_doctor: "اختر الطبيب",
      select_date_time: "اختر التاريخ والوقت",
      payment: "الدفع",
      confirmation: "التأكيد",
      choose_specialty: "اختر التخصص",
      choose_doctor: "اختر الطبيب",
      choose_date: "اختر التاريخ",
      choose_time: "اختر الوقت",
      available_slots: "المواعيد المتاحة",
      next_step: "الخطوة التالية",
      previous: "السابق",
      no_slots: "لا توجد مواعيد متاحة لهذا التاريخ",

      // Patient form
      full_name: "الاسم الكامل",
      phone_number: "رقم الهاتف",
      email: "البريد الإلكتروني",

      // Payment
      checkout: "الدفع الآمن",
      card_number: "رقم البطاقة",
      expiry: "تاريخ الانتهاء",
      cvc: "رمز الأمان",
      cardholder: "اسم حامل البطاقة",
      total: "المجموع",
      pay_now: "ادفع الآن",
      booking_summary: "ملخص الحجز",
      consultation_fee: "رسوم الاستشارة",

      // Confirmation
      booking_confirmed: "تم تأكيد الحجز!",
      confirmation_msg: "تم حجز موعدك بنجاح. سيتم إرسال رسالة تأكيد وتذكير إلى هاتفك.",
      booking_id: "رقم الحجز",
      add_to_calendar: "أضف إلى التقويم",
      back_to_home: "العودة للرئيسية",

      // Dashboard
      dashboard_title: "لوحة تحكم العيادة",
      today_appointments: "مواعيد اليوم",
      total_patients: "إجمالي المرضى",
      revenue: "الإيرادات",
      cancellation_rate: "نسبة الإلغاء",
      recent_appointments: "الحجوزات الأخيرة",
      patient: "المريض",
      doctor: "الطبيب",
      date_time: "التاريخ والوقت",
      status: "الحالة",
      actions: "الإجراءات",
      confirmed: "مقبول",
      pending: "بانتظار الموافقة",
      cancelled: "ملغي",
      rejected: "مرفوض",
      no_show: "لم يحضر",
      approve: "تأكيد",
      cancel: "إلغاء",
      reschedule: "إعادة جدولة",
      send_reminder: "إرسال تذكير",
      weekly_revenue: "الإيرادات الأسبوعية",
      peak_hours: "أوقات الذروة",

      // Doctor Management
      manage_doctors: "إدارة الأطباء",
      add_doctor: "إضافة طبيب",
      edit_doctor: "تعديل الطبيب",
      doctor_name: "اسم الطبيب",
      specialty: "التخصص",
      working_hours: "ساعات العمل",
      appointment_duration: "مدة الموعد",
      minutes: "دقيقة",
      save: "حفظ",
      delete: "حذف",
      vacation_days: "أيام الإجازة",

      // Schedule
      schedule: "الجدول",
      weekly_view: "العرض الأسبوعي",
      today: "اليوم",
      booked: "محجوز",
      available_slot: "متاح",
      break_time: "استراحة",

      // Patient Profile
      my_appointments: "مواعيدي",
      upcoming: "القادمة",
      past_visits: "الزيارات السابقة",
      invoices: "الفواتير",
      prescriptions: "الوصفات الطبية",
      cancel_appointment: "إلغاء الموعد",
      view_prescription: "عرض الوصفة",
      download_invoice: "تحميل الفاتورة",
      no_upcoming: "لا توجد مواعيد قادمة.",

      // Notifications
      notifications: "الإشعارات",
      reminder: "تذكير",
      reminder_msg: "موعدك بعد 24 ساعة",
      slot_available: "موعد متاح!",
      slot_msg: "تم توفر موعد مع",
      mark_read: "تحديد الكل كمقروء",

      // Waitlist
      waitlist: "قائمة الانتظار",
      join_waitlist: "انضم لقائمة الانتظار",
      leave_waitlist: "مغادرة قائمة الانتظار",
      position: "الترتيب",
      waitlist_info: "سيتم إشعارك تلقائياً عند توفر موعد شاغر.",

      // Telehealth
      telehealth: "استشارة عن بُعد",
      join_call: "انضم للمكالمة المرئية",
      telehealth_info: "تواصل مع طبيبك من أي مكان عبر استشارة مرئية آمنة.",

      // Prescription
      prescription: "وصفة طبية",
      prescribed_by: "الطبيب المعالج",
      prescribed_on: "التاريخ",
      medication: "الدواء",
      dosage: "الجرعة",
      instructions: "التعليمات",
      download_pdf: "تحميل PDF",

      // Specialties
      cardiology: "القلب والأوعية",
      pediatrics: "طب الأطفال",
      dermatology: "الجلدية",
      orthopedics: "العظام",
      general: "الطب العام",
      dentistry: "طب الأسنان",

      // Sidebar
      overview: "نظرة عامة",
      appointments: "المواعيد",
      doctors_menu: "الأطباء",
      schedule_menu: "الجدول",
      patients_menu: "المرضى",
      analytics: "التحليلات",
      settings: "الإعدادات",
      clinic_panel: "لوحة العيادة",

      // Login
      welcome_back: "مرحباً بعودتك",
      login_subtitle: "سجّل الدخول لمتابعة حسابك",
      password: "كلمة المرور",
      sign_in: "تسجيل الدخول",
      no_account: "ليس لديك حساب؟",
      sign_up: "إنشاء حساب",
      as_patient: "كمريض",
      as_clinic: "كموظف عيادة",
      create_new_account: "أنشئ حساباً جديداً",
      already_have_account: "لديك حساب بالفعل؟",
      phone: "رقم الهاتف",
      loading: "جارٍ التحميل...",
      patients: "المرضى",
      settings: "الإعدادات",

      // Doctor Dashboard
      doctor_dashboard: "لوحة الطبيب",
      time: "الوقت",
      completed: "مكتمل",
      in_progress: "قيد الكشف",
      completed_visits: "زيارات مكتملة",
      waiting_appointments: "بالانتظار",
      patients_visited: "مرضى تمت معاينتهم اليوم",
      this_week: "هذا الأسبوع",
      this_month: "هذا الشهر",
      total_appointments: "إجمالي المواعيد",
      new_patients: "مرضى جدد",
      start_visit: "بدء الكشف",
      complete_visit: "إنهاء",
      recent_patients: "المرضى الأخيرون",
      last_visit: "آخر زيارة",
      open_profile: "فتح الملف",
      visits_last_7: "الزيارات — آخر ٧ أيام",
      no_appointments_today: "لا توجد مواعيد مجدولة اليوم.",
      no_recent_patients: "لا يوجد مرضى بعد.",

      // Days
      sun: "أحد", mon: "إثن", tue: "ثلا", wed: "أرب", thu: "خمي", fri: "جمع", sat: "سبت",

      // Clinic management dashboard
      clinic_admin_panel: "إدارة العيادة",
      employee_panel: "عمليات العيادة",
      total_doctors: "إجمالي الأطباء",
      pending_appointments: "مواعيد قيد الانتظار",
      appointments_management: "إدارة المواعيد",
      patients_management: "إدارة المرضى",
      manage_bookings_desc: "مراجعة المواعيد وقبولها أو رفضها",
      manage_patients_desc: "عرض سجلات المرضى وتاريخهم",
      todays_schedule: "جدول اليوم",
      reject: "رفض",

      // Countdown
      days: "يوم",
      hours: "ساعة",
      seconds: "ثانية",
      appointment_time_reached: "حان الموعد!",

      // Patient appointments
      pending_approval: "بانتظار الموافقة",
      time_until_appointment: "الوقت المتبقي لموعدك",
      appointment_rejected_note: "تم رفض طلب هذا الموعد.",
      no_prescriptions: "لا توجد وصفات طبية بعد.",
      no_notifications: "لا توجد إشعارات بعد",

      // Prescriptions
      diagnosis: "التشخيص",
      medicines: "الأدوية",
      medicine_name: "اسم الدواء",
      add_medicine: "إضافة دواء",
      new_prescription: "وصفة طبية جديدة",
      save_prescription: "حفظ الوصفة",
      saving: "جارٍ الحفظ...",
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: "ar",
  fallbackLng: "en",
  interpolation: { escapeValue: false }
});

export default i18n;
