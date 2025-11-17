# Setup Scheduled Emails Table

## Important: Create the scheduled_emails table in Supabase

The email status feature requires the `scheduled_emails` table to be created in your Supabase database.

### Steps:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run the following SQL:

```sql
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id TEXT NOT NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('followup-3h', 'followup-6h', 'followup-24h', 'event-reminder-24h')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due ON scheduled_emails(scheduled_for, sent) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_booking ON scheduled_emails(booking_id);
```

4. After creating the table, the email status will work correctly in the admin dashboard.

## Database Cleanup

The database has been cleaned and seeded with 3 dummy bookings:

1. **dummy-1-quoted** - Status: Quoted (no payment yet)
2. **dummy-2-pending** - Status: Quoted with Interac payment pending
3. **dummy-3-confirmed** - Status: Confirmed with deposit paid

You can view these in the admin dashboard to test the email status feature.


