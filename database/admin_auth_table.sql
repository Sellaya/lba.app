-- Create admin_auth table for storing admin credentials
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS admin_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial admin credentials
-- Password hash for "Canada90." is: $2b$10$afIBXgLbyCqr40PcU9Bgy.nX5UMQNzpiOzQN1EOSCAhvTx8Lr9STO
INSERT INTO admin_auth (email, password_hash)
VALUES ('info@looksbyanum.com', '$2b$10$afIBXgLbyCqr40PcU9Bgy.nX5UMQNzpiOzQN1EOSCAhvTx8Lr9STO')
ON CONFLICT (email) DO NOTHING;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_auth_email ON admin_auth(email);

-- Create password_reset_tokens table for password reset functionality
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);

-- Disable RLS for service role access (admin operations)
ALTER TABLE admin_auth DISABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens DISABLE ROW LEVEL SECURITY;

