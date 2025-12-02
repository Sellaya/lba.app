-- Create pricing_config table in Supabase
-- Run this SQL in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- 'service', 'addon', 'mobile_location', 'bridal_party', 'service_option'
  item_id TEXT NOT NULL, -- e.g., 'bridal', 'hairExtension', 'toronto', 'makeup-hair'
  item_name TEXT NOT NULL, -- Display name
  price_lead NUMERIC(10, 2) NOT NULL,
  price_team NUMERIC(10, 2) NOT NULL,
  metadata JSONB, -- Additional data like modifiers, labels, etc.
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(category, item_id)
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_pricing_config_category ON pricing_config(category);
CREATE INDEX IF NOT EXISTS idx_pricing_config_item ON pricing_config(category, item_id);

-- Add comment
COMMENT ON TABLE pricing_config IS 'Stores all pricing configurations for services, addons, and other chargeable items';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pricing_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_pricing_config_timestamp
BEFORE UPDATE ON pricing_config
FOR EACH ROW
EXECUTE FUNCTION update_pricing_config_updated_at();

