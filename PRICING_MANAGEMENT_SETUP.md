# Pricing Management System Setup

This document explains how to set up and use the new pricing management system that allows admins to change pricing from the dashboard.

## Overview

The pricing management system allows you to:
- View all pricing configurations for Lead Artist and Team
- Update prices directly from the admin dashboard
- Have pricing changes immediately reflected in quote calculations
- Maintain separate pricing for Lead Artist and Team tiers

## Setup Steps

### 1. Create the Database Tables

Run the SQL scripts in your Supabase SQL editor:

1. **pricing_config table** - `database/pricing_config.sql`
2. **pricing_history table** - `database/pricing_history.sql` (for tracking price changes)

Or manually create the tables:

```sql
CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  price_lead NUMERIC(10, 2) NOT NULL,
  price_team NUMERIC(10, 2) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(category, item_id)
);

CREATE INDEX IF NOT EXISTS idx_pricing_config_category ON pricing_config(category);
CREATE INDEX IF NOT EXISTS idx_pricing_config_item ON pricing_config(category, item_id);

CREATE OR REPLACE FUNCTION update_pricing_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pricing_config_timestamp
BEFORE UPDATE ON pricing_config
FOR EACH ROW
EXECUTE FUNCTION update_pricing_config_updated_at();
```

**Create the pricing_history table:**

```sql
CREATE TABLE IF NOT EXISTS pricing_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  item_id TEXT NOT NULL,
  price_lead NUMERIC(10, 2) NOT NULL,
  price_team NUMERIC(10, 2) NOT NULL,
  changed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pricing_history_item ON pricing_history(category, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_history_created ON pricing_history(created_at DESC);
```

### 2. Initialize the Database

After creating the table, you need to populate it with the default pricing from the codebase:

1. Go to `/admin/pricing` in your admin dashboard
2. Click the "Initialize Database" button
3. This will populate the database with all current pricing from the codebase

Alternatively, you can call the API directly:

```bash
POST /api/pricing/initialize
```

## Pricing Categories

The system manages pricing for the following categories:

### 1. Services
- Bridal Makeup
- Semi-Bridal / Engagement
- Party Glam
- Photoshoot Makeup

### 2. Add-ons
- Hair Extension
- Jewellery Setting
- Saree Draping
- Hijab Setting
- Bridal Trial

### 3. Travel Surcharges (Mobile Locations)
- Toronto / GTA
- Immediate Neighbors (15-30 Minutes)
- Moderate Distance (30 Minutes to 1 Hour Drive)
- Further Out But Still Reachable (1 Hour Plus)

### 4. Bridal Party Services
- Hair & Makeup
- Makeup Only
- Hair Only
- Dupatta Setting
- Hair Extension Installation
- Party Saree Draping
- Party Hijab Setting
- Air Brush

### 5. Service Option Modifiers
- Makeup & Hair (multiplier: 1.0)
- Makeup Only (multiplier: 0.61 for lead, 0.611 for team)
- Hair Only (multiplier: 0.44 for lead, 0.444 for team)

## How to Use

### Accessing the Pricing Management Page

1. Log into the admin dashboard
2. Click on "Pricing" in the sidebar navigation
3. You'll see two tabs: "Lead Artist" and "Team"

### Updating Prices

**Instant Save (Recommended):**
1. Navigate to the appropriate tier tab (Lead Artist or Team)
2. Find the item you want to update
3. Enter the new price in the input field
4. A save button (💾) will appear next to the item
5. Click the save button to instantly save that item
6. The change is saved immediately and history is updated

**Batch Save:**
1. Make changes to multiple items
2. Click "Save Changes" at the top right
3. All changes will be saved at once

### Viewing Price History

1. Click the history icon (📜) next to any pricing item
2. View the last 3 price changes for that item
3. Each history entry shows:
   - Date and time of the change
   - Lead Artist price at that time
   - Team price at that time
4. This helps you track pricing changes and remember what was changed

### Features

- **Real-time Updates**: Price changes are cached and immediately available for quote calculations
- **Separate Tiers**: Manage Lead Artist and Team pricing independently
- **Change Tracking**: The system shows when you have unsaved changes
- **Reset Function**: You can reset unsaved changes if needed
- **Fallback System**: If the database is unavailable, the system falls back to hardcoded defaults

## Technical Details

### Caching

The pricing system uses a 5-minute cache to reduce database queries. The cache is automatically invalidated when prices are updated.

### Fallback Behavior

If the database is unavailable or empty, the system will:
1. Use the hardcoded default prices from `src/lib/services.ts`
2. Log a warning message
3. Continue functioning normally

### API Endpoints

- `GET /api/pricing` - Fetch all pricing configurations
- `POST /api/pricing` - Update pricing configurations
- `POST /api/pricing/initialize` - Initialize database with default values

## Important Notes

1. **Existing Quotes**: Price changes only affect new quotes. Existing quotes maintain their original pricing.

2. **Service Option Modifiers**: These are multipliers, not direct prices. For example, a modifier of 0.61 means the price is 61% of the base service price.

3. **Database Initialization**: You only need to initialize the database once. After that, all pricing is managed through the admin interface.

4. **Cache Invalidation**: The cache is automatically invalidated when you save changes, so new quotes will use the updated prices immediately.

## Troubleshooting

### Prices not updating in quotes

1. Make sure you clicked "Save Changes" after updating prices
2. Check the browser console for any errors
3. Verify the database table exists and has data
4. Try refreshing the pricing page

### Database initialization fails

1. Verify the `pricing_config` table exists
2. Check Supabase connection settings
3. Ensure you have proper permissions
4. Check the browser console for error messages

### Prices showing as 0 or incorrect

1. Verify the database has been initialized
2. Check that prices are saved correctly in the database
3. Clear your browser cache and refresh
4. Check the server logs for any errors

