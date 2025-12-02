import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { invalidatePricingCache } from '@/lib/pricing';

// Get Supabase client directly to avoid Proxy issues
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

// Helper function to save price history
async function savePriceHistory(
  category: string,
  itemId: string,
  priceLead: number,
  priceTeam: number
) {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('pricing_history').insert({
      category,
      item_id: itemId,
      price_lead: priceLead,
      price_team: priceTeam,
    });
  } catch (error) {
    console.error('Error saving price history:', error);
    // Don't fail the main operation if history save fails
  }
}

// Helper to check if error is table not found
function isTableNotFoundError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = String(error.message || '').toLowerCase();
  const errorCode = String(error.code || '');
  const errorDetails = String(error.details || '').toLowerCase();
  const errorHint = String(error.hint || '').toLowerCase();
  const fullError = `${errorMessage} ${errorDetails} ${errorHint}`;
  
  return (
    errorCode === '42P01' || 
    errorCode === 'PGRST116' ||
    fullError.includes('does not exist') || 
    fullError.includes('schema cache') ||
    fullError.includes('could not find the table') ||
    fullError.includes('relation') && fullError.includes('does not exist')
  );
}

// GET all pricing configurations
export async function GET() {
  try {
    // Get Supabase client
    const supabase = getSupabaseClient();

    // Try to query the pricing_config table
    const { data, error } = await supabase
      .from('pricing_config')
      .select('*')
      .order('category', { ascending: true })
      .order('item_name', { ascending: true });

    // If there's an error, check if it's because the table doesn't exist
    if (error) {
      if (isTableNotFoundError(error)) {
        console.warn('pricing_config table does not exist, returning empty array');
        return NextResponse.json({ data: [] }, { status: 200 });
      }
      
      // For other errors, log and return error response
      console.error('Error fetching pricing config:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      return NextResponse.json({ 
        error: error.message || 'Failed to fetch pricing data',
        code: error.code,
        data: [] // Return empty data to prevent page crash
      }, { status: 200 }); // Return 200 with error message instead of 500
    }

    // Success - return data
    return NextResponse.json({ data: data || [] }, { status: 200 });
    
  } catch (error: any) {
    // Catch any unexpected errors (e.g., Supabase client initialization errors)
    console.error('Unexpected error in GET /api/pricing:', error);
    
    // Check if it's a table not found error
    if (isTableNotFoundError(error)) {
      console.warn('pricing_config table does not exist (caught in catch block), returning empty array');
      return NextResponse.json({ data: [] }, { status: 200 });
    }
    
    // For any other error, return empty array to prevent page crash
    // This ensures the page can still load and show the "Initialize Database" button
    return NextResponse.json({ 
      data: [],
      error: process.env.NODE_ENV === 'development' ? String(error?.message || error) : undefined
    }, { status: 200 });
  }
}

// POST/PUT to update pricing configurations
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { updates } = body; // Array of { category, item_id, price_lead, price_team, metadata? }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Invalid request body. Expected array of updates.' }, { status: 400 });
    }

    const results = [];

    for (const update of updates) {
      const { category, item_id, price_lead, price_team, metadata, item_name } = update;

      if (!category || !item_id || price_lead === undefined || price_team === undefined) {
        results.push({ error: `Missing required fields for ${item_id}` });
        continue;
      }

      // Upsert the pricing configuration
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('pricing_config')
        .upsert(
          {
            category,
            item_id,
            item_name: item_name || item_id,
            price_lead: parseFloat(price_lead),
            price_team: parseFloat(price_team),
            metadata: metadata || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'category,item_id',
          }
        )
        .select()
        .single();

      if (error) {
        console.error(`Error updating pricing for ${category}/${item_id}:`, error);
        results.push({ error: `Failed to update ${item_id}: ${error.message}` });
      } else {
        // Save to history
        await savePriceHistory(category, item_id, parseFloat(price_lead), parseFloat(price_team));
        results.push({ success: true, data });
      }
    }

    // Invalidate pricing cache so new prices are used immediately
    invalidatePricingCache();

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Error in POST /api/pricing:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
