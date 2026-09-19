import React, { useState, useMemo } from 'react';
import { Lead, LeadActivityLog } from '../../types';
import { 
  TrendingUp, Users, CheckCircle2, Copy, Crown, Flame, 
  Award, Target, Calendar, Sparkles, ChevronRight, BarChart3, 
  Clock, Zap, DollarSign, Download, Search, Filter, ArrowUpRight, 
  ArrowDownRight, Eye, Database, HelpCircle, Check, RefreshCw, 
  ArrowRight, ShieldCheck, Activity, Layers, Star, CalendarDays
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DailyMemberProgressProps {
  leads: Lead[];
  logs?: LeadActivityLog[];
  allMembers: string[];
  currentUser: string;
  onSelectMember?: (username: string) => void;
  onNavigateTab?: (tab: 'leads' | 'members' | 'distribution' | 'attendance') => void;
}

export function DailyMemberProgress({
  leads,
  logs = [],
  allMembers,
  currentUser,
  onSelectMember,
  onNavigateTab
}: DailyMemberProgressProps) {
  // 1. Date Range State
  const [timeRange, setTimeRange] = useState<'today' | 'yesterday' | '7d' | '14d' | '30d' | 'custom'>('7d');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // 2. Daily Goal Target (Configurable)
  const [dailyContactGoal, setDailyContactGoal] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('team_daily_contact_goal');
      return saved ? Number(saved) : 10;
    } catch {
      return 10;
    }
  });

  const [dailyCloseGoal, setDailyCloseGoal] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('team_daily_close_goal');
      return saved ? Number(saved) : 2;
    } catch {
      return 2;
    }
  });

  // 3. Search & Sort State
  const [searchMember, setSearchMember] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'closed' | 'contacted' | 'total' | 'winrate' | 'goal'>('score');
  const [activeChartTab, setActiveChartTab] = useState<'timeline' | 'comparison' | 'heatmap'>('timeline');
  const [selectedDayMemberModal, setSelectedDayMemberModal] = useState<string | null>(null);
  const [hoveredDateIndex, setHoveredDateIndex] = useState<number | null>(null);

  // Helper date calculations
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  const yesterdayObj = new Date(now);
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  // Calculate start & end bounds for the selected range
  const { rangeStartDate, rangeEndDate, dateList } = useMemo(() => {
    let start = new Date(now);
    let end = new Date(now);
    let numDays = 7;

    if (timeRange === 'today') {
      start = new Date(now);
      end = new Date(now);
      numDays = 1;
    } else if (timeRange === 'yesterday') {
      start = new Date(yesterdayObj);
      end = new Date(yesterdayObj);
      numDays = 1;
    } else if (timeRange === '7d') {
      start.setDate(now.getDate() - 6);
      numDays = 7;
    } else if (timeRange === '14d') {
      start.setDate(now.getDate() - 13);
      numDays = 14;
    } else if (timeRange === '30d') {
      start.setDate(now.getDate() - 29);
      numDays = 30;
    } else if (timeRange === 'custom') {
      start = new Date(customStartDate || todayStr);
      end = new Date(customEndDate || todayStr);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      numDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
    }

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    // Generate list of date strings for timeline chart
    const dates: string[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    return { rangeStartDate: startStr, rangeEndDate: endStr, dateList: dates };
  }, [timeRange, customStartDate, customEndDate, todayStr]);

  // Filter leads within the selected date range
  const filteredLeadsInRange = useMemo(() => {
    return leads.filter(l => {
      const dStr = l.assigned_date || (l.created_at ? l.created_at.split('T')[0] : '');
      if (!dStr) return false;
      return dStr >= rangeStartDate && dStr <= rangeEndDate;
    });
  }, [leads, rangeStartDate, rangeEndDate]);

  // Combined active members list
  const combinedMembers = useMemo(() => {
    const set = new Set(allMembers);
    leads.forEach(l => {
      if (l.assigned_to) set.add(l.assigned_to);
      if (l.added_by) set.add(l.added_by);
    });
    return Array.from(set).filter(Boolean);
  }, [allMembers, leads]);

  // Calculate detailed daily metrics per member
  const memberDailyStats = useMemo(() => {
    const stats: Record<string, {
      username: string;
      totalAssigned: number;
      contacted: number;
      interested: number;
      closed: number;
      notInterested: number;
      newLeads: number;
      copied: number;
      winRate: number;
      pipelineRate: number;
      dailyScore: number;
      goalProgressPct: number;
      activeDaysCount: number;
      estimatedRevenue: number;
      dayBreakdown: Record<string, {
        assigned: number;
        contacted: number;
        interested: number;
        closed: number;
        score: number;
      }>;
    }> = {};

    // Initialize all members
    combinedMembers.forEach(m => {
      stats[m] = {
        username: m,
        totalAssigned: 0,
        contacted: 0,
        interested: 0,
        closed: 0,
        notInterested: 0,
        newLeads: 0,
        copied: 0,
        winRate: 0,
        pipelineRate: 0,
        dailyScore: 0,
        goalProgressPct: 0,
        activeDaysCount: 0,
        estimatedRevenue: 0,
        dayBreakdown: {}
      };
      // Initialize days
      dateList.forEach(d => {
        stats[m].dayBreakdown[d] = { assigned: 0, contacted: 0, interested: 0, closed: 0, score: 0 };
      });
    });

    // Populate from filtered leads
    filteredLeadsInRange.forEach(l => {
      const u = l.assigned_to;
      if (!u) return;

      if (!stats[u]) {
        stats[u] = {
          username: u,
          totalAssigned: 0,
          contacted: 0,
          interested: 0,
          closed: 0,
          notInterested: 0,
          newLeads: 0,
          copied: 0,
          winRate: 0,
          pipelineRate: 0,
          dailyScore: 0,
          goalProgressPct: 0,
          activeDaysCount: 0,
          estimatedRevenue: 0,
          dayBreakdown: {}
        };
        dateList.forEach(d => {
          stats[u].dayBreakdown[d] = { assigned: 0, contacted: 0, interested: 0, closed: 0, score: 0 };
        });
      }

      const dStr = l.assigned_date || (l.created_at ? l.created_at.split('T')[0] : '');

      stats[u].totalAssigned += 1;
      stats[u].copied += (l.copied_count || 0);
      stats[u].estimatedRevenue += (l.deal_value || 100);

      if (stats[u].dayBreakdown[dStr]) {
        stats[u].dayBreakdown[dStr].assigned += 1;
      }

      if (l.status === 'contacted') {
        stats[u].contacted += 1;
        if (stats[u].dayBreakdown[dStr]) stats[u].dayBreakdown[dStr].contacted += 1;
      } else if (l.status === 'interested') {
        stats[u].interested += 1;
        if (stats[u].dayBreakdown[dStr]) stats[u].dayBreakdown[dStr].interested += 1;
      } else if (l.status === 'closed') {
        stats[u].closed += 1;
        if (stats[u].dayBreakdown[dStr]) stats[u].dayBreakdown[dStr].closed += 1;
      } else if (l.status === 'not_interested') {
        stats[u].notInterested += 1;
      } else {
        stats[u].newLeads += 1;
      }
    });

    // Calculate derived rates, score & active streak days
    Object.values(stats).forEach(s => {
      s.winRate = s.totalAssigned > 0 ? (s.closed / s.totalAssigned) * 100 : 0;
      s.pipelineRate = s.totalAssigned > 0 ? ((s.closed + s.interested + s.contacted) / s.totalAssigned) * 100 : 0;
      
      // Daily activity score formula: Closed=25pts, Interested=10pts, Contacted=5pts, Copied=2pts
      s.dailyScore = (s.closed * 25) + (s.interested * 10) + (s.contacted * 5) + (s.copied * 2);

      // Target goal calculation (contacts + closed deals vs target)
      const targetBase = Math.max(1, dailyContactGoal * (timeRange === 'today' || timeRange === 'yesterday' ? 1 : Math.min(dateList.length, 7)));
      const actualProgress = s.contacted + (s.closed * 2);
      s.goalProgressPct = Math.min(200, Math.round((actualProgress / targetBase) * 100));

      // Calculate active days in this range
      let activeDays = 0;
      Object.entries(s.dayBreakdown).forEach(([d, dayData]) => {
        dayData.score = (dayData.closed * 25) + (dayData.interested * 10) + (dayData.contacted * 5);
        if (dayData.contacted > 0 || dayData.interested > 0 || dayData.closed > 0) {
          activeDays += 1;
        }
      });
      s.activeDaysCount = activeDays;
    });

    return stats;
  }, [combinedMembers, filteredLeadsInRange, dateList, dailyContactGoal, timeRange]);

  // Overall Team Aggregates in Selected Range
  const teamAggregates = useMemo(() => {
    const totalAssigned = filteredLeadsInRange.length;
    const totalClosed = filteredLeadsInRange.filter(l => l.status === 'closed').length;
    const totalInterested = filteredLeadsInRange.filter(l => l.status === 'interested').length;
    const totalContacted = filteredLeadsInRange.filter(l => l.status === 'contacted').length;
    const totalNew = filteredLeadsInRange.filter(l => l.status === 'new').length;
    const totalLost = filteredLeadsInRange.filter(l => l.status === 'not_interested').length;
    const totalCopies = filteredLeadsInRange.reduce((acc, l) => acc + (l.copied_count || 0), 0);
    const winRate = totalAssigned > 0 ? ((totalClosed / totalAssigned) * 100).toFixed(1) : '0';
    
    // Active members in this range
    const activeMembersCount = Object.values(memberDailyStats).filter(m => m.totalAssigned > 0 || m.contacted > 0 || m.closed > 0).length;

    // Team MVP in range
    const membersArr = Object.values(memberDailyStats);
    const topMvp = membersArr.length > 0 ? [...membersArr].sort((a, b) => b.closed - a.closed || b.dailyScore - a.dailyScore)[0] : null;

    // Target calculation for team
    const teamDailyTarget = Math.max(1, dailyContactGoal * (timeRange === 'today' || timeRange === 'yesterday' ? 1 : Math.min(dateList.length, 7)) * Math.max(1, activeMembersCount));
    const teamCurrentProgress = totalContacted + (totalClosed * 2);
    const teamGoalProgressPct = Math.min(200, Math.round((teamCurrentProgress / teamDailyTarget) * 100));

    return {
      totalAssigned,
      totalClosed,
      totalInterested,
      totalContacted,
      totalNew,
      totalLost,
      totalCopies,
      winRate,
      activeMembersCount,
      topMvp,
      teamGoalProgressPct,
      teamCurrentProgress,
      teamDailyTarget
    };
  }, [filteredLeadsInRange, memberDailyStats, dailyContactGoal, timeRange, dateList]);

  // Timeline series data per date (for Area & Line chart)
  const timelineChartData = useMemo(() => {
    return dateList.map(dateStr => {
      const dayLeads = leads.filter(l => {
        const d = l.assigned_date || (l.created_at ? l.created_at.split('T')[0] : '');
        return d === dateStr;
      });

      const assigned = dayLeads.length;
      const contacted = dayLeads.filter(l => l.status === 'contacted').length;
      const interested = dayLeads.filter(l => l.status === 'interested').length;
      const closed = dayLeads.filter(l => l.status === 'closed').length;
      const score = (closed * 25) + (interested * 10) + (contacted * 5);

      const dateObj = new Date(dateStr + 'T00:00:00');
      const label = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const shortLabel = dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

      return {
        dateStr,
        label,
        shortLabel,
        assigned,
        contacted,
        interested,
        closed,
        score
      };
    });
  }, [dateList, leads]);

  // Maximum value for timeline chart scaling
  const maxTimelineVal = useMemo(() => {
    const maxVal = Math.max(
      ...timelineChartData.map(d => Math.max(d.assigned, d.contacted + d.interested + d.closed, 5)),
      10
    );
    return maxVal;
  }, [timelineChartData]);

  // Filtered and Sorted Member List for Table
  const sortedMembers = useMemo(() => {
    return Object.values(memberDailyStats)
      .filter(m => m.username.toLowerCase().includes(searchMember.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'score') return b.dailyScore - a.dailyScore || b.closed - a.closed;
        if (sortBy === 'closed') return b.closed - a.closed || b.dailyScore - a.dailyScore;
        if (sortBy === 'contacted') return b.contacted - a.contacted;
        if (sortBy === 'total') return b.totalAssigned - a.totalAssigned;
        if (sortBy === 'winrate') return b.winRate - a.winRate;
        if (sortBy === 'goal') return b.goalProgressPct - a.goalProgressPct;
        return 0;
      });
  }, [memberDailyStats, searchMember, sortBy]);

  // Day-of-week productivity heatmap aggregation
  const dayOfWeekHeatmap = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const heatmap: Record<string, { assigned: number; contacted: number; closed: number; score: number }> = {};
    days.forEach(d => {
      heatmap[d] = { assigned: 0, contacted: 0, closed: 0, score: 0 };
    });

    filteredLeadsInRange.forEach(l => {
      const dStr = l.assigned_date || (l.created_at ? l.created_at.split('T')[0] : '');
      if (!dStr) return;
      const dayName = days[new Date(dStr + 'T00:00:00').getDay()];
      if (heatmap[dayName]) {
        heatmap[dayName].assigned += 1;
        if (l.status === 'contacted') heatmap[dayName].contacted += 1;
        if (l.status === 'interested') heatmap[dayName].score += 10;
        if (l.status === 'closed') {
          heatmap[dayName].closed += 1;
          heatmap[dayName].score += 25;
        }
      }
    });

    const maxScore = Math.max(...Object.values(heatmap).map(h => h.score), 10);
    return { heatmap, maxScore, days };
  }, [filteredLeadsInRange]);

  // Export Daily Progress Report to CSV
  const handleExportCsv = () => {
    if (sortedMembers.length === 0) return;
    const headers = [
      'Rank', 'Member Username', 'Assigned In Range', 'Contacted', 
      'Interested', 'Closed Deals', 'Win Rate %', 'Daily Score (Points)', 
      'Goal Completion %', 'Active Days Count'
    ];
    const rows = sortedMembers.map((m, idx) => [
      idx + 1,
      `"${m.username}"`,
      m.totalAssigned,
      m.contacted,
      m.interested,
      m.closed,
      `"${m.winRate.toFixed(1)}%"`,
      m.dailyScore,
      `"${m.goalProgressPct}%"`,
      m.activeDaysCount
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `member_daily_progress_report_${rangeStartDate}_to_${rangeEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGoalChange = (type: 'contact' | 'close', val: number) => {
    if (type === 'contact') {
      setDailyContactGoal(val);
      localStorage.setItem('team_daily_contact_goal', String(val));
    } else {
      setDailyCloseGoal(val);
      localStorage.setItem('team_daily_close_goal', String(val));
    }
  };

  const selectedMemberDayData = selectedDayMemberModal ? memberDailyStats[selectedDayMemberModal] : null;

  return (
    <div className="space-y-6 text-white">
      {/* 1. TOP CONTROL & DATE FILTER BAR */}
      <div className="bg-slate-900/90 border border-purple-500/20 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                Daily Member Progress & Activity Intelligence
              </h2>
              <p className="text-xs text-white/50">
                Track real-time output, closing velocity, daily streaks & target completion
              </p>
            </div>
          </div>
        </div>

        {/* Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-black/60 rounded-2xl border border-white/10 shrink-0">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7d', label: '7 Days' },
            { id: '14d', label: '14 Days' },
            { id: '30d', label: '30 Days' },
            { id: 'custom', label: 'Custom' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setTimeRange(btn.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeRange === btn.id
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Pickers (Shown only when 'custom' is selected) */}
      {timeRange === 'custom' && (
        <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-white/70 font-semibold">From Date:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-purple-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/70 font-semibold">To Date:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-purple-400"
            />
          </div>
          <span className="text-purple-300 font-mono">
            Selected: {dateList.length} days range
          </span>
        </div>
      )}

      {/* 2. TEAM PERFORMANCE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Team Goal Completion Meter */}
        <div className="bg-gradient-to-br from-purple-950/40 via-slate-900 to-black/60 border border-purple-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4 text-purple-400" /> Team Goal Progress
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              teamAggregates.teamGoalProgressPct >= 100 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
            }`}>
              {teamAggregates.teamGoalProgressPct}%
            </span>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-white">
              {teamAggregates.teamCurrentProgress} <span className="text-sm text-white/40 font-normal">/ {teamAggregates.teamDailyTarget} pts</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mt-2.5 relative">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${
                  teamAggregates.teamGoalProgressPct >= 100 
                    ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-sm shadow-emerald-500' 
                    : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                }`}
                style={{ width: `${Math.min(100, teamAggregates.teamGoalProgressPct)}%` }}
              />
            </div>
          </div>
          <div className="text-[11px] text-white/50 flex items-center justify-between">
            <span>Target: {dailyContactGoal} contacts/member</span>
            <span>{teamAggregates.activeMembersCount} active members</span>
          </div>
        </div>

        {/* Daily Top Closer / MVP */}
        <div 
          onClick={() => teamAggregates.topMvp && onSelectMember && onSelectMember(teamAggregates.topMvp.username)}
          className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-black/60 border border-amber-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-amber-400/60 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-400" /> Daily MVP Performer
            </span>
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="my-3">
            <div className="text-xl sm:text-2xl font-black text-white truncate">
              {teamAggregates.topMvp && teamAggregates.topMvp.dailyScore > 0 ? `@${teamAggregates.topMvp.username}` : 'Awaiting Activity'}
            </div>
            <div className="text-xs text-amber-300/90 font-semibold mt-0.5">
              {teamAggregates.topMvp && teamAggregates.topMvp.dailyScore > 0
                ? `${teamAggregates.topMvp.closed} Won Deals • ${teamAggregates.topMvp.dailyScore} Pts`
                : 'No actions recorded yet today'}
            </div>
          </div>
          <div className="text-[11px] text-white/50 flex items-center justify-between">
            <span>Win Rate: {teamAggregates.topMvp ? `${teamAggregates.topMvp.winRate.toFixed(0)}%` : '0%'}</span>
            <span className="text-amber-400 flex items-center gap-1 font-semibold">Inspect <ChevronRight className="w-3 h-3" /></span>
          </div>
        </div>

        {/* Closed Deals & Conversion Rate */}
        <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-black/60 border border-emerald-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Closed Deals Won
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
              {teamAggregates.winRate}% Win Rate
            </span>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">
              {teamAggregates.totalClosed} <span className="text-sm text-white/50 font-normal">Won</span>
            </div>
            <div className="text-xs text-white/60 mt-1 flex items-center gap-2">
              <span className="text-cyan-300 font-semibold">{teamAggregates.totalContacted} Contacted</span>
              <span>•</span>
              <span className="text-amber-300 font-semibold">{teamAggregates.totalInterested} Interested</span>
            </div>
          </div>
          <div className="text-[11px] text-white/50 flex items-center justify-between">
            <span>From {teamAggregates.totalAssigned} total assigned leads</span>
          </div>
        </div>

        {/* Quick CSV Export & Reports Hub */}
        <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-black/60 border border-indigo-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4 text-indigo-400" /> Export Reports
            </span>
            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md">
              CSV / Excel
            </span>
          </div>
          <div className="my-2 space-y-2">
            <button
              onClick={handleExportCsv}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-bold flex items-center justify-between transition-all cursor-pointer shadow-md active:scale-95"
            >
              <span className="flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-indigo-300" /> Download Full CSV Report
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
            </button>

            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('attendance')}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/50 hover:to-teal-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-between transition-all cursor-pointer shadow-md active:scale-95"
              >
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-300" /> Open Attendance Register
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            )}
          </div>
          <div className="text-[10px] text-white/40 truncate">
            Export all member metrics, scores & conversion data
          </div>
        </div>
      </div>

      {/* 3. VISUAL INTERACTIVE GRAPHS SECTION */}
      <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <span>Interactive Progress Visualizer & Graphs</span>
            </h3>
            <p className="text-xs text-white/50">
              Visual timeline progression of daily contacts, hot prospects & deals won
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-black/60 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setActiveChartTab('timeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'timeline'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Timeline Trend
            </button>
            <button
              onClick={() => setActiveChartTab('comparison')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'comparison'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Member Comparison
            </button>
            <button
              onClick={() => setActiveChartTab('heatmap')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'heatmap'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Weekly Heatmap
            </button>
          </div>
        </div>

        {/* TAB 1: INTERACTIVE TIMELINE TREND CHART (SVG) */}
        {activeChartTab === 'timeline' && (
          <div className="space-y-4">
            {/* Chart Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-white/80 font-medium">
                  <span className="w-3 h-3 rounded-full bg-purple-500" /> Total Assigned
                </span>
                <span className="flex items-center gap-1.5 text-cyan-300 font-medium">
                  <span className="w-3 h-3 rounded-full bg-cyan-400" /> Contacted
                </span>
                <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                  <span className="w-3 h-3 rounded-full bg-amber-400" /> Interested (Warm)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                  <span className="w-3 h-3 rounded-full bg-emerald-400" /> Closed (Won)
                </span>
              </div>
              <span className="text-[11px] text-white/40">
                Hover over bars to inspect daily details
              </span>
            </div>

            {/* SVG Visual Timeline Chart */}
            <div className="relative w-full h-64 sm:h-72 bg-black/60 rounded-2xl p-4 border border-white/5 flex flex-col justify-between overflow-hidden">
              {timelineChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/40 text-xs">
                  No activity logs in this date range.
                </div>
              ) : (
                <div className="h-full w-full flex items-end justify-between gap-1.5 sm:gap-3 pt-6 pb-2">
                  {timelineChartData.map((d, index) => {
                    const assignedHeight = Math.min(100, Math.max(4, (d.assigned / maxTimelineVal) * 100));
                    const contactedHeight = Math.min(100, (d.contacted / maxTimelineVal) * 100);
                    const interestedHeight = Math.min(100, (d.interested / maxTimelineVal) * 100);
                    const closedHeight = Math.min(100, (d.closed / maxTimelineVal) * 100);
                    const isHovered = hoveredDateIndex === index;

                    return (
                      <div
                        key={d.dateStr}
                        onMouseEnter={() => setHoveredDateIndex(index)}
                        onMouseLeave={() => setHoveredDateIndex(null)}
                        className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                      >
                        {/* Interactive Tooltip Card */}
                        {isHovered && (
                          <div className="absolute bottom-full mb-2 bg-slate-900 border border-purple-500/40 rounded-xl p-2.5 shadow-2xl z-30 min-w-[140px] text-[11px] pointer-events-none animate-fadeIn">
                            <div className="font-bold text-white border-b border-white/10 pb-1 mb-1 flex items-center justify-between">
                              <span>{d.label}</span>
                              <span className="text-purple-300 font-mono">{d.score} pts</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-white/70">
                                <span>Assigned:</span> <span className="font-bold text-white">{d.assigned}</span>
                              </div>
                              <div className="flex justify-between text-cyan-300">
                                <span>Contacted:</span> <span className="font-bold">{d.contacted}</span>
                              </div>
                              <div className="flex justify-between text-amber-300">
                                <span>Interested:</span> <span className="font-bold">{d.interested}</span>
                              </div>
                              <div className="flex justify-between text-emerald-300">
                                <span>Closed Won:</span> <span className="font-bold">{d.closed}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Multi-tier stacked bar */}
                        <div className="w-full max-w-[28px] sm:max-w-[42px] bg-white/5 rounded-t-lg overflow-hidden flex flex-col justify-end transition-all group-hover:brightness-125 border border-white/10" style={{ height: `${assignedHeight}%` }}>
                          {/* Segment: Closed */}
                          {d.closed > 0 && (
                            <div 
                              className="w-full bg-emerald-500 transition-all" 
                              style={{ height: `${(d.closed / Math.max(1, d.assigned)) * 100}%` }}
                              title={`Closed: ${d.closed}`}
                            />
                          )}
                          {/* Segment: Interested */}
                          {d.interested > 0 && (
                            <div 
                              className="w-full bg-amber-400 transition-all" 
                              style={{ height: `${(d.interested / Math.max(1, d.assigned)) * 100}%` }}
                              title={`Interested: ${d.interested}`}
                            />
                          )}
                          {/* Segment: Contacted */}
                          {d.contacted > 0 && (
                            <div 
                              className="w-full bg-cyan-400 transition-all" 
                              style={{ height: `${(d.contacted / Math.max(1, d.assigned)) * 100}%` }}
                              title={`Contacted: ${d.contacted}`}
                            />
                          )}
                        </div>

                        {/* Date Label on X Axis */}
                        <span className="text-[10px] text-white/40 mt-2 font-mono group-hover:text-purple-300 truncate w-full text-center">
                          {d.shortLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MEMBER COMPARISON BAR GRAPH */}
        {activeChartTab === 'comparison' && (
          <div className="space-y-4">
            <div className="text-xs text-white/60">
              Side-by-side comparison of total leads worked, contacts made, and deals closed per member.
            </div>
            <div className="space-y-3">
              {sortedMembers.slice(0, 8).map((m, idx) => {
                const maxScore = Math.max(...sortedMembers.map(x => x.dailyScore), 10);
                const scoreWidth = Math.min(100, Math.max(8, (m.dailyScore / maxScore) * 100));

                return (
                  <div key={m.username} className="bg-black/40 border border-white/5 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          idx === 0 ? 'bg-amber-500 text-black font-black' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-white/70'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-bold text-white">@{m.username}</span>
                        {m.closed > 0 && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.2 rounded font-semibold">
                            {m.closed} Closed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-cyan-300">{m.contacted} contacted</span>
                        <span className="text-purple-300 font-bold">{m.dailyScore} pts</span>
                      </div>
                    </div>

                    {/* Progress Output Bar */}
                    <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full transition-all duration-700" 
                        style={{ width: `${scoreWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: WEEKLY PRODUCTIVITY HEATMAP */}
        {activeChartTab === 'heatmap' && (
          <div className="space-y-4">
            <div className="text-xs text-white/60">
              Aggregated closing & contacting intensity by day of the week to identify peak sales shifts.
            </div>
            <div className="grid grid-cols-7 gap-2">
              {dayOfWeekHeatmap.days.map(dayName => {
                const data = dayOfWeekHeatmap.heatmap[dayName] || { assigned: 0, contacted: 0, closed: 0, score: 0 };
                const intensity = Math.min(100, Math.round((data.score / Math.max(1, dayOfWeekHeatmap.maxScore)) * 100));

                return (
                  <div
                    key={dayName}
                    className="bg-black/60 border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-between text-center min-h-[110px]"
                  >
                    <span className="text-xs font-bold text-white uppercase">{dayName}</span>
                    <div className="my-2">
                      <div className="text-lg font-black text-white">{data.closed}</div>
                      <div className="text-[10px] text-emerald-400 font-semibold">Closed Deals</div>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-purple-500 h-full rounded-full transition-all" 
                        style={{ width: `${intensity}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white/40 mt-1 font-mono">{data.contacted} calls</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. MEMBER DAILY PROGRESS MASTER TABLE */}
      <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
        {/* Table Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Users className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">
                Member Daily Performance & Streaks Leaderboard
              </h3>
              <p className="text-xs text-white/50">
                Detailed metrics, contact count, won deals, and daily goals
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchMember}
                onChange={e => setSearchMember(e.target.value)}
                placeholder="Search member..."
                className="bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-purple-400 w-36 sm:w-44"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
            >
              <option value="score">Sort by Daily Score (Pts)</option>
              <option value="closed">Sort by Closed Won</option>
              <option value="contacted">Sort by Contacted</option>
              <option value="total">Sort by Total Assigned</option>
              <option value="winrate">Sort by Win Rate %</option>
              <option value="goal">Sort by Goal % Achieved</option>
            </select>
          </div>
        </div>

        {/* Master Table (Desktop & Mobile View) */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs text-white/80 min-w-[750px]">
            <thead className="bg-black/40 text-white/50 font-bold uppercase tracking-wider text-[10px] border-b border-white/10">
              <tr>
                <th className="py-3 px-3">Rank & Member</th>
                <th className="py-3 px-3">Daily Goal Target</th>
                <th className="py-3 px-3 text-center">Assigned</th>
                <th className="py-3 px-3 text-center">Contacted</th>
                <th className="py-3 px-3 text-center">Interested</th>
                <th className="py-3 px-3 text-center">Closed Won</th>
                <th className="py-3 px-3 text-center">Win Rate %</th>
                <th className="py-3 px-3 text-right">Daily Score</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedMembers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-white/40">
                    No members matching search query.
                  </td>
                </tr>
              ) : (
                sortedMembers.map((m, idx) => {
                  const isTopRank = idx === 0 && m.dailyScore > 0;
                  const isGoalAchieved = m.goalProgressPct >= 100;

                  return (
                    <tr 
                      key={m.username}
                      className="hover:bg-white/5 transition-colors group cursor-pointer"
                      onClick={() => setSelectedDayMemberModal(m.username)}
                    >
                      {/* Rank & Username */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                            idx === 0 && m.dailyScore > 0 
                              ? 'bg-amber-400 text-black font-black shadow-md shadow-amber-500/20' 
                              : idx === 1 
                              ? 'bg-slate-300 text-black font-bold' 
                              : idx === 2 
                              ? 'bg-amber-700 text-white font-bold' 
                              : 'bg-white/5 text-white/60'
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>@{m.username}</span>
                              {isTopRank && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                            </div>
                            <div className="text-[10px] text-white/40 flex items-center gap-1">
                              {m.activeDaysCount > 0 ? (
                                <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                                  <Flame className="w-3 h-3" /> {m.activeDaysCount}d active
                                </span>
                              ) : (
                                <span>No activity yet</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Goal Progress Bar */}
                      <td className="py-3 px-3 min-w-[140px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/60">{m.contacted} / {dailyContactGoal}</span>
                            <span className={`font-bold ${isGoalAchieved ? 'text-emerald-400' : 'text-purple-300'}`}>
                              {m.goalProgressPct}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isGoalAchieved 
                                  ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' 
                                  : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                              }`}
                              style={{ width: `${Math.min(100, m.goalProgressPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Assigned */}
                      <td className="py-3 px-3 text-center font-semibold text-white/80">
                        {m.totalAssigned}
                      </td>

                      {/* Contacted */}
                      <td className="py-3 px-3 text-center font-bold text-cyan-300">
                        {m.contacted}
                      </td>

                      {/* Interested */}
                      <td className="py-3 px-3 text-center font-bold text-amber-300">
                        {m.interested}
                      </td>

                      {/* Closed */}
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md font-bold ${
                          m.closed > 0 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' 
                            : 'text-white/40'
                        }`}>
                          {m.closed}
                        </span>
                      </td>

                      {/* Win Rate */}
                      <td className="py-3 px-3 text-center font-mono">
                        <span className={`font-bold ${m.winRate >= 20 ? 'text-emerald-400' : m.winRate > 0 ? 'text-cyan-300' : 'text-white/40'}`}>
                          {m.winRate.toFixed(1)}%
                        </span>
                      </td>

                      {/* Daily Score */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-black text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 rounded-xl">
                          {m.dailyScore} pts
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayMemberModal(m.username);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-purple-600/30 border border-white/10 hover:border-purple-500/40 text-white/70 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Daily Log
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. INDIVIDUAL MEMBER DAY-BY-DAY HISTORY MODAL */}
      {selectedDayMemberModal && selectedMemberDayData && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-xl p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-slate-950 border border-purple-500/30 rounded-3xl shadow-2xl p-5 sm:p-6 overflow-hidden flex flex-col max-h-[85vh] text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-sm">
                  {selectedMemberDayData.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    @{selectedMemberDayData.username} — Day-by-Day Historical Log
                  </h3>
                  <p className="text-xs text-white/50">
                    Daily breakdown for the selected {dateList.length}-day timeframe
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDayMemberModal(null)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Quick stats for this member */}
            <div className="grid grid-cols-4 gap-2 my-4">
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-center">
                <div className="text-xs text-white/50">Assigned</div>
                <div className="text-base font-bold text-white">{selectedMemberDayData.totalAssigned}</div>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-center">
                <div className="text-xs text-cyan-300">Contacted</div>
                <div className="text-base font-bold text-cyan-300">{selectedMemberDayData.contacted}</div>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-center">
                <div className="text-xs text-amber-300">Interested</div>
                <div className="text-base font-bold text-amber-300">{selectedMemberDayData.interested}</div>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-center">
                <div className="text-xs text-emerald-300">Closed</div>
                <div className="text-base font-bold text-emerald-300">{selectedMemberDayData.closed}</div>
              </div>
            </div>

            {/* Daily History Table for Member */}
            <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/10 rounded-2xl">
              <table className="w-full text-left text-xs text-white/80">
                <thead className="bg-black/60 text-white/50 font-bold uppercase text-[10px] sticky top-0 border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-center">Assigned</th>
                    <th className="py-2.5 px-3 text-center">Contacted</th>
                    <th className="py-2.5 px-3 text-center">Interested</th>
                    <th className="py-2.5 px-3 text-center">Closed Won</th>
                    <th className="py-2.5 px-3 text-right">Daily Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dateList.slice().reverse().map(dStr => {
                    const dayData = selectedMemberDayData.dayBreakdown[dStr] || { assigned: 0, contacted: 0, interested: 0, closed: 0, score: 0 };
                    const dObj = new Date(dStr + 'T00:00:00');
                    const label = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                    return (
                      <tr key={dStr} className="hover:bg-white/5">
                        <td className="py-2.5 px-3 font-medium text-white">{label}</td>
                        <td className="py-2.5 px-3 text-center text-white/70">{dayData.assigned}</td>
                        <td className="py-2.5 px-3 text-center text-cyan-300 font-semibold">{dayData.contacted}</td>
                        <td className="py-2.5 px-3 text-center text-amber-300 font-semibold">{dayData.interested}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded ${dayData.closed > 0 ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-white/40'}`}>
                            {dayData.closed}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-300">
                          {dayData.score} pts
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-4 flex justify-between items-center text-xs">
              <span className="text-white/50">Score Formula: Closed=25pts • Interested=10pts • Contacted=5pts</span>
              <button
                onClick={() => {
                  if (onSelectMember) onSelectMember(selectedMemberDayData.username);
                  setSelectedDayMemberModal(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all cursor-pointer shadow-md"
              >
                Inspect All Leads
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
