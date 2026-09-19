import React, { useState, useMemo } from 'react';
import { Lead } from '../../types';
import { 
  TrendingUp, Users, CheckCircle2, Copy, Briefcase, 
  Flame, Award, Target, ArrowUpRight, Calendar, Sparkles, 
  ChevronRight, BarChart3, Clock, Zap, DollarSign, 
  HelpCircle, Eye, RefreshCw, ArrowRight, CalendarDays
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DashboardOverviewProps {
  leads: Lead[];
  memberStats: Record<string, {
    total: number;
    copied: number;
    contacted: number;
    interested: number;
    closed: number;
    notInterested: number;
  }>;
  onSelectMember?: (username: string) => void;
  onNavigateTab?: (tab: 'leads' | 'members' | 'distribution' | 'daily_progress' | 'attendance') => void;
}

export function DashboardOverview({ 
  leads, 
  memberStats, 
  onSelectMember,
  onNavigateTab
}: DashboardOverviewProps) {
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7d' | '30d'>('all');
  const [dealValue, setDealValue] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('owner_avg_deal_value');
      return saved ? Number(saved) : 100;
    } catch {
      return 100;
    }
  });
  const [currency, setCurrency] = useState<string>(() => {
    try {
      return localStorage.getItem('owner_currency_symbol') || '$';
    } catch {
      return '$';
    }
  });
  const [showHelperGuide, setShowHelperGuide] = useState(false);

  // Helper date calculations
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Filtered leads based on date selection
  const filteredLeads = useMemo(() => {
    if (dateFilter === 'all') return leads;
    return leads.filter(l => {
      const dStr = l.assigned_date || (l.created_at ? l.created_at.split('T')[0] : '');
      if (!dStr) return false;
      if (dateFilter === 'today') return dStr === todayStr;
      if (dateFilter === 'yesterday') return dStr === yesterdayStr;
      const leadDate = new Date(dStr);
      if (dateFilter === '7d') return leadDate >= sevenDaysAgo;
      if (dateFilter === '30d') return leadDate >= thirtyDaysAgo;
      return true;
    });
  }, [leads, dateFilter, todayStr, yesterdayStr]);

  const totalLeads = filteredLeads.length;
  const totalClosed = filteredLeads.filter(l => l.status === 'closed').length;
  const totalInterested = filteredLeads.filter(l => l.status === 'interested').length;
  const totalContacted = filteredLeads.filter(l => l.status === 'contacted').length;
  const totalNew = filteredLeads.filter(l => l.status === 'new').length;
  const totalNotInterested = filteredLeads.filter(l => l.status === 'not_interested').length;
  const totalCopied = filteredLeads.reduce((acc, l) => acc + (l.copied_count || 0), 0);

  const conversionRate = totalLeads > 0 ? ((totalClosed / totalLeads) * 100).toFixed(1) : '0';
  const pipelineRate = totalLeads > 0 ? (((totalClosed + totalInterested) / totalLeads) * 100).toFixed(1) : '0';

  // Projected Revenue Calculations
  const realizedRevenue = totalClosed * dealValue;
  const pipelinePotentialRevenue = (totalInterested + totalContacted) * dealValue;
  const totalOpportunityValue = totalLeads * dealValue;

  const handleUpdateDealValue = (val: number) => {
    setDealValue(val);
    try {
      localStorage.setItem('owner_avg_deal_value', String(val));
    } catch {}
  };

  const handleUpdateCurrency = (sym: string) => {
    setCurrency(sym);
    try {
      localStorage.setItem('owner_currency_symbol', sym);
    } catch {}
  };

  // Recalculate member rankings
  const rankedMembers = useMemo(() => {
    const map: Record<string, { total: number; closed: number; copied: number; interested: number; contacted: number }> = {};
    Object.keys(memberStats).forEach(m => {
      map[m] = { total: 0, closed: 0, copied: 0, interested: 0, contacted: 0 };
    });

    filteredLeads.forEach(l => {
      const u = l.assigned_to;
      if (!map[u]) map[u] = { total: 0, closed: 0, copied: 0, interested: 0, contacted: 0 };
      map[u].total += 1;
      map[u].copied += (l.copied_count || 0);
      if (l.status === 'closed') map[u].closed += 1;
      if (l.status === 'interested') map[u].interested += 1;
      if (l.status === 'contacted') map[u].contacted += 1;
    });

    return Object.entries(map).sort((a, b) => b[1].closed - a[1].closed || b[1].interested - a[1].interested || b[1].total - a[1].total);
  }, [filteredLeads, memberStats]);

  const topThree = rankedMembers.slice(0, 3);

  // Past 7 Days velocity
  const past7DaysData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayLeads = leads.filter(l => (l.assigned_date || l.created_at?.split('T')[0]) === str);
      const dayClosed = dayLeads.filter(l => l.status === 'closed').length;
      days.push({
        date: str,
        label: i === 0 ? 'Today' : dayName,
        leadsCount: dayLeads.length,
        closedCount: dayClosed
      });
    }
    const maxCount = Math.max(...days.map(d => d.leadsCount), 6);
    return { days, maxCount };
  }, [leads]);

  // Target Goal Calculations
  const monthlyTargetDeals = Math.max(10, Math.ceil(leads.length * 0.15));
  const allTimeClosed = leads.filter(l => l.status === 'closed').length;
  const targetProgress = Math.min(100, Math.round((allTimeClosed / monthlyTargetDeals) * 100));

  const triggerCelebrate = () => {
    try {
      confetti({
        particleCount: 110,
        spread: 85,
        origin: { y: 0.6 }
      });
    } catch {}
  };

  // Status Funnel items
  const statusFunnel = [
    { label: 'New Uncontacted', urdu: 'Nayi Leads (Unreached)', count: totalNew, color: 'bg-blue-500', bar: 'from-blue-600 to-blue-400', text: 'text-blue-400' },
    { label: 'Contacted', urdu: 'Rabta Ho Chuka', count: totalContacted, color: 'bg-amber-500', bar: 'from-amber-600 to-amber-400', text: 'text-amber-400' },
    { label: 'Interested Prospects', urdu: 'Hot / Interested Leads', count: totalInterested, color: 'bg-cyan-500', bar: 'from-cyan-600 to-cyan-400', text: 'text-cyan-400' },
    { label: 'Won / Closed Deals', urdu: 'Pakki Deals (Successful)', count: totalClosed, color: 'bg-emerald-500', bar: 'from-emerald-600 to-emerald-400', text: 'text-emerald-400' },
    { label: 'Not Interested / Lost', urdu: 'Not Interested', count: totalNotInterested, color: 'bg-red-500', bar: 'from-red-600 to-red-400', text: 'text-red-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Date Filter & Control Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80 border border-purple-500/20 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-white text-xs sm:text-sm">Analytics Timeline</span>
            <span className="text-[10px] text-white/50 block sm:inline sm:ml-2">Waqt ke mutabiq filter karein</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
            {(['all', 'today', 'yesterday', '7d', '30d'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setDateFilter(filterKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  dateFilter === filterKey
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {filterKey === 'all' && 'All Time (Total)'}
                {filterKey === 'today' && "Aaj Ki Leads"}
                {filterKey === 'yesterday' && 'Kal Ki Leads'}
                {filterKey === '7d' && '7 Din'}
                {filterKey === '30d' && '30 Din'}
              </button>
            ))}
          </div>

          {onNavigateTab && (
            <>
              <button
                onClick={() => onNavigateTab('daily_progress')}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-sm"
                title="Her Member Ki Daily Progress Graphs Dekhein"
              >
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                <span>Daily Progress</span>
              </button>
              <button
                onClick={() => onNavigateTab('attendance')}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/50 hover:to-teal-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-sm"
                title="Rozana Attendance & Duty Register Dekhein"
              >
                <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
                <span>Attendance Register</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowHelperGuide(!showHelperGuide)}
            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            title="Dashboard Samajhne Ke Liye Guide"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Guide</span>
          </button>
        </div>
      </div>

      {/* Collapsible Easy-to-understand Urdu / English Guide */}
      {showHelperGuide && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/30 text-xs text-white/80 space-y-2 shadow-2xl">
          <div className="flex items-center justify-between font-bold text-white text-sm">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              Owner Dashboard Guide (Aasan Tareeqa):
            </span>
            <button onClick={() => setShowHelperGuide(false)} className="text-white/50 hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 text-[11px]">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <strong className="text-blue-300 block mb-0.5">1. Total Leads:</strong>
              System me maujood kul clients. Inhe team me distribute kiya jata hai.
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <strong className="text-amber-300 block mb-0.5">2. Contacted:</strong>
              Jin leads ko team member ne WhatsApp ya call par pehla message bheja.
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <strong className="text-cyan-300 block mb-0.5">3. Interested:</strong>
              Wo clients jo deal lene me interested hain — in par follow up zaroori hai.
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <strong className="text-emerald-300 block mb-0.5">4. Closed Deals:</strong>
              Pakki kamyab deals jo finalize ho chuki hain aur revenue generate hua.
            </div>
          </div>
        </div>
      )}

      {/* Top 6 KPI Performance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
        {/* Total Leads */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-lg hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-white/50 text-[11px] sm:text-xs font-semibold">
            <span>Total Leads</span>
            <div className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalLeads.toLocaleString()}</span>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-cyan-400 font-semibold flex items-center justify-between">
            <span>{totalNew} Uncontacted</span>
            <span className="text-white/40">Kul Pool</span>
          </div>
        </div>

        {/* Won / Closed Deals */}
        <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/90 border border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-lg hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between text-emerald-300 text-[11px] sm:text-xs font-semibold">
            <span>Closed Won</span>
            <button 
              onClick={triggerCelebrate}
              className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:scale-110 transition-transform cursor-pointer"
              title="Click to Celebrate!"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-300">{totalClosed.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-400 font-bold">Deals</span>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-emerald-300/70 font-semibold">
            Win Rate: <strong className="text-emerald-300">{conversionRate}%</strong>
          </div>
        </div>

        {/* Hot / Interested Prospects */}
        <div className="bg-gradient-to-br from-cyan-950/40 to-slate-900/90 border border-cyan-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-lg hover:border-cyan-400 transition-all">
          <div className="flex items-center justify-between text-cyan-300 text-[11px] sm:text-xs font-semibold">
            <span>Interested</span>
            <div className="p-1 rounded-lg bg-cyan-500/20 text-cyan-300">
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-cyan-300">{totalInterested.toLocaleString()}</span>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-cyan-300/70 font-semibold">
            Hot Follow-ups
          </div>
        </div>

        {/* Contacted */}
        <div className="bg-slate-900/90 border border-amber-500/20 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-lg hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-amber-300 text-[11px] sm:text-xs font-semibold">
            <span>Contacted</span>
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-300">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-300">{totalContacted.toLocaleString()}</span>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-amber-300/70 font-semibold">
            In Conversation
          </div>
        </div>

        {/* Leads Copied / Action Velocity */}
        <div className="bg-slate-900/90 border border-blue-500/20 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-lg hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-blue-300 text-[11px] sm:text-xs font-semibold">
            <span>Leads Copied</span>
            <div className="p-1 rounded-lg bg-blue-500/20 text-blue-300">
              <Copy className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-blue-300">{totalCopied.toLocaleString()}</span>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-blue-300/70 font-semibold">
            Outreach clicks
          </div>
        </div>

        {/* Pipeline Health */}
        <div className="bg-gradient-to-br from-purple-950/40 to-slate-900/90 border border-purple-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-lg hover:border-purple-400 transition-all">
          <div className="flex items-center justify-between text-purple-300 text-[11px] sm:text-xs font-semibold">
            <span>Active Pipeline</span>
            <div className="p-1 rounded-lg bg-purple-500/20 text-purple-300">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-purple-300">
              {(totalContacted + totalInterested).toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-purple-300/70 font-semibold">
            {pipelineRate}% conversion potential
          </div>
        </div>
      </div>

      {/* Interactive Revenue & Deal Estimator Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-purple-950/40 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Revenue & Deal Value Calculator
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    Live Simulator
                  </span>
                </h3>
                <p className="text-xs text-white/50">
                  Apni average deal value set karein aur foran revenue estimation dekhein
                </p>
              </div>
            </div>
          </div>

          {/* Deal Value Controller */}
          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10 w-full sm:w-auto">
            <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-xl">
              <select
                value={currency}
                onChange={e => handleUpdateCurrency(e.target.value)}
                className="bg-transparent text-xs font-bold text-emerald-300 focus:outline-none cursor-pointer"
              >
                <option value="$" className="bg-slate-900 text-white">$ (USD)</option>
                <option value="Rs" className="bg-slate-900 text-white">Rs (PKR)</option>
                <option value="₹" className="bg-slate-900 text-white">₹ (INR)</option>
                <option value="AED" className="bg-slate-900 text-white">AED</option>
                <option value="£" className="bg-slate-900 text-white">£ (GBP)</option>
                <option value="€" className="bg-slate-900 text-white">€ (EUR)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <span className="text-xs text-white/60 pl-1">Avg Deal:</span>
              <input
                type="number"
                min={1}
                value={dealValue}
                onChange={e => handleUpdateDealValue(Math.max(1, Number(e.target.value)))}
                className="w-24 px-2.5 py-1 text-xs font-bold bg-slate-950 border border-white/15 rounded-xl text-white text-right focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Realized vs Pipeline Revenue Strips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block">
              Realized Closed Revenue (Earned)
            </span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">
              {currency} {realizedRevenue.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-400/80 font-medium mt-0.5 block">
              {totalClosed} won deals finalized
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30">
            <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider block">
              In-Progress Pipeline Value
            </span>
            <div className="text-xl sm:text-2xl font-black text-cyan-200 mt-1">
              {currency} {pipelinePotentialRevenue.toLocaleString()}
            </div>
            <span className="text-[10px] text-cyan-400/80 font-medium mt-0.5 block">
              {totalInterested + totalContacted} active warm leads
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30">
            <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider block">
              Total Lead Pool Worth
            </span>
            <div className="text-xl sm:text-2xl font-black text-purple-200 mt-1">
              {currency} {totalOpportunityValue.toLocaleString()}
            </div>
            <span className="text-[10px] text-purple-400/80 font-medium mt-0.5 block">
              Based on {totalLeads} total leads
            </span>
          </div>
        </div>
      </div>

      {/* Team Leaderboard Podiums & Funnel Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Top 3 Podiums */}
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Top Performers Podium</h4>
                  <p className="text-[11px] text-white/50">Sabse zyada deals close karne wale</p>
                </div>
              </div>

              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('members')}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  All Members <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Podiums List */}
            <div className="space-y-3 mt-4">
              {topThree.map(([username, s], idx) => {
                const medals = ['🥇 Gold Closer', '🥈 Silver Rank', '🥉 Bronze Rank'];
                const borders = [
                  'border-amber-500/40 bg-amber-500/10',
                  'border-slate-400/30 bg-white/5',
                  'border-amber-700/30 bg-amber-900/10'
                ];
                const textColors = ['text-amber-300', 'text-slate-200', 'text-amber-500'];

                return (
                  <div
                    key={username}
                    onClick={() => onSelectMember && onSelectMember(username)}
                    className={`p-3 rounded-2xl border ${borders[idx]} flex items-center justify-between cursor-pointer hover:scale-[1.01] transition-all shadow-md`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl font-bold text-sm flex items-center justify-center ${textColors[idx]} bg-black/40 border border-white/10`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs sm:text-sm">@{username}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${textColors[idx]} bg-black/30 border border-white/10`}>
                            {medals[idx]}
                          </span>
                        </div>
                        <div className="text-[11px] text-white/60 mt-0.5">
                          {s.closed} closed • {s.interested} hot • {s.total} assigned
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-400">
                        {s.total > 0 ? ((s.closed / s.total) * 100).toFixed(0) : 0}% win
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/40 ml-auto mt-0.5" />
                    </div>
                  </div>
                );
              })}

              {topThree.length === 0 && (
                <div className="text-center py-6 text-xs text-white/40">
                  No member activity registered yet.
                </div>
              )}
            </div>
          </div>

          {/* Quick Target Progress Indicator */}
          <div className="pt-4 mt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-white/70 font-semibold flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-purple-400" />
                Monthly Team Target:
              </span>
              <span className="font-bold text-white">
                {allTimeClosed} / {monthlyTargetDeals} Won ({targetProgress}%)
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${targetProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Middle + Right Column: Conversion Funnel & 7-Day Velocity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Conversion Funnel */}
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Lead Conversion Funnel (Kamyabi Ka Safar)
                </h4>
                <p className="text-[11px] text-white/50">
                  Har stage par kitni leads hain aur conversion ratio kya hai
                </p>
              </div>
              <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                {totalLeads} Leads Total
              </span>
            </div>

            <div className="space-y-3 mt-4">
              {statusFunnel.map((step) => {
                const percent = totalLeads > 0 ? ((step.count / totalLeads) * 100).toFixed(1) : '0';
                return (
                  <div key={step.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white/90 flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${step.color}`} />
                        <span>{step.label}</span>
                        <span className="text-[10px] text-white/40 hidden sm:inline">({step.urdu})</span>
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={`font-bold ${step.text}`}>{step.count}</span>
                        <span className="text-white/40 text-[11px]">({percent}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${step.bar} transition-all duration-500`}
                        style={{ width: `${Math.max(Number(percent), 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Past 7 Days Inflow Activity Trend */}
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  Weekly Inflow & Deals Velocity (Pichle 7 Din)
                </h4>
                <p className="text-[11px] text-white/50">Rozana naye aane wale leads aur closed deals</p>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-3 mt-4 text-center">
              {past7DaysData.days.map((day) => {
                const heightPercent = Math.max(12, Math.round((day.leadsCount / past7DaysData.maxCount) * 100));
                return (
                  <div key={day.date} className="flex flex-col items-center justify-end h-32 group">
                    <span className="text-[10px] text-white/60 mb-1 font-mono">{day.leadsCount}</span>
                    <div className="w-full max-w-[28px] bg-slate-950 rounded-xl overflow-hidden p-1 flex flex-col justify-end h-24 border border-white/10">
                      <div
                        className="w-full bg-gradient-to-t from-purple-600 to-cyan-400 rounded-lg transition-all duration-300 group-hover:brightness-125"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-white/70 mt-1.5">{day.label}</span>
                    <span className="text-[9px] text-emerald-400 font-bold">{day.closedCount} won</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
