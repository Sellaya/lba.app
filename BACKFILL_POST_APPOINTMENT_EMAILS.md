# Backfill Post-Appointment Followup Emails for Existing Bookings

This guide explains how to apply the post-appointment followup email feature to existing bookings in your database.

## Prerequisites

1. ✅ Run the database migration to update the `scheduled_emails` table constraint (see `migration-add-post-appointment-email.sql`)
2. ✅ The application code has been updated with the new post-appointment email functionality

## Step 1: Update Database Schema

Run the SQL migration in your Supabase SQL editor:

```bash
# The migration file is located at:
migration-add-post-appointment-email.sql
```

Or copy and paste this SQL into your Supabase SQL editor:

```sql
-- Drop the existing constraint (if it exists)
ALTER TABLE scheduled_emails 
DROP CONSTRAINT IF EXISTS scheduled_emails_email_type_check;

-- Add the updated constraint with post-appointment-followup
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
```

## Step 2: Backfill Post-Appointment Emails

### Option 1: Using cURL (Recommended)

Run this command from your terminal:

```bash
curl -X POST http://localhost:3000/api/admin/backfill-post-appointment-emails \
  -H "Content-Type: application/json"
```

For production (if you have ADMIN_SECRET_TOKEN set):

```bash
curl -X POST https://your-domain.com/api/admin/backfill-post-appointment-emails \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET_TOKEN"
```

### Option 2: Using Browser/Postman

1. Open your browser or Postman
2. Make a POST request to: `http://localhost:3000/api/admin/backfill-post-appointment-emails`
3. If you have `ADMIN_SECRET_TOKEN` set in your environment, include it in the Authorization header:
   - Header: `Authorization`
   - Value: `Bearer YOUR_ADMIN_SECRET_TOKEN`

### Option 3: Re-run Full Schedule (Alternative)

If you want to schedule all emails (including post-appointment) for bookings that don't have any emails scheduled yet:

```bash
curl -X POST http://localhost:3000/api/admin/schedule-all-bookings-emails \
  -H "Content-Type: application/json"
```

**Note:** This will only schedule emails for bookings that don't already have any scheduled emails.

## What This Does

The backfill endpoint:

1. **Fetches all bookings** from the database
2. **Filters for confirmed bookings** with advance payment made
3. **Checks if post-appointment followup email** already exists for each booking
4. **Schedules post-appointment followup email** (6 hours after appointment time) for bookings that don't have it yet
5. **Skips bookings** that:
   - Are not confirmed
   - Don't have advance payment
   - Already have post-appointment followup email scheduled
   - Have invalid or missing data

## Expected Results

The API will return a JSON response like:

```json
{
  "success": true,
  "message": "Backfilled post-appointment emails for 5 bookings",
  "processed": 5,
  "skipped": 12,
  "errors": []
}
```

Where:
- `processed`: Number of bookings that had post-appointment email scheduled
- `skipped`: Number of bookings that were skipped (already have email, not eligible, etc.)
- `errors`: Array of error messages if any bookings failed

## Verification

After running the backfill, you can verify by:

1. Check the `scheduled_emails` table in Supabase for entries with `email_type = 'post-appointment-followup'`
2. View any booking in the admin dashboard and check the email status section
3. The post-appointment followup email should appear as "Email 7" in the email list

## Troubleshooting

### Error: "constraint violation"
- Make sure you ran the SQL migration first (Step 1)
- The constraint must allow `'post-appointment-followup'` as a valid email type

### No bookings processed
- Check that you have confirmed bookings with advance payment
- Verify the booking data structure is correct
- Check the server logs for detailed error messages

### Some bookings skipped
- This is normal - bookings are skipped if they:
  - Already have post-appointment email scheduled
  - Are not confirmed
  - Don't have advance payment
  - Have invalid appointment dates

