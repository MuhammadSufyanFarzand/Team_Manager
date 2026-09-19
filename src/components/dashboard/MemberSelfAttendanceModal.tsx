import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import { 
  AttendanceRecord, AttendanceStatus, UserDailyStats, 
  UserProfile, LeaveRequest, LeaveType, LeaveStatus, LeadActivityLog 
} from '../../types';
import { 
  X, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, 
  Send, History, FileText, Check, Coffee, Timer, UserCheck, 
  Sparkles, ShieldCheck, ChevronLeft, ChevronRight, CalendarDays,
  PlusCircle, RefreshCw, AlertTriangle, ArrowRight, User
} from 'lucide-react';

interface MemberSelfAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string;
  isAdmin?: boolean;
  isOwner?: boolean;
}

export function MemberSelfAttendanceModal({
  isOpen,
  onClose,
  currentUser,
  isAdmin = false,
  isOwner = false
}: MemberSelfAttendanceModalProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'apply_leave' | 'my_leaves'>('today');
  const [loading, setLoading] = useState(false);

  // Today string
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Data states
  const [userStats, setUserStats] = useState<UserDailyStats[]>([]);
  const [customAttendance, setCustomAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  // Leave Form State
  const [leaveStartDate, setLeaveStartDate] = useState<string>(todayStr);
  const [leaveEndDate, setLeaveEndDate] = useState<string>(todayStr);
  const [leaveType, setLeaveType] = useState<LeaveType>('casual');
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveSuccessMsg, setLeaveSuccessMsg] = useState<string | null>(null);
  const [leaveErrorMsg, setLeaveErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMemberData();
    }
  }, [isOpen, currentUser, selectedMonth]);

  const fetchMemberData = async () => {
    setLoading(true);
    try {
      const uname = currentUser?.trim().toLowerCase();
      if (!uname) return;

      // 1. Fetch Profile
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('username', uname)
        .maybeSingle();
      if (prof) setUserProfile(prof as UserProfile);

      // 2. Fetch User Daily Stats
      const { data: stats } = await supabase
        .from('user_daily_stats')
        .select('*')
        .ilike('username', uname)
        .order('date', { ascending: false })
        .limit(120);
      if (stats) setUserStats(stats as UserDailyStats[]);

      // 3. Fetch Custom Attendance Records
      try {
        const { data: attData } = await supabase
          .from('attendance_records')
          .select('*')
          .ilike('username', uname);
        if (attData) {
          const map: Record<string, AttendanceRecord> = {};
          attData.forEach((rec: AttendanceRecord) => {
            map[rec.date] = rec;
          });
          setCustomAttendance(map);
        }
      } catch {
        const local = localStorage.getItem('custom_attendance_records');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            const userSpecific: Record<string, AttendanceRecord> = {};
            Object.keys(parsed).forEach(k => {
              if (k.toLowerCase().includes(uname)) {
                const rec = parsed[k];
                userSpecific[rec.date] = rec;
              }
            });
            setCustomAttendance(userSpecific);
          } catch {}
        }
      }

      // 4. Fetch Leave Requests
      try {
        const { data: leaves } = await supabase
          .from('leave_requests')
          .select('*')
          .ilike('username', uname)
          .order('created_at', { ascending: false });
        if (leaves) {
          setLeaveRequests(leaves as LeaveRequest[]);
        } else {
          loadLocalLeaves();
        }
      } catch {
        loadLocalLeaves();
      }
    } catch (err) {
      console.warn('Member attendance fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLocalLeaves = () => {
    try {
      const local = localStorage.getItem(`leave_requests_${currentUser.toLowerCase()}`);
      if (local) {
        setLeaveRequests(JSON.parse(local));
      }
    } catch {}
  };

  // Helper to format duration
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  // Compute Today's Stats
  const todayRecord = useMemo(() => {
    const statItem = userStats.find(s => s.date === todayStr);
    const custom = customAttendance[todayStr];

    const activeSec = statItem?.active_seconds || 0;
    const clicks = statItem?.total_clicks || 0;
    const msgs = statItem?.messages_sent || 0;

    let status: AttendanceStatus = 'absent';
    if (custom?.status) {
      status = custom.status;
    } else if (activeSec >= 7200 || msgs >= 5) {
      status = 'present';
    } else if (activeSec > 0 || msgs > 0) {
      status = 'half_day';
    }

    return {
      date: todayStr,
      activeSeconds: activeSec,
      clicks,
      messages: msgs,
      status,
      notes: custom?.notes || '',
      firstActiveTime: userProfile?.last_seen && userProfile.last_seen.startsWith(todayStr) 
        ? new Date(userProfile.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Active today'
    };
  }, [userStats, customAttendance, todayStr, userProfile]);

  // Compute Month Stats based on selectedMonth (YYYY-MM)
  const monthDaysList = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const list = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${yearStr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      // Do not include future dates beyond today
      if (dStr > todayStr) continue;

      const statItem = userStats.find(s => s.date === dStr);
      const custom = customAttendance[dStr];
      const activeSec = statItem?.active_seconds || (custom?.active_seconds || 0);
      const clicks = statItem?.total_clicks || (custom?.total_clicks || 0);
      const msgs = statItem?.messages_sent || (custom?.messages_sent || 0);

      let status: AttendanceStatus = 'absent';
      if (custom?.status) {
        status = custom.status;
      } else if (activeSec >= 7200 || msgs >= 5) {
        status = 'present';
      } else if (activeSec > 0 || msgs > 0) {
        status = 'half_day';
      }

      list.push({
        date: dStr,
        dayNum: day,
        dayName: new Date(dStr).toLocaleDateString('en-US', { weekday: 'short' }),
        status,
        activeSeconds: activeSec,
        clicks,
        messages: msgs,
        notes: custom?.notes || ''
      });
    }

    // reverse so most recent days are at top
    return list.reverse();
  }, [selectedMonth, userStats, customAttendance, todayStr]);

  // Monthly aggregated numbers
  const monthlySummary = useMemo(() => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let leave = 0;
    let totalSeconds = 0;

    monthDaysList.forEach(item => {
      if (item.status === 'present') present++;
      else if (item.status === 'half_day') halfDay++;
      else if (item.status === 'leave') leave++;
      else absent++;

      totalSeconds += item.activeSeconds;
    });

    const totalDaysRecorded = monthDaysList.length;
    const effectivePresent = present + (halfDay * 0.5);
    const attendanceRate = totalDaysRecorded > 0 ? Math.round((effectivePresent / totalDaysRecorded) * 100) : 0;

    return {
      totalDaysRecorded,
      present,
      halfDay,
      absent,
      leave,
      totalSeconds,
      attendanceRate
    };
  }, [monthDaysList]);

  // Handle Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) {
      setLeaveErrorMsg('Barahe karam chutti ki waja (Reason) likhein.');
      return;
    }

    if (leaveEndDate < leaveStartDate) {
      setLeaveErrorMsg('End date start date se pehle nahi ho sakti.');
      return;
    }

    setSubmittingLeave(true);
    setLeaveErrorMsg(null);

    const newLeave: LeaveRequest = {
      id: `leave_${Date.now()}`,
      username: currentUser,
      start_date: leaveStartDate,
      end_date: leaveEndDate,
      leave_type: leaveType,
      reason: leaveReason.trim(),
      status: 'pending',
      created_at: new Date().toISOString()
    };

    try {
      // 1. Try Supabase insert
      try {
        await supabase.from('leave_requests').insert([newLeave]);
      } catch (e) {
        console.warn('Could not insert to Supabase leave_requests:', e);
      }

      // 2. Update local state & storage
      const updated = [newLeave, ...leaveRequests];
      setLeaveRequests(updated);
      localStorage.setItem(`leave_requests_${currentUser.toLowerCase()}`, JSON.stringify(updated));

      setLeaveSuccessMsg('Aapki leave request Admin ko bhej di gayi hai!');
      setLeaveReason('');
      setTimeout(() => {
        setLeaveSuccessMsg(null);
        setActiveTab('my_leaves');
      }, 1200);
    } catch (err: any) {
      setLeaveErrorMsg(err.message || 'Leave request submit karne me masla aya.');
    } finally {
      setSubmittingLeave(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">
                  My Attendance & Leave Portal
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {currentUser}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Apni rozana ki duty time, chuttiyon ka hisab aur online attendance dekhein
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-white/10 px-4 sm:px-6 bg-black/20 gap-2 overflow-x-auto">
          {[
            { id: 'today', label: "Today's Status (آج کی حاضری)", icon: Clock },
            { id: 'history', label: 'Attendance History (ریکارڈ)', icon: History },
            { id: 'apply_leave', label: 'Apply Leave (چھٹی کی درخواست)', icon: PlusCircle },
            { id: 'my_leaves', label: `My Applications (${leaveRequests.length})`, icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: TODAY'S STATUS */}
          {activeTab === 'today' && (
            <div className="space-y-5">
              {/* Today's Hero Card */}
              <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/90 border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Live Session Today
                      </span>
                      <span className="text-xs text-slate-400 font-mono">({todayStr})</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-1 flex items-baseline gap-2">
                      <span>{formatDuration(todayRecord.activeSeconds)}</span>
                      <span className="text-xs font-medium text-slate-400">Total Active Duty</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`px-4 py-2 rounded-2xl border text-xs font-black flex items-center gap-2 ${
                      todayRecord.status === 'present'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/20'
                        : todayRecord.status === 'half_day'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}>
                      {todayRecord.status === 'present' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      <span className="capitalize">{todayRecord.status.replace('_', ' ')} (حاضر)</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar towards 8 hour day */}
                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
                    <span>Target Duty Goal (8 Hours):</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {Math.min(100, Math.round((todayRecord.activeSeconds / 28800) * 100))}% Completed
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round((todayRecord.activeSeconds / 28800) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Today's breakdown metrics */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-3 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Messages Sent</div>
                    <div className="text-xl font-black text-cyan-300 mt-1">{todayRecord.messages}</div>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-3 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Clicks / Actions</div>
                    <div className="text-xl font-black text-indigo-300 mt-1">{todayRecord.clicks}</div>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-3 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Punch Status</div>
                    <div className="text-sm font-bold text-emerald-300 mt-1">Checked In</div>
                  </div>
                </div>
              </div>

              {/* Quick Summary Grid */}
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Need a day off or sick leave?</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Submit a formal leave request for admin approval</p>
                </div>
                <button
                  onClick={() => setActiveTab('apply_leave')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Apply Leave</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Month Picker & Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02] border border-white/10 p-3.5 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">Select Month:</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-800 border border-white/10 text-white text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer font-bold"
                  />
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400 font-bold">Present: {monthlySummary.present}</span>
                  <span className="text-amber-400 font-bold">Half Day: {monthlySummary.halfDay}</span>
                  <span className="text-rose-400 font-bold">Absent: {monthlySummary.absent}</span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-black border border-emerald-500/30">
                    {monthlySummary.attendanceRate}% Rate
                  </span>
                </div>
              </div>

              {/* History Table */}
              <div className="border border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-3">Day</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Active Duty Hours</th>
                      <th className="py-2.5 px-3">Actions / Msgs</th>
                      <th className="py-2.5 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {monthDaysList.map(item => (
                      <tr key={item.date} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-white">{item.date}</td>
                        <td className="py-2.5 px-3 text-slate-400">{item.dayName}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            item.status === 'present' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            item.status === 'half_day' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            item.status === 'leave' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                            'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {item.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-cyan-300 font-semibold">
                          {formatDuration(item.activeSeconds)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {item.messages} msgs • {item.clicks} clicks
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 italic text-[11px]">
                          {item.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: APPLY FOR LEAVE */}
          {activeTab === 'apply_leave' && (
            <form onSubmit={handleSubmitLeave} className="space-y-4 max-w-xl mx-auto">
              <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  Chutti Ki Darkhwast (Submit Leave Application)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Darkhwast submit hone ke baad Admin review karke approve ya reject karega.
                </p>
              </div>

              {/* Leave Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase">Leave Category / Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'casual', label: 'Casual Leave (اتفاقیہ)' },
                    { id: 'sick', label: 'Sick / Medical (طبی)' },
                    { id: 'emergency', label: 'Emergency (ہنگامی)' },
                    { id: 'annual', label: 'Annual / Planned' }
                  ].map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setLeaveType(t.id as LeaveType)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        leaveType === t.id
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20'
                          : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Start Date</label>
                  <input
                    type="date"
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">End Date</label>
                  <input
                    type="date"
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    required
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Reason / Waja (Explanation)</label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Barahe karam chutti ki tafseel ya waja likhein..."
                  rows={4}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                  required
                />
              </div>

              {/* Error / Success Messages */}
              {leaveErrorMsg && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {leaveErrorMsg}
                </div>
              )}

              {leaveSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" /> {leaveSuccessMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingLeave}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submittingLeave ? 'Submitting Application...' : 'Send Leave Request to Admin'}</span>
              </button>
            </form>
          )}

          {/* TAB 4: MY LEAVE APPLICATIONS */}
          {activeTab === 'my_leaves' && (
            <div className="space-y-3">
              {leaveRequests.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <div className="text-sm font-bold text-slate-400">No Leave Applications Found</div>
                  <p className="text-xs text-slate-500 mt-1">Aap ne abhi tak koi chutti ki request submit nahi ki.</p>
                  <button
                    onClick={() => setActiveTab('apply_leave')}
                    className="mt-3 px-4 py-1.5 bg-white/10 hover:bg-white/15 text-emerald-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Apply Now
                  </button>
                </div>
              ) : (
                leaveRequests.map((req, idx) => (
                  <div
                    key={req.id || idx}
                    className="bg-slate-800/60 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white capitalize">{req.leave_type} Leave</span>
                        <span className="text-xs font-mono text-slate-400">
                          ({req.start_date} {req.start_date !== req.end_date ? `to ${req.end_date}` : ''})
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 italic">"{req.reason}"</p>
                      {req.admin_notes && (
                        <div className="text-[11px] text-amber-300 mt-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Admin Remark: {req.admin_notes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 ${
                        req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        req.status === 'rejected' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {req.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                         req.status === 'rejected' ? <XCircle className="w-3.5 h-3.5" /> :
                         <Clock className="w-3.5 h-3.5" />}
                        <span>{req.status}</span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-white/10 flex items-center justify-between bg-black/20 text-xs text-slate-400">
          <span>Logged in as: <strong className="text-white">{currentUser}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
