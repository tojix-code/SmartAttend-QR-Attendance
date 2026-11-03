import { supabase, isSupabaseConfigured, isDemoMode, requireSupabase } from '../lib/supabase';
import { 
  DEMO_STUDENTS, 
  DEMO_SESSIONS, 
  DEMO_ATTENDANCE 
} from './mockData';
import { generateSessionToken } from '../utils/tokenGenerator';
import { isBefore } from 'date-fns';

const STORAGE_KEYS = {
  SESSIONS: 'smartattend_sessions',
  ATTENDANCE: 'smartattend_attendance',
  STUDENTS: 'smartattend_students'
};
const avatarUrlCache = new Map();

function requireDemoMode() {
  if (!isDemoMode()) {
    throw new Error('Demo data is disabled. Configure Supabase to use SmartAttend.');
  }
}

async function getAvatarUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const cached = avatarUrlCache.get(path);
  if (cached?.url && cached.expiresAt > Date.now()) return cached.url;
  if (cached?.promise) return cached.promise;

  const promise = requireSupabase()
    .storage.from('student-avatars')
    .createSignedUrl(path, 3600)
    .then(({ data, error }) => {
      if (error) throw error;
      avatarUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 50 * 60 * 1000 });
      return data.signedUrl;
    })
    .catch(error => {
      avatarUrlCache.delete(path);
      throw error;
    });
  avatarUrlCache.set(path, { promise, expiresAt: 0 });
  return promise;
}

function getLocalData(key, defaultData) {
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      localStorage.setItem(key, JSON.stringify(defaultData));
      return defaultData;
    }
    return JSON.parse(item);
  } catch (err) {
    console.error('Error reading localStorage', err);
    return defaultData;
  }
}

function setLocalData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error('Error writing localStorage', err);
  }
}

// Ensure initial demo records are present
export function initDemoStorage() {
  if (typeof window === 'undefined' || !isDemoMode()) return;
  if (!localStorage.getItem(STORAGE_KEYS.SESSIONS)) {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(DEMO_SESSIONS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(DEMO_ATTENDANCE));
  }
  if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(DEMO_STUDENTS));
  }
}

export const attendanceService = {
  /**
   * Reset local demo data to initial state for testing
   */
  resetDemoData: () => {
    requireDemoMode();
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(DEMO_SESSIONS));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(DEMO_ATTENDANCE));
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(DEMO_STUDENTS));
    window.location.reload();
  },

  /**
   * Fetch all sessions created by teacher
   */
  getTeacherSessions: async (teacherId) => {
    if (isSupabaseConfigured() && supabase) {
      if (!teacherId) return [];
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }

    requireDemoMode();
    const sessions = getLocalData(STORAGE_KEYS.SESSIONS, DEMO_SESSIONS);
    return sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  /**
   * Fetch a single session by session_token
   */
  getSessionByToken: async (token) => {
    const cleanToken = token.trim();
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_token', cleanToken)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (error) return null;
      return data;
    }

    requireDemoMode();
    const sessions = getLocalData(STORAGE_KEYS.SESSIONS, DEMO_SESSIONS);
    return sessions.find(s => s.session_token.toLowerCase() === cleanToken.toLowerCase()) || null;
  },

  /**
   * Fetch a single session by ID
   */
  getSessionById: async (sessionId) => {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (error) return null;
      return data;
    }

    requireDemoMode();
    const sessions = getLocalData(STORAGE_KEYS.SESSIONS, DEMO_SESSIONS);
    return sessions.find(s => s.id === sessionId) || null;
  },

  /**
   * Create a new attendance session
   */
  createSession: async ({
    className,
    subject,
    section,
    durationMinutes = 15,
    teacherId,
    description = ''
  }) => {
    if (!teacherId) throw new Error('A signed-in teacher profile is required to create a session.');
    const token = generateSessionToken(subject.replace(/[^a-zA-Z]/g, '').slice(0, 4) || 'SESS');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60000).toISOString();

    const newSession = {
      session_token: token,
      class_name: className,
      subject,
      section,
      teacher_id: teacherId,
      created_at: now.toISOString(),
      expires_at: expiresAt,
      duration_minutes: durationMinutes,
      is_active: true,
      description
    };

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('sessions')
        .insert([newSession])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    requireDemoMode();
    newSession.id = `sess-${Date.now()}`;
    const sessions = getLocalData(STORAGE_KEYS.SESSIONS, DEMO_SESSIONS);
    sessions.unshift(newSession);
    setLocalData(STORAGE_KEYS.SESSIONS, sessions);
    return newSession;
  },

  /**
   * Close/deactivate a session
   */
  closeSession: async (sessionId) => {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('id', sessionId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    requireDemoMode();
    const sessions = getLocalData(STORAGE_KEYS.SESSIONS, DEMO_SESSIONS);
    const updated = sessions.map(s => s.id === sessionId ? { ...s, is_active: false } : s);
    setLocalData(STORAGE_KEYS.SESSIONS, updated);
    return updated.find(s => s.id === sessionId);
  },

  /**
   * Mark attendance via QR Code Token
   * Strict validation:
   * 1. Validate session token exists
   * 2. Check if session is deactivated
   * 3. Check if session QR is expired
   * 4. Check for duplicate attendance submission
   */
  markAttendance: async ({ sessionToken, student, deviceInfo = 'Web Scanner' }) => {
    if (!student || !student.id) {
      return {
        success: false,
        code: 'UNAUTHENTICATED',
        message: 'You must be logged in as a registered student to mark attendance.'
      };
    }

    // If Supabase is configured with stored procedure
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.rpc('mark_qr_attendance', {
        p_session_token: sessionToken.trim(),
        p_device_info: deviceInfo
      });

      if (error) {
        return {
          success: false,
          code: 'DATABASE_ERROR',
          message: error.message || 'An error occurred while communicating with database.'
        };
      }
      return data;
    }

    requireDemoMode();
    // Local / Offline / Demo Mode Execution with real business rules
    const sessions = getLocalData(STORAGE_KEYS.SESSIONS, DEMO_SESSIONS);
    const session = sessions.find(
      s => s.session_token.trim().toLowerCase() === sessionToken.trim().toLowerCase()
    );

    // Rule 1: Session existence
    if (!session) {
      return {
        success: false,
        code: 'INVALID_QR',
        message: 'Invalid QR code. No attendance session found for this token.'
      };
    }

    // Rule 2: Inactive / closed session
    if (!session.is_active) {
      return {
        success: false,
        code: 'SESSION_CLOSED',
        message: 'This attendance session has already been closed by the instructor.'
      };
    }

    // Rule 3: Expired QR code
    const isExpired = isBefore(new Date(session.expires_at), new Date());
    if (isExpired) {
      return {
        success: false,
        code: 'SESSION_EXPIRED',
        message: `This QR code expired at ${new Date(session.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Expired submissions are strictly rejected.`
      };
    }

    // Rule 4: Duplicate attendance prevention
    const attendanceRecords = getLocalData(STORAGE_KEYS.ATTENDANCE, DEMO_ATTENDANCE);
    const existing = attendanceRecords.find(
      a => a.session_id === session.id && (a.student_id === student.id || a.roll_number === student.roll_number)
    );

    if (existing) {
      const markedTime = new Date(existing.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        success: false,
        code: 'DUPLICATE_ATTENDANCE',
        message: `Duplicate submission rejected! Your attendance for "${session.subject}" was already recorded at ${markedTime}.`
      };
    }

    // Save attendance record
    const newRecord = {
      id: `att-${Date.now()}`,
      student_id: student.id,
      session_id: session.id,
      student_name: student.full_name,
      roll_number: student.roll_number,
      class_name: session.class_name,
      section: session.section,
      subject: session.subject,
      marked_at: new Date().toISOString(),
      status: 'present',
      device_info: deviceInfo
    };

    attendanceRecords.unshift(newRecord);
    setLocalData(STORAGE_KEYS.ATTENDANCE, attendanceRecords);

    return {
      success: true,
      code: 'ATTENDANCE_RECORDED',
      message: `Attendance marked successfully for ${session.subject}!`,
      record: newRecord,
      session
    };
  },

  /**
   * Get attendance records for a specific session (Teacher view)
   */
  getSessionAttendance: async (sessionId) => {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id,
          marked_at,
          status,
          revoked_at,
          device_info,
          student:students (
            id,
            full_name,
            roll_number,
            class_name,
            section,
            avatar_url
          )
        `)
        .eq('session_id', sessionId)
        .order('marked_at', { ascending: false });
      if (error) throw error;
      return Promise.all(data.map(async item => ({
        id: item.id,
        student_id: item.student?.id,
        student_name: item.student?.full_name,
        roll_number: item.student?.roll_number,
        class_name: item.student?.class_name,
        section: item.student?.section,
        avatar: await getAvatarUrl(item.student?.avatar_url),
        marked_at: item.marked_at,
        status: item.revoked_at ? 'revoked' : item.status,
        revoked_at: item.revoked_at,
        device_info: item.device_info
      })));
    }

    requireDemoMode();
    const records = getLocalData(STORAGE_KEYS.ATTENDANCE, DEMO_ATTENDANCE);
    return records.filter(r => r.session_id === sessionId);
  },

  revokeSessionAttendance: async (attendanceId) => {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.rpc('revoke_session_attendance', {
        p_attendance_id: attendanceId
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Attendance could not be revoked.');
      return data;
    }

    requireDemoMode();
    const records = getLocalData(STORAGE_KEYS.ATTENDANCE, DEMO_ATTENDANCE);
    const record = records.find(item => item.id === attendanceId);
    const sessions = getLocalData(STORAGE_KEYS.SESSIONS, DEMO_SESSIONS);
    const session = record && sessions.find(item => item.id === record.session_id);
    if (!record || !session) throw new Error('Attendance record not found.');
    if (!session.is_active || new Date(session.expires_at) <= new Date()) {
      throw new Error('Attendance can only be revoked while its QR session is active.');
    }
    if (record.revoked_at) throw new Error('This attendance has already been revoked.');
    record.revoked_at = new Date().toISOString();
    record.status = 'revoked';
    setLocalData(STORAGE_KEYS.ATTENDANCE, records);
    return { success: true, message: 'Attendance revoked. The student cannot use this session QR to check in again.' };
  },

  /**
   * Get all attendance records (with filters for search, class, date, status)
   */
  getAllAttendance: async (filters = {}) => {
    let records = [];

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id,
          marked_at,
          status,
          revoked_at,
          device_info,
          student:students (
            id,
            full_name,
            roll_number,
            class_name,
            section,
            avatar_url
          ),
          session:sessions (
            id,
            subject,
            class_name,
            section,
            teacher:teachers (
              full_name
            )
          )
        `)
        .order('marked_at', { ascending: false });

      if (error) throw error;
      records = await Promise.all(data.map(async item => ({
        id: item.id,
        session_id: item.session?.id,
        student_id: item.student?.id,
        student_name: item.student?.full_name,
        roll_number: item.student?.roll_number,
        class_name: item.student?.class_name || item.session?.class_name,
        section: item.student?.section || item.session?.section,
        avatar: await getAvatarUrl(item.student?.avatar_url),
        subject: item.session?.subject,
        teacher_name: item.session?.teacher?.full_name,
        marked_at: item.marked_at,
        status: item.revoked_at ? 'revoked' : item.status,
        revoked_at: item.revoked_at,
        device_info: item.device_info
      })));
    } else {
      requireDemoMode();
      records = getLocalData(STORAGE_KEYS.ATTENDANCE, DEMO_ATTENDANCE);
    }

    // Apply filters
    if (filters.search) {
      const q = filters.search.toLowerCase();
      records = records.filter(r => 
        (r.student_name && r.student_name.toLowerCase().includes(q)) ||
        (r.roll_number && r.roll_number.toLowerCase().includes(q)) ||
        (r.subject && r.subject.toLowerCase().includes(q))
      );
    }

    if (filters.className && filters.className !== 'ALL') {
      records = records.filter(r => r.class_name === filters.className);
    }

    if (filters.status && filters.status !== 'ALL') {
      records = records.filter(r => r.status.toLowerCase() === filters.status.toLowerCase());
    }

    return records;
  },

  /**
   * Get attendance history for a student
   */
  getStudentAttendance: async (studentId, rollNumber) => {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.rpc('get_student_attendance_history');
      if (error) throw error;
      return data;
    }

    requireDemoMode();
    const records = getLocalData(STORAGE_KEYS.ATTENDANCE, DEMO_ATTENDANCE);
    return records.filter(
      r => r.student_id === studentId || (rollNumber && r.roll_number === rollNumber)
    );
  },

  getStudentSummary: async (student) => {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.rpc('get_student_attendance_summary');
      if (error) throw error;
      return data;
    }

    requireDemoMode();
    const finishedSessions = getLocalData(STORAGE_KEYS.SESSIONS, DEMO_SESSIONS).filter(session =>
      session.class_name === student.class_name &&
      session.section === student.section &&
      (!session.is_active || new Date(session.expires_at) <= new Date())
    );
    const records = getLocalData(STORAGE_KEYS.ATTENDANCE, DEMO_ATTENDANCE);
    const classesAttended = new Set(
      records
        .filter(record => record.student_id === student.id && !record.revoked_at && record.status !== 'revoked' && finishedSessions.some(session => session.id === record.session_id))
        .map(record => record.session_id)
    ).size;
    const subjectMap = new Map();
    finishedSessions.forEach(session => {
        const stats = subjectMap.get(session.subject) || { subject: session.subject, total_sessions: 0, classes_attended: 0 };
        stats.total_sessions += 1;
        const attended = records.some(record =>
          record.student_id === student.id &&
          record.session_id === session.id &&
          !record.revoked_at &&
          record.status !== 'revoked'
        );
        if (attended) stats.classes_attended += 1;
        subjectMap.set(session.subject, stats);
    });
    const monthlyMap = new Map();
    finishedSessions.forEach(session => {
        const month = session.created_at.slice(0, 7);
        const stats = monthlyMap.get(month) || { month, total_sessions: 0, classes_attended: 0 };
        stats.total_sessions += 1;
        const attended = records.some(record =>
          record.student_id === student.id &&
          record.session_id === session.id &&
          !record.revoked_at &&
          record.status !== 'revoked'
        );
        if (attended) stats.classes_attended += 1;
        monthlyMap.set(month, stats);
    });
    return {
        total_sessions: finishedSessions.length,
        classes_attended: classesAttended,
        classes_missed: Math.max(finishedSessions.length - classesAttended, 0),
        subject_stats: [...subjectMap.values()],
        monthly_trend: [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month))
    };
  },

  /**
   * Get list of all registered students
   */
  getStudents: async ({ includeEmail = false, includeAvatars = true } = {}) => {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('students')
        .select(includeEmail
          ? 'id, user_id, full_name, email, roll_number, class_name, section, avatar_url, created_at'
          : 'id, full_name, roll_number, class_name, section, avatar_url')
        .order('roll_number', { ascending: true });
      if (error) throw error;
      return Promise.all(data.map(async student => ({
        ...student,
        avatar: includeAvatars ? await getAvatarUrl(student.avatar_url) : null
      })));
    }

    requireDemoMode();
    return getLocalData(STORAGE_KEYS.STUDENTS, DEMO_STUDENTS);
  },

  getTeachers: async () => {
    const client = requireSupabase();
    const { data, error } = await client
      .from('teachers')
      .select('id, full_name, email, department, created_at')
      .order('full_name', { ascending: true });
    if (error) throw error;
    return data;
  },

  createManagedUser: async (input) => {
    const client = requireSupabase();
    const { data, error } = await client.functions.invoke('admin-create-user', { body: input });
    if (error) {
      let message = error.message || 'Account creation failed.';
      if (error.context && typeof error.context.json === 'function') {
        const response = await error.context.json();
        if (response?.error) message = response.error;
      }
      throw new Error(message);
    }
    if (!data?.profile) {
      throw new Error('Account provisioning did not return a created profile.');
    }
    return data.profile;
  },

  uploadStudentAvatar: async (studentId, file) => {
    const mimeTypes = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    const extension = mimeTypes[file.type];
    if (!extension) throw new Error('Choose a JPG, PNG, or WebP image.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Profile images must be 5 MB or smaller.');

    const client = requireSupabase();
    const path = `${studentId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage
      .from('student-avatars')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { error: profileError } = await client
      .from('students')
      .update({ avatar_url: path })
      .eq('id', studentId);
    if (profileError) {
      const { error: deleteError } = await client.storage.from('student-avatars').remove([path]);
      if (deleteError) console.error('Could not remove an unlinked student avatar:', deleteError.message);
      throw profileError;
    }
    return getAvatarUrl(path);
  }
};
