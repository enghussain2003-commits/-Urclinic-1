/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import i18n from '../i18n';
import { specialties } from '../data/specialties';
import {
  addDemoAppointment,
  getDemoAppointments,
  getDemoDoctors,
  getDemoNotifications,
  getDemoPatients,
  updateDemoAppointmentStatus,
} from '../demo/demoData';
import { isDemoModeEnabled } from '../demo/demoMode';
import { clearStoredUser, setStoredUser } from '../services/sessionService';
import { SUPPORT_NOTIFICATION_TYPES } from '../services/supportService';
import { validateIraqiPhone, validatePersonName } from '../utils/identityValidation';

const AppContext = createContext();

export const useApp = () => useContext(AppContext);

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

const APPOINTMENTS_WITH_PATIENT_SELECT = `
  *,
  patient:patients (
    id,
    clinic_id,
    auth_user_id,
    full_name,
    phone,
    email
  ),
  clinic:clinics (
    id,
    default_consultation_fee,
    currency
  ),
  payment:appointment_payments (
    id,
    consultation_fee,
    paid_amount,
    payment_status,
    payment_method,
    currency,
    note,
    paid_at,
    recorded_by,
    created_at,
    updated_at
  )
`;

// ---- Schema adapter for the appointments table ----
// The DB columns are `appointment_date` / `appointment_time`, but the entire UI
// reads `date` / `time`. Map at the supabase boundary so the in-memory shape stays
// stable and we don't have to touch every component.
const fromDbAppt = (row, patientProfile = null) => {
  if (!row) return row;
  const patient = Array.isArray(row.patient) ? row.patient[0] : row.patient;
  const clinic = Array.isArray(row.clinic) ? row.clinic[0] : row.clinic;
  const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment;

  return {
    ...row,
    patient,
    clinic,
    payment,
    patient_profile: patientProfile,
    patient_name: patient?.full_name || row.patient_name || patientProfile?.full_name || null,
    patient_phone: patient?.phone || patient?.phone_number || row.patient_phone || patientProfile?.phone_number || null,
    patient_email: patient?.email || row.patient_email || patientProfile?.email || null,
    consultation_fee: payment?.consultation_fee ?? row.consultation_fee ?? row.fee ?? null,
    paid_amount: payment?.paid_amount ?? row.paid_amount ?? (row.paid ? row.fee : 0),
    payment_status: payment?.payment_status ?? row.payment_status ?? (row.paid ? 'paid' : null),
    payment_method: payment?.payment_method ?? row.payment_method ?? null,
    payment_currency: payment?.currency ?? row.payment_currency ?? clinic?.currency ?? null,
    date: row.date ?? row.appointment_date,
    time: row.time ?? row.appointment_time,
    booking_code: row.booking_code ?? row.bookingCode ?? '',
    completed_at: row.completed_at ?? null,
  };
};

const hydrateAppointments = async (rows = []) => {
  const authUserIds = Array.from(new Set(rows
    .map(row => {
      const patient = Array.isArray(row.patient) ? row.patient[0] : row.patient;
      return patient?.auth_user_id;
    })
    .filter(Boolean)
    .map(String)));

  const profileById = new Map();
  if (authUserIds.length) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone_number, email')
      .in('id', authUserIds);
    if (error) {
      console.warn('appointment patient profile fallback error:', error.message);
    } else {
      (data || []).forEach(profile => profileById.set(String(profile.id), profile));
    }
  }

  return rows.map(row => {
    const patient = Array.isArray(row.patient) ? row.patient[0] : row.patient;
    const profile = patient?.auth_user_id ? profileById.get(String(patient.auth_user_id)) : null;
    return fromDbAppt(row, profile || null);
  });
};

const fetchAppointmentsWithPatients = async (clinicDoctorIds = null) => {
  if (clinicDoctorIds && clinicDoctorIds.length === 0) {
    return { data: [], error: null };
  }

  let query = supabase
    .from('appointments')
    .select(APPOINTMENTS_WITH_PATIENT_SELECT)
    .order('appointment_date', { ascending: false });

  if (clinicDoctorIds) {
    query = query.in('doctor_id', clinicDoctorIds);
  }

  const { data, error } = await query;
  if (error) return { data: null, error };

  return { data: await hydrateAppointments(data || []), error: null };
};

const fetchAppointmentWithPatient = async (id) => {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENTS_WITH_PATIENT_SELECT)
    .eq('id', id)
    .single();
  if (error) return { data: null, error };
  const [hydrated] = await hydrateAppointments(data ? [data] : []);
  return { data: hydrated || null, error: null };
};

const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'approved', 'in_progress', 'confirmed'];

const sortNotifications = (list = []) =>
  [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

const fetchNotificationsForUser = (uid) =>
  supabase.from('notifications').select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(50);

const formatSupabaseError = (error) => {
  if (!error) return 'Unknown Supabase error';
  return [
    error.message,
    error.code ? `code=${error.code}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null,
  ].filter(Boolean).join(' | ');
};

const STAFF_ROLES = ['super_admin', 'clinic_admin', 'employee', 'doctor'];
const DISABLED_STATUSES = ['suspended', 'inactive', 'disabled'];
const PROFILE_AUTH_SELECT = 'id, full_name, email, phone_number, role, clinic_id, status, must_change_password';

const isDisabledStatus = (status) =>
  DISABLED_STATUSES.includes(String(status || '').trim().toLowerCase());

const decodeJwtPayload = (token) => {
  try {
    const payload = token?.split('.')?.[1];
    if (!payload) return {};
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
};

const canonicalUserFromSessionProfile = (sessionUser, profile, clinicActive = true) => {
  const role = String(profile?.role || 'patient').trim().toLowerCase();
  return {
    id: sessionUser.id,
    name: profile?.full_name || sessionUser.email,
    full_name: profile?.full_name || '',
    email: profile?.email || sessionUser.email,
    phone: profile?.phone_number || '',
    role,
    clinic_id: profile?.clinic_id || null,
    status: profile?.status || 'active',
    must_change_password: Boolean(profile?.must_change_password),
    clinic_active: clinicActive,
  };
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState(null);
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

  const clearSessionState = useCallback(() => {
    clearStoredUser();
    setUser(null);
    setDoctors([]);
    setAppointments([]);
    setPatients([]);
    setNotifications([]);
    setMyPatientIds([]);
    clinicDoctorIdsRef.current = null;
  }, []);

  const refreshAuthProfile = useCallback(async (sessionOverride = null, options = {}) => {
    const { setLoadingState = true, allowTokenRefresh = true } = options;
    if (setLoadingState) setAuthLoading(true);
    try {
      let session = sessionOverride || (await supabase.auth.getSession()).data?.session;
      if (!session?.user?.id) {
        clearSessionState();
        return null;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select(PROFILE_AUTH_SELECT)
        .eq('id', session.user.id)
        .single();
      if (error || !profile) {
        console.error('Canonical profile load failed:', error);
        clearSessionState();
        return null;
      }

      const role = String(profile.role || 'patient').trim().toLowerCase();
      const claims = decodeJwtPayload(session.access_token);
      const claimRole = String(claims.user_role || '').trim().toLowerCase();
      const claimClinicId = claims.clinic_id ? String(claims.clinic_id) : null;
      const profileClinicId = profile.clinic_id ? String(profile.clinic_id) : null;
      const tokenClaimsAreStale =
        (role && claimRole && claimRole !== role)
        || (role !== 'patient' && !claimRole)
        || (profileClinicId !== claimClinicId && role !== 'super_admin');

      if (allowTokenRefresh && tokenClaimsAreStale) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('Auth token refresh failed after profile change:', refreshError);
          await supabase.auth.signOut();
          clearSessionState();
          return null;
        }
        if (refreshed?.session) {
          session = refreshed.session;
        }
      }

      let clinicActive = true;
      if (STAFF_ROLES.includes(role) && role !== 'super_admin' && profile.clinic_id) {
        const { data: clinic, error: clinicError } = await supabase
          .from('clinics')
          .select('is_active')
          .eq('id', profile.clinic_id)
          .single();
        if (clinicError) {
          console.warn('Clinic status check failed:', clinicError.message);
        }
        clinicActive = clinic?.is_active !== false;
      }

      const canonicalUser = canonicalUserFromSessionProfile(session.user, profile, clinicActive);
      if (isDisabledStatus(canonicalUser.status) || !canonicalUser.clinic_active) {
        setAuthNotice(!canonicalUser.clinic_active ? 'clinic_disabled' : 'account_disabled');
        await supabase.auth.signOut();
        clearSessionState();
        return null;
      }

      setAuthNotice(null);
      setUser(canonicalUser);
      setStoredUser(canonicalUser);
      return canonicalUser;
    } catch (err) {
      console.error('Secure auth profile refresh failed:', err);
      clearSessionState();
      return null;
    } finally {
      if (setLoadingState) setAuthLoading(false);
    }
  }, [clearSessionState]);

  // Fetch initial data from Supabase
  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) {
      const clearTimer = setTimeout(() => {
        setDoctors([]);
        setAppointments([]);
        setPatients([]);
        setNotifications([]);
        setMyPatientIds([]);
        clinicDoctorIdsRef.current = null;
        setLoading(false);
      }, 0);
      return () => clearTimeout(clearTimer);
    }

    const fetchData = async () => {
      setLoading(true);
      // Clear the previous user's appointments immediately so a clinic switch never shows
      // stale cross-clinic rows while the new scoped fetch is in flight.
      setAppointments([]);
      const currentUser = user;

      if (isDemoModeEnabled(currentUser)) {
        const demoDoctors = getDemoDoctors();
        setDoctors(demoDoctors);
        setPatients(getDemoPatients());
        setAppointments(getDemoAppointments().map(fromDbAppt));
        setMyPatientIds([]);
        clinicDoctorIdsRef.current = null;
        setLoading(false);
        return;
      }

      const isSuperAdmin = currentUser?.role === 'super_admin';
      const isStaff = currentUser?.role &&
        STAFF_ROLES.includes(currentUser.role);

      // Resolve the staff member's clinic_id reliably.
      // The profile in memory has already been reloaded from Supabase; if a
      // staff clinic is still missing, use a fresh profile lookup as a safe fallback.
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
        let docQuery = supabase.from('doctors').select('*');
        if (staffClinicId) {
          docQuery = docQuery.eq('clinic_id', staffClinicId);
        }
        const { data: docs, error: docError } = await docQuery;
        if (docError) {
          console.warn("doctors table error:", docError.message);
          setDoctors([]);
        } else {
          setDoctors((docs || []).map(d => ({
            ...d,
            name: d.full_name || d.name,
            nameAr: d.full_name || d.nameAr,
            avatar: (d.full_name || '?').charAt(0).toUpperCase(),
            available: true,
            nextSlot: 'Available',
          })));
        }

        // Build the set of doctor IDs that belong to this clinic.
        // appointments has no clinic_id column — isolation goes via doctor_id → doctors.clinic_id.
        // Use (docs || []) so that a failed doctor fetch → empty array (safe) not null (no filter).
        const clinicDoctorIds = staffClinicId
          ? (docs || []).map(d => String(d.id))
          : null; // null = no restriction (super_admin / patient)

        // Persist in ref so the Realtime callback uses the same filter.
        clinicDoctorIdsRef.current = clinicDoctorIds;

        const { data: apts, error: aptError } = await fetchAppointmentsWithPatients(clinicDoctorIds);

        if (aptError) {
          console.warn("appointments fetch error:", aptError.message);
          setAppointments([]);
        } else {
          // Map DB columns → UI shape and attach patients via appointments.patient_id → patients.id.
          setAppointments(scopeToClinic(apts || [], clinicDoctorIds));
        }

        // Fetch Patients — staff (non-super_admin) see only their clinic's patient records.
        // Medical history/files/appointments are keyed to public.patients.id, not profiles.id.
        let patQuery = supabase.from('patients').select('*').order('created_at', { ascending: false });
        if (staffClinicId) {
          patQuery = patQuery.eq('clinic_id', staffClinicId);
        }
        const { data: pats, error: patError } = await patQuery;
        if (patError) {
          console.warn("patients fetch error:", patError.message);
          setPatients([]);
        } else {
          setPatients(pats || []);
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

        fetchAppointmentsWithPatients(ids).then(({ data, error }) => {
          if (error) {
            console.warn("appointments realtime refresh error:", error.message);
            return;
          }
          setAppointments(scopeToClinic(data || [], ids));
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Re-run on login/logout/clinic switch. React Router navigation does NOT remount the
    // provider, so without these deps the scope ref + appointments stay stale and a newly
    // logged-in clinic would see the previous session's appointments.
  }, [authLoading, user]);

  const refreshNotifications = useCallback(async () => {
    try {
      if (isDemoModeEnabled(user)) {
        const demoNotifications = getDemoNotifications();
        setNotifications(demoNotifications);
        return demoNotifications;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setNotifications([]);
        return [];
      }

      const { data, error } = await fetchNotificationsForUser(authUser.id);
      if (error) {
        console.warn('notifications fetch error:', error.message);
        setNotifications([]);
        return [];
      }

      const next = data || [];
      setNotifications(next);
      return next;
    } catch (err) {
      console.warn('notifications load failed:', err);
      setNotifications([]);
      return [];
    }
  }, [user]);

  // Sync with Supabase Auth. Browser storage is never used to authorize; every
  // startup and auth event is resolved through the active Supabase session and
  // the canonical public.profiles row.
  useEffect(() => {
    let active = true;

    const boot = async () => {
      setAuthLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        await refreshAuthProfile(session, { setLoadingState: false });
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    boot();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setAuthLoading(false);
        clearSessionState();
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setAuthLoading(true);
        setTimeout(() => {
          refreshAuthProfile(session, {
            setLoadingState: true,
            allowTokenRefresh: event !== 'TOKEN_REFRESHED',
          });
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [clearSessionState, refreshAuthProfile]);

  useEffect(() => {
    if (!user?.id || authLoading) return undefined;

    const channel = supabase
      .channel(`profile-auth:${user.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => {
          refreshAuthProfile(null, { setLoadingState: true });
        })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, refreshAuthProfile, user?.id]);

  // ---- Notifications: real DB-driven, scoped per user (RLS returns only user_id = auth.uid) ----
  // Replaces the old mock notifications. Each user — patient, doctor, admin — only ever
  // receives their own rows. Realtime keeps the bell live without a refresh.
  useEffect(() => {
    let active = true;
    let channel;

    const load = async () => {
      try {
        if (isDemoModeEnabled(user)) {
          if (active) setNotifications(getDemoNotifications());
          return;
        }

        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { if (active) setNotifications([]); return; }

        const { data, error } = await fetchNotificationsForUser(authUser.id);
        if (!active) return;
        if (error) { console.warn('notifications fetch error:', error.message); setNotifications([]); }
        else setNotifications(data || []);

        channel = supabase
          .channel(`notifications:${authUser.id}`)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${authUser.id}` },
            (payload) => {
              if (!active || !payload.new) return;
              setNotifications(prev => sortNotifications(mergeById([payload.new], prev)));
            })
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${authUser.id}` },
            (payload) => {
              if (!active || !payload.new) return;
              setNotifications(prev => sortNotifications(mergeById([payload.new], prev)));
            })
          .on('postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${authUser.id}` },
            (payload) => {
              if (!active || !payload.old?.id) return;
              setNotifications(prev => prev.filter(n => String(n.id) !== String(payload.old.id)));
            })
          .subscribe();
      } catch (err) {
        console.warn('notifications load failed:', err);
        if (active) setNotifications([]);
      }
    };

    load();
    return () => { active = false; if (channel) supabase.removeChannel(channel); };
  }, [user]);

  const login = async () => {
    return refreshAuthProfile(null, { setLoadingState: true });
  };

  const logout = async () => {
    if (!isDemoModeEnabled(user)) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    }
    clearSessionState();
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
    if (isDemoModeEnabled(user)) {
      const ui = {
        id: `demo-doctor-${Date.now()}`,
        clinic_id: 'demo-clinic',
        ...doctorData,
        name: doctorData.full_name,
        nameAr: doctorData.full_name,
        avatar: (doctorData.full_name || '?').charAt(0).toUpperCase(),
        available: true,
        nextSlot: 'Available',
      };
      setDoctors(prev => [ui, ...prev]);
      return ui;
    }

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
    return ui;
  };

  const deleteDoctor = async (id) => {
    if (isDemoModeEnabled(user)) {
      setDoctors(prev => prev.filter(d => String(d.id) !== String(id)));
      return;
    }

    // Only super_admin may delete doctors. This is enforced again at the DB by the
    // `doctors_delete` RLS policy — the guard here just fails fast with a clear error
    // instead of silently issuing a delete the database will reject.
    if (user?.role !== 'super_admin') {
      throw new Error(i18n.language === 'ar'
        ? 'غير مصرح: حذف الأطباء متاح للمشرف العام فقط'
        : 'Not authorized: only super admin can delete doctors');
    }
    setDoctors(prev => prev.filter(d => String(d.id) !== String(id)));
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

    const isAr = i18n.language === 'ar';
    const checkedName = validatePersonName(patient_name, { isAr });
    if (!checkedName.valid) {
      throw new Error(checkedName.error);
    }
    const checkedPhone = validateIraqiPhone(patient_phone, { isAr });
    if (!checkedPhone.valid) {
      throw new Error(checkedPhone.error);
    }

    const normalizedPatientName = checkedName.value;
    const normalizedPatientPhone = checkedPhone.value;

    if (isDemoModeEnabled(user)) {
      // eslint-disable-next-line react-hooks/purity
      const demoStamp = Date.now();
      const demoRow = {
        id: `DEMO-${demoStamp}`,
        clinic_id: clinic_id || 'demo-clinic',
        patient_name: normalizedPatientName,
        patient_phone: normalizedPatientPhone,
        patient_email,
        patient: normalizedPatientName,
        doctor_id,
        doctorId: doctor_id,
        date,
        time,
        appointment_date: date,
        appointment_time: time,
        status: status || 'pending',
        paid: !!paid,
        payment_method: payment_method || null,
        fee: Number(fee) || 0,
        booking_code: `DEMO-${String(demoStamp).slice(-6)}`,
      };
      addDemoAppointment(demoRow);
      setAppointments(prev => [demoRow, ...prev]);
      return demoRow;
    }

    const patientId = await ensurePatientForClinic({
      clinic_id, full_name: normalizedPatientName, phone: normalizedPatientPhone, email: patient_email,
    });

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: patientRows, error: patientRowsErr } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', authUser.id);
      if (patientRowsErr) throw patientRowsErr;
      const patientIds = (patientRows || []).map(p => p.id).filter(Boolean);
      if (patientIds.length) {
        const { data: activeRows, error: activeErr } = await supabase
          .from('appointments')
          .select('id,status')
          .in('patient_id', patientIds)
          .in('status', ACTIVE_APPOINTMENT_STATUSES)
          .limit(1);
        if (activeErr) throw activeErr;
        if ((activeRows || []).length > 0) {
          throw new Error(i18n.language === 'ar'
            ? 'لديك موعد نشط بالفعل. يرجى الانتظار حتى تكتمل زيارتك الحالية.'
            : 'You already have an active appointment. Please wait until your current visit is completed.');
        }
      }
    }

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
    if (error) {
      const isSlotConflict = error.code === '23505'
        || (error.message || '').includes('appointments_doctor_active_slot_uniq')
        || (error.message || '').includes('appointments_doctor_slot_uniq');
      const isActiveAppointmentConflict = error.code === '23514'
        || (error.message || '').includes('patient already has an active appointment');
      const isRateLimit = error.code === '23514'
        && (error.message || '').includes('booking rate limit exceeded');
      if (isRateLimit) {
        throw new Error(i18n.language === 'ar'
          ? 'يرجى الانتظار دقيقة قبل إرسال طلب حجز جديد.'
          : 'Please wait one minute before submitting another booking request.');
      }
      if (isActiveAppointmentConflict) {
        throw new Error(i18n.language === 'ar'
          ? 'لديك موعد نشط بالفعل. يرجى الانتظار حتى تكتمل زيارتك الحالية.'
          : 'You already have an active appointment. Please wait until your current visit is completed.');
      }
      if (isSlotConflict) {
        throw new Error(i18n.language === 'ar'
          ? 'عذراً، تم حجز هذا الموعد قبل لحظات.\nيرجى اختيار وقت آخر.'
          : 'Sorry, this appointment was just booked. Please choose another time.');
      }
      throw error;
    }

    // Reflect immediately in state with the UI shape (date/time aliases). The
    // realtime channel will re-fetch in a moment, but this avoids a visible lag.
    const uiRow = fromDbAppt({
      ...data,
      patient_name: normalizedPatientName,
      patient_phone: normalizedPatientPhone,
      patient_email,
      patient: {
        id: patientId,
        clinic_id,
        auth_user_id: null,
        full_name: normalizedPatientName,
        phone: normalizedPatientPhone,
        email: patient_email,
      },
    });
    setAppointments(prev => scopeToClinic([uiRow, ...prev], clinicDoctorIdsRef.current));

    // Notify the booked doctor (best-effort — only works if the doctor row has a
    // linked profile_id and the new notif RLS policy 0005 admits this insert).
    const doc = doctors.find(d => String(d.id) === String(doctor_id));
    if (doc?.profile_id) {
      const ar = i18n.language === 'ar';
      await sendNotification(
        doc.profile_id,
        ar ? 'طلب موعد جديد' : 'New appointment request',
        ar ? `${normalizedPatientName || 'مريض'} طلب موعداً بتاريخ ${date}`
           : `${normalizedPatientName || 'A patient'} requested an appointment on ${date}`,
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
    if (status === 'completed') {
      throw new Error('Use completeAppointmentWithPayment to complete appointments with payment recording.');
    }

    const apt = appointments.find(a => String(a.id) === String(id));
    if (!apt) throw new Error('Appointment not found');

    const normalizedStatus = status === 'confirmed' ? 'approved' : status;

    if (user?.role === 'patient' && normalizedStatus !== 'cancelled') {
      throw new Error('Patients cannot approve or reject appointments');
    }

    if (user?.role === 'doctor') {
      const doctor = doctors.find(d => String(d.id) === String(apt.doctor_id));
      if (String(doctor?.profile_id || '') !== String(user?.id || '')) {
        throw new Error('Doctors can only update appointments assigned to them');
      }
    }

    if (isDemoModeEnabled(user)) {
      updateDemoAppointmentStatus(id, normalizedStatus);
      setAppointments(prev => prev.map(a => String(a.id) === String(id) ? { ...a, status: normalizedStatus } : a));
      return;
    }

    const updateRow = { status: normalizedStatus };
    if (normalizedStatus === 'approved') {
      updateRow.approved_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('appointments')
      .update(updateRow)
      .eq('id', id)
      .select('id,status,approved_at')
      .single();

    if (error) {
      const formatted = formatSupabaseError(error);
      console.error('appointments status update failed', { id, status: normalizedStatus, error });
      throw new Error(`Appointment status update failed: ${formatted}`);
    }

    if (!data?.id || data.status !== normalizedStatus) {
      throw new Error('Appointment status update failed: no persisted appointment row was returned');
    }

    const { data: refreshed, error: refreshError } = await fetchAppointmentWithPatient(id);
    if (refreshError) {
      const formatted = formatSupabaseError(refreshError);
      console.error('appointments status refresh failed', { id, error: refreshError });
      throw new Error(`Appointment updated, but refresh failed: ${formatted}`);
    }

    setAppointments(prev => scopeToClinic(prev.map(a => String(a.id) === String(id) ? refreshed : a), clinicDoctorIdsRef.current));

    // Notify the patient when staff approve / reject their request (best-effort).
    if (normalizedStatus === 'approved' || normalizedStatus === 'rejected') {
      const uid = await resolvePatientUserId(refreshed || apt);
      if (uid) {
        const ar = i18n.language === 'ar';
        const ok = normalizedStatus === 'approved';
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
          { clinic_id: refreshed?.clinic_id || apt?.clinic_id },
        );
      }
    }

    return refreshed;
  };

  const completeAppointmentWithPayment = async (id, paymentInput = {}) => {
    const apt = appointments.find(a => String(a.id) === String(id));
    if (!apt) throw new Error('Appointment not found');

    if (isDemoModeEnabled(user)) {
      const payment = {
        id: `demo-payment-${Date.now()}`,
        appointment_id: id,
        clinic_id: apt.clinic_id,
        patient_id: apt.patient_id,
        doctor_id: apt.doctor_id,
        consultation_fee: Number(paymentInput.consultation_fee) || 0,
        paid_amount: Number(paymentInput.paid_amount) || 0,
        payment_status: paymentInput.payment_status || 'unpaid',
        payment_method: paymentInput.payment_method || null,
        currency: paymentInput.currency || 'IQD',
        note: paymentInput.note || null,
        paid_at: Number(paymentInput.paid_amount) > 0 ? new Date().toISOString() : null,
        recorded_by: user?.id || null,
        created_at: new Date().toISOString(),
      };
      const updated = fromDbAppt({
        ...apt,
        status: 'completed',
        completed_at: new Date().toISOString(),
        fee: payment.consultation_fee,
        paid: payment.paid_amount > 0,
        payment_method: payment.payment_method,
        payment,
      });
      updateDemoAppointmentStatus(id, 'completed');
      setAppointments(prev => scopeToClinic(prev.map(a => String(a.id) === String(id) ? updated : a), clinicDoctorIdsRef.current));
      return { appointment: updated, payment };
    }

    const { data, error } = await supabase.rpc('complete_appointment_with_payment', {
      p_appointment_id: id,
      p_consultation_fee: Number(paymentInput.consultation_fee),
      p_paid_amount: Number(paymentInput.paid_amount),
      p_payment_status: paymentInput.payment_status,
      p_payment_method: paymentInput.payment_method || null,
      p_note: paymentInput.note || null,
      p_currency: paymentInput.currency || null,
    });

    if (error) {
      throw new Error(formatSupabaseError(error));
    }

    const payload = Array.isArray(data) ? data[0] : data;
    const appointmentRow = payload?.appointment || {};
    const paymentRow = payload?.payment || null;
    const updated = fromDbAppt({
      ...apt,
      ...appointmentRow,
      payment: paymentRow,
      patient: apt.patient,
      clinic: apt.clinic,
    }, apt.patient_profile || null);

    setAppointments(prev => scopeToClinic(prev.map(a => String(a.id) === String(id) ? updated : a), clinicDoctorIdsRef.current));
    return { appointment: updated, payment: paymentRow, already_recorded: !!payload?.already_recorded };
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
      const row = { ...record };
      if (!row.clinic_id && user?.clinic_id) row.clinic_id = user.clinic_id;
      const { data, error } = await supabase.from('medical_history').insert([row]).select().single();
      if (error) { console.error(error); return null; }
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const addMedicalFile = async (record) => {
    try {
      const row = { ...record };
      if (!row.clinic_id && user?.clinic_id) row.clinic_id = user.clinic_id;
      const { data, error } = await supabase.from('medical_files').insert([row]).select().single();
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
    if (isDemoModeEnabled(user)) {
      setNotifications(prev => sortNotifications([{
        id: `demo-notification-${Date.now()}`,
        user_id: userId,
        title,
        message,
        type,
        is_read: false,
        created_at: new Date().toISOString(),
      }, ...prev]));
      return true;
    }
    try {
      const row = { user_id: userId, title, message, type, is_read: false };
      const cid = opts.clinic_id ?? user?.clinic_id;
      if (cid) row.clinic_id = cid;
      if (opts.prescription_id) row.prescription_id = opts.prescription_id;
      const { error } = await supabase.from('notifications').insert([row]);
      if (error) { console.warn('notification insert failed:', error.message); return false; }
      return true;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  // Doctor/staff creates a prescription → saved to the patient's account + notified.
  // medicines is a JSON array: [{ name, dosage, instructions }].
  //
  // prescriptions.patient_id follows the table's RLS contract: it is the patient's
  // auth/profile UUID (auth.uid()), not the clinic-scoped patients.id row.
  const createPrescription = async (rx) => {
    const patientUserId = rx.patient_user_id || rx.patient_id;
    if (!patientUserId) {
      throw new Error('Cannot create prescription: patient account is not linked to an auth user');
    }

    const row = {
      clinic_id: rx.clinic_id || user?.clinic_id || null,
      patient_id: patientUserId,
      doctor_id: rx.doctor_id || null,
      diagnosis: rx.diagnosis || '',
      medicines: rx.medicines || [],
      instructions: rx.instructions || '',
      prescribed_date: rx.prescribed_date || new Date().toISOString().slice(0, 10),
    };

    if (!row.clinic_id) {
      throw new Error('Cannot create prescription: missing clinic_id');
    }
    if (user?.role !== 'super_admin' && user?.clinic_id && String(user.clinic_id) !== String(row.clinic_id)) {
      throw new Error('Cannot create prescription: patient clinic does not match the logged-in clinic');
    }

    const { data, error } = await supabase.from('prescriptions').insert([row]).select().single();
    if (error) {
      const formatted = formatSupabaseError(error);
      console.error('Prescription insert failed', { error, row });
      throw new Error(`Prescription insert failed: ${formatted}`);
    }
    console.info('prescription inserted', data);

    if (!data?.id) {
      throw new Error('Prescription notification skipped: inserted prescription id is missing');
    }

    const notificationRow = {
      user_id: patientUserId,
      clinic_id: row.clinic_id,
      title: 'تم إصدار وصفة طبية جديدة',
      message: 'تم إصدار وصفة طبية جديدة لك من العيادة',
      type: 'prescription_created',
      is_read: false,
      prescription_id: data.id,
    };

    console.info('before notification insert', notificationRow);
    const { error: notifError } = await supabase
      .from('notifications')
      .insert([notificationRow]);

    if (notifError) {
      const formatted = formatSupabaseError(notifError);
      console.error('notification insert failed', {
        error: notifError,
        payload: notificationRow,
      });
      throw new Error(`Prescription notification insert failed: ${formatted}`);
    }

    console.info('after notification insert');

    return data;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const supportUnreadCount = notifications.filter(n =>
    !n.is_read && SUPPORT_NOTIFICATION_TYPES.includes(n.type)
  ).length;

  return (
    <AppContext.Provider value={{
      user, login, logout, authLoading, authNotice, refreshAuthProfile,
      doctors, appointments, patients, myPatientIds, loading, specialties,
      createAppointment, changeStatus, completeAppointmentWithPayment,
      addDoctor, deleteDoctor,
      addMedicalHistory, addMedicalFile, sendNotification, createPrescription,
      notifications, refreshNotifications, readAllNotifications, markNotificationRead, markAllNotificationsRead, unreadCount, supportUnreadCount,
    }}>
      {children}
    </AppContext.Provider>
  );
};
