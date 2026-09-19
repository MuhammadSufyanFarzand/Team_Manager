-- ============================================================================
-- SQL QUERY FOR TEAM ANALYTICS & ACTIVITY TRACKING
-- ============================================================================
-- Run this script in your Supabase SQL Editor to add the tracking table.

CREATE TABLE IF NOT EXISTS public.user_daily_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    username TEXT NOT NULL,
    active_seconds INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    UNIQUE(date, username)
);

-- Enable RLS and create policy
ALTER TABLE public.user_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all public access" ON public.user_daily_stats FOR ALL USING (true);

-- Enable Realtime for stats (Optional, if you want live dashboard updates without refresh)
BEGIN;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_daily_stats;
COMMIT;
