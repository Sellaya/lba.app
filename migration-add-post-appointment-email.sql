-- Migration: Add post-appointment-followup email type to scheduled_emails table
-- Run this SQL in your Supabase SQL editor to update existing database schema

-- Step 1: Drop the existing constraint (if it exists)
ALTER TABLE scheduled_emails 
DROP CONSTRAINT IF EXISTS scheduled_emails_email_type_check;

-- Step 2: Add the updated constraint with post-appointment-followup
ALTER TABLE scheduled_emails 
ADD CONSTRAINT scheduled_emails_email_type_check 
CHECK (email_type IN (
  'followup-3h', 
  'followup-6h', 
  'followup-24h', 
  'followup-3d', 
  'followup-6d', 
  'followup-30d', 
  'event-reminder-24h', 
  'appointment-day-reminder', 
  'post-appointment-followup'
));

-- Verify the constraint was added
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'scheduled_emails'::regclass
  AND conname = 'scheduled_emails_email_type_check';

