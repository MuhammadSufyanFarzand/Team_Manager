import React, { useState, useMemo } from 'react';
import { Lead } from '../../types';
import { 
  Search, Filter, Download, User, Globe, Phone, Mail, 
  MapPin, CheckCircle2, Copy, Trash2, ArrowRightLeft, 
  ExternalLink, Calendar, MessageCircle, Sparkles, 
  Layers, CheckSquare, Square, MoreHorizontal, Eye, Flame 
} from 'lucide-react';
import { supabase } from '../../supabase';
import { logLeadActivity } from '../../lib/leadLogs';
import { SocialBadges } from '../SocialBadges';
import confetti from 'canvas-confetti';

interface LeadsMasterTableProps {
  leads: Lead[];
  allMembers: string[];
  currentUser: string;
  onLeadUpdated: () => void;
  selectedMemberFilter?: string;
  onOpenQuickTransfer?: () => void;
}

export function LeadsMasterTable({
  leads,
  allMembers,
  currentUser,
  onLeadUpdated,
  selectedMemberFilter,
  onOpenQuickTransfer
}: LeadsMasterTableProps) {
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState(selectedMemberFilter || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'older'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards'); // Default to cards for best mobile UX
  const [reassigningLeadId, setReassigningLeadId] = useState<string | null>(null);
  const [targetAssignee, setTargetAssignee] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  const weekAgoObj = new Date();
  weekAgoObj.setDate(weekAgoObj.getDate() - 7);
  const weekAgoStr = weekAgoObj.toISOString().split('T')[0];

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search
      const s = search.toLowerCase();
      const matchesSearch = !s || 
        lead.business_name.toLowerCase().includes(s) ||
        (lead.phone && lead.phone.toLowerCase().includes(s)) ||
        (lead.email && lead.email.toLowerCase().includes(s)) ||
        (lead.instagram && lead.instagram.toLowerCase().includes(s)) ||
        (lead.facebook && lead.facebook.toLowerCase().includes(s)) ||
        (lead.linkedin && lead.linkedin.toLowerCase().includes(s)) ||
        (lead.assigned_to && lead.assigned_to.toLowerCase().includes(s)) ||
        (lead.location && lead.location.toLowerCase().includes(s));

      // Member filter
      const matchesMember = memberFilter === 'all' || lead.assigned_to === memberFilter;

      // Status filter
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;

      // Date filter
      const leadDate = (lead.created_at || '').split('T')[0] || lead.assigned_date || '';
      let matchesDate = true;
      if (dateFilter === 'today') {
        matchesDate = leadDate === todayStr;
      } else if (dateFilter === 'yesterday') {
        matchesDate = leadDate === yesterdayStr;
      } else if (dateFilter === 'week') {
        matchesDate = leadDate >= weekAgoStr;
      } else if (dateFilter === 'older') {
        matchesDate = leadDate < weekAgoStr && leadDate.length > 0;
      }

      return matchesSearch && matchesMember && matchesStatus && matchesDate;
    });
  }, [leads, search, memberFilter, statusFilter, dateFilter, todayStr, yesterdayStr, weekAgoStr]);

  const handleCopyLeadInfo = (lead: Lead) => {
    const text = `Business: ${lead.business_name}\nPhone: ${lead.phone || 'N/A'}\nEmail: ${lead.email || 'N/A'}\nWebsite: ${lead.website || 'N/A'}\nLocation: ${lead.location || 'N/A'}\nNotes: ${lead.notes || ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(lead.id || lead.business_name);
    setTimeout(() => setCopiedId(null), 2000);

    logLeadActivity('copied', currentUser, lead.business_name, `Lead details copied by ${currentUser}`, lead.id);
  };

  const handleUpdateStatus = async (id: string, newStatus: string, leadName: string) => {
    try {
      await supabase.from('leads').update({ status: newStatus }).eq('id', id);
      logLeadActivity('status_changed', currentUser, leadName, `Status updated to ${newStatus} by Admin`, id);
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

  const handleDeleteLead = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to permanently delete lead "${name}"?`)) {
      try {
        await supabase.from('leads').delete().eq('id', id);
        onLeadUpdated();
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  // Bulk Selection Handlers
  const handleToggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredLeads.map(l => l.id).filter(Boolean) as string[];
    if (selectedLeadIds.length === allFilteredIds.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(allFilteredIds);
    }
  };

  const handleExecuteBulkAssign = async () => {
    if (!bulkAssignee || selectedLeadIds.length === 0) return;
    setBulkLoading(true);
    try {
      await supabase
        .from('leads')
        .update({ 
          assigned_to: bulkAssignee,
          last_updated_at: new Date().toISOString()
        })
        .in('id', selectedLeadIds);

      logLeadActivity(
        'reassigned',
        currentUser,
        `${selectedLeadIds.length} Leads (Bulk Action)`,
        `Bulk reassigned ${selectedLeadIds.length} leads to @${bulkAssignee}`
      );

      try {
        confetti({ particleCount: 50, spread: 60 });
      } catch {}

      setSelectedLeadIds([]);
      setBulkAssignee('');
      onLeadUpdated();
    } catch (err) {
      console.error('Bulk assign error:', err);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExecuteBulkStatus = async () => {
    if (!bulkStatus || selectedLeadIds.length === 0) return;
    setBulkLoading(true);
    try {
      await supabase
        .from('leads')
        .update({ 
          status: bulkStatus,
          last_updated_at: new Date().toISOString()
        })
        .in('id', selectedLeadIds);

      logLeadActivity(
        'status_changed',
        currentUser,
        `${selectedLeadIds.length} Leads (Bulk Action)`,
        `Bulk updated ${selectedLeadIds.length} leads to status: ${bulkStatus}`
      );

      setSelectedLeadIds([]);
      setBulkStatus('');
      onLeadUpdated();
    } catch (err) {
      console.error('Bulk status error:', err);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExecuteBulkDelete = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedLeadIds.length} selected leads?`)) return;

    setBulkLoading(true);
    try {
      await supabase.from('leads').delete().in('id', selectedLeadIds);
      setSelectedLeadIds([]);
      onLeadUpdated();
    } catch (err) {
      console.error('Bulk delete error:', err);
    } finally {
      setBulkLoading(false);
    }
  };

  // Helper for WhatsApp link
  const getWhatsAppLink = (phone?: string, businessName?: string) => {
    if (!phone) return null;
    const cleanNumber = phone.replace(/[^0-9]/g, '');
    if (!cleanNumber) return null;
    const greeting = encodeURIComponent(`Hello ${businessName || ''}, I am reaching out regarding your business services.`);
    return `https://wa.me/${cleanNumber}?text=${greeting}`;
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLeads.length === 0) return;
    const headers = [
      'Business Name', 'Status', 'Assigned To', 'Phone', 'Email', 
      'Location', 'Website', 'Instagram', 'Facebook', 'LinkedIn', 
      'Rating', 'Notes', 'Created At'
    ];

    const rows = filteredLeads.map(l => [
      `"${(l.business_name || '').replace(/"/g, '""')}"`,
      `"${l.status}"`,
      `"${l.assigned_to}"`,
      `"${l.phone || ''}"`,
      `"${l.email || ''}"`,
      `"${(l.location || '').replace(/"/g, '""')}"`,
      `"${l.website || ''}"`,
      `"${l.instagram || ''}"`,
      `"${l.facebook || ''}"`,
      `"${l.linkedin || ''}"`,
      `"${l.rating || ''}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
      `"${l.created_at || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Search Controls */}
      <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search business name, phone, city, or member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* View Mode & Export Actions */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {/* Table / Cards Toggle */}
            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Cards View
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Table View
              </button>
            </div>

            {onOpenQuickTransfer && (
              <button
                onClick={onOpenQuickTransfer}
                className="px-3 py-2 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Transfer leads between members"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-purple-300" />
                <span className="hidden sm:inline">Quick Transfer</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Pills / Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/5">
          {/* Member Filter */}
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Filter by Member:</label>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="all">All Members ({allMembers.length})</option>
              {allMembers.map((m) => (
                <option key={m} value={m}>@{m}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="new">🔵 New (Uncontacted)</option>
              <option value="contacted">🟡 Contacted</option>
              <option value="interested">🟢 Interested / Hot</option>
              <option value="closed">🏆 Won / Closed</option>
              <option value="not_interested">🔴 Not Interested</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="text-[10px] text-white/50 block mb-1">Filter by Time:</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today's Inflow</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Past 7 Days</option>
              <option value="older">Older</option>
            </select>
          </div>

          {/* Results Summary & Select All button */}
          <div className="flex items-end justify-between sm:justify-end gap-2 pb-0.5">
            <button
              onClick={handleSelectAllFiltered}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[11px] text-white/80 flex items-center gap-1.5 cursor-pointer"
            >
              {selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0 ? (
                <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-white/40" />
              )}
              <span>Select All ({filteredLeads.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar (Visible when leads are selected) */}
      {selectedLeadIds.length > 0 && (
        <div className="sticky top-2 z-20 bg-purple-950/95 border border-purple-500/50 rounded-2xl p-3 sm:px-4 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 font-bold text-white">
            <span className="w-6 h-6 rounded-full bg-purple-500/30 border border-purple-400/50 flex items-center justify-center text-xs text-purple-300">
              {selectedLeadIds.length}
            </span>
            <span>Leads Selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk Reassign */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
              <select
                value={bulkAssignee}
                onChange={(e) => setBulkAssignee(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer px-1"
              >
                <option value="" className="bg-slate-900">Assign to...</option>
                {allMembers.map(m => (
                  <option key={m} value={m} className="bg-slate-900">@{m}</option>
                ))}
              </select>
              <button
                onClick={handleExecuteBulkAssign}
                disabled={bulkLoading || !bulkAssignee}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg font-bold transition-colors cursor-pointer"
              >
                Reassign
              </button>
            </div>

            {/* Bulk Status Change */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer px-1"
              >
                <option value="" className="bg-slate-900">Change Status...</option>
                <option value="new" className="bg-slate-900">New</option>
                <option value="contacted" className="bg-slate-900">Contacted</option>
                <option value="interested" className="bg-slate-900">Interested</option>
                <option value="closed" className="bg-slate-900">Closed (Won)</option>
                <option value="not_interested" className="bg-slate-900">Not Interested</option>
              </select>
              <button
                onClick={handleExecuteBulkStatus}
                disabled={bulkLoading || !bulkStatus}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg font-bold transition-colors cursor-pointer"
              >
                Update
              </button>
            </div>

            {/* Bulk Delete */}
            <button
              onClick={handleExecuteBulkDelete}
              disabled={bulkLoading}
              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl transition-colors cursor-pointer"
              title="Delete Selected Leads"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setSelectedLeadIds([])}
              className="px-2 py-1 text-white/50 hover:text-white text-[11px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* No Results Fallback */}
      {filteredLeads.length === 0 && (
        <div className="py-16 text-center text-white/40 space-y-2 bg-slate-900/40 rounded-3xl border border-white/5">
          <Filter className="w-8 h-8 mx-auto text-white/20" />
          <p className="text-sm font-semibold">No matching leads found</p>
          <p className="text-xs text-white/30">Apne filter ya search criteria ko tabdeel karein</p>
        </div>
      )}

      {/* VIEW 1: Touch-Optimized Cards View (Supercool on Mobile & Desktop) */}
      {viewMode === 'cards' && filteredLeads.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredLeads.map((lead) => {
            const isSelected = selectedLeadIds.includes(lead.id || '');
            const waLink = getWhatsAppLink(lead.phone, lead.business_name);

            const statusColors: Record<string, { bg: string; text: string; border: string }> = {
              new: { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/30' },
              contacted: { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/30' },
              interested: { bg: 'bg-cyan-500/10', text: 'text-cyan-300', border: 'border-cyan-500/30' },
              closed: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/40' },
              not_interested: { bg: 'bg-red-500/10', text: 'text-red-300', border: 'border-red-500/30' },
            };
            const currentStatus = statusColors[lead.status] || statusColors.new;

            return (
              <div
                key={lead.id || lead.business_name}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-lg relative ${
                  isSelected 
                    ? 'bg-purple-950/40 border-purple-500 ring-1 ring-purple-500' 
                    : 'bg-slate-900/80 border-white/10 hover:border-white/20'
                }`}
              >
                <div>
                  {/* Top Bar: Checkbox + Title + Status Pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => lead.id && handleToggleSelectLead(lead.id)}
                        className="mt-0.5 text-white/40 hover:text-purple-400 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <h4 className="font-bold text-white text-sm tracking-tight leading-snug">
                          {lead.business_name}
                        </h4>
                        {lead.location && (
                          <div className="flex items-center gap-1 text-[11px] text-white/50 mt-0.5">
                            <MapPin className="w-3 h-3 text-white/40 shrink-0" />
                            <span className="truncate">{lead.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Dropdown Pill */}
                    <select
                      value={lead.status}
                      onChange={(e) => lead.id && handleUpdateStatus(lead.id, e.target.value, lead.business_name)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-full border focus:outline-none cursor-pointer ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}
                    >
                      <option value="new" className="bg-slate-900 text-white">New</option>
                      <option value="contacted" className="bg-slate-900 text-white">Contacted</option>
                      <option value="interested" className="bg-slate-900 text-white">Interested</option>
                      <option value="closed" className="bg-slate-900 text-white">Closed (Won)</option>
                      <option value="not_interested" className="bg-slate-900 text-white">Lost</option>
                    </select>
                  </div>

                  {/* Contact Info Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                    {lead.phone && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-white/80 font-mono text-[11px]">
                        <Phone className="w-3 h-3 text-cyan-400" />
                        {lead.phone}
                      </span>
                    )}
                    {lead.email && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-white/80 text-[11px] truncate max-w-[170px]">
                        <Mail className="w-3 h-3 text-purple-400" />
                        {lead.email}
                      </span>
                    )}
                    {lead.website && (
                      <a
                        href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-cyan-300 hover:underline text-[11px]"
                      >
                        <Globe className="w-3 h-3" />
                        Site
                      </a>
                    )}
                  </div>

                  {/* Social Badges */}
                  <div className="mt-2.5">
                    <SocialBadges 
                      instagram={lead.instagram}
                      facebook={lead.facebook}
                      linkedin={lead.linkedin}
                      website={lead.website}
                      socialLinks={lead.social_links}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Bottom Row: Assigned Member + Quick Actions */}
                <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    {reassigningLeadId === lead.id ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={targetAssignee}
                          onChange={(e) => setTargetAssignee(e.target.value)}
                          className="bg-slate-950 border border-white/20 rounded px-1.5 py-0.5 text-[11px] text-white"
                        >
                          <option value="">Select...</option>
                          {allMembers.map(m => (
                            <option key={m} value={m}>@{m}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => lead.id && handleReassign(lead.id, lead)}
                          className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setReassigningLeadId(null)}
                          className="text-[10px] text-white/40"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReassigningLeadId(lead.id || null);
                          setTargetAssignee(lead.assigned_to);
                        }}
                        className="hover:text-purple-300 hover:underline font-bold text-white/90 flex items-center gap-1 cursor-pointer"
                        title="Click to reassign"
                      >
                        @{lead.assigned_to}
                        <ArrowRightLeft className="w-2.5 h-2.5 text-white/40" />
                      </button>
                    )}
                  </div>

                  {/* 1-Tap Action Launcher (WhatsApp, Call, Copy, Delete) */}
                  <div className="flex items-center gap-1">
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors"
                        title="Open WhatsApp Chat"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-colors"
                        title="Call Phone Number"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => handleCopyLeadInfo(lead)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors cursor-pointer"
                      title="Copy details"
                    >
                      {copiedId === (lead.id || lead.business_name) ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => lead.id && handleDeleteLead(lead.id, lead.business_name)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 border border-white/10 transition-colors cursor-pointer"
                      title="Delete lead"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: Dense Table View (Classic Desktop) */}
      {viewMode === 'table' && filteredLeads.length > 0 && (
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-white/80">
              <thead className="bg-slate-950 text-white/50 uppercase font-mono text-[10px] border-b border-white/10">
                <tr>
                  <th className="p-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                      onChange={handleSelectAllFiltered}
                      className="rounded accent-purple-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Business</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assigned To</th>
                  <th className="p-3">Socials</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLeads.map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead.id || '');
                  const waLink = getWhatsAppLink(lead.phone, lead.business_name);

                  return (
                    <tr 
                      key={lead.id || lead.business_name} 
                      className={`hover:bg-white/5 transition-colors ${isSelected ? 'bg-purple-950/20' : ''}`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => lead.id && handleToggleSelectLead(lead.id)}
                          className="rounded accent-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-white text-xs">{lead.business_name}</div>
                        {lead.location && <div className="text-[10px] text-white/40">{lead.location}</div>}
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-cyan-300 text-[11px]">{lead.phone || '-'}</div>
                        <div className="text-[10px] text-white/40 truncate max-w-[140px]">{lead.email || ''}</div>
                      </td>
                      <td className="p-3">
                        <select
                          value={lead.status}
                          onChange={(e) => lead.id && handleUpdateStatus(lead.id, e.target.value, lead.business_name)}
                          className="bg-slate-950 border border-white/15 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="interested">Interested</option>
                          <option value="closed">Closed (Won)</option>
                          <option value="not_interested">Not Interested</option>
                        </select>
                      </td>
                      <td className="p-3 font-semibold text-white/90">
                        @{lead.assigned_to}
                      </td>
                      <td className="p-3">
                        <SocialBadges 
                          instagram={lead.instagram}
                          facebook={lead.facebook}
                          linkedin={lead.linkedin}
                          website={lead.website}
                          socialLinks={lead.social_links}
                          size="sm"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleCopyLeadInfo(lead)}
                            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                            title="Copy details"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => lead.id && handleDeleteLead(lead.id, lead.business_name)}
                            className="p-1 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
