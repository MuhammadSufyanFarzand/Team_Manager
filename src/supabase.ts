import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://kkblzoyrmjunaielazkh.supabase.co';
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_wtksVBVpnU0VG5LEvYzM3Q_pSuw6JKL';

export const supabase = createClient(supabaseUrl, supabaseKey);
