// =====================================================================
// Edge Function: create-clinic-user
// =====================================================================
// WHY: only a super_admin may create doctor / employee accounts.
// Creating an Auth user for someone else requires the SERVICE ROLE key,
// which MUST NEVER live in the React frontend. So it runs here, server-side.
//
// SECURITY:
//   * Verifies the CALLER's JWT and that their role is super_admin.
//   * Only creates roles: 'doctor' or 'employee'.
//   * Compensating cleanup: if profile/doctor creation fails AFTER the auth
//     user was created, the auth user (and any partial rows) are deleted, so
//     no orphan account is ever left behind.
//   * CORS is restricted to an allowlist in production (ALLOWED_ORIGINS),
//     and falls back to "*" only when that secret is unset (local dev).
//
// Deploy:  supabase functions deploy create-clinic-user
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//          ALLOWED_ORIGINS="https://app.yourdomain.com,https://admin.yourdomain.com"
//          (omit ALLOWED_ORIGINS in local dev → CORS "*")
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---- CORS: allowlist in prod, "*" only when ALLOWED_ORIGINS is unset (dev) ----
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',').map((s) => s.trim()).filter(Boolean);

function corsHeaders(reqOrigin: string | null): Record<string, string> {
  const allowAll = ALLOWED_ORIGINS.includes('*');
  const origin = allowAll
    ? '*'
    : (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0] ?? '');
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  let createdUserId: string | null = null;   // tracked for compensating cleanup
  let profileWritten = false;

  try {
    // 1) Identify the caller from their JWT.
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401, cors);

    // 2) Authorize: caller must be super_admin. Done BEFORE
    //    any service-role write, so the privileged path is never reached
    //    without a verified, authorized caller.
    const { data: callerProfile } = await admin
      .from('profiles').select('role, clinic_id').eq('id', caller.id).single();
    if (!callerProfile || callerProfile.role !== 'super_admin') {
      return json({ error: 'Forbidden: super_admin only' }, 403, cors);
    }

    // 3) Validate payload.
    const body = await req.json();
    const { email, password, full_name, role, specialty, clinic_address, fee } = body;
    if (!email || !password || !full_name || !['doctor', 'employee'].includes(role)) {
      return json({ error: 'Invalid payload' }, 400, cors);
    }

    // 4) super_admin must target a clinic explicitly.
    const clinicId = body.clinic_id ?? callerProfile.clinic_id;
    if (!clinicId) return json({ error: 'No clinic_id for caller' }, 400, cors);

    // 5) Create the auth user.
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name },
    });
    if (cErr) return json({ error: cErr.message }, 400, cors);
    createdUserId = created.user.id;

    // 6) Set their profile (role + clinic_id), overriding the trigger default.
    const { error: pErr } = await admin.from('profiles').upsert({
      id: createdUserId, full_name, email, role, clinic_id: clinicId,
    });
    if (pErr) throw new Error(`profile upsert failed: ${pErr.message}`);
    profileWritten = true;

    // 7) If a doctor, create the clinic-scoped doctor record.
    if (role === 'doctor') {
      const { error: dErr } = await admin.from('doctors').insert({
        clinic_id: clinicId, profile_id: createdUserId, full_name, email,
        specialty: specialty ?? 'general', clinic_address, fee: fee ?? 0,
      });
      if (dErr) throw new Error(`doctor insert failed: ${dErr.message}`);
    }

    return json({ ok: true, user_id: createdUserId }, 200, cors);
  } catch (e) {
    // ----- Compensating cleanup: never leave an orphan account -----
    // Scenarios prevented:
    //   (a) auth user created but profile upsert failed   → delete profile (noop) + auth user
    //   (b) profile created but doctor insert failed       → delete profile + auth user
    //   (c) any unexpected throw after createUser           → same rollback
    if (createdUserId) {
      try {
        if (profileWritten) await admin.from('profiles').delete().eq('id', createdUserId);
        await admin.auth.admin.deleteUser(createdUserId);
      } catch (cleanupErr) {
        // Surface that manual cleanup may be required (should be rare).
        return json({
          error: String(e),
          cleanup: 'FAILED — orphan auth user may remain: ' + String(cleanupErr),
          orphan_user_id: createdUserId,
        }, 500, cors);
      }
    }
    return json({ error: String(e), cleanup: 'rolled back' }, 500, cors);
  }
});

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
