import React, { useState, useMemo } from 'react';
import { Lead } from '../../types';
import { 
  Users, Search, Award, Crown, CheckCircle2, Copy, 
  PhoneCall, Star, ChevronRight, TrendingUp, AlertCircle, 
  Download, Sparkles, ExternalLink, Zap, Flame 
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MemberPerformanceProps {
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
}

export function MemberPerformance({ leads, memberStats, onSelectMember }: MemberPerformanceProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'closed' | 'total' | 'conversion' | 'copied'>('closed');

  const membersArray = useMemo(() => {
    return Object.entries(memberStats).map(([username, s]) => {
      const conversion = s.total > 0 ? (s.closed / s.total) * 100 : 0;
      const progressRate = s.total > 0 ? ((s.contacted + s.interested + s.closed) / s.total) * 100 : 0;
      const activePipeline = s.total - s.closed - s.notInterested;
      return {
        username,
        ...s,
        conversion,
        progressRate,
        activePipeline,
      };
    });
  }, [memberStats]);

  const filteredMembers = useMemo(() => {
    return membersArray
      .filter(m => m.username.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'closed') return b.closed - a.closed || b.total - a.total;
        if (sortBy === 'total') return b.total - a.total;
        if (sortBy === 'conversion') return b.conversion - a.conversion;
        if (sortBy === 'copied') return b.copied - a.copied;
        return 0;
      });
  }, [membersArray, search, sortBy]);

  // Highlights
  const topCloser = useMemo(() => {
    return [...membersArray].sort((a, b) => b.closed - a.closed)[0] || null;
  }, [membersArray]);

  const topActive = useMemo(() => {
    return [...membersArray].sort((a, b) => b.copied - a.copied)[0] || null;
  }, [membersArray]);

  const topPipeline = useMemo(() => {
    return [...membersArray].sort((a, b) => b.activePipeline - a.activePipeline)[0] || null;
  }, [membersArray]);

  const exportAllPerformanceCSV = () => {
    if (membersArray.length === 0) return;
    const headers = [
      'Rank', 'Username', 'Total Assigned', 'Leads Copied', 
      'Contacted', 'Interested', 'Closed Deals', 'Lost', 
      'Win Rate %', 'Active Pipeline'
    ];
    const rows = filteredMembers.map((m, idx) => [
      idx + 1,
      `"${m.username}"`,
      m.total,
      m.copied,
      m.contacted,
      m.interested,
      m.closed,
      m.notInterested,
      `"${m.conversion.toFixed(1)}%"`,
      m.activePipeline
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `team_performance_leaderboard_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Highlights Banner Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top Closer */}
        <div 
          onClick={() => topCloser && onSelectMember && onSelectMember(topCloser.username)}
          className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-black/40 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-amber-400 transition-all shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <Crown className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <span className="text-[11px] text-amber-300/80 font-bold uppercase tracking-wider">
                Top Closer
              </span>
              <div className="text-base font-bold text-white">
                {topCloser && topCloser.closed > 0 ? `@${topCloser.username}` : 'None Yet'}
              </div>
              <span className="text-xs text-white/50">
                {topCloser ? `${topCloser.closed} deals won (${topCloser.conversion.toFixed(0)}%)` : 'Awaiting first closing'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </div>

        {/* Most Active Follower */}
        <div 
          onClick={() => topActive && onSelectMember && onSelectMember(topActive.username)}
          className="bg-gradient-to-r from-blue-500/10 via-slate-900 to-black/40 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-blue-400 transition-all shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300">
              <Copy className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <span className="text-[11px] text-blue-300/80 font-bold uppercase tracking-wider">
                Highest Action Rate
              </span>
              <div className="text-base font-bold text-white">
                {topActive && topActive.copied > 0 ? `@${topActive.username}` : 'None Yet'}
              </div>
              <span className="text-xs text-white/50">
                {topActive ? `${topActive.copied} leads copied` : 'No action clicks yet'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </div>

        {/* Largest Hot Pipeline */}
        <div 
          onClick={() => topPipeline && onSelectMember && onSelectMember(topPipeline.username)}
          className="bg-gradient-to-r from-purple-500/10 via-slate-900 to-black/40 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-purple-400 transition-all shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Flame className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <span className="text-[11px] text-purple-300/80 font-bold uppercase tracking-wider">
                Active In-Flight Pipeline
              </span>
              <div className="text-base font-bold text-white">
                {topPipeline ? `@${topPipeline.username}` : 'None Yet'}
              </div>
              <span className="text-xs text-white/50">
                {topPipeline ? `${topPipeline.activePipeline} prospects in progress` : '0'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </div>
      </div>

      {/* Search, Sort, & Export Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-md">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search team member..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/50 font-medium">Sort by:</span>
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setSortBy('closed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                sortBy === 'closed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-white/60 hover:text-white'
              }`}
            >
              Closed Deals
            </button>
            <button
              onClick={() => setSortBy('conversion')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                sortBy === 'conversion' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-white/60 hover:text-white'
              }`}
            >
              Win Rate %
            </button>
            <button
              onClick={() => setSortBy('total')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                sortBy === 'total' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-white/60 hover:text-white'
              }`}
            >
              Total Assigned
            </button>
            <button
              onClick={() => setSortBy('copied')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                sortBy === 'copied' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-white/60 hover:text-white'
              }`}
            >
              Leads Copied
            </button>
          </div>

          <button
            onClick={exportAllPerformanceCSV}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download CSV Leaderboard Report"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Member Performance Table */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/80">
            <thead className="text-xs text-white/50 uppercase bg-black/40 border-b border-white/10">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Rank & Member</th>
                <th className="px-4 py-3.5 font-semibold text-center">Assigned Leads</th>
                <th className="px-4 py-3.5 font-semibold text-center">Leads Copied</th>
                <th className="px-4 py-3.5 font-semibold text-center">Contacted</th>
                <th className="px-4 py-3.5 font-semibold text-center">Interested</th>
                <th className="px-4 py-3.5 font-semibold text-center">Closed Won</th>
                <th className="px-4 py-3.5 font-semibold text-center">Conversion %</th>
                <th className="px-4 py-3.5 font-semibold text-center">In Pipeline</th>
                <th className="px-4 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-white/40 italic">
                    No team members found. Distribute leads to team members to track performance here.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member, idx) => {
                  const isTop1 = idx === 0 && member.closed > 0;
                  const isTop3 = idx < 3 && member.closed > 0;

                  return (
                    <tr 
                      key={member.username} 
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                      onClick={() => onSelectMember && onSelectMember(member.username)}
                    >
                      {/* Member Info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 text-center font-bold text-xs">
                            {isTop1 ? (
                              <Crown className="w-5 h-5 text-amber-400 mx-auto animate-bounce" />
                            ) : isTop3 ? (
                              <Star className="w-4 h-4 text-slate-300 mx-auto fill-slate-300" />
                            ) : (
                              <span className="text-white/30 font-mono">#{idx + 1}</span>
                            )}
                          </div>

                          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center font-bold text-cyan-400 text-xs">
                            {member.username.substring(0, 2).toUpperCase()}
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
                                @{member.username}
                              </span>
                              {isTop1 && (
                                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                                  Top Closer
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-white/40">
                              {member.activePipeline} active prospects
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Total Assigned */}
                      <td className="px-4 py-4 text-center font-semibold text-white">
                        <span className="bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 font-mono">
                          {member.total}
                        </span>
                      </td>

                      {/* Leads Copied */}
                      <td className="px-4 py-4 text-center font-semibold">
                        <span className="text-blue-400 font-mono flex items-center justify-center gap-1">
                          <Copy className="w-3.5 h-3.5 text-blue-400/70" />
                          {member.copied}
                        </span>
                      </td>

                      {/* Contacted */}
                      <td className="px-4 py-4 text-center font-semibold">
                        <span className="text-amber-400 font-mono">
                          {member.contacted}
                        </span>
                      </td>

                      {/* Interested */}
                      <td className="px-4 py-4 text-center font-semibold">
                        <span className="text-cyan-400 font-mono">
                          {member.interested}
                        </span>
                      </td>

                      {/* Closed Won */}
                      <td className="px-4 py-4 text-center font-bold">
                        <span className="bg-emerald-500/15 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-500/30 font-mono">
                          {member.closed}
                        </span>
                      </td>

                      {/* Win Rate */}
                      <td className="px-4 py-4 text-center font-mono font-bold">
                        <span className={member.conversion >= 15 ? 'text-emerald-400' : member.conversion > 0 ? 'text-purple-300' : 'text-white/40'}>
                          {member.conversion.toFixed(1)}%
                        </span>
                      </td>

                      {/* Active Pipeline */}
                      <td className="px-4 py-4 text-center font-mono text-purple-300 text-xs">
                        {member.activePipeline}
                      </td>

                      {/* Deep dive drill button */}
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMember && onSelectMember(member.username);
                          }}
                          className="px-2.5 py-1 bg-white/5 group-hover:bg-purple-600 text-white/70 group-hover:text-white rounded-lg border border-white/10 text-xs font-semibold flex items-center gap-1 ml-auto transition-all cursor-pointer"
                        >
                          <span>Deep Dive</span>
                          <ChevronRight className="w-3.5 h-3.5" />
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
    </div>
  );
}
