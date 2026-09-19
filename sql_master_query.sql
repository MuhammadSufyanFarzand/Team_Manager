-- ============================================================================
-- SQL MASTER QUERY FILE
-- Supabase / PostgreSQL Schema Definition
-- ============================================================================
-- Run this script in your Supabase SQL Editor to set up the complete 
-- database schema for the chat application.

-- 1. Create User Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT gen_random_uuid() UNIQUE,
    username TEXT PRIMARY KEY,
    email TEXT,
    phone TEXT,
    bio TEXT,
    password TEXT,
    avatar_url TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    blocked_usernames JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure avatar and last_seen columns exist if table was created previously
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS blocked_usernames JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    username TEXT NOT NULL,
    recipient_username TEXT,
    status TEXT,
    is_edited BOOLEAN DEFAULT false,
    read_by JSONB DEFAULT '[]'::jsonb,
    avatar TEXT,
    file_name TEXT,
    file_size NUMERIC,
    reply_to JSONB,
    reactions JSONB DEFAULT '{}'::jsonb
);

-- Ensure avatar and extra columns exist in messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS recipient_username TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_size NUMERIC;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to JSONB;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;

-- 3. Create Group Settings Table
CREATE TABLE IF NOT EXISTS public.group_settings (
    id BIGINT PRIMARY KEY DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    owner_username TEXT NOT NULL,
    admin_usernames JSONB DEFAULT '[]'::jsonb,
    banned_usernames JSONB DEFAULT '[]'::jsonb,
    ban_appeals JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create User Daily Stats (Activity & Focus Analytics)
CREATE TABLE IF NOT EXISTS public.user_daily_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    username TEXT NOT NULL,
    active_seconds INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    UNIQUE(date, username)
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & POLICIES (Optional but recommended)
-- ============================================================================
-- If you want to enable Row Level Security, run the following commands:
-- 
-- ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.group_settings ENABLE ROW LEVEL SECURITY;
-- 
-- Example permissive policies for local / simple testing:
-- CREATE POLICY "Allow all public access" ON public.user_profiles FOR ALL USING (true);
-- CREATE POLICY "Allow all public access" ON public.messages FOR ALL USING (true);
-- CREATE POLICY "Allow all public access" ON public.group_settings FOR ALL USING (true);

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================
-- The application uses Supabase Realtime to listen for new messages.
-- You must enable Realtime for the 'messages' and 'group_settings' tables.
-- This can be done via the Supabase Dashboard:
-- Database -> Replication -> Click '0 tables' -> Enable for 'messages' and 'group_settings'
-- Alternatively, via SQL:

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_username ON public.messages(username);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_username ON public.messages(recipient_username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
