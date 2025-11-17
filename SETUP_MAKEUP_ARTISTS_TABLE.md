# Setup Makeup Artists Table

## Quick Setup Instructions

The `makeup_artists` table needs to be created in your Supabase database before you can use the artists management feature.

### Steps:

1. **Go to your Supabase Dashboard**
   - Navigate to your project
   - Click on "SQL Editor" in the left sidebar

2. **Run the following SQL script:**

```sql
CREATE TABLE IF NOT EXISTS makeup_artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_makeup_artists_email ON makeup_artists(email);

ALTER TABLE makeup_artists DISABLE ROW LEVEL SECURITY;
```

3. **Click "Run" or press Ctrl+Enter** to execute the SQL

4. **Verify the table was created:**
   - Go to "Table Editor" in Supabase
   - You should see `makeup_artists` in the list of tables

5. **Create dummy data:**
   - Go to `/admin/artists` in your app
   - Click "Create Dummy Artists" button
   - This will add 10 dummy artists to the table

## Alternative: Use the Setup API

You can also use the setup endpoint which will guide you through the process:

1. Go to `/admin/artists`
2. Click "Create Dummy Artists"
3. If the table doesn't exist, you'll get a prompt to copy the SQL script
4. Follow the instructions to create the table
5. Click the button again to create the dummy data

## Table Structure

- **id**: UUID (Primary Key, auto-generated)
- **name**: TEXT (Artist's full name)
- **email**: TEXT (Unique email address)
- **whatsapp**: TEXT (WhatsApp phone number)
- **created_at**: TIMESTAMP (Auto-set on creation)
- **updated_at**: TIMESTAMP (Auto-set on update)

## Troubleshooting

If you still see errors after creating the table:

1. **Refresh your Supabase connection** - Sometimes the schema cache needs to refresh
2. **Check table name** - Make sure it's exactly `makeup_artists` (lowercase, with underscore)
3. **Verify RLS is disabled** - The table should have RLS disabled for service role access
4. **Check your Supabase credentials** - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set correctly in your `.env` file

