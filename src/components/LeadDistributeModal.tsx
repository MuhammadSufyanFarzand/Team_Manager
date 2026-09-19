import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { 
  X, Upload, Users, CheckCircle2, AlertCircle, 
  ArrowRight, ShieldCheck, Sparkles, Check, 
  UserCheck, UserX, Phone, Mail, Globe, Eye, FileSpreadsheet
} from 'lucide-react';
import { Lead } from '../types';
import { supabase } from '../supabase';
import { logLeadActivity } from '../lib/leadLogs';
import { SocialBadges } from './SocialBadges';

interface LeadDistributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string;
  allMembers: string[];
  onSuccess: (newLeads: Lead[], summary: string) => void;
}

// Flexible header normalizer to handle ANY CSV header variations
function findHeaderValue(row: Record<string, any>, candidateKeys: string[]): string {
  const rowKeys = Object.keys(row);
  for (const candidate of candidateKeys) {
    const foundKey = rowKeys.find(
      k => k.trim().toLowerCase().replace(/[\s_\-#]+/g, '') === candidate.toLowerCase().replace(/[\s_\-#]+/g, '')
    );
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      const val = String(row[foundKey]).trim();
      if (val) return val;
    }
  }
  return '';
}

export function LeadDistributeModal({
  isOpen,
  onClose,
  currentUser,
  allMembers,
  onSuccess
}: LeadDistributeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Partial<Lead>[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Selection mode: 'all' | 'custom'
  const [selectionMode, setSelectionMode] = useState<'all' | 'custom'>('all');
  
  // Ensure valid clean members list
  const validMembers = useMemo(() => {
    const unique = Array.from(new Set(allMembers.filter(m => Boolean(m && m.trim()))));
    return unique.length > 0 ? unique : [currentUser];
  }, [allMembers, currentUser]);

  // Selected members for this batch distribution
  const [selectedMembers, setSelectedMembers] = useState<string[]>(validMembers);

  // When validMembers changes, sync
  React.useEffect(() => {
    if (selectionMode === 'all') {
      setSelectedMembers(validMembers);
    }
  }, [validMembers, selectionMode]);

  // Parse CSV file safely with ZERO errors for missing email/phone
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setParsing(true);
    setFile(selectedFile);
    setFileName(selectedFile.name);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const rawData = (results.data || []) as Record<string, any>[];
        const processed: Partial<Lead>[] = [];

        rawData.forEach((row, index) => {
          // Check business name with many fallbacks so zero rows are rejected
          let businessName = findHeaderValue(row, [
            'business name', 'business_name', 'company', 'company name', 'name', 
            'lead name', 'title', 'store', 'shop', 'organization', 'client', 'firm'
          ]);

          const website = findHeaderValue(row, ['website', 'web', 'url', 'domain', 'site', 'link']);
          const phone = findHeaderValue(row, [
            'phone', 'phone number', 'mobile', 'mobile number', 'cell', 'telephone', 
            'tel', 'whatsapp', 'contact', 'contact number', 'phone_number'
          ]);
          const email = findHeaderValue(row, ['email', 'e-mail', 'mail', 'email address', 'contact email']);
          
          // Social Media extraction
          const instagram = findHeaderValue(row, [
            'instagram', 'ig', 'insta', 'instagram link', 'instagram profile', 
            'instagram url', 'instagram handle', 'ig link', 'instagram_id'
          ]);
          const facebook = findHeaderValue(row, [
            'facebook', 'fb', 'facebook page', 'facebook link', 'facebook url', 
            'fb page', 'fb link', 'facebook_id'
          ]);
          const linkedin = findHeaderValue(row, [
            'linkedin', 'li', 'linked in', 'linkedin profile', 'linkedin url', 
            'linkedin link', 'li url'
          ]);
          const socialLinks = findHeaderValue(row, [
            'social', 'social links', 'socials', 'social media', 'twitter', 'x', 'social_links'
          ]);

          const location = findHeaderValue(row, ['location', 'address', 'city', 'state', 'country', 'region']);
          const rating = findHeaderValue(row, ['rating', 'stars', 'score', 'reviews']);
          const notes = findHeaderValue(row, ['notes', 'note', 'comment', 'description', 'remarks']);

          // If completely empty row (no name, phone, email, website), skip
          if (!businessName && !website && !phone && !email && !instagram && !facebook && !linkedin) {
            return;
          }

          // Fallback business name if missing
          if (!businessName) {
            businessName = website 
              ? website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] 
              : `Lead #${index + 1}`;
          }

          processed.push({
            business_name: businessName,
            website,
            phone,
            email,
            instagram,
            facebook,
            linkedin,
            social_links: socialLinks,
            location,
            rating,
            notes,
            status: 'new',
            copied_count: 0
          });
        });

        setParsedRows(processed);
        setParsing(false);
      },
      error: (err) => {
        console.error('CSV parse error:', err);
        alert('Failed to parse CSV file: ' + err.message);
        setParsing(false);
      }
    });
  };

  // Toggle member selection
  const toggleMember = (member: string) => {
    setSelectionMode('custom');
    if (selectedMembers.includes(member)) {
      if (selectedMembers.length === 1) {
        alert('You must select at least one team member for lead distribution.');
        return;
      }
      setSelectedMembers(selectedMembers.filter(m => m !== member));
    } else {
      setSelectedMembers([...selectedMembers, member]);
    }
  };

  const handleSelectAll = () => {
    setSelectedMembers(validMembers);
    setSelectionMode('all');
  };

  const handleSelectOnlyMe = () => {
    setSelectedMembers([currentUser]);
    setSelectionMode('custom');
  };

  // Math: Calculate equal distribution breakdown
  const distributionPlan = useMemo(() => {
    const totalLeads = parsedRows.length;
    const targetMembers = selectedMembers.length > 0 ? selectedMembers : [currentUser];
    const memberCount = targetMembers.length;

    const basePerMember = Math.floor(totalLeads / memberCount);
    const remainder = totalLeads % memberCount;

    const breakdown: { username: string; count: number }[] = targetMembers.map((username, idx) => {
      // Give remainder 1 each to top members
      const count = basePerMember + (idx < remainder ? 1 : 0);
      return { username, count };
    });

    return {
      totalLeads,
      memberCount,
      basePerMember,
      remainder,
      breakdown
    };
  }, [parsedRows, selectedMembers, currentUser]);

  // Execute Distribution to Supabase
  const handleConfirmDistribution = async () => {
    if (parsedRows.length === 0) {
      alert('Please select a valid CSV file with leads first.');
      return;
    }

    if (selectedMembers.length === 0) {
      alert('Please select at least one member to receive the leads.');
      return;
    }

    setSubmitting(true);
    const todayISO = new Date().toISOString();
    const todayDateStr = todayISO.split('T')[0];

    // Assign leads strictly according to the round-robin selected members
    const finalLeadsToInsert: any[] = [];
    const countsAssigned: Record<string, number> = {};
    selectedMembers.forEach(m => { countsAssigned[m] = 0; });

    let memberIndex = 0;
    for (const lead of parsedRows) {
      const assignedTarget = selectedMembers[memberIndex % selectedMembers.length];
      countsAssigned[assignedTarget] = (countsAssigned[assignedTarget] || 0) + 1;

      finalLeadsToInsert.push({
        business_name: lead.business_name || 'Unnamed Lead',
        website: lead.website || '',
        phone: lead.phone || '',
        email: lead.email || '',
        instagram: lead.instagram || '',
        facebook: lead.facebook || '',
        linkedin: lead.linkedin || '',
        social_links: lead.social_links || '',
        location: lead.location || '',
        rating: lead.rating || '',
        notes: lead.notes || '',
        status: 'new',
        added_by: currentUser,
        assigned_to: assignedTarget,
        assigned_date: todayDateStr,
        copied_count: 0,
        created_at: todayISO
      });

      memberIndex++;
    }

    try {
      const { data, error } = await supabase.from('leads').insert(finalLeadsToInsert).select();
      if (error) {
        throw error;
      }

      // Generate clear summary
      const summaryItems = Object.entries(countsAssigned)
        .map(([user, count]) => `${count} leads to @${user}`)
        .join(', ');
      
      const summaryMsg = `Successfully distributed ${finalLeadsToInsert.length} leads across ${selectedMembers.length} members (${summaryItems}).`;

      // Log activity
      logLeadActivity(
        'distributed',
        currentUser,
        `${finalLeadsToInsert.length} Leads`,
        summaryMsg
      );

      onSuccess((data || finalLeadsToInsert) as Lead[], summaryMsg);
      onClose();
    } catch (err: any) {
      console.error('Distribution error:', err);
      alert('Database Insert Failed: ' + (err?.message || 'Check Supabase table columns and RLS'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-4xl max-h-[92vh] bg-slate-950 border border-cyan-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900/80 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                Equal Lead Distribution Hub
                <span className="text-[11px] bg-cyan-500/20 text-cyan-300 font-semibold px-2 py-0.5 rounded-full border border-cyan-500/30">
                  Smart Split
                </span>
              </h2>
              <p className="text-xs text-white/50">
                Upload CSV and select which members should receive equal leads. Missing emails or numbers are handled safely.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-white/60 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
          {/* STEP 1: UPLOAD CSV FILE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                Step 1: Upload CSV Leads File
              </label>
              {parsedRows.length > 0 && (
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {parsedRows.length} Leads Ready
                </span>
              )}
            </div>

            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 rounded-2xl p-6 sm:p-8 text-center bg-cyan-500/5 hover:bg-cyan-500/10 transition-all cursor-pointer group"
              >
                <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold text-sm text-white">Click or drag & drop CSV file here</h4>
                <p className="text-xs text-white/50 mt-1 max-w-md mx-auto">
                  Supports columns: <strong>Business Name, Phone, Email, Instagram, Facebook, LinkedIn, Website, Location</strong>.
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Zero Errors: If email or phone is missing, it will upload smoothly without errors.
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    CSV
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">{fileName}</h4>
                    <p className="text-xs text-white/50">
                      Found <strong className="text-emerald-400">{parsedRows.length} leads</strong> • Missing details auto-handled
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Change File
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: SELECT MEMBERS TO DISTRIBUTE TO */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  Step 2: Choose Who Receives The Leads ({selectedMembers.length} Selected)
                </label>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Select all members or hand-pick specific members (e.g. 3 members will each get 5 leads from 15 leads).
                </p>
              </div>

              {/* Quick toggle presets */}
              <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5 text-xs">
                <button
                  onClick={handleSelectAll}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    selectionMode === 'all' ? 'bg-cyan-500 text-white shadow-sm' : 'text-white/60 hover:text-white'
                  }`}
                >
                  All Members ({validMembers.length})
                </button>
                <button
                  onClick={handleSelectOnlyMe}
                  className="px-2.5 py-1 rounded-lg font-medium text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  Only Me
                </button>
              </div>
            </div>

            {/* Member Chips Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {validMembers.map((member) => {
                const isSelected = selectedMembers.includes(member);
                const assignedShare = distributionPlan.breakdown.find(b => b.username === member);

                return (
                  <div
                    key={member}
                    onClick={() => toggleMember(member)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/60 shadow-md shadow-cyan-500/10'
                        : 'bg-white/5 border-white/10 opacity-50 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="font-bold text-xs truncate text-white">@{member}</span>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center border text-[9px] ${
                        isSelected 
                          ? 'bg-cyan-500 text-white border-cyan-400' 
                          : 'border-white/20 text-transparent'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>

                    <div className="text-[11px] font-semibold flex items-center justify-between">
                      <span className={isSelected ? 'text-cyan-300' : 'text-white/40'}>
                        {isSelected ? 'Active' : 'Excluded'}
                      </span>
                      {isSelected && parsedRows.length > 0 && (
                        <span className="bg-cyan-500/25 text-cyan-200 px-1.5 py-0.5 rounded font-mono text-[10px]">
                          +{assignedShare?.count || 0} leads
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 3: REAL-TIME DISTRIBUTION FORMULA PREVIEW */}
          {parsedRows.length > 0 && (
            <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Live Distribution Formula Preview
                </span>

                <div className="text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-xl border border-cyan-500/30">
                  {distributionPlan.totalLeads} Total Leads ÷ {distributionPlan.memberCount} Selected Members = ~{distributionPlan.basePerMember} leads each
                </div>
              </div>

              {/* Exact breakdown pills */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {distributionPlan.breakdown.map((item) => (
                  <div 
                    key={item.username}
                    className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs"
                  >
                    <span className="text-white/60">@{item.username}:</span>
                    <span className="font-bold text-cyan-400 font-mono">{item.count} leads</span>
                  </div>
                ))}
              </div>

              {distributionPlan.remainder > 0 && (
                <p className="text-[11px] text-white/40 italic">
                  Note: {distributionPlan.totalLeads} leads divided by {distributionPlan.memberCount} members has a remainder of {distributionPlan.remainder}. The first {distributionPlan.remainder} members get 1 extra lead for fair distribution.
                </p>
              )}
            </div>
          )}

          {/* STEP 4: PREVIEW OF LEADS TO BE IMPORTED */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white/70">
                  Leads Sample Preview (First {Math.min(5, parsedRows.length)} of {parsedRows.length})
                </span>
                <span className="text-[11px] text-white/40">
                  Auto-formatted columns
                </span>
              </div>

              <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-inner">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-white/80">
                    <thead className="bg-black/40 text-[10px] uppercase text-white/50 border-b border-white/10">
                      <tr>
                        <th className="px-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">Business Name</th>
                        <th className="px-3 py-2.5">Phone</th>
                        <th className="px-3 py-2.5">Email</th>
                        <th className="px-3 py-2.5">Social Media</th>
                        <th className="px-3 py-2.5">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {parsedRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="px-3 py-2 font-mono text-white/40">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold text-white truncate max-w-[160px]">
                            {row.business_name}
                          </td>
                          <td className="px-3 py-2 font-mono text-white/70">
                            {row.phone || <span className="text-white/30 italic text-[11px]">None</span>}
                          </td>
                          <td className="px-3 py-2 text-white/70 truncate max-w-[150px]">
                            {row.email || <span className="text-white/30 italic text-[11px]">None</span>}
                          </td>
                          <td className="px-3 py-2">
                            <SocialBadges
                              instagram={row.instagram}
                              facebook={row.facebook}
                              linkedin={row.linkedin}
                              website={row.website}
                              socialLinks={row.social_links}
                              size="sm"
                            />
                            {!row.instagram && !row.facebook && !row.linkedin && !row.website && (
                              <span className="text-white/30 italic text-[11px]">None</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-white/60 truncate max-w-[120px]">
                            {row.location || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-900/90 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmDistribution}
            disabled={submitting || parsedRows.length === 0 || selectedMembers.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Distributing {parsedRows.length} Leads...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Distribute {parsedRows.length > 0 ? `${parsedRows.length} Leads` : ''} to {selectedMembers.length} Members</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
