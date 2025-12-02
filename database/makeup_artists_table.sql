-- Create makeup_artists table in Supabase
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS makeup_artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_makeup_artists_email ON makeup_artists(email);

-- Disable Row Level Security (RLS) for service role access
-- The admin API uses service role key which bypasses RLS anyway
ALTER TABLE makeup_artists DISABLE ROW LEVEL SECURITY;

-- If you want to enable RLS later, you can create a policy like this:
-- ALTER TABLE makeup_artists ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Service role can access all artists" ON makeup_artists
--   FOR ALL USING (true);

