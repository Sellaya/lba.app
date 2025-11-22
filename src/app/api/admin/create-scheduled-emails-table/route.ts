import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * API route to create the scheduled_emails table if it doesn't exist
 * This should be called once to set up the table
 */
export async function POST(request: Request) {
  try {
    // Optional: Add authentication check here
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ADMIN_SECRET_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to create the table using raw SQL
    // Note: Supabase client doesn't support CREATE TABLE directly
    // This needs to be run in Supabase SQL editor or via a migration
    
    // For now, we'll just verify the table exists by trying to query it
    const { data, error } = await supabaseAdmin
      .from('scheduled_emails')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          message: 'scheduled_emails table does not exist. Please run the SQL script in Supabase SQL editor.',
          sqlScript: `
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id TEXT NOT NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('followup-3h', 'followup-6h', 'followup-24h')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due ON scheduled_emails(scheduled_for, sent) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_booking ON scheduled_emails(booking_id);
          `,
        });
      }
      return NextResponse.json({ error: `Error checking table: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'scheduled_emails table exists and is accessible',
    });

  } catch (error: any) {
    console.error('Error in create-scheduled-emails-table:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}















