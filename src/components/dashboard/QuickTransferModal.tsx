import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  X, ArrowRightLeft, Users, CheckCircle2, 
  AlertCircle, Sparkles, Filter, ShieldCheck 
} from 'lucide-react';
import { Lead } from '../../types';
import { supabase } from '../../supabase';
import { logLeadActivity } from '../../lib/leadLogs';
import confetti from 'canvas-confetti';

interface QuickTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  allMembers: string[];
  currentUser: string;
  onTransferComplete: () => void;
}

export function QuickTransferModal({
  isOpen,
  onClose,
  leads,
  allMembers,
  currentUser,
  onTransferComplete
}: QuickTransferModalProps) {
  const [fromMember, setFromMember] = useState<string>('');
  const [toMember, setToMember] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'contacted' | 'interested'>('new');
  const [transferCount, setTransferCount] = useState<number>(0);
  const [transferAll, setTransferAll] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Eligible leads matching source member and status filter
  const eligibleLeads = useMemo(() => {
    if (!fromMember) return [];
    return leads.filter(l => {
      const matchFrom = l.assigned_to?.toLowerCase() === fromMember.toLowerCase();
      if (!matchFrom) return false;
      if (statusFilter === 'all') return true;
      return l.status === statusFilter;
    });
  }, [leads, fromMember, statusFilter]);

  // Set default count when eligible leads change
  React.useEffect(() => {
    if (transferAll) {
      setTransferCount(eligibleLeads.length);
    } else {
      setTransferCount(prev => Math.min(prev, eligibleLeads.length));
    }
  }, [eligibleLeads.length, transferAll]);

  if (!isOpen) return null;

  const handleExecuteTransfer = async () => {
    setErrorMsg('');
    if (!fromMember) {
      setErrorMsg('Please select a source member to transfer from.');
      return;
    }
    if (!toMember) {
      setErrorMsg('Please select a target member to transfer to.');
      return;
    }
    if (fromMember.toLowerCase() === toMember.toLowerCase()) {
      setErrorMsg('Source and target members cannot be the same person.');
      return;
    }
    if (eligibleLeads.length === 0) {
      setErrorMsg('No matching leads found for the selected filters.');
      return;
    }

    const countToTransfer = transferAll ? eligibleLeads.length : Math.min(transferCount, eligibleLeads.length);
    if (countToTransfer <= 0) {
      setErrorMsg('Please select at least 1 lead to transfer.');
      return;
    }

    const leadsToUpdate = eligibleLeads.slice(0, countToTransfer);
    const leadIds = leadsToUpdate.map(l => l.id).filter(Boolean) as string[];

    if (leadIds.length === 0) {
      setErrorMsg('No valid lead IDs to update.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          assigned_to: toMember,
          last_updated_at: new Date().toISOString()
        })
        .in('id', leadIds);

      if (error) throw error;

      // Log activity
      logLeadActivity(
        'reassigned',
        currentUser,
        `${countToTransfer} Leads (Bulk Transfer)`,
        `Bulk transferred ${countToTransfer} leads from @${fromMember} to @${toMember}`
      );

      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch {}

      onTransferComplete();
      onClose();
    } catch (err: any) {
      console.error('Transfer failed:', err);
      setErrorMsg(err?.message || 'Failed to reassign leads. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-slate-900 border border-purple-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-900/40 to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <ArrowRightLeft className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Fast Lead Rebalance & Transfer
              </h2>
              <p className="text-xs text-white/50">
                Ek member se doosre member ko leads foran shift karein
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-sm">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Member Selection Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                From (Kis member se lene hain):
              </label>
              <select
                value={fromMember}
                onChange={e => setFromMember(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="">-- Select Source Member --</option>
                {allMembers.map(m => {
                  const mCount = leads.filter(l => l.assigned_to?.toLowerCase() === m.toLowerCase()).length;
                  return (
                    <option key={m} value={m}>
                      @{m} ({mCount} leads)
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                To (Kis member ko dene hain):
              </label>
              <select
                value={toMember}
                onChange={e => setToMember(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="">-- Select Target Member --</option>
                {allMembers
                  .filter(m => m.toLowerCase() !== fromMember.toLowerCase())
                  .map(m => {
                    const mCount = leads.filter(l => l.assigned_to?.toLowerCase() === m.toLowerCase()).length;
                    return (
                      <option key={m} value={m}>
                        @{m} (currently {mCount})
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Filter by Lead Status (Kaunsi status wali shift karni hain):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'new', label: 'Only New Leads', desc: 'Uncontacted' },
                { id: 'contacted', label: 'Contacted', desc: 'In progress' },
                { id: 'interested', label: 'Interested', desc: 'Hot prospects' },
                { id: 'all', label: 'All Statuses', desc: 'Everything' }
              ].map(st => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => setStatusFilter(st.id as any)}
                  className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                    statusFilter === st.id
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : 'bg-slate-950/60 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  <div className="text-[11px] font-bold">{st.label}</div>
                  <div className="text-[9px] text-white/40">{st.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity selector */}
          {fromMember && (
            <div className="p-3.5 bg-slate-950/70 border border-white/10 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/80 font-medium">
                  Available matching leads:
                </span>
                <span className="text-xs font-black text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                  {eligibleLeads.length} leads
                </span>
              </div>

              {eligibleLeads.length > 0 && (
                <>
                  <div className="flex items-center gap-3 pt-1">
                    <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={transferAll}
                        onChange={e => setTransferAll(e.target.checked)}
                        className="rounded accent-purple-500 cursor-pointer"
                      />
                      <span>Transfer all {eligibleLeads.length} leads</span>
                    </label>
                  </div>

                  {!transferAll && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px] text-white/60">
                        <span>Select exact quantity:</span>
                        <span className="font-bold text-white">{transferCount} leads</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={eligibleLeads.length}
                        value={transferCount}
                        onChange={e => setTransferCount(Number(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Transfer Summary Preview */}
          {fromMember && toMember && eligibleLeads.length > 0 && (
            <div className="p-3 bg-gradient-to-r from-purple-900/20 via-slate-900 to-emerald-900/20 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-200">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong>Action Summary:</strong> {transferAll ? eligibleLeads.length : transferCount} leads will immediately move from <span className="underline font-bold">@{fromMember}</span> to <span className="underline font-bold">@{toMember}</span>.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteTransfer}
            disabled={loading || !fromMember || !toMember || eligibleLeads.length === 0}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>Processing Transfer...</>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                Transfer Leads Now
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
