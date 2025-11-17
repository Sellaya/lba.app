import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

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
    const { data, error } = await supabaseAdmin
      .from('makeup_artists')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching artists:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Check if column is missing (error 42703)
      if (error.code === '42703') {
        return NextResponse.json({
          error: 'Table structure is incorrect',
          message: 'The makeup_artists table exists but is missing required columns. Please recreate it with the correct structure.',
          errorCode: error.code,
          errorDetails: error.message,
          sqlScript: `-- The table exists but has wrong structure. Drop and recreate it:
-- WARNING: This will delete all existing data!

DROP TABLE IF EXISTS makeup_artists CASCADE;

-- Now create the table with correct structure:
CREATE TABLE makeup_artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  address JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_makeup_artists_email ON makeup_artists(email);

ALTER TABLE makeup_artists DISABLE ROW LEVEL SECURITY;`,
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
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

// POST - Create a new artist
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, whatsapp, address } = body;

    if (!name || !email || !whatsapp) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, whatsapp' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate WhatsApp (should be numeric)
    const whatsappRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanedWhatsapp = whatsapp.replace(/\D/g, '');
    if (!whatsappRegex.test(cleanedWhatsapp)) {
      return NextResponse.json({ error: 'Invalid WhatsApp number format' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('makeup_artists')
      .insert([
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: cleanedWhatsapp,
          address: address || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating artist:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ artist: data }, { status: 201 });
  } catch (e: any) {
    console.error('Error in POST /api/artists:', e);
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

// PUT - Update an artist
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, email, whatsapp, address } = body;

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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate WhatsApp
    const whatsappRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanedWhatsapp = whatsapp.replace(/\D/g, '');
    if (!whatsappRegex.test(cleanedWhatsapp)) {
      return NextResponse.json({ error: 'Invalid WhatsApp number format' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('makeup_artists')
      .update({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: cleanedWhatsapp,
        address: address || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id as string)
      .select()
      .single();

    if (error) {
      console.error('Error updating artist:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ artist: data });
  } catch (e: any) {
    console.error('Error in PUT /api/artists:', e);
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
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

    const { error } = await supabaseAdmin
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

