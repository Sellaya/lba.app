import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { SERVICES, ADDON_PRICES, MOBILE_LOCATION_OPTIONS, BRIDAL_PARTY_PRICES, BRIDAL_TRIAL_PRICES } from '@/lib/services';

/**
 * Initialize pricing_config table with default values from code
 * This should be run once to seed the database
 */
export async function POST(request: Request) {
  try {
    // Optional: Add authentication check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ADMIN_SECRET_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First, check if the table exists
    const { error: checkError } = await supabaseAdmin
      .from('pricing_config')
      .select('id')
      .limit(1);

    if (checkError) {
      const isTableNotFound = 
        checkError.code === '42P01' || 
        checkError.code === 'PGRST116' ||
        checkError.message?.includes('does not exist') || 
        checkError.message?.includes('schema cache') ||
        checkError.message?.includes('Could not find the table') ||
        (checkError.message?.includes('relation') && checkError.message?.includes('does not exist'));
      
      if (isTableNotFound) {
        return NextResponse.json({
          success: false,
          error: 'Table does not exist',
          message: 'The pricing_config table does not exist. Please create it first.',
          errorCode: checkError.code,
          errorDetails: checkError.message,
          sqlScript: `
-- Run this SQL in your Supabase SQL Editor:

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

COMMENT ON TABLE pricing_config IS 'Stores all pricing configurations for services, addons, and other chargeable items';

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
          `.trim(),
        }, { status: 400 });
      }
      // Other error
      return NextResponse.json({
        success: false,
        error: checkError.message,
        errorCode: checkError.code,
      }, { status: 500 });
    }

    const pricingData: Array<{
      category: string;
      item_id: string;
      item_name: string;
      price_lead: number;
      price_team: number;
      metadata?: any;
    }> = [];

    // Services
    SERVICES.forEach((service) => {
      pricingData.push({
        category: 'service',
        item_id: service.id,
        item_name: service.name,
        price_lead: service.basePrice.lead,
        price_team: service.basePrice.team,
        metadata: {
          description: service.description,
          duration: service.duration,
          askServiceType: service.askServiceType,
        },
      });
    });

    // Addons
    Object.entries(ADDON_PRICES).forEach(([key, prices]) => {
      pricingData.push({
        category: 'addon',
        item_id: key,
        item_name: key
          .split(/(?=[A-Z])/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        price_lead: prices.lead,
        price_team: prices.team,
      });
    });

    // Mobile Locations
    Object.entries(MOBILE_LOCATION_OPTIONS).forEach(([key, location]) => {
      pricingData.push({
        category: 'mobile_location',
        item_id: key,
        item_name: location.label,
        price_lead: location.surcharge.lead,
        price_team: location.surcharge.team,
      });
    });

    // Bridal Party Prices
    Object.entries(BRIDAL_PARTY_PRICES).forEach(([key, prices]) => {
      pricingData.push({
        category: 'bridal_party',
        item_id: key,
        item_name: key
          .split(/(?=[A-Z])/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        price_lead: prices.lead,
        price_team: prices.team,
      });
    });

    // Bridal Trial Prices
    Object.entries(BRIDAL_TRIAL_PRICES).forEach(([key, prices]) => {
      pricingData.push({
        category: 'bridal_trial',
        item_id: key,
        item_name: key === 'makeup-hair' ? 'Makeup & Hair' : 
                   key === 'makeup-only' ? 'Makeup Only' : 'Hair Only',
        price_lead: prices.lead,
        price_team: prices.team,
      });
    });

    // Upsert all pricing data
    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .upsert(pricingData, {
        onConflict: 'category,item_id',
      })
      .select();

    if (error) {
      console.error('Error initializing pricing config:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Initialized ${pricingData.length} pricing configurations`,
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error('Error in POST /api/pricing/initialize:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

