import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAttendance } from '../../context/AttendanceContext';
import { attendanceService } from '../../services/attendanceService';
import { useToast } from '../../context/ToastContext';
import QRCodeDisplay from '../../components/teacher/QRCodeDisplay';
import LiveAttendanceFeed from '../../components/teacher/LiveAttendanceFeed';
import EmptyState from '../../components/common/EmptyState';
import { QrCode, PlusCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import Button from '../../components/common/Button';

export default function LiveSessionPage() {
  const navigate = useNavigate();
  const { activeSession, closeSession, revokeSessionAttendance, sessions } = useAttendance();
  const toast = useToast();

  const [sessionAttendees, setSessionAttendees] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [selectedSession, setSelectedSession] = useState(activeSession || sessions[0] || null);
  const [totalStudents, setTotalStudents] = useState(0);

  // Sync selected session if activeSession changes
  useEffect(() => {
    if (activeSession) {
      setSelectedSession(activeSession);
    } else if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(sessions[0]);
    }
  }, [activeSession, sessions]);

  // Load attendees for selected session
  const fetchAttendees = async () => {
    if (!selectedSession) return;
    try {
      const records = await attendanceService.getSessionAttendance(selectedSession.id);
      setSessionAttendees(records);
      setFeedError('');
    } catch (e) {
      console.error('Error fetching live session attendance', e);
      setFeedError(e.message || 'Attendance feed could not be refreshed.');
    }
  };

  useEffect(() => {
    fetchAttendees();
    // Poll every 3 seconds to update attendee list in real-time
    const interval = setInterval(fetchAttendees, 3000);
    return () => clearInterval(interval);
  }, [selectedSession]);

  useEffect(() => {
    if (!selectedSession) return;
    let active = true;
    attendanceService.getStudents({ includeAvatars: false })
      .then(students => {
        if (active) {
          setTotalStudents(students.filter(student =>
            student.class_name === selectedSession.class_name &&
            student.section === selectedSession.section
          ).length);
        }
      })
      .catch(error => toast.error('Class roster could not be loaded', error.message));
    return () => { active = false; };
  }, [selectedSession, toast]);

  const handleCloseSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to close this session? Students will no longer be able to mark attendance.')) {
      return;
    }
    setIsClosing(true);
    await closeSession(sessionId);
    setIsClosing(false);
    fetchAttendees();
  };

  const handleRevokeAttendance = async (record) => {
    const confirmed = window.confirm(
      `Revoke attendance for ${record.student_name || 'this student'} (Roll #${record.roll_number || 'N/A'})? They will not be able to check in again using this session QR.`
    );
    if (!confirmed) return;

    const result = await revokeSessionAttendance(record.id);
    if (result.success) {
      await fetchAttendees();
    }
  };

  const isSelectedSessionActive = Boolean(
    selectedSession?.is_active && new Date(selectedSession.expires_at) > new Date()
  );

  if (!selectedSession) {
    return (
      <div className="max-w-2xl mx-auto py-12 animate-in fade-in">
        <EmptyState
          icon={QrCode}
          title="No Active QR Session"
          description="You don't have an active attendance session right now. Create a new session to generate an auto-expiring QR code."
          actionLabel="Create New Session"
          onAction={() => navigate('/teacher/create-session')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/teacher/dashboard')}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
              Active Attendance Stream
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Classroom QR Display
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Session Switcher Dropdown (to inspect other created sessions) */}
          <select
            value={selectedSession.id}
            onChange={(e) => {
              const found = sessions.find(s => s.id === e.target.value);
              if (found) setSelectedSession(found);
            }}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject} ({s.is_active ? 'Active' : 'Ended'})
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={fetchAttendees}
            title="Refresh Attendee Feed"
          />

          <Button
            variant="primary"
            size="sm"
            icon={PlusCircle}
            onClick={() => navigate('/teacher/create-session')}
          >
            New Session
          </Button>
        </div>
      </div>

      {/* Main Grid: QR Code on Left, Live Attendee Feed on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: QR Display Card */}
        <div className="lg:col-span-7">
          <QRCodeDisplay
            session={selectedSession}
            onCloseSession={handleCloseSession}
            isClosing={isClosing}
          />
        </div>

        {/* Right: Live Attendee Stream */}
        <div className="lg:col-span-5">
          {feedError && (
            <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              Live attendance could not be refreshed: {feedError}
            </div>
          )}
          <LiveAttendanceFeed
            records={sessionAttendees}
            totalStudents={totalStudents}
            sessionActive={isSelectedSessionActive}
            onRevoke={handleRevokeAttendance}
          />
        </div>
      </div>
    </div>
  );
}
