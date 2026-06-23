# CareClinic → Multi-Tenant SaaS — Design & Migration (Review Only)

> **Status:** design artifacts for review. **Nothing here has been executed on production.**
> Apply on a Supabase **branch / staging** project first, validate with the Test Matrix, then promote.

---

## 1. Phase 0 — Real findings (from live schema)

| Area | Finding |
|---|---|
| Tables | `profiles`, `doctors`, `appointments`, `bookings`, `clinic_settings`, `notifications` |
| Critical | Two competing booking tables (`appointments` vs `bookings`); doctors stand-alone (no Auth); enum `user_role` = `patient/employee/admin` only |
| RLS leak | `profiles_select USING (true)` → any user reads **all** profiles; 3 open `INSERT` policies on profiles; `doctors` DELETE/INSERT `USING (true)` |
| Locked | `appointments` had RLS enabled with **no policies** → default-deny (explains failed inserts) |
| Isolation | **No `clinic_id` anywhere** → zero tenant isolation (root problem) |
| Storage | No buckets/policies (unused) |
| Row counts | doctors 4, profiles 10, everything else 0 → safe clean start |

## 2. Decisions (confirmed by you)

- Doctor → **one** clinic. Employee → **one** clinic.
- Patient → **both** real Auth account *and* staff-created record.
- Roles → exactly `super_admin, clinic_admin, employee, doctor, patient`.
- Booking tables → **consolidate onto one clean `appointments`**, drop `bookings`.
- Doctors → **get Auth accounts** (profile role `doctor`, linked via `doctors.profile_id`).
- Backfill → **clean start**: drop test data, keep your account, seed it `super_admin`.

## 3. Target ERD (text)

```
clinics (TENANT ROOT)
  ├─< profiles      (clinic_id, role)            id = auth.users.id
  ├─< doctors       (clinic_id, profile_id ─→ profiles.id)
  ├─< patients      (clinic_id, auth_user_id ─→ auth.users.id NULLABLE)
  ├─< appointments  (clinic_id, patient_id ─→ patients, doctor_id ─→ doctors)
  ├─< medical_history (clinic_id, patient_id, doctor_id)
  ├─< medical_files   (clinic_id, patient_id)
  └─< notifications   (clinic_id, user_id ─→ profiles)
```
Every sensitive table carries `clinic_id` and is filtered by RLS via JWT claims.

## 4. Isolation model (defense in depth)

1. **JWT claims** — `custom_access_token_hook` injects `clinic_id` + `user_role` into every access token.
2. **Helper fns** — `current_clinic_id()`, `current_user_role()`, `is_super_admin()` read those claims (`STABLE SECURITY DEFINER`). **No JOIN on `profiles` inside policies** → no recursion.
3. **RLS** — separate `SELECT/INSERT/UPDATE/DELETE` policies per table; `super_admin` bypasses; staff scoped to `clinic_id = current_clinic_id()`; patient to own rows; doctor to own patients (via `appointments` EXISTS).

> Design choice (flag): `clinics` + `doctors` are a **browsable directory** (any authenticated user can `SELECT` active rows) so patients can pick who to book. All **patient/appointment/medical** data is strictly clinic-isolated. If you want fully closed clinics (patient pre-assigned to one clinic), change `doctors_select`/`clinics_select` to `clinic_id = current_clinic_id()`.

## 5. Files in this delivery

| File | Purpose |
|---|---|
| `migrations/0001_multitenant.sql` | Forward migration (schema, indexes, helper fns, JWT hook, trigger, all RLS) |
| `migrations/0001_multitenant_rollback.sql` | Tear-down of new objects (restore data from backup) |
| `functions/create-clinic-user/index.ts` | Edge Function — clinic_admin creates doctor/employee accounts (service_role server-side) |
| `MULTITENANT_DESIGN.md` | This document |

## 6. Apply plan (staging first)

1. **Backup** — Dashboard → Database → Backups (or `pg_dump`). Keep it.
2. **Branch** — create a Supabase branch (or a staging project) and point a staging `.env` at it.
3. Run `0001_multitenant.sql` in the branch SQL Editor.
4. **Enable the JWT hook** — Dashboard → Authentication → Hooks → *Custom Access Token* → select `public.custom_access_token_hook`. (Cannot be scripted.)
5. **Seed** (bottom of the migration): create `Default Clinic`, set your account `role='super_admin'`. Log out/in so the new JWT carries the claims.
6. Deploy the Edge Function: `supabase functions deploy create-clinic-user` and set secrets.
7. Run the **Test Matrix** (§8). Only then promote to production (repeat 1–6 there).

## 7. Rollback / emergency

- Partial/failed apply on branch → run `0001_multitenant_rollback.sql`, then **restore the backup**, then disable the hook.
- Production incident → restore the pre-migration backup (point-in-time), disable the hook. The app keeps working on the old schema because the migration is isolated to the branch until promoted.

## 8. Test Matrix (run as each role after login)

| # | Role | Action | Expected |
|---|---|---|---|
| 1 | patient A (clinic 1) | select own appointments | ✅ only own |
| 2 | patient A | select another patient's row | ❌ 0 rows |
| 3 | patient A | insert appointment for someone else | ❌ blocked by `with check` |
| 4 | employee (clinic 1) | select patients | ✅ only clinic 1 |
| 5 | employee (clinic 1) | select clinic 2 patients/appointments | ❌ 0 rows |
| 6 | employee | approve/reject appointment in own clinic | ✅ |
| 7 | employee | update appointment in clinic 2 | ❌ |
| 8 | doctor (clinic 1) | select patients | ✅ only patients with an appointment with him |
| 9 | doctor | select a clinic-1 patient he never saw | ❌ |
| 10 | clinic_admin (clinic 1) | create doctor via Edge Function | ✅ doctor lands in clinic 1 |
| 11 | clinic_admin (clinic 1) | create user in clinic 2 (tamper clinic_id) | ❌ forced to clinic 1 |
| 12 | super_admin | select across all clinics | ✅ everything |
| 13 | anon (no login) | select profiles/patients | ❌ 0 rows |
| 14 | patient | direct REST call (bypass UI) to clinic 2 data | ❌ RLS blocks |

## 9. Required React changes (separate PR, after schema is on staging)

- **Remove the `localStorage` fallback** (`cc_bookings`, `cc_doctors`) in `src/context/AppContext.jsx` — it bypasses RLS and breaks tenant isolation. Read/write the real tables; RLS auto-filters by clinic.
- **Doctors** now come from `doctors` (has `clinic_id`); **patients** from the new `patients` table (not `profiles`).
- **Add Doctor / Add Employee** must call the `create-clinic-user` Edge Function (no direct `doctors` insert for accounts).
- **Booking insert** must set `clinic_id` (from the chosen doctor) and resolve/create the caller's `patients` row for that clinic.
- **Login** keeps `signInWithPassword`; role/clinic now also available from JWT claims (`session.access_token` → decoded) but fetching the profile for display is fine.
- `supabaseClient.js` stays **anon-only** (✅ already correct).

## 10. Risk register

| Risk | Mitigation |
|---|---|
| Recursion in RLS | Helpers read JWT, never JOIN `profiles` in policies |
| Hook not enabled → claims missing → `current_clinic_id()` NULL → staff see nothing | Enable hook (step 4) and re-login; verify claims before testing |
| service_role leak | Lives only in Edge Function secrets; never in frontend |
| Cross-clinic leak via direct API | RLS enforced at DB; UI filtering is not relied upon |
| Doctor account creation | Done server-side in Edge Function with caller authorization |
| Data loss on clean start | Full backup before apply; clean start chosen knowingly (test data) |

## 11. Security audit checklist

- [x] `service_role` absent from frontend (`.env` = anon only)
- [x] No API path bypasses RLS (all client access is anon-key + RLS)
- [x] `SECURITY DEFINER` functions are minimal, `search_path` pinned, JWT-only
- [x] `super_admin` is the only cross-tenant role
- [x] Every sensitive table: RLS enabled + 4 explicit policies + `clinic_id` index
