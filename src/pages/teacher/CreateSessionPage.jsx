import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAttendance } from '../../context/AttendanceContext';
import { attendanceService } from '../../services/attendanceService';
import { 
  PlusCircle, 
  Clock, 
  BookOpen, 
  Layers, 
  FileText, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import Button from '../../components/common/Button';

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const { createNewSession } = useAttendance();

  const [loading, setLoading] = useState(false);
  const [registeredGroups, setRegisteredGroups] = useState([]);
  const [formData, setFormData] = useState({
    className: '',
    subject: '',
    section: '',
    durationMinutes: 15,
    description: ''
  });

  const classOptions = registeredGroups.map(group => group.className);
  const sectionOptions = registeredGroups.find(group => group.className === formData.className)?.sections || [];

  useEffect(() => {
    let isMounted = true;

    const loadOptions = async () => {
      try {
        const students = await attendanceService.getStudents({ includeAvatars: false });
        if (!isMounted) return;

        const groupsMap = {};
        students.forEach(student => {
          if (!student.class_name || !student.section) return;
          if (!groupsMap[student.class_name]) {
            groupsMap[student.class_name] = new Set();
          }
          groupsMap[student.class_name].add(student.section);
        });

        const groups = Object.entries(groupsMap)
          .map(([className, sections]) => ({ className, sections: [...sections].sort() }))
          .sort((a, b) => a.className.localeCompare(b.className));

        setRegisteredGroups(groups);

        if (!formData.className && groups.length > 0) {
          setFormData(prev => ({ ...prev, className: groups[0].className }));
        }
      } catch (err) {
        console.error('Unable to load registered classes:', err);
        if (isMounted) setRegisteredGroups([]);
      }
    };

    loadOptions();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!formData.className) {
      setFormData(prev => ({ ...prev, section: '' }));
      return;
    }

    const validSections = sectionOptions;
    if (validSections.length === 1) {
      setFormData(prev => ({ ...prev, section: validSections[0] }));
      return;
    }

    if (formData.section && !validSections.includes(formData.section)) {
      setFormData(prev => ({ ...prev, section: '' }));
    }
  }, [formData.className, sectionOptions]);

  const durationOptions = [
    { label: '5 Minutes (Quick Pulse Check)', value: 5 },
    { label: '10 Minutes (Standard Quiz/Lecture)', value: 10 },
    { label: '15 Minutes (Recommended)', value: 15 },
    { label: '30 Minutes (Full Class)', value: 30 },
    { label: '45 Minutes (Extended Lab)', value: 45 },
    { label: '60 Minutes (Examination)', value: 60 }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await createNewSession(formData);
    setLoading(false);

    if (result.success) {
      navigate('/teacher/live-session');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
          Attendance Generator
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Create Attendance Session
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Generate an auto-expiring QR code with cryptographic token security.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-card">
        <form onSubmit={handleSubmit} className="space-y-6">
          <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            Class and section must match the values assigned to students by your administrator.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-brand-600" />
                Class / Degree
              </label>
              <input
                list="registered-class-options"
                type="text"
                value={formData.className}
                onChange={(e) => setFormData({ ...formData, className: e.target.value, section: '' })}
                maxLength={120}
                required
                placeholder={classOptions.length ? 'Select registered class' : 'Use the class name assigned to students'}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <datalist id="registered-class-options">
                {classOptions.map((className) => (
                  <option key={className} value={className} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-600" />
                Section
              </label>
              <input
                list="registered-section-options"
                type="text"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                maxLength={64}
                required
                placeholder={sectionOptions.length ? 'Select registered section' : 'Exact section name, e.g. Section A'}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <datalist id="registered-section-options">
                {sectionOptions.map((section) => (
                  <option key={section} value={section} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Subject Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Subject Name
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              maxLength={120}
              placeholder="e.g. Mathematics"
              required
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          <div>
            {/* Session Duration */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-600" />
                QR Expiry Duration
              </label>
              <select
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                required
              >
                {durationOptions.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Session Notes / Topic (Optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g. Chapter 4 - Tree Traversals and Binary Search Trees"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          {/* Security Guarantee Note */}
          <div className="p-3.5 rounded-2xl bg-brand-50/70 border border-brand-100 flex items-start gap-3 text-xs text-brand-900">
            <Sparkles className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Upon clicking generate, a <strong>cryptographically secure token</strong> will be created. The session will automatically expire in <strong>{formData.durationMinutes} minutes</strong> and reject all duplicate attendance submissions.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => navigate('/teacher/dashboard')}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              icon={ArrowRight}
            >
              Generate QR Code & Start Session
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
