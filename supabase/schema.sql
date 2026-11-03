-- SmartAttend production schema for Supabase.
-- Safe to run again: this script does not drop application data or seed demo accounts.

create extension if not exists pgcrypto;

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  department text not null default 'General',
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique,
  roll_number text not null unique,
  class_name text not null,
  section text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.students add column if not exists email text;
alter table public.students add column if not exists avatar_url text;
create unique index if not exists idx_students_email_unique
  on public.students (email) where email is not null;
create unique index if not exists idx_students_user_id_unique
  on public.students (user_id) where user_id is not null;
create unique index if not exists idx_teachers_user_id_unique
  on public.teachers (user_id) where user_id is not null;

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  class_name text not null,
  subject text not null,
  section text not null,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  duration_minutes integer not null default 15 check (duration_minutes between 1 and 120),
  description text
);

alter table public.sessions add column if not exists description text;
alter table public.sessions add column if not exists duration_minutes integer not null default 15;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  marked_at timestamptz not null default now(),
  status text not null default 'present' check (status in ('present', 'late', 'absent')),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  device_info text,
  constraint unique_student_session unique (student_id, session_id)
);

alter table public.attendance add column if not exists revoked_at timestamptz;
alter table public.attendance add column if not exists revoked_by uuid references auth.users(id) on delete set null;

create index if not exists idx_sessions_teacher_created
  on public.sessions (teacher_id, created_at desc);
create index if not exists idx_attendance_student_marked
  on public.attendance (student_id, marked_at desc);
create index if not exists idx_attendance_session_marked
  on public.attendance (session_id, marked_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (select 1 from public.teachers where user_id = auth.uid());
$$;

create or replace function public.can_view_student_avatar(p_profile_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.students st
    where st.id::text = p_profile_id
      and (
        st.user_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1
          from public.sessions s
          join public.teachers t on t.id = s.teacher_id
          where t.user_id = auth.uid()
            and s.class_name = st.class_name
            and s.section = st.section
        )
      )
  );
$$;

alter table public.admins enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "Allow public read for teachers" on public.teachers;
drop policy if exists "Allow teachers to manage own profile" on public.teachers;
drop policy if exists "Allow authenticated read for students" on public.students;
drop policy if exists "Allow students to manage own profile" on public.students;
drop policy if exists "Allow authenticated read for sessions" on public.sessions;
drop policy if exists "Teachers can create sessions" on public.sessions;
drop policy if exists "Teachers can update own sessions" on public.sessions;
drop policy if exists "Students can view own attendance" on public.attendance;
drop policy if exists "Students can insert own attendance" on public.attendance;

drop policy if exists "Admins manage administrators" on public.admins;
drop policy if exists "Users read own administrator profile" on public.admins;
drop policy if exists "Admins manage teachers" on public.teachers;
drop policy if exists "Teachers read own profile" on public.teachers;
drop policy if exists "Admins manage students" on public.students;
drop policy if exists "Students read own profile" on public.students;
drop policy if exists "Teachers read students in their classes" on public.students;
drop policy if exists "Teachers read registered students" on public.students;
drop policy if exists "Admins manage sessions" on public.sessions;
drop policy if exists "Teachers manage own sessions" on public.sessions;
drop policy if exists "Admins read all attendance" on public.attendance;
drop policy if exists "Students read own attendance" on public.attendance;
drop policy if exists "Teachers read attendance for own sessions" on public.attendance;

create policy "Admins manage administrators"
  on public.admins for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Users read own administrator profile"
  on public.admins for select to authenticated
  using (user_id = auth.uid());

create policy "Admins manage teachers"
  on public.teachers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Teachers read own profile"
  on public.teachers for select to authenticated
  using (user_id = auth.uid());

create policy "Admins manage students"
  on public.students for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Students read own profile"
  on public.students for select to authenticated
  using (user_id = auth.uid());
create policy "Teachers read registered students"
  on public.students for select to authenticated
  using (public.is_teacher());

create policy "Admins manage sessions"
  on public.sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Teachers manage own sessions"
  on public.sessions for all to authenticated
  using (
    exists (select 1 from public.teachers t where t.id = sessions.teacher_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.teachers t where t.id = sessions.teacher_id and t.user_id = auth.uid())
  );

create policy "Admins read all attendance"
  on public.attendance for select to authenticated
  using (public.is_admin());
create policy "Students read own attendance"
  on public.attendance for select to authenticated
  using (
    exists (select 1 from public.students s where s.id = attendance.student_id and s.user_id = auth.uid())
  );
create policy "Teachers read attendance for own sessions"
  on public.attendance for select to authenticated
  using (
    exists (
      select 1 from public.sessions s
      join public.teachers t on t.id = s.teacher_id
      where s.id = attendance.session_id and t.user_id = auth.uid()
    )
  );

revoke all on public.admins, public.teachers, public.students, public.sessions, public.attendance from anon;
grant select, insert, update, delete on public.admins, public.teachers, public.students, public.sessions to authenticated;
grant select on public.attendance to authenticated;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_teacher() from public, anon;
revoke all on function public.can_view_student_avatar(text) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.can_view_student_avatar(text) to authenticated;

-- Remove the legacy SECURITY DEFINER overload that trusted a client-supplied student ID.
drop function if exists public.mark_qr_attendance(text, uuid, text);

create or replace function public.mark_qr_attendance(
  p_session_token text,
  p_device_info text default 'Web Scanner'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_student public.students%rowtype;
  v_attendance_id uuid;
  v_marked_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_session_token is null or length(trim(p_session_token)) not between 1 and 128 then
    return jsonb_build_object('success', false, 'code', 'INVALID_QR', 'message', 'Invalid QR code.');
  end if;

  select * into v_student
  from public.students
  where user_id = auth.uid();

  if v_student.id is null then
    return jsonb_build_object('success', false, 'code', 'STUDENT_PROFILE_REQUIRED', 'message', 'Your account is not linked to a student profile.');
  end if;

  select * into v_session
  from public.sessions
  where session_token = trim(p_session_token)
  for share;

  if v_session.id is null then
    return jsonb_build_object('success', false, 'code', 'SESSION_NOT_FOUND', 'message', 'Invalid QR code.');
  end if;
  if not v_session.is_active then
    return jsonb_build_object('success', false, 'code', 'SESSION_CLOSED', 'message', 'This attendance session has been closed.');
  end if;
  if v_session.expires_at <= now() then
    return jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED', 'message', 'This QR code has expired.');
  end if;
  if v_student.class_name <> v_session.class_name or v_student.section <> v_session.section then
    return jsonb_build_object('success', false, 'code', 'CLASS_MISMATCH', 'message', 'This QR code is not for your class.');
  end if;

  insert into public.attendance (student_id, session_id, status, device_info)
  values (v_student.id, v_session.id, 'present', left(coalesce(p_device_info, 'Web Scanner'), 120))
  on conflict (student_id, session_id) do nothing
  returning id, marked_at into v_attendance_id, v_marked_at;

  if v_attendance_id is null then
    return jsonb_build_object('success', false, 'code', 'DUPLICATE_ATTENDANCE', 'message', 'Attendance has already been recorded for this session.');
  end if;

  return jsonb_build_object(
    'success', true,
    'code', 'ATTENDANCE_RECORDED',
    'message', 'Attendance recorded successfully!',
    'attendance_id', v_attendance_id,
    'class_name', v_session.class_name,
    'subject', v_session.subject,
    'marked_at', v_marked_at
  );
end;
$$;

revoke all on function public.mark_qr_attendance(text, text) from public, anon;
grant execute on function public.mark_qr_attendance(text, text) to authenticated;

create or replace function public.revoke_session_attendance(p_attendance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_session_active boolean;
  v_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select s.is_active, s.expires_at
  into v_session_active, v_expires_at
  from public.attendance a
  join public.sessions s on s.id = a.session_id
  join public.teachers t on t.id = s.teacher_id
  where a.id = p_attendance_id
    and t.user_id = auth.uid()
  for update of a, s;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Attendance record not found for your session.');
  end if;
  if not v_session_active or v_expires_at <= now() then
    return jsonb_build_object('success', false, 'message', 'Attendance can only be revoked while its QR session is active.');
  end if;

  update public.attendance
  set revoked_at = now(), revoked_by = auth.uid()
  where id = p_attendance_id and revoked_at is null;

  if not found then
    return jsonb_build_object('success', false, 'message', 'This attendance has already been revoked.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Attendance revoked. The student cannot use this session QR to check in again.');
end;
$$;

revoke all on function public.revoke_session_attendance(uuid) from public, anon;
grant execute on function public.revoke_session_attendance(uuid) to authenticated;

create or replace function public.get_student_attendance_summary()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_student public.students%rowtype;
  v_total integer;
  v_attended integer;
  v_subject_stats jsonb;
  v_monthly_trend jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_student from public.students where user_id = auth.uid();
  if v_student.id is null then
    raise exception 'Student profile required' using errcode = '42501';
  end if;

  select count(*) into v_total
  from public.sessions s
  where s.class_name = v_student.class_name
    and s.section = v_student.section
    and (s.expires_at <= now() or not s.is_active);

  select count(*) into v_attended
  from public.attendance a
  join public.sessions s on s.id = a.session_id
  where a.student_id = v_student.id
    and s.class_name = v_student.class_name
    and s.section = v_student.section
    and (s.expires_at <= now() or not s.is_active)
    and a.revoked_at is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'subject', stats.subject,
        'total_sessions', stats.total_sessions,
        'classes_attended', stats.classes_attended
      ) order by stats.subject
    ),
    '[]'::jsonb
  )
  into v_subject_stats
  from (
    select s.subject,
      count(*) as total_sessions,
      count(a.id) filter (where a.id is not null and a.revoked_at is null) as classes_attended
    from public.sessions s
    left join public.attendance a
      on a.session_id = s.id and a.student_id = v_student.id
    where s.class_name = v_student.class_name
      and s.section = v_student.section
      and (s.expires_at <= now() or not s.is_active)
    group by s.subject
  ) stats;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'month', stats.month,
        'total_sessions', stats.total_sessions,
        'classes_attended', stats.classes_attended
      ) order by stats.month
    ),
    '[]'::jsonb
  )
  into v_monthly_trend
  from (
    select to_char(date_trunc('month', s.created_at), 'YYYY-MM') as month,
      count(*) as total_sessions,
      count(a.id) filter (where a.id is not null and a.revoked_at is null) as classes_attended
    from public.sessions s
    left join public.attendance a
      on a.session_id = s.id and a.student_id = v_student.id
    where s.class_name = v_student.class_name
      and s.section = v_student.section
      and (s.expires_at <= now() or not s.is_active)
      and s.created_at >= date_trunc('month', now()) - interval '5 months'
    group by date_trunc('month', s.created_at)
  ) stats;

  return jsonb_build_object(
    'total_sessions', v_total,
    'classes_attended', v_attended,
    'classes_missed', greatest(v_total - v_attended, 0),
    'subject_stats', v_subject_stats,
    'monthly_trend', v_monthly_trend
  );
end;
$$;

revoke all on function public.get_student_attendance_summary() from public, anon;
grant execute on function public.get_student_attendance_summary() to authenticated;

create or replace function public.get_student_attendance_history()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_student_id uuid;
  v_history jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select id into v_student_id from public.students where user_id = auth.uid();
  if v_student_id is null then
    raise exception 'Student profile required' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'marked_at', a.marked_at,
        'status', case when a.revoked_at is not null then 'revoked' else a.status end,
        'revoked_at', a.revoked_at,
        'device_info', a.device_info,
        'subject', s.subject,
        'class_name', s.class_name,
        'section', s.section,
        'teacher_name', t.full_name
      ) order by a.marked_at desc
    ),
    '[]'::jsonb
  )
  into v_history
  from public.attendance a
  join public.sessions s on s.id = a.session_id
  left join public.teachers t on t.id = s.teacher_id
  where a.student_id = v_student_id;

  return v_history;
end;
$$;

revoke all on function public.get_student_attendance_history() from public, anon;
grant execute on function public.get_student_attendance_history() to authenticated;

-- Student profile images are stored privately; signed URLs are created by authenticated app clients.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-avatars', 'student-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Admins manage student avatars" on storage.objects;
drop policy if exists "Signed-in users view student avatars" on storage.objects;
create policy "Admins manage student avatars"
  on storage.objects for all to authenticated
  using (bucket_id = 'student-avatars' and public.is_admin())
  with check (bucket_id = 'student-avatars' and public.is_admin());
create policy "Signed-in users view student avatars"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'student-avatars'
    and public.can_view_student_avatar((storage.foldername(name))[1])
  );
