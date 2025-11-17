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

export async function POST() {
  try {
    const results = [];
    const errors = [];

    for (const artist of dummyArtists) {
      try {
        // Check if artist already exists
        const { data: existing } = await supabaseAdmin
          .from('makeup_artists')
          .select('id')
          .eq('email', artist.email)
          .single();

        if (existing) {
          errors.push({
            artist: artist.name,
            error: 'Artist with this email already exists',
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
            error: error.message,
          });
        } else {
          results.push(data);
        }
      } catch (err: any) {
        errors.push({
          artist: artist.name,
          error: err.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      created: results.length,
      failed: errors.length,
      artists: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    console.error('Error seeding artists:', e);
    return NextResponse.json(
      { error: e?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check current artist count
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('makeup_artists')
      .select('id, name, email')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      count: data?.length || 0,
      artists: data || [],
    });
  } catch (e: any) {
    console.error('Error fetching artists:', e);
    return NextResponse.json(
      { error: e?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

