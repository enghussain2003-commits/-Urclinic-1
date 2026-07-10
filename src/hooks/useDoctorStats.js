/**
 * useDoctorStats — per-doctor analytics hook.
 *
 * Receives data from AppContext (no duplicate fetches).
 * Resolves the logged-in doctor's row by profile_id OR email match.
 * All stats are scoped strictly to myDoctorId — nothing leaks across doctors.
 */
import { useMemo } from 'react';

const isoToday = () => new Date().toISOString().slice(0, 10);
const VOID = ['cancelled', 'rejected'];

// Patient identity key (appointments carry no patients.id for legacy bookings)
const patientKey = a => a.patient_phone || a.patient_name || String(a.id);

/**
 * Builds weekly appointment counts for the last N weeks.
 * Returns [{ label: 'W1', count: N }]
 */
const buildWeeklyData = (appointments, weeksBack = 8) => {
  const weeks = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const endD   = new Date(); endD.setDate(endD.getDate() - i * 7);
    const startD = new Date(endD); startD.setDate(endD.getDate() - 6);
    const isoEnd   = endD.toISOString().slice(0, 10);
    const isoStart = startD.toISOString().slice(0, 10);
    const count = appointments.filter(a => {
      const d = a.date || '';
      return d >= isoStart && d <= isoEnd && !VOID.includes(a.status);
    }).length;
    weeks.push({ label: `W${weeksBack - i}`, count });
  }
  return weeks;
};

/**
 * @param {object} params
 * @param {Array}  params.appointments From AppContext.
 * @param {Array}  params.doctors      From AppContext.
 * @param {Array}  params.patients     From AppContext.
 * @param {object} params.user         Logged-in user from AppContext.
 */
export const useDoctorStats = ({ appointments = [], doctors = [], patients = [], user } = {}) => {

  // Resolve the doctors table row for the logged-in doctor
  const myDoctorRow = useMemo(() =>
    doctors.find(d =>
      String(d.profile_id) === String(user?.id) ||
      (d.email && user?.email && d.email === user.email)
    ),
    [doctors, user]
  );

  const myDoctorId = myDoctorRow ? String(myDoctorRow.id) : null;

  // All appointments belonging to this doctor only
  const myAppointments = useMemo(() =>
    myDoctorId
      ? appointments.filter(a => String(a.doctor_id) === myDoctorId)
      : [],
    [appointments, myDoctorId]
  );

  const stats = useMemo(() => {
    const today     = isoToday();
    const thisMonth = today.slice(0, 7);

    const todayAppts  = myAppointments.filter(a => a.date === today);
    const activeToday = todayAppts.filter(a => !VOID.includes(a.status));

    // Stats
    const completedToday = todayAppts.filter(a => a.status === 'completed').length;
    const waitingToday   = todayAppts.filter(a => ['pending', 'confirmed', 'in_progress'].includes(a.status)).length;

    const patientsThisMonth = new Set(
      myAppointments
        .filter(a => a.date?.startsWith(thisMonth) && !VOID.includes(a.status))
        .map(patientKey)
    ).size;

    // Today's schedule sorted by time
    const todayList = [...activeToday]
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    // Weekly chart data
    const weeklyData = buildWeeklyData(myAppointments, 8);

    // Recent unique patients (latest appointment per patient)
    const patientMap = new Map();
    myAppointments.forEach(a => {
      const k = patientKey(a);
      if (!k) return;
      const cur = patientMap.get(k);
      if (!cur || (a.date || '') > (cur.lastDate || '')) {
        patientMap.set(k, {
          name:     a.patient_name  || '-',
          phone:    a.patient_phone || '',
          lastDate: a.date || '',
        });
      }
    });
    const recentPatients = [...patientMap.values()]
      .map(p => {
        const prof = patients.find(pt =>
          (pt.phone_number && pt.phone_number === p.phone) ||
          (pt.phone        && pt.phone        === p.phone) ||
          (pt.full_name    && pt.full_name    === p.name)
        );
        return { ...p, profileId: prof?.id || null };
      })
      .sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''))
      .slice(0, 6);

    // Upcoming (after today)
    const upcoming = [...myAppointments]
      .filter(a => a.date > today && !VOID.includes(a.status))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
      .slice(0, 5);

    return {
      todayTotal:          activeToday.length,
      completedToday,
      waitingToday,
      patientsThisMonth,
      todayList,
      weeklyData,
      recentPatients,
      upcoming,
      myDoctorId,
      myDoctorRow,
      totalAppointments:   myAppointments.length,
      completedAll:        myAppointments.filter(a => a.status === 'completed').length,
    };
  }, [myAppointments, myDoctorId, myDoctorRow, patients]);

  return stats;
};
