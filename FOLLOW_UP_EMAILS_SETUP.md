# Follow-Up Email System Setup

This document explains how to set up the automated follow-up email system that sends 3 emails after quote generation.

## Email Flow

1. **Email #1** - Sent immediately after quote generation (already implemented)
2. **Email #2** - Sent 3 hours after quote generation (gentle reminder)
3. **Email #3** - Sent 6 hours after quote generation (urgency with contact info)
4. **Email #4** - Sent 24 hours after quote generation (travel fee waiver - mobile bookings only)

## Setup Steps

### 1. Create the Database Tables

Run the SQL script in your Supabase SQL editor:

```sql
-- File: supabase-scheduled-emails-table.sql
```

Or manually create the table:

```sql
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id TEXT NOT NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('followup-3h', 'followup-6h', 'followup-24h')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due ON scheduled_emails(scheduled_for, sent) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_booking ON scheduled_emails(booking_id);
```

Additionally, create the log table so admins can audit every send attempt:

```sql
-- File: supabase-email-send-logs-table.sql
```

This log table stores a record for each attempt, including skips/failures, so you can confirm that the processor actually executed.

### 2. Set Up Environment Variables

Add to your `.env.local`:

```env
# Optional: WhatsApp number for contact links (format: country code + number, e.g., 14161234567)
NEXT_PUBLIC_WHATSAPP_NUMBER=14161234567

# Optional: Secret token for cron job authentication
CRON_SECRET=your-secret-token-here
```

### 3. Set Up Cron Job

The system requires a cron job to process scheduled emails. Choose one of these options:

#### Option A: Vercel Cron (Recommended for Vercel deployments)

Create or update `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/scheduled-emails/process",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

This runs every 10 minutes. Adjust the schedule as needed.

#### Option B: External Cron Service

Use a service like:
- **cron-job.org** (free)
- **EasyCron** (free tier available)
- **GitHub Actions** (for GitHub-hosted projects)

Set up a cron job to call:
```
GET https://your-domain.com/api/scheduled-emails/process
```

If you set `CRON_SECRET`, include it in the Authorization header:
```
Authorization: Bearer your-secret-token-here
```

#### Option C: Manual Testing

You can manually trigger the processor by visiting:
```
https://your-domain.com/api/scheduled-emails/process
```

### 4. How It Works

1. When a quote is generated, `saveQuoteAndEmailAction` is called
2. The initial quote email is sent immediately
3. Follow-up emails are scheduled in the `scheduled_emails` table:
   - 3H email scheduled for 3 hours later
   - 6H email scheduled for 6 hours later
   - 24H email scheduled for 24 hours later (only for mobile bookings)

4. The cron job calls `/api/scheduled-emails/process` every 10 minutes
5. The processor:
   - Finds all unsent emails where `scheduled_for <= now()`
   - Fetches the booking data
   - Sends the appropriate email
   - Marks the email as sent

### 5. Email Templates

- **3H Email** (`follow-up-3h-email.tsx`): Gentle reminder with quote link and payment info
- **6H Email** (`follow-up-6h-email.tsx`): Urgency message with WhatsApp and email contact links
- **24H Email** (`follow-up-24h-email.tsx`): Travel fee waiver offer (mobile bookings only)

### 6. Testing

To test the system:

1. Generate a quote
2. Check the `scheduled_emails` table in Supabase - you should see 2-3 entries
3. Manually call the processor endpoint or wait for the cron job
4. Check that emails are sent and marked as `sent = true`

### 7. Monitoring

Check the `scheduled_emails` table to monitor:
- How many emails are scheduled
- Which emails have been sent
- Any emails that failed to send (check application logs)

### 8. Troubleshooting

**Emails not sending:**
- Check that the cron job is running
- Verify the `scheduled_emails` table exists
- Check application logs for errors
- Ensure Resend API key is configured

**Wrong timing:**
- Verify server timezone settings
- Check that `scheduled_for` timestamps are correct

**24H email not scheduled:**
- This email only schedules for mobile bookings
- Check that the booking has at least one day with `serviceType === 'mobile'`

## Notes

- Emails are not sent if the booking is already confirmed
- The system gracefully handles missing tables (logs warning, doesn't break quote generation)
- All email sending is idempotent - safe to retry









