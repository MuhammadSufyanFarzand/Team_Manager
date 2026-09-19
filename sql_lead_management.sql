CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  business_name TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  email TEXT,
  social_links TEXT,
  rating TEXT,
  location TEXT,
  notes TEXT,
  assigned_to TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  added_by TEXT NOT NULL
);
