-- =========================================================
-- COMPLETE SUPABASE SQL SCHEMA & SAFE REALTIME SETUP SCRIPT
-- Run this query in Supabase SQL Editor to set up everything
-- =========================================================

-- 1. Create Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  type text NOT NULL DEFAULT 'text',
  content text NOT NULL,
  username text NOT NULL,
  recipient_username text DEFAULT NULL,
  status text DEFAULT 'sent',
  is_edited boolean DEFAULT false,
  read_by text[] DEFAULT '{}',
  avatar text DEFAULT '',
  file_name text DEFAULT NULL,
  file_size bigint DEFAULT NULL,
  reply_to jsonb DEFAULT NULL
);

-- Ensure all columns exist in case table was created previously
ALTER TABLE messages ADD COLUMN IF NOT EXISTS type text DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_username text DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_by text[] DEFAULT '{}';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS avatar text DEFAULT '';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name text DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size bigint DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to jsonb DEFAULT NULL;

-- 2. Create User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  bio text DEFAULT '',
  password text DEFAULT '',
  avatar_url text DEFAULT '',
  last_seen timestamp with time zone DEFAULT now(),
  blocked_usernames text[] DEFAULT '{}'
);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email text DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS password text DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS blocked_usernames text[] DEFAULT '{}';

-- 3. Create Group Settings Table
CREATE TABLE IF NOT EXISTS group_settings (
  id integer PRIMARY KEY DEFAULT 1,
  name text DEFAULT 'Global Chat',
  description text DEFAULT 'Welcome to the global chat room!',
  avatar_url text DEFAULT NULL,
  owner_username text DEFAULT 'mr saqib',
  admin_usernames text[] DEFAULT '{}',
  banned_usernames text[] DEFAULT '{}',
  ban_appeals jsonb DEFAULT '[]'
);

ALTER TABLE group_settings ADD COLUMN IF NOT EXISTS name text DEFAULT 'Global Chat';
ALTER TABLE group_settings ADD COLUMN IF NOT EXISTS description text DEFAULT 'Welcome to the global chat room!';
ALTER TABLE group_settings ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT NULL;
ALTER TABLE group_settings ADD COLUMN IF NOT EXISTS owner_username text DEFAULT 'mr saqib';
ALTER TABLE group_settings ADD COLUMN IF NOT EXISTS admin_usernames text[] DEFAULT '{}';
ALTER TABLE group_settings ADD COLUMN IF NOT EXISTS banned_usernames text[] DEFAULT '{}';
ALTER TABLE group_settings ADD COLUMN IF NOT EXISTS ban_appeals jsonb DEFAULT '[]';

-- Insert default group settings row if missing
INSERT INTO group_settings (id, name, description, owner_username) 
VALUES (1, 'Global Chat', 'Welcome to the global chat room!', 'mr saqib') 
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Row Level Security (RLS) & Add Permissive Policies
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_settings DISABLE ROW LEVEL SECURITY;

-- 5. SAFELY Add Tables to Supabase Realtime Publication (Prevents Error 42710)
DO $$
BEGIN
  -- Add messages to realtime if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  -- Add group_settings to realtime if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_settings;
  END IF;

  -- Add user_profiles to realtime if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
  END IF;
END $$;
