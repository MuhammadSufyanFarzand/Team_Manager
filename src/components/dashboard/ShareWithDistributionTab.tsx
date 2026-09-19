import React, { useState, useMemo, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  Users, UserCheck, Check, Upload, CheckCircle2, 
  FileSpreadsheet, Sparkles, ShieldCheck, AlertCircle, 
  UserX, ArrowRight, Phone, Mail, Globe, Layers, UserPlus
} from 'lucide-react';
import { Lead } from '../../types';
import { supabase } from '../../supabase';
import { logLeadActivity } from '../../lib/leadLogs';
import { SocialBadges } from '../SocialBadges';

interface ShareWithDistributionTabProps {
  allMembers: string[];
  leads: Lead[];
  currentUser: string;
  onLeadsDistributed: () => void;
}

// Flexible header normalizer for CSV
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

export function ShareWithDistributionTab({
  allMembers,
  leads,
  currentUser,
  onLeadsDistributed
}: ShareWithDistributionTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<Partial<Lead>[]>([]);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [distributionSuccess, setDistributionSuccess] = useState<string | null>(null);

  // Clean member list
  const validMembers = useMemo(() => {
    const list = Array.from(new Set(allMembers.filter(m => Boolean(m && m.trim()))));
    return list.length > 0 ? list : [currentUser];
  }, [allMembers, currentUser]);

  // Selected members state with localStorage persistence
  const [selectedMembers, setSelectedMembers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('owner_share_with_members');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter(m => validMembers.includes(m));
          if (filtered.length > 0) return filtered;
        }
      }
    } catch {}
    return validMembers;
  });

  // Sync if members change
  useEffect(() => {
    setSelectedMembers(prev => {
      const existing = prev.filter(m => validMembers.includes(m));
      return existing.length > 0 ? existing : validMembers;
    });
  }, [validMembers]);

  // Save preference when user changes selection
  const handleToggleMember = (member: string) => {
    setSelectedMembers(prev => {
      let updated: string[];
      if (prev.includes(member)) {
        if (prev.length === 1) {
          alert('Aapko kam az kam 1 member zaroor select rakhna hai taake leads distribute ho sakein.');
          return prev;
        }
        updated = prev.filter(m => m !== member);
      } else {
        updated = [...prev, member];
      }
      try {
        localStorage.setItem('owner_share_with_members', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleSelectAll = () => {
    setSelectedMembers(validMembers);
    try {
      localStorage.setItem('owner_share_with_members', JSON.stringify(validMembers));
    } catch {}
  };

  const handleSelectNone = () => {
    // Keep at least currentUser
    const fallback = [currentUser];
    setSelectedMembers(fallback);
    try {
      localStorage.setItem('owner_share_with_members', JSON.stringify(fallback));
    } catch {}
  };

  // CSV Parsing with 0 Errors for missing Email/Phone
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setParsing(true);
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setDistributionSuccess(null);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const rawData = (results.data || []) as Record<string, any>[];
        const processed: Partial<Lead>[] = [];

        rawData.forEach((row, index) => {
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

          if (!businessName && !website && !phone && !email && !instagram && !facebook && !linkedin) {
            return;
          }

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
        alert('CSV Parse Error: ' + err.message);
        setParsing(false);
      }
    });
  };

  // Live Math Preview
  const distributionPlan = useMemo(() => {
    const totalLeads = parsedRows.length;
    const targetMembers = selectedMembers.length > 0 ? selectedMembers : [currentUser];
    const memberCount = targetMembers.length;

    const basePerMember = Math.floor(totalLeads / memberCount);
    const remainder = totalLeads % memberCount;

    const breakdown: { username: string; count: number }[] = targetMembers.map((username, idx) => {
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
  const handleExecuteDistribution = async () => {
    if (parsedRows.length === 0) {
      alert('Pehle ek CSV file upload karein jisme leads hon.');
      return;
    }

    if (selectedMembers.length === 0) {
      alert('Kam az kam ek member par tick lagana zaroori hai.');
      return;
    }

    setSubmitting(true);
    setDistributionSuccess(null);

    const todayISO = new Date().toISOString();
    const todayDateStr = todayISO.split('T')[0];

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
      if (error) throw error;

      const summaryItems = Object.entries(countsAssigned)
        .map(([user, count]) => `${count} leads to @${user}`)
        .join(', ');
      
      const summaryMsg = `Shandaar! ${finalLeadsToInsert.length} leads barabar divide ho gayi ${selectedMembers.length} members me (${summaryItems}).`;

      logLeadActivity(
        'distributed',
        currentUser,
        `${finalLeadsToInsert.length} Leads`,
        summaryMsg
      );

      setDistributionSuccess(summaryMsg);
      setParsedRows([]);
      setFile(null);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      onLeadsDistributed();
    } catch (err: any) {
      console.error('Lead distribution failed:', err);
      alert('Distribution Error: ' + (err?.message || 'Database insert failed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Member lead count lookup
  const memberCurrentStats = useMemo(() => {
    const stats: Record<string, { total: number; newCount: number; closed: number }> = {};
    validMembers.forEach(m => { stats[m] = { total: 0, newCount: 0, closed: 0 }; });
    leads.forEach(l => {
      const u = l.assigned_to;
      if (!stats[u]) stats[u] = { total: 0, newCount: 0, closed: 0 };
      stats[u].total += 1;
      if (l.status === 'new') stats[u].newCount += 1;
      if (l.status === 'closed') stats[u].closed += 1;
    });
    return stats;
  }, [validMembers, leads]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-cyan-950/50 via-slate-900 to-purple-950/40 border border-cyan-500/30 rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Lead Distribution Control
              </span>
              <span className="text-xs text-white/50">
                {selectedMembers.length} of {validMembers.length} Members Ticked
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              Share With: Equal Member Distribution
            </h2>
            <p className="text-xs sm:text-sm text-white/60 max-w-2xl mt-1">
              Jin jin members par <strong>tick (✓)</strong> hoga, jab bhi aap leads upload karenge to leads sirf unhi members me <strong>barabar (equal)</strong> distribute hongi. (Example: 15 leads aur 3 ticked members = 5, 5, 5 leads).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSelectAll}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-colors cursor-pointer"
            >
              Select All ({validMembers.length})
            </button>
            <button
              onClick={handleSelectNone}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-black/40 hover:bg-black/60 text-white/70 hover:text-white border border-white/5 transition-colors cursor-pointer"
            >
              Only Me
            </button>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {distributionSuccess && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-4 flex items-center gap-3 text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <div className="flex-1 font-medium">{distributionSuccess}</div>
          <button 
            onClick={() => setDistributionSuccess(null)}
            className="text-xs text-white/50 hover:text-white underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Grid: Left Column = Member Selector, Right Column = Upload & Distribute */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* MEMBERS SELECTION LIST (Ticked / Unticked) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/80 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Team Members ({selectedMembers.length} Active / {validMembers.length} Total)
            </h3>
            <span className="text-xs text-white/40">
              Click box to toggle tick
            </span>
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
            {validMembers.map((member) => {
              const isTicked = selectedMembers.includes(member);
              const stats = memberCurrentStats[member] || { total: 0, newCount: 0, closed: 0 };
              const projectedLeads = distributionPlan.breakdown.find(b => b.username === member);

              return (
                <div
                  key={member}
                  onClick={() => handleToggleMember(member)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                    isTicked
                      ? 'bg-gradient-to-r from-cyan-950/40 to-slate-900 border-cyan-500/50 shadow-md shadow-cyan-500/5'
                      : 'bg-white/5 border-white/5 opacity-50 hover:opacity-75'
                  }`}
                >
                  {/* Left: Checkbox & Member details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                      isTicked
                        ? 'bg-cyan-500 border-cyan-400 text-white shadow-sm'
                        : 'border-white/30 text-transparent bg-black/40'
                    }`}>
                      {isTicked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white truncate">@{member}</span>
                        {member === currentUser && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-semibold border border-purple-500/30">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/40 flex items-center gap-2 mt-0.5">
                        <span>{stats.total} total leads assigned</span>
                        <span>•</span>
                        <span className="text-cyan-400">{stats.newCount} new</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status pill or share calculation */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {parsedRows.length > 0 && isTicked && (
                      <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold rounded-lg border border-cyan-500/30">
                        +{projectedLeads?.count || 0} leads
                      </span>
                    )}
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      isTicked
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/5 text-white/40 border border-white/10'
                    }`}>
                      {isTicked ? 'Will Receive' : 'Skipped'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* UPLOAD & INSTANT DISTRIBUTION PANEL */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/80 flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-400" />
              Upload & Distribute Leads
            </h3>
            {parsedRows.length > 0 && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {parsedRows.length} Leads Ready
              </span>
            )}
          </div>

          {/* Hidden File Input */}
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
              className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 rounded-3xl p-6 sm:p-8 text-center bg-cyan-500/5 hover:bg-cyan-500/10 transition-all cursor-pointer group"
            >
              <FileSpreadsheet className="w-10 h-10 text-cyan-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <h4 className="font-bold text-base text-white">Click or Drop CSV File Here</h4>
              <p className="text-xs text-white/50 mt-1 max-w-sm mx-auto">
                Upload your leads list. Supports Phone, Email, Instagram, Facebook, LinkedIn, Website, etc.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Missing phone/email is 100% safe — NO errors!
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  CSV
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">{fileName}</h4>
                  <p className="text-xs text-white/50">
                    <strong className="text-emerald-400">{parsedRows.length} valid leads</strong> ready to share
                  </p>
                </div>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Change File
              </button>
            </div>
          )}

          {/* EQUAL DISTRIBUTION FORMULA PREVIEW */}
          {parsedRows.length > 0 && (
            <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Live Equal Distribution Math
                </span>

                <div className="text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                  {distributionPlan.totalLeads} Leads ÷ {distributionPlan.memberCount} Ticked Members = ~{distributionPlan.basePerMember} leads each
                </div>
              </div>

              {/* Per-member pill breakdown */}
              <div className="flex items-center gap-2 flex-wrap">
                {distributionPlan.breakdown.map((item) => (
                  <div 
                    key={item.username}
                    className="bg-black/50 border border-white/10 rounded-xl px-2.5 py-1 flex items-center gap-1.5 text-xs"
                  >
                    <span className="text-white/60">@{item.username}:</span>
                    <span className="font-bold text-cyan-400 font-mono">{item.count}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleExecuteDistribution}
                disabled={submitting || selectedMembers.length === 0}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 cursor-pointer mt-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Distributing {parsedRows.length} Leads...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Distribute {parsedRows.length} Leads to {selectedMembers.length} Members</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Quick Guidance Box */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-xs text-white/60 space-y-1.5">
            <div className="font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              How it works:
            </div>
            <p>1. Left side par team members ki list hai. Jin jin par tick laga hoga leads sirf unko milengi.</p>
            <p>2. CSV file upload karein — agar kisi ka number ya email nahi bhi hai to koi error nahi aayega.</p>
            <p>3. Distribute button dabane se system har member ko bilkul barabar (5, 5, 5) leads assign kar dega.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
