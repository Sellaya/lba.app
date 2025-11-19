# Schedule Emails for All Existing Bookings

This guide explains how to schedule emails for all existing bookings in your database.

## Prerequisites

1. ✅ The `scheduled_emails` table has been created in Supabase
2. ✅ The table structure matches the expected schema

## How to Schedule Emails for All Bookings

### Option 1: Using cURL (Recommended)

Run this command from your terminal:

```bash
curl -X POST http://localhost:3000/api/admin/schedule-all-bookings-emails \
  -H "Content-Type: application/json"
```

For production (if you have ADMIN_SECRET_TOKEN set):

```bash
curl -X POST https://your-domain.com/api/admin/schedule-all-bookings-emails \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET_TOKEN"
```

### Option 2: Using Browser/Postman

1. Open your browser or Postman
2. Make a POST request to: `http://localhost:3000/api/admin/schedule-all-bookings-emails`
3. If you have `ADMIN_SECRET_TOKEN` set in your environment, include it in the Authorization header:
   - Header: `Authorization`
   - Value: `Bearer YOUR_ADMIN_SECRET_TOKEN`

### Option 3: Using a Script

Create a file `schedule-all.js`:

```javascript
const fetch = require('node-fetch');

async function scheduleAllBookings() {
  const url = process.env.API_URL || 'http://localhost:3000';
  const token = process.env.ADMIN_SECRET_TOKEN;
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(`${url}/api/admin/schedule-all-bookings-emails`, {
      method: 'POST',
      headers,
    });
    
    const data = await response.json();
    console.log('Result:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

scheduleAllBookings();
```

Run it with:
```bash
node schedule-all.js
```

## What This Does

1. **Fetches all bookings** from the database
2. **Checks each booking** to see if emails are already scheduled
3. **Schedules follow-up emails** for bookings with status 'quoted' and no advance payment:
   - 3 hours after booking creation
   - 6 hours after booking creation
   - 24 hours after booking creation
   - 3 days after booking creation
   - 6 days after booking creation
   - 30 days after booking creation
4. **Schedules event reminders** for confirmed bookings with payment:
   - 24 hours before event
   - 2.5 hours before appointment

## Important Notes

- **Only future emails are scheduled**: If a booking is old and all follow-up times have passed, only emails that are still in the future will be scheduled
- **No duplicates**: The system checks for existing scheduled emails and skips bookings that already have emails scheduled
- **Safe to run multiple times**: You can run this endpoint multiple times without creating duplicate entries

## Response Format

The API returns a JSON response like:

```json
{
  "success": true,
  "message": "Scheduled emails for 15 bookings",
  "processed": 15,
  "skipped": 5,
  "errors": []
}
```

- `processed`: Number of bookings that had emails scheduled
- `skipped`: Number of bookings that were skipped (already had emails or didn't meet criteria)
- `errors`: Array of any errors encountered

## Troubleshooting

### Error: "Unauthorized"
- Make sure you've set `ADMIN_SECRET_TOKEN` in your environment variables
- Or remove the token check from the API endpoint if you don't need authentication

### No bookings processed
- Check that you have bookings in your database
- Check the console logs for detailed information about why bookings were skipped

### Some bookings skipped
- This is normal! Bookings are skipped if:
  - They already have scheduled emails
  - They are confirmed (follow-up emails not needed)
  - They have advance payment (follow-up emails not needed)
  - All scheduled times are in the past

