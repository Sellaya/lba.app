-- Create pricing_history table to track price changes
-- Run this SQL in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS pricing_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  item_id TEXT NOT NULL,
  price_lead NUMERIC(10, 2) NOT NULL,
  price_team NUMERIC(10, 2) NOT NULL,
  changed_by TEXT, -- Admin identifier (optional)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_pricing_history_item ON pricing_history(category, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_history_created ON pricing_history(created_at DESC);

-- Add comment
COMMENT ON TABLE pricing_history IS 'Tracks historical price changes for all pricing items';

