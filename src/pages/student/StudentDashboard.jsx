import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { attendanceService } from '../../services/attendanceService';
import { useToast } from '../../context/ToastContext';
import { 
  ScanLine, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  BookOpen, 
  Clock, 
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  User,
  BarChart3
} from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { formatDate, formatTime, formatRelativeTime } from '../../utils/formatters';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { attendanceRecords } = useAttendance();
  const toast = useToast();

  const [studentHistory, setStudentHistory] = useState([]);
  const [summary, setSummary] = useState({
    total_sessions: 0,
    classes_attended: 0,
    classes_missed: 0,
    subject_stats: [],
    monthly_trend: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [records, stats] = await Promise.all([
          attendanceService.getStudentAttendance(user.id, user.roll_number),
          attendanceService.getStudentSummary(user)
        ]);
        setStudentHistory(records);
        setSummary(stats);
      } catch (error) {
        console.error('Failed to fetch student attendance', error);
        toast.error('Attendance could not be loaded', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user, attendanceRecords, toast]);

  const totalClasses = summary.total_sessions;
  const classesAttended = summary.classes_attended;
  const classesMissed = summary.classes_missed;
  const overallPercentage = totalClasses > 0 ? Math.round((classesAttended / totalClasses) * 100) : 0;
  const classesTo75 = overallPercentage >= 75 || totalClasses === 0
    ? 0
    : Math.ceil(Math.max(0, (0.75 * totalClasses - classesAttended) / 0.25));
  const subjectStats = (summary.subject_stats || []).map(item => ({
    ...item,
    attendanceRate: item.total_sessions > 0
      ? Math.round((item.classes_attended / item.total_sessions) * 100)
      : 0
  }));
  const monthlyTrend = (summary.monthly_trend || []).map(item => ({
    ...item,
    monthLabel: new Date(`${item.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
    attendanceRate: item.total_sessions > 0
      ? Math.round((item.classes_attended / item.total_sessions) * 100)
      : 0
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Student Profile Card & Hero */}
      <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-elevated relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.full_name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-4 ring-white/20 shadow-md"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 flex items-center justify-center text-white font-extrabold text-2xl ring-4 ring-white/20">
                {user?.full_name?.charAt(0) || 'S'}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                  Student Portal
                </span>
                <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded-md">
                  Roll #{user?.roll_number || '101'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {user?.full_name}
              </h1>
              <p className="text-xs sm:text-sm text-white/80 mt-1">
                {user?.class_name || 'B.Tech CS 3rd Year'} • {user?.section || 'Section A'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              variant="secondary"
              size="lg"
              icon={ScanLine}
              onClick={() => navigate('/student/scan')}
              className="w-full sm:w-auto bg-white text-brand-700 hover:bg-brand-50 shadow-lg font-bold"
            >
              Scan QR Code
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Overall Attendance"
          value={`${overallPercentage}%`}
          subtitle="Eligibility target: 75%"
          icon={Percent}
          color={overallPercentage >= 75 ? 'emerald' : 'amber'}
          trend={overallPercentage >= 75 ? 'Eligible' : 'Low'}
          trendDirection={overallPercentage >= 75 ? 'up' : 'down'}
        />

        <StatCard
          title="Classes Attended"
          value={classesAttended}
          subtitle="Verified check-ins"
          icon={CheckCircle2}
          color="emerald"
        />

        <StatCard
          title="Classes Missed"
          value={classesMissed}
          subtitle="Unmarked sessions"
          icon={XCircle}
          color="rose"
        />

        <StatCard
          title="Total Conducted"
          value={totalClasses}
          subtitle="Curriculum sessions"
          icon={BookOpen}
          color="blue"
        />

        <StatCard
          title="Classes to 75%"
          value={overallPercentage >= 75 ? 'On target' : classesTo75}
          subtitle={overallPercentage >= 75 ? 'Keep your attendance up' : 'Attend every upcoming class to reach 75%'}
          icon={ShieldCheck}
          color={overallPercentage >= 75 ? 'emerald' : 'amber'}
        />
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Attendance analytics</h2>
          <p className="text-xs text-slate-500">Term performance across completed sessions for your class and section.</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-card">
            <h3 className="text-sm font-bold text-slate-900">Monthly attendance trend</h3>
            <p className="mt-1 text-xs text-slate-500">Your attendance rate for the last six months with completed sessions.</p>
            <div className="mt-4 h-64">
              {monthlyTrend.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Monthly statistics will appear after sessions are completed.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="studentAttendanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip formatter={value => [`${value}%`, 'Attendance']} />
                    <Area type="monotone" dataKey="attendanceRate" stroke="#2563eb" strokeWidth={3} fill="url(#studentAttendanceGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-card">
            <h3 className="text-sm font-bold text-slate-900">By subject</h3>
            <p className="mt-1 text-xs text-slate-500">Attended versus missed completed sessions for each subject.</p>
            <div className="mt-4 h-64">
              {subjectStats.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Subject statistics will appear after sessions are completed.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectStats} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="subject" tickLine={false} axisLine={false} fontSize={10} tickFormatter={value => value.length > 12 ? `${value.slice(0, 10)}...` : value} />
                    <YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip formatter={value => [`${value}%`, 'Attendance']} />
                    <Bar dataKey="attendanceRate" name="Attendance" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {subjectStats.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-card">
            <div className="border-b border-slate-100 p-5">
              <h3 className="text-sm font-bold text-slate-900">Subject breakdown</h3>
              <p className="mt-1 text-xs text-slate-500">Detailed counts based on completed classes.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Subject</th>
                    <th className="px-5 py-3">Attended</th>
                    <th className="px-5 py-3">Missed</th>
                    <th className="px-5 py-3">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjectStats.map(item => (
                    <tr key={item.subject}>
                      <td className="px-5 py-3 font-semibold text-slate-800">{item.subject}</td>
                      <td className="px-5 py-3 text-emerald-700">{item.classes_attended}</td>
                      <td className="px-5 py-3 text-rose-700">{item.total_sessions - item.classes_attended}</td>
                      <td className="px-5 py-3 font-bold text-slate-900">{item.attendanceRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Recent Attendance Activity */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-card">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Attendance History</h3>
            <p className="text-xs text-slate-500">Your logged classroom check-ins</p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/student/history')}
          >
            Full Log &rarr;
          </Button>
        </div>

        {studentHistory.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Clock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-600">No attendance records yet</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Click the "Scan QR Code" button above to mark your first class.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {studentHistory.slice(0, 5).map((rec) => (
              <div
                key={rec.id}
                className="py-3.5 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                    {rec.status === 'revoked'
                      ? <XCircle className="w-4 h-4" />
                      : <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {rec.subject || 'Class Lecture'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {rec.class_name} ({rec.section}) • {formatDate(rec.marked_at)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <Badge variant={rec.status === 'revoked' ? 'danger' : 'success'} size="sm" dot={true}>
                    {rec.status === 'revoked' ? 'Revoked' : 'Present'}
                  </Badge>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {formatTime(rec.marked_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
