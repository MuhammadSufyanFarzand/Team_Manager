import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lead, LeadActivityLog } from '../../types';
import { 
  X, User, Award, CheckCircle2, Copy, Phone, Mail, Globe, 
  MapPin, Clock, Calendar, TrendingUp, Sparkles, Filter, 
  Search, ArrowRightLeft, Star, Download, Flame 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../../supabase';
import { logLeadActivity } from '../../lib/leadLogs';
import { SocialBadges } from '../SocialBadges';

interface MemberDetailModalProps {
  username: string;
  onClose: () => void;
  leads: Lead[];
  logs: LeadActivityLog[];
  allMembers: string[];
  currentUser: string;
  onLeadUpdated: () => void;
}

export function MemberDetailModal({
  username,
  onClose,
  leads,
  logs,
  allMembers,
  currentUser,
  onLeadUpdated,
}: MemberDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'leads' | 'activity'>('leads');
  const [searchLead, setSearchLead] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reassigningLeadId, setReassigningLeadId] = useState<string | null>(null);
  const [targetAssignee, setTargetAssignee] = useState('');

  // Member leads
  const memberLeads = useMemo(() => {
    return leads.filter(l => l.assigned_to?.toLowerCase() === username.toLowerCase());
  }, [leads, username]);

  // Member logs
  const memberLogs = useMemo(() => {
    return logs.filter(l => l.username?.toLowerCase() === username.toLowerCase());
  }, [logs, username]);

  // Member calculated metrics
  const totalAssigned = memberLeads.length;
  const closedCount = memberLeads.filter(l => l.status === 'closed').length;
  const interestedCount = memberLeads.filter(l => l.status === 'interested').length;
  const contactedCount = memberLeads.filter(l => l.status === 'contacted').length;
  const newCount = memberLeads.filter(l => l.status === 'new').length;
  const lostCount = memberLeads.filter(l => l.status === 'not_interested').length;

  const copiedCount = memberLeads.reduce((acc, l) => acc + (l.copied_count || 0), 0) ||
    memberLogs.filter(l => l.action === 'copied').length;

  const winRate = totalAssigned > 0 ? ((closedCount / totalAssigned) * 100).toFixed(1) : '0';
  const pipelineRate = totalAssigned > 0 ? (((closedCount + interestedCount) / totalAssigned) * 100).toFixed(1) : '0';

  // Performance tier badge
  const getPerformanceTier = () => {
    if (closedCount >= 10 || Number(winRate) >= 25) {
      return { label: 'Elite Closer (S-Tier)', color: 'from-amber-400 to-orange-500', text: 'text-amber-300', border: 'border-amber-500/40' };
    }
    if (closedCount >= 5 || Number(winRate) >= 15) {
      return { label: 'Pro Deal Maker (A-Tier)', color: 'from-purple-400 to-pink-500', text: 'text-purple-300', border: 'border-purple-500/40' };
    }
    if (interestedCount + contactedCount > 5) {
      return { label: 'Active Prospector (B-Tier)', color: 'from-cyan-400 to-blue-500', text: 'text-cyan-300', border: 'border-cyan-500/40' };
    }
    return { label: 'Team Member', color: 'from-slate-400 to-slate-600', text: 'text-white/70', border: 'border-white/20' };
  };

  const tier = getPerformanceTier();

  const handleCelebrate = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // safe fallback
    }
  };

  const filteredLeads = useMemo(() => {
    return memberLeads.filter(l => {
      const s = searchLead.toLowerCase();
      const matchesSearch = !s || 
        l.business_name.toLowerCase().includes(s) ||
        (l.phone && l.phone.toLowerCase().includes(s)) ||
        (l.location && l.location.toLowerCase().includes(s));
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [memberLeads, searchLead, statusFilter]);

  const handleCopyLead = (lead: Lead) => {
    const text = `Business: ${lead.business_name}\nPhone: ${lead.phone || 'N/A'}\nEmail: ${lead.email || 'N/A'}\nWebsite: ${lead.website || 'N/A'}\nLocation: ${lead.location || 'N/A'}\nNotes: ${lead.notes || ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(lead.id || lead.business_name);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpdateStatus = async (leadId: string, newStatus: string, leadName: string) => {
    try {
      await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
      logLeadActivity('status_changed', currentUser, leadName, `Status updated to ${newStatus} for @${username}`, leadId);
      if (newStatus === 'closed') {
        handleCelebrate();
      }
      onLeadUpdated();
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const handleReassign = async (leadId: string, currentLead: Lead) => {
    if (!targetAssignee || targetAssignee === currentLead.assigned_to) {
      setReassigningLeadId(null);
      return;
    }

    try {
      await supabase.from('leads').update({ assigned_to: targetAssignee }).eq('id', leadId);
      logLeadActivity('reassigned', currentUser, currentLead.business_name, `Reassigned from @${currentLead.assigned_to} to @${targetAssignee}`, leadId);
      setReassigningLeadId(null);
      setTargetAssignee('');
      onLeadUpdated();
    } catch (err) {
      console.error('Reassign error:', err);
    }
  };

  const exportMemberReport = () => {
    if (memberLeads.length === 0) return;
    const headers = ['Business Name', 'Status', 'Phone', 'Email', 'Location', 'Website', 'Notes', 'Created At'];
    const rows = memberLeads.map(l => [
      `"${(l.business_name || '').replace(/"/g, '""')}"`,
      `"${l.status}"`,
      `"${l.phone || ''}"`,
      `"${l.email || ''}"`,
      `"${(l.location || '').replace(/"/g, '""')}"`,
      `"${l.website || ''}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
      `"${l.created_at || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${username}_leads_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-5xl h-[100dvh] sm:h-[88vh] bg-slate-950 border-0 sm:border sm:border-purple-500/40 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white"
      >
        {/* Header Profile Banner */}
        <div className="px-4 py-3 sm:px-6 sm:py-5 border-b border-white/10 bg-gradient-to-r from-purple-950/50 via-slate-900 to-black/60 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-500 p-0.5 shadow-lg shadow-purple-500/20">
              <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center text-base sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-cyan-300">
                {username.substring(0, 2).toUpperCase()}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-2xl font-black text-white">@{username}</h2>
                <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border bg-white/5 ${tier.text} ${tier.border}`}>
                  {tier.label}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-white/50 mt-0.5 hidden sm:block">
                Member deep performance drilldown, assigned workload, and activity logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCelebrate}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/10"
              title="Celebrate Member Achievements"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Celebrate</span>
            </button>

            <button
              onClick={exportMemberReport}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export Member Leads CSV"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Member KPI Cards Grid */}
        <div className="px-6 py-4 border-b border-white/10 bg-slate-900/40 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-black/30 border border-white/5 rounded-xl p-3">
            <span className="text-[11px] text-white/50 font-medium">Assigned Leads</span>
            <div className="text-xl font-black text-white mt-1">{totalAssigned}</div>
            <span className="text-[10px] text-cyan-400">Total assigned</span>
          </div>

          <div className="bg-black/30 border border-emerald-500/20 rounded-xl p-3">
            <span className="text-[11px] text-emerald-300/70 font-medium">Deals Closed</span>
            <div className="text-xl font-black text-emerald-400 mt-1">{closedCount}</div>
            <span className="text-[10px] text-emerald-300/60">Won clients</span>
          </div>

          <div className="bg-black/30 border border-purple-500/20 rounded-xl p-3">
            <span className="text-[11px] text-purple-300/70 font-medium">Win Rate</span>
            <div className="text-xl font-black text-purple-400 mt-1">{winRate}%</div>
            <span className="text-[10px] text-purple-300/60">{pipelineRate}% in pipeline</span>
          </div>

          <div className="bg-black/30 border border-blue-500/20 rounded-xl p-3">
            <span className="text-[11px] text-blue-300/70 font-medium">Leads Copied</span>
            <div className="text-xl font-black text-blue-400 mt-1">{copiedCount}</div>
            <span className="text-[10px] text-blue-300/60">Action clicks</span>
          </div>

          <div className="bg-black/30 border border-cyan-500/20 rounded-xl p-3">
            <span className="text-[11px] text-cyan-300/70 font-medium">Interested</span>
            <div className="text-xl font-black text-cyan-400 mt-1">{interestedCount}</div>
            <span className="text-[10px] text-cyan-300/60">Hot prospects</span>
          </div>

          <div className="bg-black/30 border border-amber-500/20 rounded-xl p-3">
            <span className="text-[11px] text-amber-300/70 font-medium">Contacted</span>
            <div className="text-xl font-black text-amber-400 mt-1">{contactedCount}</div>
            <span className="text-[10px] text-amber-300/60">{newCount} uncontacted</span>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="px-6 py-2.5 border-b border-white/10 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('leads')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'leads' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              Assigned Leads ({memberLeads.length})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'activity' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              Activity Logs ({memberLogs.length})
            </button>
          </div>

          {activeTab === 'leads' && (
            <div className="flex items-center gap-2">
              <div className="relative w-40 sm:w-56">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchLead}
                  onChange={(e) => setSearchLead(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-black/50 border border-white/10 text-white text-xs rounded-lg px-2 py-1 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="interested">Interested</option>
                <option value="closed">Closed</option>
                <option value="not_interested">Lost</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 custom-scrollbar">
          {activeTab === 'leads' && (
            filteredLeads.length === 0 ? (
              <div className="text-center py-16 text-white/40 text-xs italic">
                No assigned leads found for @{username} under this filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredLeads.map(lead => (
                  <div
                    key={lead.id || lead.business_name}
                    className="bg-slate-900/80 border border-white/10 hover:border-purple-500/40 rounded-xl p-4 flex flex-col justify-between transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-white text-sm truncate flex-1" title={lead.business_name}>
                          {lead.business_name}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          lead.status === 'closed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                          lead.status === 'interested' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                          lead.status === 'contacted' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                          lead.status === 'not_interested' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                          'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        }`}>
                          {lead.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-white/70 mt-2.5">
                        {lead.phone && (
                          <div className="flex items-center gap-2 font-mono">
                            <Phone className="w-3.5 h-3.5 text-white/40" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-2 truncate">
                            <Mail className="w-3.5 h-3.5 text-white/40" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        )}
                        {lead.location && (
                          <div className="flex items-center gap-2 truncate">
                            <MapPin className="w-3.5 h-3.5 text-white/40" />
                            <span className="truncate">{lead.location}</span>
                          </div>
                        )}
                        {(lead.instagram || lead.facebook || lead.linkedin || lead.website || lead.social_links) && (
                          <div className="pt-1.5 border-t border-white/5">
                            <SocialBadges
                              instagram={lead.instagram}
                              facebook={lead.facebook}
                              linkedin={lead.linkedin}
                              website={lead.website}
                              socialLinks={lead.social_links}
                              size="sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyLead(lead)}
                          className={`px-2 py-1 rounded-lg border text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                            copiedId === (lead.id || lead.business_name)
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                              : 'bg-white/5 text-white/60 border-white/10 hover:text-white hover:bg-white/10'
                          }`}
                          title="Copy details"
                        >
                          <Copy className="w-3 h-3" />
                          <span className="text-[10px]">{copiedId === (lead.id || lead.business_name) ? 'Copied' : 'Copy'}</span>
                        </button>

                        {reassigningLeadId === lead.id ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={targetAssignee}
                              onChange={(e) => setTargetAssignee(e.target.value)}
                              className="bg-black border border-cyan-500 text-white text-[10px] rounded px-1.5 py-0.5 focus:outline-none"
                            >
                              <option value="">Reassign to...</option>
                              {allMembers.map(m => (
                                <option key={m} value={m}>@{m}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleReassign(lead.id!, lead)}
                              className="px-1.5 py-0.5 bg-cyan-500 text-white rounded text-[10px] font-bold"
                            >
                              Go
                            </button>
                            <button
                              onClick={() => setReassigningLeadId(null)}
                              className="text-white/40 hover:text-white text-[10px]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setReassigningLeadId(lead.id!);
                              setTargetAssignee(lead.assigned_to);
                            }}
                            className="p-1 text-white/40 hover:text-cyan-300 text-xs rounded hover:bg-white/5"
                            title="Reassign lead"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <select
                        value={lead.status}
                        onChange={(e) => handleUpdateStatus(lead.id!, e.target.value, lead.business_name)}
                        className="bg-black/60 border border-white/10 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="interested">Interested</option>
                        <option value="closed">Closed / Won</option>
                        <option value="not_interested">Lost</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'activity' && (
            memberLogs.length === 0 ? (
              <div className="text-center py-16 text-white/40 text-xs italic">
                No activity logs recorded yet for @{username}.
              </div>
            ) : (
              <div className="space-y-2.5">
                {memberLogs.map(log => (
                  <div
                    key={log.id || `${log.created_at}_${log.action}`}
                    className="p-3 bg-black/30 border border-white/5 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        log.action === 'closed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                        log.action === 'copied' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                        log.action === 'reassigned' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                        'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      }`}>
                        {log.action}
                      </span>
                      <span className="font-semibold text-white">"{log.lead_name}"</span>
                      {log.details && <span className="text-white/50">{log.details}</span>}
                    </div>
                    <span className="font-mono text-white/40 text-[11px]">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </motion.div>
    </div>
  );
}
