/**
 * Activity Service — abstracts the data source for the Recent Activity feed.
 *
 * Current source : `notifications` table (Supabase).
 * Future source  : `audit_log` table — swap THIS FILE ONLY; UI components stay unchanged.
 *
 * ActivityItem shape:
 *   { id, type, title, description, timestamp, actor }
 */
import { supabase } from '../supabaseClient';

// ── Source table ───────────────────────────────────────────────────────────────
// When migrating to audit_log, update SOURCE_TABLE and the field mapping below.
const SOURCE_TABLE = 'notifications';

/**
 * Fetch recent activity items (normalized ActivityItem[]).
 *
 * @param {object} opts
 * @param {string}  [opts.userId]   Filter to a specific user's activity.
 * @param {number}  [opts.limit=7]  Maximum items to return.
 * @returns {{ data: ActivityItem[], error: string|null }}
 */
export const fetchRecentActivity = async ({ userId, limit = 7 } = {}) => {
  try {
    let query = supabase
      .from(SOURCE_TABLE)
      .select('id, title, message, type, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };

    // Normalize → ActivityItem  (UI never depends on raw DB shape)
    const normalized = (data || []).map(row => ({
      id:          row.id,
      type:        row.type        || 'info',
      title:       row.title       || '',
      description: row.message     || '',
      timestamp:   row.created_at,
      actor:       row.user_id,
    }));

    return { data: normalized, error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
};
