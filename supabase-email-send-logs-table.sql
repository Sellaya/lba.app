-- Tracks each attempt to process/send scheduled emails
CREATE TABLE IF NOT EXISTS scheduled_email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_email_id UUID,
  booking_id TEXT NOT NULL,
  email_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'sent', 'skipped', 'failed')),
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_logs_booking ON scheduled_email_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email ON scheduled_email_logs(scheduled_email_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON scheduled_email_logs(created_at DESC);

