import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',').map((s) => s.trim()).filter(Boolean);

const IRAQI_GOVERNORATES = new Set([
  'Baghdad', 'Basra', 'Dhi Qar', 'Maysan', 'Muthanna', 'Qadisiyah', 'Najaf',
  'Karbala', 'Babil', 'Wasit', 'Diyala', 'Anbar', 'Salah al-Din', 'Kirkuk',
  'Nineveh', 'Erbil', 'Sulaymaniyah', 'Duhok', 'Halabja',
]);
const ROLES = new Set(['clinic_admin', 'doctor', 'employee']);
const STATUSES = new Set(['active', 'suspended']);
const DURATIONS = new Set([15, 20, 30, 45, 60]);
const DAY_IDS = new Set(['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']);

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

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const bad = (message: string, status = 400) => ({ message, status });
type DbError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const safeDbError = (error: DbError | null | undefined) => ({
  code: error?.code ?? null,
  message: error?.message ?? null,
  details: error?.details ?? null,
  hint: error?.hint ?? null,
});

function dbFailure(operation: string, error: DbError | null | undefined, publicMessage: string, status = 400) {
  const safe = safeDbError(error);
  console.error('super-admin-management database operation failed', {
    operation,
    code: safe.code,
    message: safe.message,
    details: safe.details,
    hint: safe.hint,
  });
  return {
    message: publicMessage,
    status,
    operation,
    db_error: safe,
  };
}

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireText(value: unknown, label: string) {
  const text = clean(value);
  if (!text) throw bad(`${label} is required`);
  return text;
}

function optionalText(value: unknown) {
  const text = clean(value);
  return text || null;
}

function requireEmail(value: unknown) {
  const email = requireText(value, 'Email').toLowerCase();
  if (!emailRx.test(email)) throw bad('Invalid email');
  return email;
}

function requirePassword(value: unknown) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 8) throw bad('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw bad('Password must include uppercase, lowercase, and number');
  }
  if (/\s/.test(password)) throw bad('Password must not contain whitespace');
  return password;
}

function requirePasswordPair(password: unknown, confirmPassword: unknown) {
  const pwd = requirePassword(password);
  if (pwd !== confirmPassword) throw bad('Passwords do not match');
  return pwd;
}

function normalizeStatus(value: unknown) {
  const status = clean(value) || 'active';
  if (!STATUSES.has(status)) throw bad('Invalid status');
  return status;
}

function normalizeDuration(value: unknown, fallback = 30) {
  const duration = Number(value || fallback);
  if (!DURATIONS.has(duration)) throw bad('Invalid appointment duration');
  return duration;
}

function normalizeFee(value: unknown, fallback = 0) {
  const fee = Number(value ?? fallback);
  if (!Number.isFinite(fee) || fee < 0) throw bad('Invalid fee');
  return fee;
}

function normalizeDays(value: unknown) {
  const days = Array.isArray(value) ? value : ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'];
  const cleaned = days.map((d) => clean(d)).filter(Boolean);
  if (!cleaned.length || cleaned.some((d) => !DAY_IDS.has(d))) throw bad('Invalid working days');
  return cleaned;
}

function clinicPayload(input: Record<string, unknown>, actorId: string, partial = false) {
  const payload: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (!partial || value !== undefined) payload[key] = value;
  };
  set('name', partial ? optionalText(input.name) : requireText(input.name, 'Clinic name'));
  if (!partial || input.governorate !== undefined) {
    const governorate = requireText(input.governorate, 'Governorate');
    if (!IRAQI_GOVERNORATES.has(governorate)) throw bad('Invalid governorate');
    payload.governorate = governorate;
  }
  set('address', partial ? optionalText(input.address) : requireText(input.address, 'Clinic address'));
  set('phone', optionalText(input.phone));
  if (!partial || input.default_consultation_fee !== undefined) {
    payload.default_consultation_fee = normalizeFee(input.default_consultation_fee);
  }
  if (!partial || input.working_days !== undefined) payload.working_days = normalizeDays(input.working_days);
  set('opening_time', clean(input.opening_time || input.open_time || '09:00'));
  set('closing_time', clean(input.closing_time || input.close_time || '17:00'));
  if (!partial || input.appointment_duration !== undefined) {
    payload.appointment_duration = normalizeDuration(input.appointment_duration);
    payload.default_appointment_duration = payload.appointment_duration;
  }
  if (!partial || input.status !== undefined) payload.is_active = normalizeStatus(input.status) === 'active';
  set('logo_url', optionalText(input.logo_url));
  if (!partial) payload.created_by = actorId;
  payload.working_hours = {
    start: payload.opening_time ?? input.opening_time ?? input.open_time ?? '09:00',
    end: payload.closing_time ?? input.closing_time ?? input.close_time ?? '17:00',
  };
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function doctorPayload(input: Record<string, unknown>, clinicId: string, profileId: string | null, partial = false) {
  const payload: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (!partial || value !== undefined) payload[key] = value;
  };
  if (!partial) {
    payload.clinic_id = clinicId;
    payload.profile_id = profileId;
  }
  set('full_name', partial ? optionalText(input.full_name) : requireText(input.full_name, 'Doctor full name'));
  if (!partial || input.email !== undefined) payload.email = requireEmail(input.email);
  set('specialty', partial ? optionalText(input.specialty) : requireText(input.specialty, 'Specialty'));
  set('diagnosis_description', optionalText(input.diagnosis_description));
  set('clinic_address', optionalText(input.clinic_address));
  if (!partial || input.fee !== undefined) payload.fee = normalizeFee(input.fee);
  set('open_time', clean(input.open_time || input.opening_time || '09:00'));
  set('close_time', clean(input.close_time || input.closing_time || '17:00'));
  set('break_start', optionalText(input.break_start));
  set('break_end', optionalText(input.break_end));
  if (!partial || input.work_days !== undefined || input.working_days !== undefined) {
    payload.work_days = normalizeDays(input.work_days ?? input.working_days);
  }
  if (!partial || input.appointment_duration !== undefined) {
    payload.appointment_duration = normalizeDuration(input.appointment_duration);
  }
  if (!partial || input.status !== undefined) payload.is_active = normalizeStatus(input.status) === 'active';
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null));
}

function profilePayload(input: Record<string, unknown>, role: string, clinicId: string, partial = false) {
  const payload: Record<string, unknown> = {};
  if (!partial) {
    payload.role = role;
    payload.clinic_id = clinicId;
  }
  if (!partial || input.full_name !== undefined) payload.full_name = requireText(input.full_name, 'Full name');
  if (!partial || input.email !== undefined) payload.email = requireEmail(input.email);
  if (!partial || input.phone !== undefined || input.phone_number !== undefined) {
    payload.phone_number = optionalText(input.phone ?? input.phone_number);
  }
  if (!partial || input.status !== undefined) payload.status = normalizeStatus(input.status);
  if (!partial || input.must_change_password !== undefined) {
    payload.must_change_password = Boolean(input.must_change_password ?? true);
  }
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

async function emailExists(admin: ReturnType<typeof createClient>, email: string, excludeUserId?: string) {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw bad('Could not validate email uniqueness', 500);
  return (data.users || []).some((user) =>
    user.email?.toLowerCase() === email.toLowerCase() && user.id !== excludeUserId
  );
}

async function audit(admin: ReturnType<typeof createClient>, actor: { id: string; role: string }, action: string, clinicId: string | null, targetUserId: string | null, metadata: Record<string, unknown> = {}) {
  await admin.from('audit_logs').insert({
    actor_user_id: actor.id,
    actor_role: actor.role,
    clinic_id: clinicId,
    target_user_id: targetUserId,
    action_type: action,
    metadata,
  });
}

async function writeManagedProfile(
  admin: ReturnType<typeof createClient>,
  userId: string,
  payload: Record<string, unknown>,
  operation: string,
) {
  // auth.users has an on_auth_user_created trigger that normally inserts a
  // patient profile first. Prefer updating that row to avoid a second insert
  // racing or conflicting with the trigger. If the trigger did not create the
  // profile, fall back to an idempotent upsert by primary key.
  const { data: updatedRows, error: updateError } = await admin
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('id');

  if (updateError) {
    throw dbFailure(operation, updateError, `${operation} failed`);
  }

  if (Array.isArray(updatedRows) && updatedRows.length > 0) {
    return updatedRows[0];
  }

  const { data: upserted, error: upsertError } = await admin
    .from('profiles')
    .upsert({ id: userId, ...payload }, { onConflict: 'id' })
    .select('id')
    .single();

  if (upsertError) {
    throw dbFailure(`${operation}:upsert_fallback`, upsertError, `${operation} failed`);
  }

  return upserted;
}

async function createAuthUser(admin: ReturnType<typeof createClient>, account: Record<string, unknown>) {
  const email = requireEmail(account.email);
  if (await emailExists(admin, email)) throw bad('Email already exists', 409);
  const password = requirePasswordPair(account.password, account.confirm_password);
  const fullName = requireText(account.full_name, 'Full name');
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    console.error('super-admin-management auth operation failed', {
      operation: 'auth.createUser',
      message: error?.message ?? 'No user returned',
      status: error?.status ?? null,
    });
    throw bad(error?.message || 'Auth user creation failed', 400);
  }
  return data.user;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(url, serviceKey);
  const authHeader = req.headers.get('Authorization') ?? '';
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });

  const createdAuthUsers: string[] = [];
  let createdClinicId: string | null = null;

  try {
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401, cors);
    const { data: actorProfile } = await admin.from('profiles').select('id, role, status').eq('id', caller.id).single();
    if (!actorProfile || actorProfile.role !== 'super_admin' || actorProfile.status === 'suspended') {
      return json({ error: 'Forbidden: super_admin only' }, 403, cors);
    }

    const body = await req.json();
    const action = clean(body.action);
    const payload = (body.payload || {}) as Record<string, unknown>;
    const actor = { id: caller.id, role: actorProfile.role };

    if (action === 'provision_clinic') {
      const clinicInput = (payload.clinic || {}) as Record<string, unknown>;
      const adminInput = (payload.clinic_admin || {}) as Record<string, unknown>;
      const doctorInput = (payload.doctor || {}) as Record<string, unknown>;
      const skipDoctor = Boolean(payload.skip_doctor);

      const clinicRow = clinicPayload(clinicInput, caller.id);
      const { data: clinic, error: clinicError } = await admin.from('clinics').insert(clinicRow).select().single();
      if (clinicError || !clinic) {
        throw dbFailure('Clinic creation', clinicError, 'Clinic creation failed', 400);
      }
      createdClinicId = clinic.id;

      const clinicAdmin = await createAuthUser(admin, adminInput);
      createdAuthUsers.push(clinicAdmin.id);
      const adminProfile = {
        ...profilePayload(adminInput, 'clinic_admin', clinic.id),
        must_change_password: true,
      };
      await writeManagedProfile(
        admin,
        clinicAdmin.id,
        adminProfile,
        'Clinic Admin profile creation',
      );

      let doctorUserId: string | null = null;
      let doctorRecordId: string | null = null;
      if (!skipDoctor) {
        const doctor = await createAuthUser(admin, doctorInput);
        createdAuthUsers.push(doctor.id);
        doctorUserId = doctor.id;
        const doctorProfile = {
          ...profilePayload(doctorInput, 'doctor', clinic.id),
          must_change_password: true,
        };
        await writeManagedProfile(
          admin,
          doctor.id,
          doctorProfile,
          'Doctor profile creation',
        );
        const docRow = doctorPayload({
          ...doctorInput,
          clinic_address: clinic.address,
          fee: doctorInput.fee ?? clinic.default_consultation_fee,
          appointment_duration: doctorInput.appointment_duration ?? clinic.appointment_duration ?? clinic.default_appointment_duration,
        }, clinic.id, doctor.id);
        const { data: doctorRecord, error: doctorError } = await admin.from('doctors').insert(docRow).select('id').single();
        if (doctorError || !doctorRecord) {
          throw dbFailure('Doctor record creation', doctorError, 'Doctor record creation failed', 400);
        }
        doctorRecordId = doctorRecord.id;
      }

      await audit(admin, actor, 'clinic_created', clinic.id, null, {
        clinic_name: clinic.name,
        clinic_admin_user_id: clinicAdmin.id,
        doctor_user_id: doctorUserId,
      });

      return json({
        ok: true,
        clinic_id: clinic.id,
        clinic_admin_user_id: clinicAdmin.id,
        doctor_user_id: doctorUserId,
        doctor_record_id: doctorRecordId,
      }, 200, cors);
    }

    if (action === 'create_clinic_user') {
      const clinicId = requireText(payload.clinic_id, 'Clinic ID');
      const role = requireText(payload.role, 'Role');
      if (!ROLES.has(role)) throw bad('Invalid role');
      const { data: clinic, error: clinicLookupError } = await admin.from('clinics').select('id, address, default_consultation_fee, appointment_duration, default_appointment_duration').eq('id', clinicId).single();
      if (clinicLookupError || !clinic) {
        throw dbFailure('Clinic lookup', clinicLookupError, 'Clinic not found', 404);
      }
      const authUser = await createAuthUser(admin, payload);
      createdAuthUsers.push(authUser.id);
      await writeManagedProfile(
        admin,
        authUser.id,
        {
          ...profilePayload(payload, role, clinicId),
          must_change_password: true,
        },
        'Managed profile creation',
      );
      let doctorRecordId: string | null = null;
      if (role === 'doctor') {
        const { data: doctorRecord, error: doctorError } = await admin.from('doctors').insert(doctorPayload({
          ...payload,
          clinic_address: payload.clinic_address ?? clinic.address,
          fee: payload.fee ?? clinic.default_consultation_fee,
          appointment_duration: payload.appointment_duration ?? clinic.appointment_duration ?? clinic.default_appointment_duration,
        }, clinicId, authUser.id)).select('id').single();
        if (doctorError || !doctorRecord) {
          throw dbFailure('Doctor record creation', doctorError, 'Doctor record creation failed', 400);
        }
        doctorRecordId = doctorRecord.id;
      }
      await audit(admin, actor, 'account_created', clinicId, authUser.id, { role });
      return json({ ok: true, user_id: authUser.id, doctor_record_id: doctorRecordId }, 200, cors);
    }

    if (action === 'update_clinic') {
      const clinicId = requireText(payload.clinic_id, 'Clinic ID');
      const updates = clinicPayload(payload, caller.id, true);
      const { error } = await admin.from('clinics').update(updates).eq('id', clinicId);
      if (error) throw dbFailure('Clinic update', error, 'Clinic update failed', 400);
      await audit(admin, actor, 'clinic_updated', clinicId, null, { fields: Object.keys(updates) });
      return json({ ok: true }, 200, cors);
    }

    if (action === 'update_managed_user') {
      const userId = requireText(payload.user_id, 'User ID');
      const { data: profile, error: profileLookupError } = await admin.from('profiles').select('id, role, clinic_id, email').eq('id', userId).single();
      if (profileLookupError || !profile || !ROLES.has(profile.role)) {
        throw dbFailure('Managed profile lookup', profileLookupError, 'Managed user not found', 404);
      }

      const profileUpdates = profilePayload(payload, profile.role, profile.clinic_id, true);
      if (profileUpdates.email && profileUpdates.email !== profile.email) {
        if (await emailExists(admin, String(profileUpdates.email), userId)) throw bad('Email already exists', 409);
        const { error: authEmailError } = await admin.auth.admin.updateUserById(userId, { email: String(profileUpdates.email), email_confirm: true });
        if (authEmailError) throw bad('Auth email update failed', 400);
      }
      const { error: profileError } = await admin.from('profiles').update(profileUpdates).eq('id', userId);
      if (profileError) throw dbFailure('Managed profile update', profileError, 'Profile update failed', 400);

      if (profile.role === 'doctor') {
        const doctorUpdates = doctorPayload(payload, profile.clinic_id, userId, true);
        if (Object.keys(doctorUpdates).length) {
          const { error: doctorError } = await admin.from('doctors').update(doctorUpdates).eq('profile_id', userId);
          if (doctorError) throw dbFailure('Managed doctor update', doctorError, 'Doctor update failed', 400);
        }
      }
      await audit(admin, actor, 'account_updated', profile.clinic_id, userId, { role: profile.role });
      return json({ ok: true }, 200, cors);
    }

    if (action === 'reset_password') {
      const userId = requireText(payload.user_id, 'User ID');
      const password = requirePasswordPair(payload.password, payload.confirm_password);
      const { data: profile, error: profileLookupError } = await admin.from('profiles').select('id, role, clinic_id, email').eq('id', userId).single();
      if (profileLookupError || !profile || !ROLES.has(profile.role)) {
        throw dbFailure('Password reset profile lookup', profileLookupError, 'Managed user not found', 404);
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw bad('Password reset failed', 400);
      await admin.from('profiles').update({ must_change_password: true }).eq('id', userId);
      await audit(admin, actor, 'password_reset', profile.clinic_id, userId, { role: profile.role });
      return json({ ok: true }, 200, cors);
    }

    if (action === 'set_user_status') {
      const userId = requireText(payload.user_id, 'User ID');
      const status = normalizeStatus(payload.status);
      const { data: profile, error: profileLookupError } = await admin.from('profiles').select('id, role, clinic_id').eq('id', userId).single();
      if (profileLookupError || !profile || !ROLES.has(profile.role)) {
        throw dbFailure('Status profile lookup', profileLookupError, 'Managed user not found', 404);
      }
      const { error } = await admin.from('profiles').update({ status }).eq('id', userId);
      if (error) throw dbFailure('Managed profile status update', error, 'Status update failed', 400);
      if (profile.role === 'doctor') {
        await admin.from('doctors').update({ is_active: status === 'active' }).eq('profile_id', userId);
      }
      await audit(admin, actor, status === 'active' ? 'account_activated' : 'account_suspended', profile.clinic_id, userId, { role: profile.role });
      return json({ ok: true }, 200, cors);
    }

    if (action === 'set_clinic_status') {
      const clinicId = requireText(payload.clinic_id, 'Clinic ID');
      const status = normalizeStatus(payload.status);
      const { error } = await admin.from('clinics').update({ is_active: status === 'active' }).eq('id', clinicId);
      if (error) throw dbFailure('Clinic status update', error, 'Clinic status update failed', 400);
      await audit(admin, actor, status === 'active' ? 'clinic_activated' : 'clinic_suspended', clinicId, null);
      return json({ ok: true }, 200, cors);
    }

    return json({ error: 'Unknown action' }, 400, cors);
  } catch (e) {
    if (createdClinicId) {
      await admin.from('clinics').delete().eq('id', createdClinicId);
    }
    for (const userId of createdAuthUsers.reverse()) {
      await admin.from('profiles').delete().eq('id', userId);
      await admin.auth.admin.deleteUser(userId);
    }
    const error = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Request failed';
    const status = typeof e === 'object' && e && 'status' in e ? Number((e as { status: unknown }).status) : 500;
    const operation = typeof e === 'object' && e && 'operation' in e ? String((e as { operation: unknown }).operation) : undefined;
    const dbError = typeof e === 'object' && e && 'db_error' in e ? (e as { db_error: unknown }).db_error : undefined;
    return json({
      error,
      ...(operation ? { operation } : {}),
      ...(dbError ? { db_error: dbError } : {}),
    }, Number.isFinite(status) ? status : 500, cors);
  }
});
