# External Cron Setup for Hourly Email Processing

**IMPORTANT:** Vercel Hobby (Free) plan only allows cron jobs to run **once per day**, not hourly. To process emails every hour, use an external cron service (free options available).

---

## Why External Cron?

Vercel Free Plan Limitations:
- ✅ Maximum 2 cron jobs per account
- ✅ Only **once per day** schedule allowed (not hourly)
- ✅ Cannot guarantee timely execution

**Solution:** Use a free external cron service for hourly execution.

---

## Recommended: cron-job.org (FREE)

### Setup Steps:

1. **Create Account** (Free)
   - Go to https://cron-job.org
   - Sign up for a free account

2. **Create Cron Job**
   - Click "Create cronjob"
   - Configure:
     - **Title:** `LBA Email Processor - Hourly`
     - **URL:** `https://app.looksbyanum.com/api/scheduled-emails/process`
     - **Schedule:** `0 * * * *` (Every hour at minute 0)
     - **Request Method:** `GET`
     - **Add Header (if CRON_SECRET is set):**
       - Name: `Authorization`
       - Value: `Bearer your-cron-secret-token`
     - **Activate:** Yes

3. **Test**
   - Click "Run now" to test
   - Check Vercel function logs to verify execution
   - Check your database to see emails being processed

---

## Alternative: EasyCron (FREE Tier)

1. Go to https://www.easycron.com
2. Create free account
3. Add cron job:
   - **URL:** `https://app.looksbyanum.com/api/scheduled-emails/process`
   - **Schedule:** Every hour
   - **Method:** GET
   - Add Authorization header if using CRON_SECRET

---

## Alternative: GitHub Actions (If Using GitHub)

If your project is on GitHub, you can use GitHub Actions (free for public repos):

Create `.github/workflows/process-emails.yml`:

```yaml
name: Process Scheduled Emails

on:
  schedule:
    # Runs every hour at minute 0
    - cron: '0 * * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  process-emails:
    runs-on: ubuntu-latest
    steps:
      - name: Call Email Processor API
        run: |
          curl -X GET https://app.looksbyanum.com/api/scheduled-emails/process \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

**Note:** Set `CRON_SECRET` in GitHub Secrets if using authentication.

---

## Current Setup

### Vercel Cron (Once Per Day - Free Plan Limit)

The `vercel.json` is currently set to run **once per day at midnight**:
```json
{
  "crons": [
    {
      "path": "/api/scheduled-emails/process",
      "schedule": "0 0 * * *"
    }
  ]
}
```

This is a **backup** that will run daily. For hourly processing, use external cron service.

---

## Recommended Configuration

**Best Setup:**
1. **External Cron (Hourly):** Use cron-job.org to call your API every hour
2. **Vercel Cron (Daily Backup):** Keep the daily cron in vercel.json as a backup

This ensures:
- ✅ Emails processed every hour (via external cron)
- ✅ Backup daily check (via Vercel cron)
- ✅ All emails sent at their scheduled time (with max 1 hour delay)
- ✅ No CORS issues (both call same endpoint)
- ✅ Free solution

---

## Testing

1. **Test External Cron:**
   - Use "Run now" in cron-job.org
   - Check Vercel function logs
   - Verify emails in database are marked as sent

2. **Verify Hourly Execution:**
   - Wait for next hour
   - Check cron-job.org execution logs
   - Verify Vercel function was called

3. **Monitor:**
   - Check `scheduled_emails` table in Supabase
   - Check `scheduled_email_logs` for processing history
   - Monitor Vercel function logs

---

## API Endpoint Details

**Endpoint:** `GET https://app.looksbyanum.com/api/scheduled-emails/process`

**Authentication (Optional):**
- If `CRON_SECRET` environment variable is set, include header:
  - `Authorization: Bearer your-secret-token`

**Response:**
```json
{
  "message": "Processed X emails, Y failed, Z skipped",
  "totalDue": 10,
  "processed": 8,
  "failed": 1,
  "skipped": 1,
  "executionTimeMs": 2345,
  "remainingDue": 0
}
```

---

## Migration Steps

1. Set up external cron service (cron-job.org recommended)
2. Test the external cron (use "Run now")
3. Keep Vercel cron as daily backup (current setup)
4. Monitor for 24-48 hours to ensure hourly execution works
5. Once confirmed, you can remove Vercel cron if desired (optional)

---

## Troubleshooting

**External cron not executing?**
- Verify URL is correct: `https://app.looksbyanum.com/api/scheduled-emails/process`
- Check cron service logs
- Verify no authentication required (or CRON_SECRET is set correctly)
- Test manually by visiting the URL in browser

**Emails not being sent?**
- Check Vercel function logs
- Verify Resend API key is configured
- Check `scheduled_email_logs` table for errors
- Verify emails are actually due (scheduled_for <= now())

---

**Status:** ✅ API endpoint ready for external cron calls  
**Action Required:** Set up external cron service (cron-job.org recommended)

