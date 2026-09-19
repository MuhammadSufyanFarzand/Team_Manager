import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import { Lead, LeadActivityLog, AttendanceRecord, AttendanceStatus, UserDailyStats, UserProfile, LeaveRequest } from '../../types';
import { 
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle, 
  CalendarDays, Download, Filter, Search, UserCheck, 
  UserX, ChevronLeft, ChevronRight, Edit3, Save, 
  Sparkles, ShieldCheck, Flame, ArrowUpRight, Check,
  Timer, Coffee, Activity, User, HelpCircle, History,
  FileText, PlusCircle, CheckCheck, X
} from 'lucide-react';
import { MemberSelfAttendanceModal } from './MemberSelfAttendanceModal';

interface AttendanceRegisterProps {
  leads: Lead[];
  logs: LeadActivityLog[];
  allMembers: string[];
  currentUser: string;
  isAdmin: boolean;
  isOwner: boolean;
  onSelectMember?: (username: string) => void;
}

export function AttendanceRegister({
  leads,
  logs,
  allMembers,
  currentUser,
  isAdmin,
  isOwner,
  onSelectMember
}: AttendanceRegisterProps) {
  // Date selection state
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<'daily' | 'matrix' | 'leaves'>('daily');
  const [matrixRangeDays, setMatrixRangeDays] = useState<number>(7); // 7, 14, or 30 days
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');

  // Supabase & Local state for daily stats and user profiles
  const [dailyStats, setDailyStats] = useState<UserDailyStats[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [customAttendance, setCustomAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showSelfAttendance, setShowSelfAttendance] = useState(false);
  const [leaveActionLoading, setLeaveActionLoading] = useState<string | null>(null);
  const [adminRemarkInput, setAdminRemarkInput] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Edit Attendance Modal
  const [editingRecord, setEditingRecord] = useState<{
    username: string;
    date: string;
    currentStatus: AttendanceStatus;
    notes: string;
  } | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // 1. Fetch remote user daily stats, user profiles and custom attendance overrides
  useEffect(() => {
    fetchAttendanceData();
  }, [selectedDate, matrixRangeDays, viewMode]);

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      // 1. Fetch User Profiles for last_seen and avatars
      const { data: profiles } = await supabase.from('user_profiles').select('*');
      if (profiles) setUserProfiles(profiles as UserProfile[]);

      // 2. Fetch User Daily Stats from Supabase
      const { data: stats } = await supabase
        .from('user_daily_stats')
        .select('*')
        .order('date', { ascending: false })
        .limit(1000);
      if (stats) setDailyStats(stats as UserDailyStats[]);

      // 3. Fetch Custom Attendance Records if table exists
      try {
        const { data: attData } = await supabase
          .from('attendance_records')
          .select('*')
          .limit(1000);
        if (attData && attData.length > 0) {
          const map: Record<string, AttendanceRecord> = {};
          attData.forEach((rec: AttendanceRecord) => {
            const key = `${rec.date}_${rec.username.toLowerCase()}`;
            map[key] = rec;
          });
          setCustomAttendance(prev => ({ ...prev, ...map }));
        }
      } catch {
        // Fallback: Read from localStorage
        const localSaved = localStorage.getItem('custom_attendance_records');
        if (localSaved) {
          try {
            setCustomAttendance(JSON.parse(localSaved));
          } catch {}
        }
      }

      // 4. Fetch Leave Requests
      try {
        const { data: leaves } = await supabase
          .from('leave_requests')
          .select('*')
          .order('created_at', { ascending: false });
        if (leaves && leaves.length > 0) {
          setLeaveRequests(leaves as LeaveRequest[]);
        } else {
          loadAllLocalLeaves();
        }
      } catch {
        loadAllLocalLeaves();
      }
    } catch (err) {
      console.warn('Attendance fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllLocalLeaves = () => {
    try {
      const all: LeaveRequest[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('leave_requests_')) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const list: LeaveRequest[] = JSON.parse(raw);
              all.push(...list);
            } catch {}
          }
        }
      }
      setLeaveRequests(all);
    } catch {}
  };

  // Handle Leave Approval
  const handleApproveLeave = async (req: LeaveRequest) => {
    setLeaveActionLoading(req.id || req.username);
    const notes = adminRemarkInput[req.id || ''] || req.admin_notes || 'Approved by Admin';

    try {
      const updatedReq: LeaveRequest = {
        ...req,
        status: 'approved',
        admin_notes: notes,
        reviewed_by: currentUser,
        reviewed_at: new Date().toISOString()
      };

      // 1. Try Supabase update
      try {
        await supabase.from('leave_requests').upsert(updatedReq);
      } catch {}

      // 2. Mark attendance records as 'leave' for this date range
      const start = new Date(req.start_date);
      const end = new Date(req.end_date);
      const curr = new Date(start);
      const newCustom = { ...customAttendance };

      while (curr <= end) {
        const dStr = curr.toISOString().split('T')[0];
        const key = `${dStr}_${req.username.toLowerCase()}`;
        const newRecord: AttendanceRecord = {
          date: dStr,
          username: req.username,
          status: 'leave',
          notes: `Approved Leave (${req.leave_type}): ${req.reason}`,
          marked_by: currentUser,
          updated_at: new Date().toISOString()
        };
        newCustom[key] = newRecord;

        try {
          await supabase.from('attendance_records').upsert(newRecord);
        } catch {}

        curr.setDate(curr.getDate() + 1);
      }

      setCustomAttendance(newCustom);
      localStorage.setItem('custom_attendance_records', JSON.stringify(newCustom));

      // 3. Update local leave requests
      setLeaveRequests(prev => prev.map(l => (l.id === req.id ? updatedReq : l)));
      const localKey = `leave_requests_${req.username.toLowerCase()}`;
      const savedUserLeaves = localStorage.getItem(localKey);
      if (savedUserLeaves) {
        try {
          const list: LeaveRequest[] = JSON.parse(savedUserLeaves);
          const mapped = list.map(l => l.id === req.id ? updatedReq : l);
          localStorage.setItem(localKey, JSON.stringify(mapped));
        } catch {}
      }
    } catch (err) {
      console.warn('Leave approve failed:', err);
    } finally {
      setLeaveActionLoading(null);
    }
  };

  // Handle Leave Rejection
  const handleRejectLeave = async (req: LeaveRequest) => {
    setLeaveActionLoading(req.id || req.username);
    const notes = adminRemarkInput[req.id || ''] || req.admin_notes || 'Rejected by Admin';

    try {
      const updatedReq: LeaveRequest = {
        ...req,
        status: 'rejected',
        admin_notes: notes,
        reviewed_by: currentUser,
        reviewed_at: new Date().toISOString()
      };

      try {
        await supabase.from('leave_requests').upsert(updatedReq);
      } catch {}

      setLeaveRequests(prev => prev.map(l => (l.id === req.id ? updatedReq : l)));
      const localKey = `leave_requests_${req.username.toLowerCase()}`;
      const savedUserLeaves = localStorage.getItem(localKey);
      if (savedUserLeaves) {
        try {
          const list: LeaveRequest[] = JSON.parse(savedUserLeaves);
          const mapped = list.map(l => l.id === req.id ? updatedReq : l);
          localStorage.setItem(localKey, JSON.stringify(mapped));
        } catch {}
      }
    } catch (err) {
      console.warn('Leave reject failed:', err);
    } finally {
      setLeaveActionLoading(null);
    }
  };

  // Compile combined unique members list
  const memberList = useMemo(() => {
    const set = new Set<string>();
    allMembers.forEach(m => { if (m) set.add(m.trim()); });
    leads.forEach(l => {
      if (l.assigned_to) set.add(l.assigned_to.trim());
      if (l.added_by) set.add(l.added_by.trim());
    });
    userProfiles.forEach(p => {
      if (p.username) set.add(p.username.trim());
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [allMembers, leads, userProfiles]);

  // Helper: Compute Day Metrics for a Member on a Specific Date
  const getMemberDayData = (username: string, dateStr: string) => {
    const unameLower = username.toLowerCase();
    const customKey = `${dateStr}_${unameLower}`;
    const customRec = customAttendance[customKey];

    // Find in user_daily_stats
    const statItem = dailyStats.find(
      s => s.username?.toLowerCase() === unameLower && s.date === dateStr
    );

    // Find in lead logs for timestamps
    const memberLogs = logs.filter(l => {
      if (!l.username || l.username.toLowerCase() !== unameLower) return false;
      const logDate = (l.created_at || '').split('T')[0];
      return logDate === dateStr;
    });

    // Find in leads assigned/updated on this date
    const memberLeadsOnDate = leads.filter(l => {
      const isAssigned = l.assigned_to?.toLowerCase() === unameLower;
      const assDate = l.assigned_date || (l.created_at || '').split('T')[0];
      const upDate = (l.last_updated_at || '').split('T')[0];
      return isAssigned && (assDate === dateStr || upDate === dateStr);
    });

    // Calculate timestamps
    const timestamps: number[] = [];
    memberLogs.forEach(l => {
      if (l.created_at) timestamps.push(new Date(l.created_at).getTime());
    });
    memberLeadsOnDate.forEach(l => {
      if (l.last_updated_at) timestamps.push(new Date(l.last_updated_at).getTime());
      else if (l.created_at) timestamps.push(new Date(l.created_at).getTime());
    });

    const prof = userProfiles.find(p => p.username?.toLowerCase() === unameLower);
    const lastSeen = prof?.last_seen;
    if (lastSeen && lastSeen.startsWith(dateStr)) {
      timestamps.push(new Date(lastSeen).getTime());
    }

    let firstActiveTime: string | null = null;
    let lastActiveTime: string | null = null;
    if (timestamps.length > 0) {
      timestamps.sort((a, b) => a - b);
      firstActiveTime = new Date(timestamps[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      lastActiveTime = new Date(timestamps[timestamps.length - 1]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const activeSeconds = statItem?.active_seconds || (timestamps.length > 1 ? Math.min(28800, Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 1000)) : (timestamps.length === 1 ? 600 : 0));
    const clicks = statItem?.total_clicks || memberLogs.length * 4;
    const messages = statItem?.messages_sent || 0;
    const leadsHandled = memberLeadsOnDate.length + memberLogs.length;

    // Determine status
    let status: AttendanceStatus = 'absent';
    if (customRec?.status) {
      status = customRec.status;
    } else {
      if (activeSeconds >= 7200 || leadsHandled >= 3 || messages >= 5) {
        status = 'present';
      } else if (activeSeconds > 0 || leadsHandled > 0 || messages > 0 || timestamps.length > 0) {
        status = 'half_day';
      } else {
        status = 'absent';
      }
    }

    // Is online right now (active within last 2.5 minutes)
    const isOnlineNow = Boolean(
      lastSeen && (Date.now() - new Date(lastSeen).getTime() < 150000)
    );

    return {
      username,
      date: dateStr,
      status,
      firstActiveTime,
      lastActiveTime,
      activeSeconds,
      clicks,
      messages,
      leadsHandled,
      isOnlineNow,
      avatar: prof?.avatar_url,
      notes: customRec?.notes || '',
      markedBy: customRec?.marked_by || null,
      isCustom: Boolean(customRec)
    };
  };

  // 2. Data for the selected date
  const dailyRecords = useMemo(() => {
    return memberList.map(member => getMemberDayData(member, selectedDate));
  }, [memberList, selectedDate, dailyStats, logs, leads, userProfiles, customAttendance]);

  // Filtered daily records
  const filteredDailyRecords = useMemo(() => {
    return dailyRecords.filter(rec => {
      const matchSearch = !searchQuery || rec.username.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || rec.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [dailyRecords, searchQuery, statusFilter]);

  // 3. Matrix View Date Column Headers (e.g. past 7 or 14 or 30 days)
  const matrixDates = useMemo(() => {
    const list: string[] = [];
    const base = new Date();
    for (let i = 0; i < matrixRangeDays; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      list.push(d.toISOString().split('T')[0]);
    }
    return list;
  }, [matrixRangeDays]);

  // Matrix Member Rows
  const matrixRows = useMemo(() => {
    return memberList.map(username => {
      const dayMap: Record<string, ReturnType<typeof getMemberDayData>> = {};
      let presentCount = 0;
      let halfDayCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let totalSeconds = 0;

      matrixDates.forEach(d => {
        const data = getMemberDayData(username, d);
        dayMap[d] = data;
        totalSeconds += data.activeSeconds;
        if (data.status === 'present') presentCount++;
        else if (data.status === 'half_day') halfDayCount++;
        else if (data.status === 'leave') leaveCount++;
        else absentCount++;
      });

      const totalActiveDays = presentCount + (halfDayCount * 0.5);
      const attendancePercent = Math.round((totalActiveDays / matrixDates.length) * 100);

      return {
        username,
        dayMap,
        presentCount,
        halfDayCount,
        absentCount,
        leaveCount,
        totalSeconds,
        attendancePercent
      };
    }).filter(row => {
      if (!searchQuery) return true;
      return row.username.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [memberList, matrixDates, dailyStats, logs, leads, userProfiles, customAttendance, searchQuery]);

  // Summary Metrics for Today / Selected Date
  const summaryMetrics = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let halfDay = 0;
    let totalSeconds = 0;
    let onlineNow = 0;

    dailyRecords.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'leave') leave++;
      else if (r.status === 'half_day') halfDay++;

      totalSeconds += r.activeSeconds;
      if (r.isOnlineNow) onlineNow++;
    });

    const total = dailyRecords.length;
    const effectivePresent = present + (halfDay * 0.5);
    const attendanceRate = total > 0 ? Math.round((effectivePresent / total) * 100) : 0;
    const avgSecondsPerMember = total > 0 ? Math.round(totalSeconds / total) : 0;

    return {
      total,
      present,
      absent,
      leave,
      halfDay,
      totalSeconds,
      onlineNow,
      attendanceRate,
      avgSecondsPerMember
    };
  }, [dailyRecords]);

  // Format seconds to human readable
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0 min';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  // Handle Save Manual Attendance Status & Note
  const handleSaveAttendance = async () => {
    if (!editingRecord) return;
    setIsSavingRecord(true);

    const recordKey = `${editingRecord.date}_${editingRecord.username.toLowerCase()}`;
    const newRecord: AttendanceRecord = {
      date: editingRecord.date,
      username: editingRecord.username,
      status: editingRecord.currentStatus,
      notes: editingRecord.notes,
      marked_by: currentUser,
      updated_at: new Date().toISOString()
    };

    // Update local state immediately
    const updatedCustom = {
      ...customAttendance,
      [recordKey]: newRecord
    };
    setCustomAttendance(updatedCustom);
    localStorage.setItem('custom_attendance_records', JSON.stringify(updatedCustom));

    // Persist to Supabase if table exists
    try {
      await supabase.from('attendance_records').upsert({
        date: editingRecord.date,
        username: editingRecord.username,
        status: editingRecord.currentStatus,
        notes: editingRecord.notes,
        marked_by: currentUser,
        updated_at: new Date().toISOString()
      }, { onConflict: 'date,username' });
    } catch (e) {
      console.warn('Could not upsert to attendance_records in Supabase:', e);
    }

    setIsSavingRecord(false);
    setSaveSuccessMsg(`Attendance updated for ${editingRecord.username}!`);
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setEditingRecord(null);
    }, 900);
  };

  // Export Attendance CSV
  const handleExportAttendanceCsv = () => {
    const headers = [
      'Date', 'Member Username', 'Status', 'Punch In (First Active)', 
      'Punch Out (Last Active)', 'Active Duration (Hours:Mins)', 
      'Active Seconds', 'Leads Processed', 'Messages Sent', 
      'Total Clicks', 'Supervisor Notes', 'Marked By'
    ];

    const rows = dailyRecords.map(r => [
      `"${r.date}"`,
      `"${r.username}"`,
      `"${r.status.toUpperCase()}"`,
      `"${r.firstActiveTime || '--'}"`,
      `"${r.lastActiveTime || '--'}"`,
      `"${formatDuration(r.activeSeconds)}"`,
      r.activeSeconds,
      r.leadsHandled,
      r.messages,
      r.clicks,
      `"${r.notes.replace(/"/g, '""')}"`,
      `"${r.markedBy || 'System Auto'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Register_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Change Date Helper
  const shiftDate = (deltaDays: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + deltaDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar & Quick Date Navigator */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-2xl text-emerald-300 shadow-inner">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Attendance & Duty Register
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Tracking
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Rozana kon active tha, kiski chutti thi, kab login hua aur kitni der online raha ka record
                </p>
              </div>
            </div>
          </div>

          {/* Controls: Date Picker & View Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* My Self Attendance Portal Launcher */}
            <button
              onClick={() => setShowSelfAttendance(true)}
              className="px-3 py-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Apni rozana ki duty aur chutti ki application submit karein"
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>My Attendance & Leaves</span>
            </button>

            {/* View Mode Switcher */}
            <div className="flex bg-black/40 border border-white/10 p-1 rounded-2xl">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'daily'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Daily Log</span>
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'matrix'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Muster Roll (Matrix)</span>
              </button>
              <button
                onClick={() => setViewMode('leaves')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 relative ${
                  viewMode === 'leaves'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Leave Applications</span>
                {leaveRequests.filter(l => l.status === 'pending').length > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full animate-bounce">
                    {leaveRequests.filter(l => l.status === 'pending').length}
                  </span>
                )}
              </button>
            </div>

            {/* Date Navigator */}
            {viewMode === 'daily' ? (
              <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 p-1 rounded-2xl">
                <button
                  onClick={() => shiftDate(-1)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Pichhla Din"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    selectedDate === todayStr ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Aaj (Today)
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-800/80 border border-white/10 text-white text-xs font-semibold px-2 py-1 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer"
                />
                <button
                  onClick={() => shiftDate(1)}
                  disabled={selectedDate >= todayStr}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Agla Din"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : viewMode === 'matrix' ? (
              <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 p-1 rounded-2xl">
                {[7, 14, 30].map(days => (
                  <button
                    key={days}
                    onClick={() => setMatrixRangeDays(days)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      matrixRangeDays === days
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Last {days} Days
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs text-purple-300 font-bold bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-2xl">
                {leaveRequests.length} Total Applications
              </div>
            )}

            {/* Export CSV Button */}
            <button
              onClick={handleExportAttendanceCsv}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Attendance CSV Sheet Download Karein"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* 2. Top Attendance KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          {/* Total Members */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Strength</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-white">{summaryMetrics.total}</span>
              <span className="text-[10px] text-slate-400 font-semibold">Team Members</span>
            </div>
          </div>

          {/* Present Today */}
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Present (حاضر)
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-emerald-300">{summaryMetrics.present}</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                {Math.round((summaryMetrics.present / (summaryMetrics.total || 1)) * 100)}%
              </span>
            </div>
          </div>

          {/* Half Day */}
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Coffee className="w-3.5 h-3.5" /> Half Day (آدھا دن)
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-amber-300">{summaryMetrics.halfDay}</span>
              <span className="text-[10px] text-amber-400 font-semibold">&lt; 2 hours</span>
            </div>
          </div>

          {/* Absent / Chutti */}
          <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Absent (چھٹی پر)
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-rose-300">{summaryMetrics.absent}</span>
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded">
                {Math.round((summaryMetrics.absent / (summaryMetrics.total || 1)) * 100)}%
              </span>
            </div>
          </div>

          {/* Approved Leave */}
          <div className="bg-purple-950/20 border border-purple-500/20 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Leave (رخصت)
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-purple-300">{summaryMetrics.leave}</span>
              <span className="text-[10px] text-purple-400 font-semibold">Approved</span>
            </div>
          </div>

          {/* Total Active Hours */}
          <div className="bg-cyan-950/20 border border-cyan-500/20 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
              <Timer className="w-3.5 h-3.5" /> Total Duty Hours
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl font-black text-cyan-300">{formatDuration(summaryMetrics.totalSeconds)}</span>
              <span className="text-[10px] text-cyan-400 font-semibold">
                Avg: {formatDuration(summaryMetrics.avgSecondsPerMember)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/50 border border-white/10 p-3.5 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search member name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {viewMode === 'daily' && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {(['all', 'present', 'half_day', 'absent', 'leave'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors cursor-pointer capitalize whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white/15 text-white border border-white/20'
                    : 'text-slate-400 hover:text-white bg-transparent'
                }`}
              >
                {st === 'all' ? 'All Members' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. MAIN VIEW CONTAINER: Daily Register Table OR Monthly Matrix Grid */}
      {viewMode === 'daily' ? (
        /* DAILY ATTENDANCE REGISTER TABLE */
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                Daily Duty Register for <span className="text-emerald-400">{selectedDate}</span>
              </span>
              <span className="text-xs text-slate-400">({filteredDailyRecords.length} members shown)</span>
            </div>
            {isAdmin && (
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Admin can edit status & add supervisor notes
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-3">Attendance Status</th>
                  <th className="py-3 px-3">Punch In (Start)</th>
                  <th className="py-3 px-3">Punch Out (End)</th>
                  <th className="py-3 px-3">Active Duration</th>
                  <th className="py-3 px-3">Activity Breakdown</th>
                  <th className="py-3 px-3">Supervisor Notes</th>
                  {(isAdmin || isOwner) && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {filteredDailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No members matched your search criteria for {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  filteredDailyRecords.map((rec) => {
                    const statusConfig = {
                      present: {
                        label: 'Present (حاضر)',
                        bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                        icon: CheckCircle2,
                        dot: 'bg-emerald-400'
                      },
                      half_day: {
                        label: 'Half Day (آدھا دن)',
                        bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                        icon: Coffee,
                        dot: 'bg-amber-400'
                      },
                      absent: {
                        label: 'Absent (چھٹی)',
                        bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
                        icon: XCircle,
                        dot: 'bg-rose-400'
                      },
                      leave: {
                        label: 'Approved Leave (رخصت)',
                        bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
                        icon: Calendar,
                        dot: 'bg-purple-400'
                      }
                    }[rec.status];

                    const IconComp = statusConfig.icon;

                    return (
                      <tr 
                        key={rec.username}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Member Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-white text-xs shadow-md">
                                {rec.avatar ? (
                                  <img src={rec.avatar} alt={rec.username} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  rec.username.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              {rec.isOnlineNow && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full animate-pulse" title="Online Right Now" />
                              )}
                            </div>
                            <div>
                              <button
                                onClick={() => onSelectMember && onSelectMember(rec.username)}
                                className="font-bold text-white hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer text-left"
                              >
                                <span>{rec.username}</span>
                                {rec.username === currentUser && (
                                  <span className="text-[10px] text-emerald-400 bg-emerald-500/20 px-1 py-0.2 rounded font-normal">You</span>
                                )}
                              </button>
                              <div className="text-[10px] text-slate-400">
                                {rec.isOnlineNow ? (
                                  <span className="text-emerald-400 font-semibold">Active Right Now</span>
                                ) : (
                                  `Online Duty Log`
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold ${statusConfig.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                            <IconComp className="w-3 h-3" />
                            <span>{statusConfig.label}</span>
                          </span>
                        </td>

                        {/* Punch In */}
                        <td className="py-3.5 px-3">
                          {rec.firstActiveTime ? (
                            <div className="flex items-center gap-1.5 text-slate-200">
                              <Clock className="w-3 h-3 text-emerald-400" />
                              <span className="font-mono text-xs font-semibold">{rec.firstActiveTime}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 font-mono">--:--</span>
                          )}
                        </td>

                        {/* Punch Out */}
                        <td className="py-3.5 px-3">
                          {rec.lastActiveTime ? (
                            <div className="flex items-center gap-1.5 text-slate-200">
                              <Clock className="w-3 h-3 text-cyan-400" />
                              <span className="font-mono text-xs font-semibold">{rec.lastActiveTime}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 font-mono">--:--</span>
                          )}
                        </td>

                        {/* Active Duration */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono text-xs font-bold ${
                              rec.activeSeconds >= 14400 ? 'text-emerald-300' :
                              rec.activeSeconds > 0 ? 'text-amber-300' : 'text-slate-500'
                            }`}>
                              {formatDuration(rec.activeSeconds)}
                            </span>
                            {rec.activeSeconds > 0 && (
                              <div className="w-12 bg-white/10 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-emerald-400 h-full rounded-full"
                                  style={{ width: `${Math.min(100, Math.round((rec.activeSeconds / 28800) * 100))}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Activity Breakdown */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span title="Leads Processed">
                              <strong className="text-white">{rec.leadsHandled}</strong> leads
                            </span>
                            <span>•</span>
                            <span title="Messages Sent">
                              <strong className="text-white">{rec.messages}</strong> msgs
                            </span>
                            <span>•</span>
                            <span title="Clicks">
                              <strong className="text-white">{rec.clicks}</strong> clicks
                            </span>
                          </div>
                        </td>

                        {/* Notes */}
                        <td className="py-3.5 px-3">
                          {rec.notes ? (
                            <span className="text-[11px] text-slate-300 italic bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 line-clamp-1 max-w-[180px]" title={rec.notes}>
                              "{rec.notes}"
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        {(isAdmin || isOwner) && (
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setEditingRecord({
                                username: rec.username,
                                date: selectedDate,
                                currentStatus: rec.status,
                                notes: rec.notes || ''
                              })}
                              className="px-2.5 py-1 bg-white/5 hover:bg-emerald-500/20 hover:border-emerald-500/40 border border-white/10 text-slate-300 hover:text-emerald-300 text-[11px] font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Edit Attendance Status / Add Note"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'matrix' ? (
        /* MUSTER ROLL MATRIX VIEW (Multiple Days Grid) */
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                Muster Roll Attendance Matrix (Last {matrixRangeDays} Days)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                P (Present) • A (Absent) • H (Half Day) • L (Leave)
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500" /> Present
              <span className="inline-block w-2.5 h-2.5 rounded bg-rose-500 ml-2" /> Absent
              <span className="inline-block w-2.5 h-2.5 rounded bg-amber-500 ml-2" /> Half Day
              <span className="inline-block w-2.5 h-2.5 rounded bg-purple-500 ml-2" /> Leave
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-slate-900 z-10">Member</th>
                  {matrixDates.map(d => {
                    const dateObj = new Date(d);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
                    const dayNum = dateObj.getDate();
                    const isToday = d === todayStr;

                    return (
                      <th key={d} className={`py-2 px-2 text-center min-w-[36px] ${isToday ? 'bg-emerald-500/10 text-emerald-300 font-black' : ''}`}>
                        <div className="text-[10px] text-slate-400">{dayName}</div>
                        <div className="text-xs font-mono">{dayNum}</div>
                      </th>
                    );
                  })}
                  <th className="py-3 px-3 text-center">P</th>
                  <th className="py-3 px-3 text-center">H</th>
                  <th className="py-3 px-3 text-center">A</th>
                  <th className="py-3 px-3 text-center">Total Duty</th>
                  <th className="py-3 px-4 text-center">Rate %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {matrixRows.map(row => (
                  <tr key={row.username} className="hover:bg-white/[0.02] transition-colors">
                    {/* Member Name */}
                    <td className="py-2.5 px-4 sticky left-0 bg-slate-900/95 z-10">
                      <button
                        onClick={() => onSelectMember && onSelectMember(row.username)}
                        className="font-bold text-white hover:text-emerald-300 transition-colors text-left truncate max-w-[130px]"
                      >
                        {row.username}
                      </button>
                    </td>

                    {/* Matrix Day Badges */}
                    {matrixDates.map(d => {
                      const dayData = row.dayMap[d];
                      const st = dayData.status;
                      const badgeClass = {
                        present: 'bg-emerald-500 text-white shadow-emerald-500/40',
                        half_day: 'bg-amber-500 text-black shadow-amber-500/40',
                        absent: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
                        leave: 'bg-purple-500 text-white shadow-purple-500/40'
                      }[st];

                      const char = {
                        present: 'P',
                        half_day: 'H',
                        absent: 'A',
                        leave: 'L'
                      }[st];

                      return (
                        <td key={d} className="py-2 px-1 text-center">
                          <button
                            onClick={() => {
                              setSelectedDate(d);
                              setViewMode('daily');
                            }}
                            className={`w-6 h-6 rounded-md text-[10px] font-black inline-flex items-center justify-center transition-transform hover:scale-125 cursor-pointer ${badgeClass}`}
                            title={`${row.username} on ${d}: ${st.toUpperCase()} (${formatDuration(dayData.activeSeconds)})`}
                          >
                            {char}
                          </button>
                        </td>
                      );
                    })}

                    {/* Aggregate Stats */}
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-400">{row.presentCount}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-amber-400">{row.halfDayCount}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-400">{row.absentCount}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-cyan-300 font-bold">
                      {formatDuration(row.totalSeconds)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black ${
                        row.attendancePercent >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        row.attendancePercent >= 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {row.attendancePercent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* LEAVE REQUESTS MANAGEMENT VIEW (Admin Review & Approval) */
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl space-y-4">
          <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-950/20">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Member Leave Applications & Approval Desk (چھٹی کی درخواستیں)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Team members ki taraf se aane wali leave requests ko yahan se approve ya reject karein
              </p>
            </div>

            <button
              onClick={() => setShowSelfAttendance(true)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Apply for Leave</span>
            </button>
          </div>

          <div className="p-4 sm:p-5">
            {leaveRequests.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl">
                <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-400">No Leave Applications Submitted</div>
                <p className="text-xs text-slate-500 mt-1">Abhi tak kisi member ne chutti ki request nahi bheji.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaveRequests.map((req, idx) => {
                  const isPending = req.status === 'pending';
                  const isActing = leaveActionLoading === (req.id || req.username);

                  return (
                    <div
                      key={req.id || idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        isPending
                          ? 'bg-purple-950/30 border-purple-500/40 shadow-lg shadow-purple-900/10'
                          : 'bg-black/30 border-white/10'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm font-black text-white">{req.username}</span>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {req.leave_type} Leave
                            </span>
                            <span className="text-xs font-mono text-emerald-400 font-bold">
                              📅 {req.start_date} {req.start_date !== req.end_date ? `➔ ${req.end_date}` : ''}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 italic">
                            Reason: <span className="text-white">"{req.reason}"</span>
                          </p>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>Submitted: {new Date(req.created_at).toLocaleDateString()}</span>
                            {req.reviewed_by && (
                              <span>• Reviewed by: <strong className="text-slate-300">{req.reviewed_by}</strong></span>
                            )}
                            {req.admin_notes && (
                              <span>• Notes: <strong className="text-amber-300">"{req.admin_notes}"</strong></span>
                            )}
                          </div>
                        </div>

                        {/* Actions for Admin / Owner */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isPending && (isAdmin || isOwner) ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <input
                                type="text"
                                placeholder="Admin remark (optional)..."
                                value={adminRemarkInput[req.id || ''] || ''}
                                onChange={(e) => setAdminRemarkInput({ ...adminRemarkInput, [req.id || '']: e.target.value })}
                                className="px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                              />
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleApproveLeave(req)}
                                  disabled={isActing}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-md disabled:opacity-50"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleRejectLeave(req)}
                                  disabled={isActing}
                                  className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-md disabled:opacity-50"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            </div>
                          ) : (
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
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Member Self Attendance & Leave Application Modal */}
      {showSelfAttendance && (
        <MemberSelfAttendanceModal
          isOpen={showSelfAttendance}
          onClose={() => setShowSelfAttendance(false)}
          currentUser={currentUser}
          isAdmin={isAdmin}
          isOwner={isOwner}
        />
      )}

      {/* 5. EDIT ATTENDANCE MODAL (For Admins) */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-black text-white">Adjust Attendance Record</h3>
                <p className="text-xs text-slate-400">
                  {editingRecord.username} • <span className="text-emerald-400">{editingRecord.date}</span>
                </p>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Status Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Attendance Status</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'present', label: 'Present (حاضر)', icon: CheckCircle2, color: 'border-emerald-500 bg-emerald-500/20 text-emerald-300' },
                  { key: 'half_day', label: 'Half Day (آدھا دن)', icon: Coffee, color: 'border-amber-500 bg-amber-500/20 text-amber-300' },
                  { key: 'absent', label: 'Absent (چھٹی)', icon: XCircle, color: 'border-rose-500 bg-rose-500/20 text-rose-300' },
                  { key: 'leave', label: 'Leave (رخصت)', icon: Calendar, color: 'border-purple-500 bg-purple-500/20 text-purple-300' }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = editingRecord.currentStatus === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setEditingRecord({ ...editingRecord, currentStatus: item.key as AttendanceStatus })}
                      className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected ? item.color + ' ring-2 ring-white/20' : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Supervisor Notes / Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Supervisor Reason / Remarks (Optional)
              </label>
              <textarea
                value={editingRecord.notes}
                onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                placeholder="e.g. Medical leave approved, outdoor meeting, electricity issue..."
                rows={3}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Status Message */}
            {saveSuccessMsg && (
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2">
                <Check className="w-4 h-4" /> {saveSuccessMsg}
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAttendance}
                disabled={isSavingRecord}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-black text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingRecord ? 'Saving...' : 'Save Record'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
