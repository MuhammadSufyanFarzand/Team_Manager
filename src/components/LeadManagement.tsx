import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../supabase';
import { Lead } from '../types';
import { 
  X, Upload, Briefcase, Phone, Mail, Globe, MapPin, Star, 
  User, Loader2, Copy, Check, ChevronDown, ChevronRight, 
  Trash2, Search, Filter, Calendar, Clock, ArrowDownCircle, 
  CheckCircle2, Sparkles, AlertCircle, Users, LayoutGrid, Table as TableIcon 
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '../lib/utils';
import { logLeadActivity } from '../lib/leadLogs';
import { SocialBadges } from './SocialBadges';
import { LeadDistributeModal } from './LeadDistributeModal';

interface LeadManagementProps {
  onClose: () => void;
  currentUser: string;
  isLeader: boolean;
  teamMembers: string[];
}

export function LeadManagement({ onClose, currentUser, isLeader, teamMembers }: LeadManagementProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my_leads' | 'add_leads'>('my_leads');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'older'>('all');
  const [showOlderLeads, setShowOlderLeads] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);

  // Form states
  const [distributionSummary, setDistributionSummary] = useState<string | null>(null);

  useEffect(() => {
    fetchLeads();
  }, [isLeader, currentUser]);

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
    
    // Regular members only see their own assigned leads
    if (!isLeader) {
      query = query.eq('assigned_to', currentUser);
    }

    const { data, error } = await query;
    if (data && !error) {
      setLeads(data as Lead[]);
    }
    setLoading(false);
  };

  // Lead copying with interaction tracking
  const handleCopyLead = async (lead: Lead) => {
    const text = `Business: ${lead.business_name}\nPhone: ${lead.phone || 'N/A'}\nEmail: ${lead.email || 'N/A'}\nWebsite: ${lead.website || 'N/A'}\nLocation: ${lead.location || 'N/A'}\nNotes: ${lead.notes || ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(lead.id || lead.business_name);
    setTimeout(() => setCopiedId(null), 2000);

    // Increment copied count
    const nextCount = (lead.copied_count || 0) + 1;
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, copied_count: nextCount } : l));

    try {
      if (lead.id) {
        await supabase.from('leads').update({ copied_count: nextCount }).eq('id', lead.id);
      }
      logLeadActivity('copied', currentUser, lead.business_name, `Lead details copied by @${currentUser}`, lead.id);
    } catch {
      // safe fallback
    }
  };

  const updateLeadStatus = async (id: string, newStatus: string, leadName: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus as any } : l));
    try {
      await supabase.from('leads').update({ status: newStatus }).eq('id', id);
      logLeadActivity(
        newStatus === 'closed' ? 'closed' : 'status_changed',
        currentUser,
        leadName,
        `Status updated to "${newStatus}" by @${currentUser}`,
        id
      );
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const deleteLead = async (id: string) => {
    if (confirm('Are you sure you want to delete this lead?')) {
      setLeads(prev => prev.filter(l => l.id !== id));
      await supabase.from('leads').delete().eq('id', id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'contacted': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'interested': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'not_interested': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'closed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Base list depending on tab
  const baseLeads = isLeader && activeTab === 'add_leads' 
    ? leads 
    : leads.filter(l => l.assigned_to === currentUser);

  // Date constants
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  const weekAgoObj = new Date();
  weekAgoObj.setDate(weekAgoObj.getDate() - 7);
  const weekAgoStr = weekAgoObj.toISOString().split('T')[0];

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return baseLeads.filter(lead => {
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

      // Status
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;

      // Member filter (when in leader / all leads mode)
      const matchesMember = memberFilter === 'all' || lead.assigned_to === memberFilter;

      // Date
      const leadDate = (lead.created_at || '').split('T')[0] || lead.assigned_date || '';
      let matchesDate = true;
      if (dateFilter === 'today') matchesDate = leadDate === todayStr;
      else if (dateFilter === 'yesterday') matchesDate = leadDate === yesterdayStr;
      else if (dateFilter === 'week') matchesDate = leadDate >= weekAgoStr;
      else if (dateFilter === 'older') matchesDate = leadDate < weekAgoStr && leadDate.length > 0;

      return matchesSearch && matchesStatus && matchesMember && matchesDate;
    });
  }, [baseLeads, search, statusFilter, memberFilter, dateFilter, todayStr, yesterdayStr, weekAgoStr]);

  // Group filtered leads by Date: Today, Yesterday, This Week, Older
  const groupedLeads = useMemo(() => {
    const today: Lead[] = [];
    const yesterday: Lead[] = [];
    const thisWeek: Lead[] = [];
    const older: Lead[] = [];

    filteredLeads.forEach(lead => {
      const d = (lead.created_at || '').split('T')[0] || lead.assigned_date || '';
      if (d === todayStr) {
        today.push(lead);
      } else if (d === yesterdayStr) {
        yesterday.push(lead);
      } else if (d >= weekAgoStr) {
        thisWeek.push(lead);
      } else {
        older.push(lead);
      }
    });

    return { today, yesterday, thisWeek, older };
  }, [filteredLeads, todayStr, yesterdayStr, weekAgoStr]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="w-full max-w-6xl h-[90vh] bg-slate-950 border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">Daily Lead Workspace</h2>
                {isLeader ? (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-emerald-300" /> Team Leader
                  </span>
                ) : (
                  <span className="bg-white/10 text-white/60 border border-white/10 text-xs px-2.5 py-0.5 rounded-full font-medium">
                    Team Member
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50">
                {isLeader 
                  ? "Upload CSV leads to distribute equally & track progress" 
                  : "Work your daily assigned leads date-by-date and close clients"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Distribution Success Toast/Banner */}
        {distributionSummary && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-6 py-3 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{distributionSummary}</span>
            </div>
            <button 
              onClick={() => setDistributionSummary(null)} 
              className="text-white/40 hover:text-white ml-3 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Controls & Date Filter Toolbar */}
        <div className="px-6 py-3 border-b border-white/10 bg-black/20 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Main Tabs */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setActiveTab('my_leads')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer",
                  activeTab === 'my_leads' ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20" : "text-white/60 hover:text-white"
                )}
              >
                My Leads ({leads.filter(l => l.assigned_to === currentUser).length})
              </button>
              {isLeader && (
                <button 
                  onClick={() => setActiveTab('add_leads')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer",
                    activeTab === 'add_leads' ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20" : "text-white/60 hover:text-white"
                  )}
                >
                  Distribute Leads ({leads.length})
                </button>
              )}
            </div>

            {/* Quick date filters */}
            <div className="hidden sm:flex items-center gap-1 bg-black/30 p-1 rounded-xl text-xs border border-white/5">
              {(['all', 'today', 'yesterday', 'week', 'older'] as const).map(df => (
                <button
                  key={df}
                  onClick={() => setDateFilter(df)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer capitalize ${
                    dateFilter === df ? 'bg-white/15 text-white font-bold' : 'text-white/50 hover:text-white'
                  }`}
                >
                  {df === 'all' ? 'All' : df === 'today' ? 'Today' : df === 'yesterday' ? 'Yesterday' : df === 'week' ? 'This Week' : 'Older'}
                </button>
              ))}
            </div>
          </div>

          {/* Search, Status & Upload Button */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            {/* Search */}
            <div className="relative flex-1 sm:w-48 md:w-56">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Status select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-black/50 border border-white/10 text-white text-xs rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="closed">Closed / Won</option>
              <option value="not_interested">Not Interested</option>
            </select>

            {/* Member filter (Only for leader / when distributing leads) */}
            {isLeader && activeTab === 'add_leads' && (
              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="bg-black/50 border border-white/10 text-white text-xs rounded-xl px-2.5 py-1.5 focus:outline-none"
              >
                <option value="all">All Members ({teamMembers.length})</option>
                {teamMembers.map(m => (
                  <option key={m} value={m}>@{m}</option>
                ))}
              </select>
            )}

            {/* Upload & Distribute Button (ONLY for Leader) */}
            {isLeader && activeTab === 'add_leads' && (
              <button 
                onClick={() => setIsDistributeModalOpen(true)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-cyan-500/20"
                title="Upload CSV & distribute leads equally among selected members"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload & Distribute</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 custom-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-white/50 space-y-4 py-16">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <Briefcase className="w-8 h-8 opacity-40 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">No leads found</h3>
                <p className="max-w-md text-xs text-white/50 mt-1">
                  {activeTab === 'my_leads' 
                    ? "You don't have any leads assigned under this filter." 
                    : "Upload a CSV file to automatically distribute leads equally among chosen team members."}
                </p>
              </div>
              {isLeader && activeTab === 'add_leads' && (
                <button
                  onClick={() => setIsDistributeModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload & Distribute Leads</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* 1. TODAY'S LEADS */}
              {(dateFilter === 'all' || dateFilter === 'today') && groupedLeads.today.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        Today's Leads ({groupedLeads.today.length})
                      </h3>
                      <span className="text-[10px] bg-cyan-500/10 text-cyan-300 font-bold px-2 py-0.5 rounded-full border border-cyan-500/30">
                        Active Today
                      </span>
                    </div>
                    <span className="text-xs text-white/40 font-mono">{todayStr}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedLeads.today.map(lead => renderLeadCard(lead))}
                  </div>
                </section>
              )}

              {/* 2. YESTERDAY'S LEADS */}
              {(dateFilter === 'all' || dateFilter === 'yesterday') && groupedLeads.yesterday.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Yesterday's Leads ({groupedLeads.yesterday.length})
                      </h3>
                    </div>
                    <span className="text-xs text-white/40 font-mono">{yesterdayStr}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedLeads.yesterday.map(lead => renderLeadCard(lead))}
                  </div>
                </section>
              )}

              {/* 3. EARLIER THIS WEEK */}
              {(dateFilter === 'all' || dateFilter === 'week') && groupedLeads.thisWeek.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Earlier This Week ({groupedLeads.thisWeek.length})
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedLeads.thisWeek.map(lead => renderLeadCard(lead))}
                  </div>
                </section>
              )}

              {/* 4. OLDER LEADS / PREVIOUS WEEKS */}
              {(dateFilter === 'all' || dateFilter === 'older') && groupedLeads.older.length > 0 && (
                <section className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-white/40" />
                      <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">
                        Older Leads Archive ({groupedLeads.older.length})
                      </h3>
                    </div>

                    {dateFilter === 'all' && (
                      <button
                        onClick={() => setShowOlderLeads(!showOlderLeads)}
                        className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                      >
                        {showOlderLeads ? 'Hide Archive' : 'Load Previous Week Leads'}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOlderLeads ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  {(dateFilter === 'older' || showOlderLeads) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupedLeads.older.map(lead => renderLeadCard(lead))}
                    </div>
                  ) : (
                    <div 
                      onClick={() => setShowOlderLeads(true)}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-colors cursor-pointer text-xs text-white/60 flex items-center justify-center gap-2"
                    >
                      <ArrowDownCircle className="w-4 h-4 text-cyan-400" />
                      <span>Click to view {groupedLeads.older.length} older leads from previous weeks</span>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Smart Lead Distribution Modal */}
      {isDistributeModalOpen && (
        <LeadDistributeModal
          isOpen={isDistributeModalOpen}
          onClose={() => setIsDistributeModalOpen(false)}
          currentUser={currentUser}
          allMembers={teamMembers}
          onSuccess={(newlyAddedLeads, summary) => {
            setLeads(prev => [...newlyAddedLeads, ...prev]);
            setDistributionSummary(summary);
          }}
        />
      )}
    </div>
  );

  // Helper render card
  function renderLeadCard(lead: Lead) {
    const isMine = lead.assigned_to === currentUser;
    const isCopied = copiedId === (lead.id || lead.business_name);

    return (
      <div 
        key={lead.id || lead.business_name} 
        className="bg-slate-900 border border-white/10 hover:border-cyan-500/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative group transition-all"
      >
        {/* Top Header */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-bold text-white text-base truncate flex-1" title={lead.business_name}>
              {lead.business_name}
            </h4>
            
            {isLeader && (
              <button 
                onClick={() => deleteLead(lead.id!)}
                className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Delete Lead"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-white/50 mb-3 pb-2 border-b border-white/5">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 text-cyan-400" />
              <span>Assigned: <strong className="text-cyan-300">@{lead.assigned_to}</strong></span>
            </div>
            {lead.rating && (
              <span className="text-amber-400 font-semibold text-[11px]">★ {lead.rating}</span>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2 text-xs text-white/70 mb-3">
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                <span className="font-mono">{lead.phone}</span>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}
            {lead.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                <span className="truncate">{lead.location}</span>
              </div>
            )}

            {/* Social Media Badges (Instagram, Facebook, LinkedIn, Website) */}
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

            {lead.notes && (
              <p className="text-[11px] text-white/50 italic bg-black/30 p-2 rounded-lg mt-2">
                {lead.notes}
              </p>
            )}
          </div>
        </div>

        {/* Footer & Status Controls */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={cn("px-2.5 py-0.5 text-[10px] font-bold rounded-full border", getStatusColor(lead.status))}>
              {lead.status.replace('_', ' ').toUpperCase()}
            </span>

            {/* Quick Copy Button */}
            <button
              onClick={() => handleCopyLead(lead)}
              className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                isCopied 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                  : 'bg-white/5 text-white/60 border-white/10 hover:text-white hover:bg-white/10'
              }`}
              title="Copy details to clipboard"
            >
              {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span className="text-[10px]">{isCopied ? 'Copied' : (lead.copied_count ? `${lead.copied_count}` : 'Copy')}</span>
            </button>
          </div>

          {/* Status selector (for assignee or leader) */}
          {(isMine || isLeader) && (
            <select 
              value={lead.status}
              onChange={(e) => updateLeadStatus(lead.id!, e.target.value, lead.business_name)}
              className="bg-black/60 border border-white/10 text-white text-[11px] font-medium rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="closed">Closed / Won</option>
              <option value="not_interested">Not Interested</option>
            </select>
          )}
        </div>
      </div>
    );
  }
}
