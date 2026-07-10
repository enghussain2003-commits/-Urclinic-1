/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import i18n from '../i18n';
import { getUser, logoutUser, specialties, doctors as mockDoctors, mockPatients } from '../data/mockData';

const AppContext = createContext();

export const useApp = () => useContext(AppContext);

// ---- localStorage fallback for bookings (keeps bookings working even if Supabase insert fails) ----
const LS_BOOKINGS = 'cc_bookings';
const readLocalBookings = () => {
  try { return JSON.parse(localStorage.getItem(LS_BOOKINGS) || '[]'); } catch { return []; }
};
const writeLocalBookings = (list) => {
  try { localStorage.setItem(LS_BOOKINGS, JSON.stringify(list)); } catch { /* ignore */ }
};

// ---- localStorage fallback for clinic-added doctors ----
const LS_DOCTORS = 'cc_doctors';
const readLocalDoctors = () => {
  try { return JSON.parse(localStorage.getItem(LS_DOCTORS) || '[]'); } catch { return []; }
};
const writeLocalDoctors = (list) => {
  try { localStorage.setItem(LS_DOCTORS, JSON.stringify(list)); } catch { /* ignore */ }
};
const mergeById = (a = [], b = []) => {
  const map = new Map();
  [...a, ...b].forEach(item => { if (item && item.id != null) map.set(String(item.id), item); });
  return Array.from(map.values());
};

// Single choke point for clinic isolation in state: keep only appointments whose doctor
// belongs to the current clinic. ids == null → super_admin / patient (no restriction).
// Applied at EVERY setAppointments call so no path can leak a booking across clinics.
const scopeToClinic = (list = [], ids) =>
  ids == null ? list : list.filter(a => a && ids.includes(String(a.doctor_id)));

// ---- Schema adapter for the appointments table ----
// The DB columns are `appointment_date` / `appointment_time`, but the entire UI
// reads `date` / `time`. Map at the supabase boundary so the in-memory shape stays
// stable and we don't have to touch every component.
const fromDbAppt = (row) => row && ({
  ...row,
  date: row.date ?? row.appointment_date,
  time: row.time ?? row.appointment_time,
});


export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(getUser());
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  // When the logged-in user is a patient, this holds every patients.id row they own
  // across all clinics (patients.auth_user_id = auth.uid()). Drives ID-based linkage
  // for the patient's own appointments / notifications (audit finding M3).
  const [myPatientIds, setMyPatientIds] = useState([]);

  // Stores the current clinic's doctor IDs so the Realtime callback can apply
  // the same filter as the initial fetch (null = no restriction = super_admin/patient).
  const clinicDoctorIdsRef = useRef(null);

  // Fetch initial data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Clear the previous user's appointments immediately so a clinic switch never shows
      // stale cross-clinic rows while the new scoped fetch is in flight.
      setAppointments([]);
      const currentUser = getUser();
      const isSuperAdmin = currentUser?.role === 'super_admin';
      const isStaff = currentUser?.role &&
        ['super_admin', 'clinic_admin', 'employee', 'doctor'].includes(currentUser.role);

      // Resolve the staff member's clinic_id reliably.
      // localStorage may be stale (user logged in before clinic_id was stored there),
      // so fall back to a fresh Supabase profile lookup when it is missing.
      let staffClinicId = null;
      if (isStaff && !isSuperAdmin) {
        staffClinicId = currentUser?.clinic_id || null;
        if (!staffClinicId) {
          try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
              const { data: prof } = await supabase
                .from('profiles').select('clinic_id').eq('id', authUser.id).single();
              staffClinicId = prof?.clinic_id || null;
            }
          } catch { /* ignore — staffClinicId stays null */ }
        }
      }

      try {
        // Fetch Doctors — staff (non-super_admin) see only their clinic's doctors.
        const localDocs = readLocalDoctors();
        let docQuery = supabase.from('doctors').select('*');
        if (staffClinicId) {
          docQuery = docQuery.eq('clinic_id', staffClinicId);
        }
        const { data: docs, error: docError } = await docQuery;
        let baseDocs;
        if (docError) {
          console.warn("doctors table error, using mock data:", docError.message);
          baseDocs = mockDoctors;
        } else if (docs && docs.length > 0) {
          // Normalize Supabase doctor fields to match DoctorCard expectations
          baseDocs = docs.map(d => ({
            ...d,
            name: d.full_name || d.name,
            nameAr: d.full_name || d.nameAr,
            avatar: (d.full_name || '?').charAt(0).toUpperCase(),
            available: true,
            nextSlot: 'Available',
          }));
        } else {
          baseDocs = mockDoctors;
        }
        setDoctors(mergeById(baseDocs, localDocs));

        // Build the set of doctor IDs that belong to this clinic.
        // appointments has no clinic_id column — isolation goes via doctor_id → doctors.clinic_id.
        // Use (docs || []) so that a failed doctor fetch → empty array (safe) not null (no filter).
        const clinicDoctorIds = staffClinicId
          ? (docs || []).map(d => String(d.id))
          : null; // null = no restriction (super_admin / patient)

        // Persist in ref so the Realtime callback uses the same filter.
        clinicDoctorIdsRef.current = clinicDoctorIds;

        // Fetch Appointments — filter by clinic's doctor IDs when scoped to a clinic.
        const allLocal = readLocalBookings();
        // Filter local bookings exactly like Supabase rows: by doctor_id → doctors.clinic_id
        // membership only. The booking's own clinic_id is intentionally ignored — many old
        // local records have only doctor_id (e.g. BK-9165, BK-2508, BK-3957), and a stored
        // clinic_id can be stale/cross-clinic. null clinicDoctorIds = no restriction.
        const local = clinicDoctorIds
          ? allLocal.filter(b => clinicDoctorIds.includes(String(b.doctor_id)))
          : allLocal;

        let apts, aptError;
        if (clinicDoctorIds && clinicDoctorIds.length === 0) {
          // Clinic exists but has no doctors yet → no appointments possible.
          apts = [];
          aptError = null;
        } else {
          let aptQuery = supabase.from('appointments').select('*').order('appointment_date', { ascending: false });
          if (clinicDoctorIds) {
            // Filter Supabase rows to only appointments belonging to this clinic's doctors.
            aptQuery = aptQuery.in('doctor_id', clinicDoctorIds);
          }
          ({ data: apts, error: aptError } = await aptQuery);
        }

        if (aptError) {
          console.warn("appointments fetch error, using local only:", aptError.message);
          setAppointments(scopeToClinic(local, clinicDoctorIds));
        } else {
          // Map DB columns → UI shape (appointment_date → date, appointment_time → time).
          setAppointments(scopeToClinic(mergeById((apts || []).map(fromDbAppt), local), clinicDoctorIds));
        }

        // Fetch Patients — staff (non-super_admin) see only their clinic's patients.
        let patQuery = supabase.from('profiles').select('*').eq('role', 'patient').order('created_at', { ascending: false });
        if (staffClinicId) {
          patQuery = patQuery.eq('clinic_id', staffClinicId);
        }
        const { data: pats, error: patError } = await patQuery;
        if (patError) {
          console.warn("patients fetch error, using mock:", patError.message);
          setPatients(mockPatients);
        } else if (pats && pats.length > 0) {
          setPatients(pats);
        } else {
          setPatients(mockPatients);
        }

        // For the patient role, collect every patients-table row they own across all
        // clinics. This is the basis for ID-based linkage in PatientProfile (M3).
        if (currentUser?.role === 'patient') {
          try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
              const { data: mine } = await supabase
                .from('patients').select('id').eq('auth_user_id', authUser.id);
              setMyPatientIds((mine || []).map(r => r.id));
            }
          } catch { /* ignore — UI falls back to legacy name/phone match */ }
        }

      } catch (error) {
        console.error("Error fetching from Supabase:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Realtime subscription — re-fetch with the same clinic filter used at initial load.
    const channel = supabase
      .channel('public:appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        const ids = clinicDoctorIdsRef.current; // null = super_admin / patient (no restriction)

        // Clinic with no doctors → no appointments possible, skip the query.
        if (ids !== null && ids.length === 0) {
          setAppointments([]);
          return;
        }

        let q = supabase.from('appointments').select('*').order('appointment_date', { ascending: false });
        if (ids !== null) {
          // Restrict to this clinic's doctors — same logic as initial fetch.
          q = q.in('doctor_id', ids);
        }

        const allLocal = readLocalBookings();
        const local = ids !== null
          ? allLocal.filter(b => ids.includes(String(b.doctor_id)))
          : allLocal;

        q.then(({ data }) => {
          setAppointments(scopeToClinic(mergeById((data || []).map(fromDbAppt), local), ids));
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Re-run on login/logout/clinic switch. React Router navigation does NOT remount the
    // provider, so without these deps the scope ref + appointments stay stale and a newly
    // logged-in clinic would see the previous session's appointments.
  }, [user?.id, user?.clinic_id, user?.role]);

  // Sync with Supabase auth session: if the stored user has no active session, sign them out.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // No valid session → clear any leftover/stale stored user.
        logoutUser();
        setUser(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        logoutUser();
        setUser(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  // ---- Notifications: real DB-driven, scoped per user (RLS returns only user_id = auth.uid) ----
  // Replaces the old mock notifications. Each user — patient, doctor, admin — only ever
  // receives their own rows. Realtime keeps the bell live without a refresh.
  useEffect(() => {
    let active = true;
    let channel;

    const fetchForUser = (uid) =>
      supabase.from('notifications').select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50);

    const load = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { if (active) setNotifications([]); return; }

        const { data, error } = await fetchForUser(authUser.id);
        if (!active) return;
        if (error) { console.warn('notifications fetch error:', error.message); setNotifications([]); }
        else setNotifications(data || []);

        channel = supabase
          .channel(`notifications:${authUser.id}`)
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${authUser.id}` },
            () => { fetchForUser(authUser.id).then(({ data: d }) => { if (active) setNotifications(d || []); }); })
          .subscribe();
      } catch (err) {
        console.warn('notifications load failed:', err);
        if (active) setNotifications([]);
      }
    };

    load();
    return () => { active = false; if (channel) supabase.removeChannel(channel); };
  }, [user?.id]);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };
  const logout = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    logoutUser();
    setUser(null);
  };

  // Strict allowlist of public.doctors columns we may write. Stops the previous
  // failure mode where the UI form fields `clinic_name` and `duration` (which are
  // NOT columns in the doctors table) made every insert fail with an unknown-column
  // error — and the failure was swallowed, so doctors only lived in localStorage.
  const DOCTOR_COLUMNS = [
    'clinic_id', 'profile_id', 'full_name', 'email', 'specialty',
    'clinic_address', 'fee', 'open_time', 'close_time',
    'break_start', 'break_end', 'work_days', 'is_active',
  ];

  const addDoctor = async (doctorData) => {
    // Authorization is enforced in three layers: this guard, the doctors_insert
    // RLS in 0002, and the trash-icon UI gate. Each one catches a different bypass.
    if (user?.role !== 'super_admin') {
      throw new Error('Only super admin can add doctors');
    }
    if (!doctorData?.clinic_id) {
      throw new Error('Clinic is required');
    }

    const dbFields = Object.fromEntries(
      Object.entries(doctorData).filter(([k, v]) => DOCTOR_COLUMNS.includes(k) && v !== '')
    );

    // No local-id mock. Let the DB generate a uuid for `id` so the row passes the
    // uuid column constraint and shows up identically on every device.
    const { data, error } = await supabase
      .from('doctors').insert([dbFields]).select().single();
    if (error) throw error;

    const ui = {
      ...data,
      name: data.full_name,
      nameAr: data.full_name,
      avatar: (data.full_name || '?').charAt(0).toUpperCase(),
      available: true,
      nextSlot: 'Available',
    };
    setDoctors(prev => [ui, ...prev]);
    // Best-effort local mirror; not required for correctness.
    try { writeLocalDoctors([ui, ...readLocalDoctors()]); } catch { /* ignore */ }
    return ui;
  };

  const deleteDoctor = async (id) => {
    // Only super_admin may delete doctors. This is enforced again at the DB by the
    // `doctors_delete` RLS policy — the guard here just fails fast with a clear error
    // instead of silently issuing a delete the database will reject.
    if (user?.role !== 'super_admin') {
      throw new Error(i18n.language === 'ar'
        ? 'غير مصرح: حذف الأطباء متاح للمشرف العام فقط'
        : 'Not authorized: only super admin can delete doctors');
    }
    setDoctors(prev => prev.filter(d => String(d.id) !== String(id)));
    writeLocalDoctors(readLocalDoctors().filter(d => String(d.id) !== String(id)));
    try { await supabase.from('doctors').delete().eq('id', id); } catch { /* ignore */ }
  };

  // Find-or-create the logged-in patient's row in `patients` for a given clinic.
  // The patients table is clinic-scoped: a single auth user may have multiple rows,
  // one per clinic they've ever booked at. RLS allows self-insert when
  // auth_user_id = auth.uid(). Returns the patients.id (uuid) to use in appointments.
  const ensurePatientForClinic = async ({ clinic_id, full_name, phone, email }) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Not authenticated');

    const { data: existing, error: selErr } = await supabase
      .from('patients').select('id')
      .eq('clinic_id', clinic_id).eq('auth_user_id', authUser.id)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) return existing.id;

    const { data: created, error: insErr } = await supabase
      .from('patients')
      .insert({ clinic_id, auth_user_id: authUser.id, full_name, phone, email })
      .select('id').single();
    if (insErr) throw insErr;
    return created.id;
  };

  // Persist a new appointment to Supabase. ROOT CAUSE FIX (audit C1) — previously
  // the payload had a string id ("BK-XXXX") and was missing the NOT-NULL patient_id,
  // so every insert failed RLS/constraint and the booking lived only in localStorage.
  // Now:
  //   * we resolve / create the patient_id from the patients table,
  //   * let the DB generate the uuid id,
  //   * map UI's date/time → DB's appointment_date/appointment_time,
  //   * surface errors to the caller (no more silent failure).
  const createAppointment = async (aptData) => {
    const {
      clinic_id, doctor_id, date, time, status, paid, payment_method, fee,
      patient_name, patient_phone, patient_email,
    } = aptData || {};

    if (!clinic_id || !doctor_id || !date || !time) {
      throw new Error('Missing required booking fields (clinic, doctor, date, time)');
    }

    const patientId = await ensurePatientForClinic({
      clinic_id, full_name: patient_name, phone: patient_phone, email: patient_email,
    });

    const row = {
      clinic_id,
      patient_id: patientId,
      doctor_id,
      appointment_date: date,
      appointment_time: time,
      status: status || 'pending',
      paid: !!paid,
      payment_method: payment_method || null,
      fee: Number(fee) || 0,
    };

    const { data, error } = await supabase
      .from('appointments').insert([row]).select().single();
    if (error) throw error;

    // Reflect immediately in state with the UI shape (date/time aliases). The
    // realtime channel will re-fetch in a moment, but this avoids a visible lag.
    const uiRow = fromDbAppt({ ...data, patient_name, patient_phone });
    setAppointments(prev => scopeToClinic([uiRow, ...prev], clinicDoctorIdsRef.current));

    // Notify the booked doctor (best-effort — only works if the doctor row has a
    // linked profile_id and the new notif RLS policy 0005 admits this insert).
    const doc = doctors.find(d => String(d.id) === String(doctor_id));
    if (doc?.profile_id) {
      const ar = i18n.language === 'ar';
      await sendNotification(
        doc.profile_id,
        ar ? 'طلب موعد جديد' : 'New appointment request',
        ar ? `${patient_name || 'مريض'} طلب موعداً بتاريخ ${date}`
           : `${patient_name || 'A patient'} requested an appointment on ${date}`,
        'appointment_new',
        { clinic_id }, // patient inserter MUST pass the doctor's clinic_id (0005 policy)
      );
    }
    return data;
  };

  // Resolve the patient's AUTH user id (profiles.id == auth.uid()) for an appointment so
  // we can address them via `notifications.user_id` (which FKs to profiles).
  //
  // BUG FIX: previously this returned `apt.patient_id` directly, which is
  // `patients.id` (a clinic-scoped row id), NOT the auth uid. Sending a
  // notification with `user_id = patients.id` either FK-violated or stored the
  // row under a user_id that no one's session ever sees → the patient never
  // saw the approval/rejection notification. We now look up `auth_user_id`
  // from the `patients` row.
  const resolvePatientUserId = async (apt) => {
    if (!apt) return null;
    if (apt.patient_id) {
      try {
        const { data } = await supabase
          .from('patients').select('auth_user_id')
          .eq('id', apt.patient_id).single();
        if (data?.auth_user_id) return data.auth_user_id;
      } catch { /* fall through to legacy match */ }
    }
    // Legacy fallback: phone/name match against the clinic's profiles list.
    const p = patients.find(pt =>
      (pt.phone && apt.patient_phone && pt.phone === apt.patient_phone) ||
      (pt.phone_number && apt.patient_phone && pt.phone_number === apt.patient_phone) ||
      (pt.full_name && apt.patient_name && pt.full_name === apt.patient_name) ||
      (pt.name && apt.patient_name && pt.name === apt.patient_name)
    );
    return p?.id || null;
  };

  const changeStatus = async (id, status) => {
    const apt = appointments.find(a => a.id === id);
    // Update in-memory + local storage immediately (re-scope as a safety net).
    setAppointments(prev => scopeToClinic(prev.map(a => a.id === id ? { ...a, status } : a), clinicDoctorIdsRef.current));
    writeLocalBookings(readLocalBookings().map(a => a.id === id ? { ...a, status } : a));

    // Best-effort persist to Supabase.
    try {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) console.warn("Supabase status update failed (kept locally):", error.message);
    } catch (err) {
      console.warn(err);
    }

    // Notify the patient when staff approve / reject their request (best-effort).
    if (status === 'confirmed' || status === 'rejected') {
      const uid = await resolvePatientUserId(apt);
      if (uid) {
        const ar = i18n.language === 'ar';
        const ok = status === 'confirmed';
        // The notification must carry the appointment's clinic_id so the 0005
        // RLS policy admits it for staff/doctor inserters.
        await sendNotification(
          uid,
          ok ? (ar ? 'تم تأكيد موعدك' : 'Appointment confirmed')
             : (ar ? 'تم رفض موعدك' : 'Appointment rejected'),
          ok ? (ar ? `تم تأكيد موعدك بتاريخ ${apt?.date || ''} الساعة ${apt?.time || ''}`
                   : `Your appointment on ${apt?.date || ''} at ${apt?.time || ''} was confirmed`)
             : (ar ? `نأسف، تم رفض موعدك بتاريخ ${apt?.date || ''}`
                   : `We're sorry, your appointment on ${apt?.date || ''} was rejected`),
          ok ? 'appointment_confirmed' : 'appointment_rejected',
          { clinic_id: apt?.clinic_id },
        );
      }
    }
  };

  const markNotificationRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try { await supabase.from('notifications').update({ is_read: true }).eq('id', id); }
    catch (err) { console.warn(err); }
  };

  const markAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      await supabase.from('notifications').update({ is_read: true })
        .eq('user_id', authUser.id).eq('is_read', false);
    } catch (err) { console.warn(err); }
  };

  // Back-compat alias — NotificationCenter (patient navbar) still calls this name.
  const readAllNotifications = markAllNotificationsRead;

  const addMedicalHistory = async (record) => {
    try {
      const { data, error } = await supabase.from('medical_history').insert([record]).select().single();
      if (error) { console.error(error); return null; }
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const addMedicalFile = async (record) => {
    try {
      const { data, error } = await supabase.from('medical_files').insert([record]).select().single();
      if (error) { console.error(error); return null; }
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  // Send a notification. `opts.clinic_id` lets the caller override (needed for
  // patient → doctor on booking, where the patient's own user.clinic_id is null
  // but the notification must carry the booked doctor's clinic_id to satisfy the
  // 0005 RLS policy). Falls back to user.clinic_id (staff/doctor flows).
  const sendNotification = async (userId, title, message, type = 'info', opts = {}) => {
    if (!userId) return false;
    try {
      const row = { user_id: userId, title, message, type, is_read: false };
      const cid = opts.clinic_id ?? user?.clinic_id;
      if (cid) row.clinic_id = cid;
      const { error } = await supabase.from('notifications').insert([row]);
      if (error) { console.warn('notification insert failed:', error.message); return false; }
      return true;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  // Doctor creates a prescription → saved to the patient's record + patient is notified.
  // medicines is a JSON array: [{ name, dosage, instructions }].
  //
  // M1 FIX: `rx.doctor_id` MUST be the doctors.id uuid (the doctor row), not the
  // doctor's profile id. The caller is responsible for resolving profile → doctors.id
  // (e.g. via doctors.find(d => d.profile_id === user.id)?.id). We no longer fall
  // back to `user?.id`, because that fallback wrote the profile id into a column
  // that expects doctors.id, breaking every downstream "doctor name" join.
  const createPrescription = async (rx) => {
    try {
      const row = {
        patient_id: rx.patient_id,
        doctor_id: rx.doctor_id || null,
        diagnosis: rx.diagnosis || '',
        medicines: rx.medicines || [],
        instructions: rx.instructions || '',
        prescribed_date: rx.prescribed_date || new Date().toISOString().slice(0, 10),
      };
      if (user?.clinic_id) row.clinic_id = user.clinic_id;
      const { data, error } = await supabase.from('prescriptions').insert([row]).select().single();
      if (error) { console.warn('prescription insert failed:', error.message); return null; }

      const ar = i18n.language === 'ar';
      await sendNotification(
        rx.patient_id,
        ar ? 'وصفة طبية جديدة' : 'New prescription',
        ar ? 'أضاف طبيبك وصفة طبية جديدة إلى سجلك' : 'Your doctor added a new prescription to your record',
        'prescription_new',
      );
      return data;
    } catch (err) {
      console.warn(err);
      return null;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <AppContext.Provider value={{
      user, login, logout,
      doctors, appointments, patients, myPatientIds, loading, specialties,
      createAppointment, changeStatus,
      addDoctor, deleteDoctor,
      addMedicalHistory, addMedicalFile, sendNotification, createPrescription,
      notifications, readAllNotifications, markNotificationRead, markAllNotificationsRead, unreadCount,
    }}>
      {children}
    </AppContext.Provider>
  );
};
