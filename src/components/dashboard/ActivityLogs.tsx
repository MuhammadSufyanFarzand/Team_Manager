import React, { useState } from 'react';
import { LeadActivityLog } from '../../types';
import { 
  Clock, Copy, CheckCircle2, User, ArrowRightLeft, 
  Trash2, RefreshCw, Filter, Search 
} from 'lucide-react';

interface ActivityLogsProps {
  logs: LeadActivityLog[];
  onRefresh: () => void;
  onClearLogs?: () => void;
}

export function ActivityLogs({ logs, onRefresh, onClearLogs }: ActivityLogsProps) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredLogs = logs.filter(log => {
    const s = search.toLowerCase();
    const matchesSearch = !s || 
      log.username.toLowerCase().includes(s) || 
      log.lead_name.toLowerCase().includes(s) || 
      (log.details && log.details.toLowerCase().includes(s));

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: LeadActivityLog['action']) => {
    switch (action) {
      case 'closed':
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">Deal Closed</span>;
      case 'copied':
        return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">Lead Copied</span>;
      case 'distributed':
        return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">CSV Distributed</span>;
      case 'reassigned':
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">Reassigned</span>;
      case 'status_changed':
      default:
        return <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">Status Updated</span>;
    }
  };

  const formatLogTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-white/10 rounded-2xl p-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search activity by member or lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-black/50 border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="all">All Actions</option>
            <option value="closed">Deals Closed</option>
            <option value="copied">Leads Copied</option>
            <option value="status_changed">Status Changes</option>
            <option value="distributed">Distributions</option>
            <option value="reassigned">Reassignments</option>
          </select>

          <button
            onClick={onRefresh}
            className="p-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded-xl transition-colors cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors cursor-pointer"
              title="Clear Local Activity Logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl max-h-[550px] overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-14 text-white/40 text-sm">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No activity logs recorded yet.</p>
            <p className="text-xs text-white/30 mt-1">Actions like copying leads, updating statuses, and distributing CSVs will be tracked here in real-time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div 
                key={log.id || `${log.created_at}_${log.username}`}
                className="flex items-start justify-between p-3.5 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 flex-shrink-0 text-xs font-bold mt-0.5">
                    {log.username.substring(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-xs sm:text-sm">@{log.username}</span>
                      {getActionBadge(log.action)}
                      <span className="text-xs text-cyan-300 font-medium">"{log.lead_name}"</span>
                    </div>

                    {log.details && (
                      <p className="text-xs text-white/60 mt-1">{log.details}</p>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-[11px] font-mono text-white/40 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3 text-white/30" />
                    {formatLogTime(log.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
