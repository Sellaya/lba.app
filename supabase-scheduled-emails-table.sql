-- Create scheduled_emails table in Supabase
-- Run this SQL in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id TEXT NOT NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('followup-3h', 'followup-6h', 'followup-24h', 'followup-3d', 'followup-6d', 'followup-30d', 'event-reminder-24h', 'appointment-day-reminder', 'post-appointment-followup')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due ON scheduled_emails(scheduled_for, sent) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_booking ON scheduled_emails(booking_id);

-- Add comment
COMMENT ON TABLE scheduled_emails IS 'Tracks scheduled follow-up emails to be sent after quote generation';







