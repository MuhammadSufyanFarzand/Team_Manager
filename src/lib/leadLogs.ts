import { LeadActivityLog } from '../types';
import { supabase } from '../supabase';

const STORAGE_KEY = 'org_lead_activity_logs';

export const logLeadActivity = async (
  action: LeadActivityLog['action'],
  username: string,
  leadName: string,
  details: string,
  leadId?: string
) => {
  const logEntry: LeadActivityLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
    username,
    action,
    lead_name: leadName,
    details,
    lead_id: leadId
  };

  try {
    const existing = getStoredLeadLogs();
    const updated = [logEntry, ...existing].slice(0, 300); // keep last 300 logs
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Also attempt to push to Supabase lead_logs if available (fails gracefully if table not created yet)
    try {
      await supabase.from('lead_logs').insert([logEntry]);
    } catch {
      // safe ignore
    }
  } catch (err) {
    console.warn('Failed to save lead log:', err);
  }
};

export const getStoredLeadLogs = (): LeadActivityLog[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};
