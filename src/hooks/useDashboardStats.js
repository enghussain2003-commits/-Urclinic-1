/**
 * useDashboardStats — Clinic Admin analytics hook.
 *
 * Design principles:
 *  • Uses appointments/doctors/patients already in AppContext → NO duplicate Supabase calls.
 *  • Fetches ONLY what AppContext doesn't have (employee count + expenses) in parallel (Promise.allSettled).
 *  • Date-range architecture supports Today/Week/Month/Year/Custom — only 'month' is active now.
 *  • Expenses table is optional: expensesAvailable=false → UI shows placeholder, never 0.
 *  • Caching-ready: abortRef pattern prevents stale updates; TTL cache can be added later.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';

// ── Date helpers ──────────────────────────────────────────────────────────────

const isoToday = () => new Date().toISOString().slice(0, 10);

/**
 * Returns { from, to } ISO date strings for a named range.
 * Architecture is open-ended — add cases here for future range support.
 * Only 'today' and 'month' are currently wired to the UI.
 *
 * @param {'today'|'week'|'month'|'year'|'custom'} range
 * @param {{ from?: string, to?: string }} [custom]  Used only when range='custom'.
 */
export const getDateBounds = (range = 'month', custom = {}) => {
  const now = new Date();
  const iso = d => d.toISOString().slice(0, 10);

  switch (range) {
    case 'today':
      return { from: iso(now), to: iso(now) };

    case 'week': {
      const s = new Date(now);
      s.setDate(now.getDate() - 6);
      return { from: iso(s), to: iso(now) };
    }

    case 'year': {
      const s = new Date(now.getFullYear(), 0, 1);
      return { from: iso(s), to: iso(now) };
    }

    case 'custom':
      return { from: custom.from || iso(now), to: custom.to || iso(now) };

    case 'month':
    default: {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: iso(s), to: iso(now) };
    }
  }
};

// ── Chart data builders ───────────────────────────────────────────────────────

/**
 * Builds last-N-months data for line/bar charts.
 * Returns [{ key:'YYYY-MM', label:'Jan', count:N, revenue:N }]
 */
const buildMonthlyData = (appointments, monthsBack = 6) => {
  const result = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key   = d.toISOString().slice(0, 7);                   // 'YYYY-MM'
    const label = d.toLocaleString('default', { month: 'short' }); // 'Jan'
    const monthAppts = appointments.filter(a => (a.date || '').startsWith(key));
    const revenue    = monthAppts
      .filter(a => a.paid && a.status === 'completed')
      .reduce((s, a) => s + (Number(a.fee) || 0), 0);
    result.push({ key, label, count: monthAppts.length, revenue });
  }
  return result;
};

// ── Main hook ─────────────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {Array}  params.appointments  From AppContext.
 * @param {Array}  params.doctors       From AppContext.
 * @param {Array}  params.patients      From AppContext.
 * @param {string} [params.clinicId]    Current clinic id (used to scope extra queries).
 * @param {string} [params.dateRange]   One of: 'today'|'week'|'month'|'year'|'custom'.
 */
export const useDashboardStats = ({
  appointments = [],
  doctors      = [],
  patients     = [],
  clinicId,
  dateRange    = 'month',
} = {}) => {
  const [extraLoading,  setExtraLoading]  = useState(true);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [expensesInfo,  setExpensesInfo]  = useState({
    available: null, // null = still loading; false = table absent; true = loaded
    total:     null,
    items:     [],
  });
  const abortRef = useRef(false);

  // ── Fetch ONLY extra data (employees + expenses) — parallel, non-duplicate ──
  useEffect(() => {
    abortRef.current = false;
    setExtraLoading(true);

    const run = async () => {
      // Employee count query
      let empQ = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'employee');
      if (clinicId) empQ = empQ.eq('clinic_id', clinicId);

      // Expenses query — may fail if table doesn't exist yet
      const expQ = supabase
        .from('expenses')
        .select('amount, date, description, category')
        .order('date', { ascending: false })
        .limit(100);

      // Parallel — allSettled so one failure doesn't block the other
      const [empResult, expResult] = await Promise.allSettled([empQ, expQ]);

      if (abortRef.current) return;

      // Employee count
      setEmployeeCount(
        empResult.status === 'fulfilled' ? (empResult.value?.count ?? 0) : 0
      );

      // Expenses — only mark available=true when table exists AND no error
      if (expResult.status === 'fulfilled' && !expResult.value?.error) {
        const items = expResult.value?.data || [];
        setExpensesInfo({
          available: true,
          total: items.reduce((s, e) => s + (Number(e.amount) || 0), 0),
          items,
        });
      } else {
        // Table missing or RLS denial → not configured
        setExpensesInfo({ available: false, total: null, items: [] });
      }

      setExtraLoading(false);
    };

    run().catch(() => {
      if (!abortRef.current) setExtraLoading(false);
    });

    return () => { abortRef.current = true; };
  }, [clinicId]);

  // ── Derived stats — pure computation, zero Supabase calls ─────────────────
  const stats = useMemo(() => {
    const today           = isoToday();
    const { from, to }    = getDateBounds(dateRange);
    const VOID            = ['cancelled', 'rejected'];

    const inRange  = d  => d && d >= from && d <= to;
    const apptDate = a  => a.date || '';

    const todayAppts  = appointments.filter(a => apptDate(a) === today);
    const rangeAppts  = appointments.filter(a => inRange(apptDate(a)));

    // Revenue in range (paid + completed)
    const totalRevenue = rangeAppts
      .filter(a => a.paid && a.status === 'completed')
      .reduce((s, a) => s + (Number(a.fee) || 0), 0);

    // Net profit only when expenses are configured
    const netProfit = expensesInfo.available === true
      ? totalRevenue - (expensesInfo.total || 0)
      : null;

    // Status distribution (all time — for donut chart)
    const statusCounts = {
      pending:     appointments.filter(a => a.status === 'pending').length,
      confirmed:   appointments.filter(a => a.status === 'confirmed').length,
      in_progress: appointments.filter(a => a.status === 'in_progress').length,
      completed:   appointments.filter(a => a.status === 'completed').length,
      cancelled:   appointments.filter(a => a.status === 'cancelled').length,
      rejected:    appointments.filter(a => a.status === 'rejected').length,
    };

    // Recent payments — real records only (paid=true, fee>0)
    const recentPayments = [...appointments]
      .filter(a => a.paid && Number(a.fee) > 0)
      .sort((a, b) => apptDate(b).localeCompare(apptDate(a)))
      .slice(0, 5);

    return {
      // Counts
      totalPatients:      patients.length,
      totalDoctors:       doctors.length,
      totalEmployees:     employeeCount,
      todayTotal:         todayAppts.filter(a => !VOID.includes(a.status)).length,
      pendingApprovals:   appointments.filter(a => a.status === 'pending').length,
      completedRange:     rangeAppts.filter(a => a.status === 'completed').length,
      cancelledRange:     rangeAppts.filter(a => VOID.includes(a.status)).length,
      rangeTotal:         rangeAppts.filter(a => !VOID.includes(a.status)).length,

      // Financial
      totalRevenue,
      expensesAvailable:  expensesInfo.available,   // null|true|false
      totalExpenses:      expensesInfo.total,        // null when not configured
      netProfit,                                     // null when expenses absent

      // Charts
      monthlyData:        buildMonthlyData(appointments, 6),
      statusCounts,

      // Lists
      recentPayments,
    };
  }, [appointments, doctors, patients, employeeCount, expensesInfo, dateRange]);

  return { stats, loading: extraLoading };
};
