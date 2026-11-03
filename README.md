# SmartAttend

SmartAttend is a QR attendance app for schools and colleges. Teachers create expiring attendance sessions, students sign in and scan the session QR code, and administrators manage teacher/student accounts. Supabase Auth, PostgreSQL, Row Level Security, and private Storage provide the production data layer.

## Features

- Separate administrator, teacher, and student workspaces with role-gated routes.
- Admin-managed teacher and student accounts using temporary passwords.
- Optional student profile photos stored in a private Supabase Storage bucket.
- Teacher session creation, QR attendance, live feed, history, and CSV reports.
- Student and teacher attendance analytics with subject, monthly, weekly, and class-group breakdowns.
- Teachers can revoke a check-in while its QR session is active; the record remains auditable and duplicate scans stay blocked.
- Server-side attendance validation, class matching, expiration checks, and duplicate prevention.
- Campus-building landing-page background and responsive layouts.

## Local setup

Requirements: Node.js 18+ and npm.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

By default the app does **not** authenticate against sample accounts or save fake data. Configure a Supabase project in `.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_DEMO_MODE=false
```

The anon/publishable key is intended for the browser; database permissions are enforced by RLS. **Never put a Supabase service-role key in a `VITE_` variable or browser code.** If the database is not configured, production mode fails closed. For an isolated local preview only, set `VITE_DEMO_MODE=true`; this enables fictional data and one-click demo profiles only when Supabase is not configured.

## Supabase setup

1. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). It is designed to be re-runnable and does not drop tables or seed demo users. Back up existing data and review any local schema customizations before applying it. If this project was previously initialized with the old demo schema, review and remove its fictional seed rows before production; this migration intentionally preserves existing records.
2. Create the first administrator in **Authentication → Users**. Copy that user's UUID and add the corresponding profile in the SQL Editor:

   ```sql
   insert into public.admins (user_id, full_name, email)
   values ('AUTH_USER_UUID', 'School Administrator', 'admin@school.edu');
   ```

   Keep the initial password private; the account can request a password-reset email from the sign-in page.
3. Install and link the Supabase CLI, then deploy the account-provisioning Edge Function:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy admin-create-user
   ```

   The function verifies the caller's Supabase JWT and `admins` record before it creates a confirmed Auth user and matching profile. Supabase supplies the function's service-role secret at runtime; it is never sent to the browser. Account creation is rolled back if profile creation fails.
4. Configure the Supabase Auth site's **Site URL** and **Redirect URLs** for your deployed app so password-reset links return to the correct domain.
5. In your hosting provider, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_DEMO_MODE=false`, then build and deploy:

   ```powershell
   npm run build
   ```

Administrators can add teachers and students at `/admin/users`. Temporary passwords must be at least 12 characters; users should replace them using the password-reset email. Student photos are private, limited to JPG/PNG/WebP files up to 5 MB, and served through short-lived signed URLs.

## Security notes

- Attendance identity is derived from `auth.uid()` in PostgreSQL; clients cannot submit another student's profile ID.
- The database checks the student's class/section, session state, and expiry, and the unique student/session constraint prevents concurrent duplicates.
- Students can read only their own profile and attendance. Teachers are limited to their own sessions and the associated class roster. Admin privileges come from the protected `admins` table, not editable browser metadata.
- Session tokens are not readable through student table queries. The attendance RPC validates submitted tokens without exposing the sessions table to students.
- Teacher attendance revocation is handled by a database function that verifies session ownership and active expiry. Revoked check-ins remain recorded for audit purposes and do not count as attendance.
- QR attendance can prevent duplicate or unauthorized account submissions, but a static QR can still be shared with another person during its validity window. Keep session lifetimes short and use in-person identity checks for high-stakes attendance.

## Demo mode

Demo data is fictional, browser-local, and intended only for previews. It is not a database connection and must not be used for real attendance. Enable it explicitly with `VITE_DEMO_MODE=true` and no Supabase credentials. Demo role switching is hidden in connected/production mode.

## Project structure

- `src/pages`: landing, role-specific dashboards, scanner, reports, and admin directory.
- `src/context`: authentication, attendance state, and notifications.
- `src/services/attendanceService.js`: Supabase operations and explicitly gated demo storage.
- `supabase/schema.sql`: PostgreSQL tables, RLS policies, attendance RPCs, and private avatar storage.
- `supabase/functions/admin-create-user`: server-side administrator-only account provisioning.
