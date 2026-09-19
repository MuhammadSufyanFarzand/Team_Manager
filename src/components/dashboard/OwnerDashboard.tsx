import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../../supabase';
import { Lead, LeadActivityLog } from '../../types';
import { getStoredLeadLogs } from '../../lib/leadLogs';
import { 
  X, BarChart2, Users, Database, Clock, RefreshCw, 
  Crown, ShieldCheck, Download, Sparkles, UserCheck, 
  ArrowRightLeft, Layers, HelpCircle, TrendingUp, CalendarDays 
} from 'lucide-react';
import { DashboardOverview } from './DashboardOverview';
import { MemberPerformance } from './MemberPerformance';
import { DailyMemberProgress } from './DailyMemberProgress';
import { AttendanceRegister } from './AttendanceRegister';
import { LeadsMasterTable } from './LeadsMasterTable';
import { ActivityLogs } from './ActivityLogs';
import { MemberDetailModal } from './MemberDetailModal';
import { ShareWithDistributionTab } from './ShareWithDistributionTab';
import { QuickTransferModal } from './QuickTransferModal';

interface OwnerDashboardProps {
  onClose: () => void;
  currentUser: string;
  isOwner: boolean;
  isAdmin: boolean;
  allMembers: string[];
}

export function OwnerDashboard({
  onClose,
  currentUser,
  isOwner,
  isAdmin,
  allMembers
}: OwnerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'daily_progress' | 'attendance' | 'members' | 'leads' | 'logs' | 'distribution'>('overview');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<LeadActivityLog[]>([]);
  const [filterMemberForLeads, setFilterMemberForLeads] = useState<string>('all');
  const [selectedDrilldownMember, setSelectedDrilldownMember] = useState<string | null>(null);
  const [isQuickTransferOpen, setIsQuickTransferOpen] = useState(false);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime leads table changes
    const channel = supabase
      .channel('leads-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);

    try {
      // 1. Fetch leads
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && !error) {
        setLeads(data as Lead[]);
      }

      // 2. Fetch logs
      const localLogs = getStoredLeadLogs();
      try {
        const { data: remoteLogs } = await supabase
          .from('lead_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(150);

        if (remoteLogs && remoteLogs.length > 0) {
          const merged = [...remoteLogs, ...localLogs];
          const uniqueMap = new Map();
          merged.forEach(item => {
            const key = item.id || `${item.created_at}_${item.username}`;
            if (!uniqueMap.has(key)) uniqueMap.set(key, item);
          });
          setLogs(Array.from(uniqueMap.values()).slice(0, 250));
        } else {
          setLogs(localLogs);
        }
      } catch {
        setLogs(localLogs);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Compile full members list (from allMembers prop + any members found in leads)
  const combinedMembers = useMemo(() => {
    const set = new Set(allMembers);
    leads.forEach(l => {
      if (l.assigned_to) set.add(l.assigned_to);
      if (l.added_by) set.add(l.added_by);
    });
    return Array.from(set).filter(Boolean);
  }, [allMembers, leads]);

  // Aggregate stats per member
  const memberStats = useMemo(() => {
    const stats: Record<string, {
      total: number;
      copied: number;
      contacted: number;
      interested: number;
      closed: number;
      notInterested: number;
    }> = {};

    // Initialize all known members
    combinedMembers.forEach(m => {
      stats[m] = {
        total: 0,
        copied: 0,
        contacted: 0,
        interested: 0,
        closed: 0,
        notInterested: 0,
      };
    });

    leads.forEach(l => {
      const u = l.assigned_to;
      if (!stats[u]) {
        stats[u] = { total: 0, copied: 0, contacted: 0, interested: 0, closed: 0, notInterested: 0 };
      }

      stats[u].total += 1;
      stats[u].copied += (l.copied_count || 0);

      if (l.status === 'contacted') stats[u].contacted += 1;
      else if (l.status === 'interested') stats[u].interested += 1;
      else if (l.status === 'closed') stats[u].closed += 1;
      else if (l.status === 'not_interested') stats[u].notInterested += 1;
    });

    // Also factor copied actions from logs
    logs.forEach(log => {
      if (log.action === 'copied' && stats[log.username]) {
        stats[log.username].copied = Math.max(stats[log.username].copied, 1);
      }
    });

    return stats;
  }, [combinedMembers, leads, logs]);

  const handleOpenMemberDrilldown = (username: string) => {
    setSelectedDrilldownMember(username);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-lg p-0 sm:p-3 md:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="w-full max-w-7xl h-[100dvh] sm:h-[94vh] bg-slate-950 border-0 sm:border sm:border-purple-500/30 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white"
      >
        {/* Header - Optimized for Mobile & Desktop */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-gradient-to-r from-purple-950/50 via-slate-900 to-black/50 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-lg shadow-purple-500/10 shrink-0">
              <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight truncate">
                  Command Center
                </h1>
                <span className="bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/30 text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                  <ShieldCheck className="w-3 h-3 text-amber-300" />
                  <span>{isOwner ? 'CEO' : 'Manager'}</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-white/50 truncate hidden sm:block">
                Real-time lead flow, team conversion metrics & fast distribution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Attendance Trigger */}
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                activeTab === 'attendance'
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300'
              }`}
              title="Open Daily Attendance & Duty Register"
            >
              <CalendarDays className="w-3.5 h-3.5 text-emerald-300" />
              <span>Attendance</span>
            </button>

            {/* Quick Rebalance / Transfer Trigger */}
            <button
              onClick={() => setIsQuickTransferOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Fast Lead Transfer between members"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-300" />
              <span className="hidden md:inline">Transfer Leads</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchData(false)}
              disabled={refreshing}
              className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded-xl transition-colors cursor-pointer"
              title="Refresh Real-time Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
              title="Close Dashboard"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar - Touch & Mobile Optimized */}
        <div className="px-3 sm:px-6 py-2 border-b border-white/10 bg-slate-900/80 flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar shrink-0">
          <div className="flex items-center gap-1 p-1 bg-black/50 rounded-xl border border-white/5 shrink-0">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('daily_progress')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'daily_progress'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 font-black'
                  : 'text-purple-300 hover:text-white hover:bg-white/5 font-semibold'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
              <span>Daily Progress & Graphs</span>
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'attendance'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30 font-black'
                  : 'text-emerald-300 hover:text-white hover:bg-white/5 font-semibold'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              <span>Attendance & Duty Register</span>
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'members'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Team Ranking ({combinedMembers.length})</span>
            </button>

            <button
              onClick={() => {
                setFilterMemberForLeads('all');
                setActiveTab('leads');
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'leads'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Leads Pool ({leads.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('distribution')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'distribution'
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                  : 'text-emerald-300 hover:text-emerald-200 hover:bg-white/5'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Share & Distribute</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Audit Logs</span>
              <span className="sm:hidden">Logs</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs text-white/50 font-mono shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Realtime Sync Active
            </span>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 bg-slate-950 custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-white/40 space-y-3 py-20">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
              <p className="text-sm">Loading command center analytics...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <DashboardOverview 
                  leads={leads} 
                  memberStats={memberStats} 
                  onSelectMember={handleOpenMemberDrilldown}
                  onNavigateTab={(target) => {
                    if (target === 'leads') {
                      setFilterMemberForLeads('all');
                      setActiveTab('leads');
                    } else if (target === 'members') {
                      setActiveTab('members');
                    } else if (target === 'distribution') {
                      setActiveTab('distribution');
                    } else if (target === 'attendance') {
                      setActiveTab('attendance');
                    } else if (target === 'daily_progress') {
                      setActiveTab('daily_progress');
                    }
                  }}
                />
              )}

              {activeTab === 'daily_progress' && (
                <DailyMemberProgress
                  leads={leads}
                  logs={logs}
                  allMembers={combinedMembers}
                  currentUser={currentUser}
                  onSelectMember={handleOpenMemberDrilldown}
                  onNavigateTab={(target) => {
                    if (target === 'leads') {
                      setFilterMemberForLeads('all');
                      setActiveTab('leads');
                    } else if (target === 'members') {
                      setActiveTab('members');
                    } else if (target === 'distribution') {
                      setActiveTab('distribution');
                    } else if (target === 'attendance') {
                      setActiveTab('attendance');
                    }
                  }}
                />
              )}

              {activeTab === 'attendance' && (
                <AttendanceRegister
                  leads={leads}
                  logs={logs}
                  allMembers={combinedMembers}
                  currentUser={currentUser}
                  isAdmin={isAdmin}
                  isOwner={isOwner}
                  onSelectMember={handleOpenMemberDrilldown}
                />
              )}

              {activeTab === 'members' && (
                <MemberPerformance
                  leads={leads}
                  memberStats={memberStats}
                  onSelectMember={handleOpenMemberDrilldown}
                />
              )}

              {activeTab === 'leads' && (
                <LeadsMasterTable
                  leads={leads}
                  allMembers={combinedMembers}
                  currentUser={currentUser}
                  onLeadUpdated={() => fetchData(false)}
                  selectedMemberFilter={filterMemberForLeads}
                  onOpenQuickTransfer={() => setIsQuickTransferOpen(true)}
                />
              )}

              {activeTab === 'logs' && (
                <ActivityLogs
                  logs={logs}
                  onRefresh={() => fetchData(false)}
                  onClearLogs={() => {
                    localStorage.removeItem('org_lead_activity_logs');
                    setLogs([]);
                  }}
                />
              )}

              {activeTab === 'distribution' && (
                <ShareWithDistributionTab
                  allMembers={combinedMembers}
                  leads={leads}
                  currentUser={currentUser}
                  onLeadsDistributed={() => fetchData(false)}
                />
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Member Deep Dive Modal */}
      {selectedDrilldownMember && (
        <MemberDetailModal
          username={selectedDrilldownMember}
          onClose={() => setSelectedDrilldownMember(null)}
          leads={leads}
          logs={logs}
          allMembers={combinedMembers}
          currentUser={currentUser}
          onLeadUpdated={() => fetchData(false)}
        />
      )}

      {/* Quick Lead Transfer Modal */}
      <QuickTransferModal
        isOpen={isQuickTransferOpen}
        onClose={() => setIsQuickTransferOpen(false)}
        leads={leads}
        allMembers={combinedMembers}
        currentUser={currentUser}
        onTransferComplete={() => fetchData(false)}
      />
    </div>
  );
}
