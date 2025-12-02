import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET price history for a specific item or all items
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const itemId = searchParams.get('item_id');
    const limit = parseInt(searchParams.get('limit') || '3');

    let query = supabaseAdmin
      .from('pricing_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category && itemId) {
      query = query
        .eq('category', category)
        .eq('item_id', itemId);
    }

    const { data, error } = await query;

    // If table doesn't exist, return empty array instead of error
    if (error) {
      const isTableNotFound = 
        error.code === '42P01' || 
        error.code === 'PGRST116' ||
        error.message?.includes('does not exist') || 
        error.message?.includes('schema cache') ||
        error.message?.includes('Could not find the table');
      
      if (isTableNotFound) {
        console.warn('pricing_history table does not exist yet');
        return NextResponse.json({ data: [] });
      }
      
      console.error('Error fetching price history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error in GET /api/pricing/history:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

