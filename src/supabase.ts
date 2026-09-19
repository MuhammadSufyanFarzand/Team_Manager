import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kkblzoyrmjunaielazkh.supabase.co';
const supabaseKey = 'sb_publishable_wtksVBVpnU0VG5LEvYzM3Q_pSuw6JKL';

export const supabase = createClient(supabaseUrl, supabaseKey);
