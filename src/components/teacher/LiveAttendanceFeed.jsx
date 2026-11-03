import React from 'react';
import { Users, Smartphone, ShieldCheck, Ban } from 'lucide-react';
import Badge from '../common/Badge';
import { formatTime } from '../../utils/formatters';

export default function LiveAttendanceFeed({
  records = [],
  totalStudents = 0,
  sessionActive = false,
  onRevoke
}) {
  const presentCount = records.filter(record => !record.revoked_at && record.status !== 'revoked').length;
  const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600" />
            Live Attendee Feed
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Real-time QR verification log</p>
        </div>

        <div className="text-right">
          <span className="text-xl font-extrabold text-slate-900">
            {presentCount}
            <span className="text-xs font-medium text-slate-400">/{totalStudents}</span>
          </span>
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
            {attendanceRate}% Present
          </div>
        </div>
      </div>

      {/* Attendees list */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[380px]">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-2">
              <Users className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-xs font-semibold text-slate-600">Waiting for first scan...</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              Ask students to scan the QR code using their phones.
            </p>
          </div>
        ) : (
          records.map((record, index) => (
            <div
              key={record.id || index}
              className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-all animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <div className="flex items-center gap-3 min-w-0">
                {record.avatar ? (
                  <img src={record.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full border border-brand-200 object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs shrink-0 border border-brand-200">
                    {record.student_name ? record.student_name.charAt(0) : 'S'}
                  </div>
                )}
                <div className="truncate">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {record.student_name || 'Student'}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>Roll #{record.roll_number || 'N/A'}</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5 text-slate-400">
                      <Smartphone className="w-3 h-3" />
                      {record.device_info || 'Mobile Web'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pl-2">
                <div className="text-right">
                  <Badge variant={record.revoked_at || record.status === 'revoked' ? 'danger' : 'success'} size="sm" dot={true}>
                    {record.revoked_at || record.status === 'revoked' ? 'Revoked' : 'Verified'}
                  </Badge>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    {formatTime(record.marked_at)}
                  </div>
                </div>
                {sessionActive && !record.revoked_at && record.status !== 'revoked' && onRevoke && (
                  <button
                    type="button"
                    onClick={() => onRevoke(record)}
                    title={`Revoke attendance for ${record.student_name || 'student'}`}
                    aria-label={`Revoke attendance for ${record.student_name || 'student'}`}
                    className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                  >
                    <Ban className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Cryptographic Token Validated
        </span>
        <span>Anti-duplication active</span>
      </div>
    </div>
  );
}
