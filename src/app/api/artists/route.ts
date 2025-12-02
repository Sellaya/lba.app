import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';

export interface MakeupArtist {
  id?: string;
  name: string;
  email: string;
  whatsapp: string;
  address?: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  created_at?: string;
  updated_at?: string;
}

// GET - Fetch all artists
export async function GET() {
  try {
    // Use getSupabaseClient to ensure proper initialization
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (initError: any) {
      console.error('Error initializing Supabase client:', initError);
      return NextResponse.json({ 
        error: 'Server configuration error',
        message: initError?.message || 'Failed to initialize database connection',
        errorCode: 'INIT_ERROR'
      }, { status: 500 });
    }
    
    const { data, error } = await supabase
      .from('makeup_artists')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching artists:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Check if column is missing (error 42703 or schema cache error)
      const isColumnMissing = 
        error.code === '42703' || 
        error.message?.includes("Could not find the 'address' column") ||
        error.message?.includes('schema cache') ||
        error.message?.includes('column') && error.message?.includes('does not exist');
      
      if (isColumnMissing) {
        return NextResponse.json({
          error: 'Table structure is incorrect',
          message: 'The makeup_artists table exists but is missing the "address" column. Please add it using the SQL script below.',
          errorCode: error.code,
          errorDetails: error.message,
          sqlScript: `-- Add the missing 'address' column to the existing table:
-- This will NOT delete any existing data

ALTER TABLE makeup_artists 
ADD COLUMN IF NOT EXISTS address JSONB;

-- If you want to recreate the entire table instead (WARNING: Deletes all data):
-- DROP TABLE IF EXISTS makeup_artists CASCADE;
-- 
-- CREATE TABLE makeup_artists (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   name TEXT NOT NULL,
--   email TEXT NOT NULL UNIQUE,
--   whatsapp TEXT NOT NULL,
--   address JSONB,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );
-- 
-- CREATE INDEX idx_makeup_artists_email ON makeup_artists(email);
-- ALTER TABLE makeup_artists DISABLE ROW LEVEL SECURITY;`,
        }, { status: 400 });
      }
      
      // Check if table doesn't exist - check multiple error codes and messages
      const isTableNotFound = 
        error.code === '42P01' || 
        error.code === 'PGRST116' ||
        error.message?.includes('does not exist') || 
        error.message?.includes('schema cache') ||
        error.message?.includes('Could not find the table') ||
        error.message?.includes('relation') && error.message?.includes('does not exist');
      
      if (isTableNotFound) {
        return NextResponse.json({
          error: 'Table does not exist',
          message: 'The makeup_artists table has not been created yet.',
          errorCode: error.code,
          errorDetails: error.message,
          sqlScript: `-- Run this SQL in your Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS makeup_artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  address JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_makeup_artists_email ON makeup_artists(email);

ALTER TABLE makeup_artists DISABLE ROW LEVEL SECURITY;`,
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        error: error.message,
        errorCode: error.code,
        errorDetails: error 
      }, { status: 500 });
    }

    return NextResponse.json({ artists: data || [] });
  } catch (e: any) {
    console.error('Error in GET /api/artists:', e);
    console.error('Error stack:', e?.stack);
    // Check if it's a Supabase initialization error
    if (e?.message?.includes('Missing Supabase environment variables')) {
      return NextResponse.json({ 
        error: 'Server configuration error: Missing Supabase credentials',
        errorCode: 'CONFIG_ERROR'
      }, { status: 500 });
    }
    return NextResponse.json({ 
      error: e?.message || 'Unknown error occurred',
      errorType: e?.name || 'Error',
      errorDetails: process.env.NODE_ENV === 'development' ? String(e) : undefined
    }, { status: 500 });
  }
}

// POST - Create a new artist
export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { name, email, whatsapp, address } = body || {};

    if (!name || !email || !whatsapp) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, whatsapp' },
        { status: 400 }
      );
    }

    // Validate email format
    if (typeof email !== 'string') {
      return NextResponse.json({ error: 'Email must be a string' }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate WhatsApp (should be numeric)
    if (typeof whatsapp !== 'string') {
      return NextResponse.json({ error: 'WhatsApp must be a string' }, { status: 400 });
    }
    const whatsappRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanedWhatsapp = whatsapp.replace(/\D/g, '');
    if (!cleanedWhatsapp || !whatsappRegex.test(cleanedWhatsapp)) {
      return NextResponse.json({ error: 'Invalid WhatsApp number format' }, { status: 400 });
    }

    // Normalize address - only include if it has actual data
    let normalizedAddress = null;
    if (address && typeof address === 'object' && !Array.isArray(address)) {
      const hasAddressData = 
        (address.street && typeof address.street === 'string' && address.street.trim()) ||
        (address.city && typeof address.city === 'string' && address.city.trim()) ||
        (address.province && typeof address.province === 'string' && address.province.trim()) ||
        (address.postalCode && typeof address.postalCode === 'string' && address.postalCode.trim());
      
      if (hasAddressData) {
        normalizedAddress = {
          street: (address.street && typeof address.street === 'string') ? address.street.trim() || null : null,
          city: (address.city && typeof address.city === 'string') ? address.city.trim() || null : null,
          province: (address.province && typeof address.province === 'string') ? address.province.trim() || null : null,
          postalCode: (address.postalCode && typeof address.postalCode === 'string') ? address.postalCode.trim() || null : null,
        };
      }
    }

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('makeup_artists')
      .insert([
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: cleanedWhatsapp,
          address: normalizedAddress,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating artist:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json({ 
        error: error.message || 'Failed to create artist',
        errorCode: error.code,
        errorDetails: process.env.NODE_ENV === 'development' ? error : undefined
      }, { status: 500 });
    }

    return NextResponse.json({ artist: data }, { status: 201 });
  } catch (e: any) {
    console.error('Error in POST /api/artists:', e);
    console.error('Error stack:', e?.stack);
    return NextResponse.json({ 
      error: e?.message || 'Unknown error occurred',
      errorType: e?.name || 'Error',
      errorDetails: process.env.NODE_ENV === 'development' ? String(e) : undefined
    }, { status: 500 });
  }
}

// PUT - Update an artist
export async function PUT(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { id, name, email, whatsapp, address } = body || {};

    if (!id) {
      return NextResponse.json({ error: 'Missing artist ID' }, { status: 400 });
    }

    if (!name || !email || !whatsapp) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, whatsapp' },
        { status: 400 }
      );
    }

    // Validate email format
    if (typeof email !== 'string') {
      return NextResponse.json({ error: 'Email must be a string' }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate WhatsApp
    if (typeof whatsapp !== 'string') {
      return NextResponse.json({ error: 'WhatsApp must be a string' }, { status: 400 });
    }
    const whatsappRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanedWhatsapp = whatsapp.replace(/\D/g, '');
    if (!cleanedWhatsapp || !whatsappRegex.test(cleanedWhatsapp)) {
      return NextResponse.json({ error: 'Invalid WhatsApp number format' }, { status: 400 });
    }

    // Normalize address - only include if it has actual data
    let normalizedAddress = null;
    if (address && typeof address === 'object' && !Array.isArray(address)) {
      const hasAddressData = 
        (address.street && typeof address.street === 'string' && address.street.trim()) ||
        (address.city && typeof address.city === 'string' && address.city.trim()) ||
        (address.province && typeof address.province === 'string' && address.province.trim()) ||
        (address.postalCode && typeof address.postalCode === 'string' && address.postalCode.trim());
      
      if (hasAddressData) {
        normalizedAddress = {
          street: (address.street && typeof address.street === 'string') ? address.street.trim() || null : null,
          city: (address.city && typeof address.city === 'string') ? address.city.trim() || null : null,
          province: (address.province && typeof address.province === 'string') ? address.province.trim() || null : null,
          postalCode: (address.postalCode && typeof address.postalCode === 'string') ? address.postalCode.trim() || null : null,
        };
      }
    }

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('makeup_artists')
      .update({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: cleanedWhatsapp,
        address: normalizedAddress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id as string)
      .select()
      .single();

    if (error) {
      console.error('Error updating artist:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json({ 
        error: error.message || 'Failed to update artist',
        errorCode: error.code,
        errorDetails: process.env.NODE_ENV === 'development' ? error : undefined
      }, { status: 500 });
    }

    return NextResponse.json({ artist: data });
  } catch (e: any) {
    console.error('Error in PUT /api/artists:', e);
    console.error('Error stack:', e?.stack);
    return NextResponse.json({ 
      error: e?.message || 'Unknown error occurred',
      errorType: e?.name || 'Error',
      errorDetails: process.env.NODE_ENV === 'development' ? String(e) : undefined
    }, { status: 500 });
  }
}

// DELETE - Delete an artist
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing artist ID' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('makeup_artists')
      .delete()
      .eq('id', id as string);

    if (error) {
      console.error('Error deleting artist:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error in DELETE /api/artists:', e);
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

