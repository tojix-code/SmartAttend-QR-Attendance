import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function AttendanceChart({ weeklyData = [], subjectData = [] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Weekly Attendance Trend Area Chart */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Attendance Trends</h3>
            <p className="text-xs text-slate-500">Weekly average participation rate (%)</p>
          </div>
          {weeklyData.length > 0 && (
            <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
              {weeklyData.length} day{weeklyData.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="h-64 w-full">
          {weeklyData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Attendance trends will appear after sessions are recorded.</div>
          ) : <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="attendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
                formatter={(value) => [`${value}%`, 'Attendance Rate']}
              />
              <Area
                type="monotone"
                dataKey="attendanceRate"
                stroke="#2563eb"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#attendGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>}
        </div>
      </div>

      {/* Subject Wise Performance Bar Chart */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Subject-wise Average</h3>
            <p className="text-xs text-slate-500">Attendance percentages across subjects</p>
          </div>
        </div>

        <div className="h-64 w-full">
          {subjectData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Subject statistics will appear after sessions are recorded.</div>
          ) : <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjectData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="subject" 
                stroke="#94a3b8" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(v) => v.length > 10 ? `${v.slice(0, 8)}...` : v} 
              />
              <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
                formatter={(value) => [`${value}%`, 'Average Attendance']}
              />
              <Bar dataKey="attendance" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>}
        </div>
      </div>
    </div>
  );
}
