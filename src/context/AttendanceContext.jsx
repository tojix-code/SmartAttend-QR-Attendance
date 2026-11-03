import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { attendanceService, initDemoStorage } from '../services/attendanceService';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import { isDemoMode } from '../lib/supabase';

const AttendanceContext = createContext(null);

export function AttendanceProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();

  const [sessions, setSessions] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);

  // Initialize data on mount
  useEffect(() => {
    initDemoStorage();
    if (!user && !isDemoMode()) {
      setLoading(false);
      setSessions([]);
      setAttendanceRecords([]);
      return;
    }
    loadInitialData();
  }, [user]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const sessList = user?.role === 'teacher'
        ? await attendanceService.getTeacherSessions(user.id)
        : [];
      setSessions(sessList);

      // Find the first active session if available
      const live = sessList.find(s => s.is_active && new Date(s.expires_at) > new Date());
      setActiveSession(live || null);

      const allAtt = user?.role === 'student'
        ? await attendanceService.getStudentAttendance(user.id, user.roll_number)
        : await attendanceService.getAllAttendance();
      setAttendanceRecords(allAtt);
    } catch (err) {
      console.error('Failed to load attendance data:', err);
      toast.error('Attendance data could not be loaded', err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Teacher creates a new attendance session
   */
  const createNewSession = async (sessionData) => {
    try {
      const created = await attendanceService.createSession({
        ...sessionData,
        teacherId: user?.id
      });
      setSessions(prev => [created, ...prev]);
      setActiveSession(created);
      toast.success('Session Created', `QR code generated for ${created.subject}!`);
      return { success: true, session: created };
    } catch (err) {
      toast.error('Session Error', err.message || 'Could not generate session.');
      return { success: false, error: err.message };
    }
  };

  /**
   * Teacher closes a session
   */
  const closeSession = async (sessionId) => {
    try {
      const updated = await attendanceService.closeSession(sessionId);
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, is_active: false } : s));
      if (activeSession?.id === sessionId) {
        setActiveSession(prev => ({ ...prev, is_active: false }));
      }
      toast.info('Session Closed', 'Attendance submissions are now disabled for this session.');
      return { success: true, session: updated };
    } catch (err) {
      toast.error('Error', 'Failed to close session.');
      return { success: false, error: err.message };
    }
  };

  const revokeSessionAttendance = async (attendanceId) => {
    try {
      await attendanceService.revokeSessionAttendance(attendanceId);
      const allAtt = user?.role === 'student'
        ? await attendanceService.getStudentAttendance(user.id, user.roll_number)
        : await attendanceService.getAllAttendance();
      setAttendanceRecords(allAtt);
      toast.success('Attendance revoked', 'This check-in has been removed from the attendance count.');
      return { success: true };
    } catch (err) {
      toast.error('Attendance could not be revoked', err.message);
      return { success: false, error: err.message };
    }
  };

  /**
   * Student marks attendance using session token
   */
  const recordAttendance = async (sessionToken) => {
    try {
      const result = await attendanceService.markAttendance({
        sessionToken,
        student: user,
        deviceInfo: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser'
      });

      if (result.success) {
        toast.success('Attendance Recorded!', result.message);
        // Refresh local attendance records
        const allAtt = user?.role === 'student'
          ? await attendanceService.getStudentAttendance(user.id, user.roll_number)
          : await attendanceService.getAllAttendance();
        setAttendanceRecords(allAtt);
      } else {
        // Specific error handling for duplicate, expired, closed, invalid
        if (result.code === 'DUPLICATE_ATTENDANCE') {
          toast.warning('Duplicate Attendance', result.message);
        } else if (result.code === 'SESSION_EXPIRED') {
          toast.error('Session Expired', result.message);
        } else if (result.code === 'SESSION_CLOSED') {
          toast.error('Session Closed', result.message);
        } else {
          toast.error('Attendance Failed', result.message || 'Invalid QR code.');
        }
      }
      return result;
    } catch (err) {
      toast.error('Error', 'Unable to record attendance.');
      return { success: false, message: err.message };
    }
  };

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await loadInitialData();
  }, [user]);

  return (
    <AttendanceContext.Provider
      value={{
        sessions,
        activeSession,
        setActiveSession,
        attendanceRecords,
        loading,
        createNewSession,
        closeSession,
        revokeSessionAttendance,
        recordAttendance,
        refresh,
        resetDemoData: attendanceService.resetDemoData
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
}
