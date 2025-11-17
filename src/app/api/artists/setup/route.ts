import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Dummy artists data
const dummyArtists = [
  {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@looksbyanum.com',
    whatsapp: '14165551234',
  },
  {
    name: 'Emily Chen',
    email: 'emily.chen@looksbyanum.com',
    whatsapp: '14165552345',
  },
  {
    name: 'Maria Rodriguez',
    email: 'maria.rodriguez@looksbyanum.com',
    whatsapp: '14165553456',
  },
  {
    name: 'Jessica Williams',
    email: 'jessica.williams@looksbyanum.com',
    whatsapp: '14165554567',
  },
  {
    name: 'Amanda Brown',
    email: 'amanda.brown@looksbyanum.com',
    whatsapp: '14165555678',
  },
  {
    name: 'Nicole Davis',
    email: 'nicole.davis@looksbyanum.com',
    whatsapp: '14165556789',
  },
  {
    name: 'Rachel Martinez',
    email: 'rachel.martinez@looksbyanum.com',
    whatsapp: '14165557890',
  },
  {
    name: 'Lauren Anderson',
    email: 'lauren.anderson@looksbyanum.com',
    whatsapp: '14165558901',
  },
  {
    name: 'Michelle Taylor',
    email: 'michelle.taylor@looksbyanum.com',
    whatsapp: '14165559012',
  },
  {
    name: 'Ashley Thomas',
    email: 'ashley.thomas@looksbyanum.com',
    whatsapp: '14165550123',
  },
];

/**
 * POST endpoint to check if table exists and create dummy data
 * This will attempt to insert dummy data, and if the table doesn't exist,
 * it will return instructions on how to create it.
 */
export async function POST() {
  try {
    // First, try to check if the table exists by querying it
    const { data: existingData, error: checkError } = await supabaseAdmin
      .from('makeup_artists')
      .select('id')
      .limit(1);

    // If table doesn't exist, return instructions
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
          message: 'The makeup_artists table does not exist. Please create it first.',
          errorCode: checkError.code,
          errorDetails: checkError.message,
          sqlScript: `
-- Run this SQL in your Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS makeup_artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_makeup_artists_email ON makeup_artists(email);

-- Disable RLS for service role access (or create appropriate policies)
ALTER TABLE makeup_artists DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS enabled, create a policy:
-- CREATE POLICY "Service role can access all artists" ON makeup_artists
--   FOR ALL USING (true);
          `.trim(),
        }, { status: 400 });
      }
      // Other error
      return NextResponse.json({
        success: false,
        error: checkError.message,
        code: checkError.code,
      }, { status: 500 });
    }

    // Table exists, now try to insert dummy data
    const results = [];
    const errors = [];
    const skipped = [];

    for (const artist of dummyArtists) {
      try {
        // Check if artist already exists
        const { data: existing } = await supabaseAdmin
          .from('makeup_artists')
          .select('id, name')
          .eq('email', artist.email)
          .single();

        if (existing) {
          skipped.push({
            artist: artist.name,
            email: artist.email,
            reason: 'Already exists',
          });
          continue;
        }

        // Insert artist
        const { data, error } = await supabaseAdmin
          .from('makeup_artists')
          .insert([artist])
          .select()
          .single();

        if (error) {
          errors.push({
            artist: artist.name,
            email: artist.email,
            error: error.message,
          });
        } else {
          results.push({
            id: data.id,
            name: data.name,
            email: data.email,
          });
        }
      } catch (err: any) {
        errors.push({
          artist: artist.name,
          email: artist.email,
          error: err.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      created: results.length,
      skipped: skipped.length,
      failed: errors.length,
      artists: results,
      skippedArtists: skipped.length > 0 ? skipped : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    console.error('Error in POST /api/artists/setup:', e);
    return NextResponse.json(
      {
        success: false,
        error: e?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check table status
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('makeup_artists')
      .select('id, name, email')
      .order('name', { ascending: true })
      .limit(100);

    if (error) {
      const isTableNotFound = 
        error.code === '42P01' || 
        error.code === 'PGRST116' ||
        error.message?.includes('does not exist') || 
        error.message?.includes('schema cache') ||
        error.message?.includes('Could not find the table') ||
        (error.message?.includes('relation') && error.message?.includes('does not exist'));
      
      if (isTableNotFound) {
        return NextResponse.json({
          exists: false,
          message: 'Table does not exist',
          errorCode: error.code,
          errorDetails: error.message,
          sqlScript: `
-- Run this SQL in your Supabase SQL Editor:

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
          `.trim(),
        });
      }
      return NextResponse.json({
        exists: false,
        error: error.message,
        code: error.code,
      }, { status: 500 });
    }

    return NextResponse.json({
      exists: true,
      count: data?.length || 0,
      artists: data || [],
    });
  } catch (e: any) {
    console.error('Error in GET /api/artists/setup:', e);
    return NextResponse.json(
      {
        exists: false,
        error: e?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

