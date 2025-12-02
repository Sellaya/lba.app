import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { FinalQuote } from '@/lib/types';

// This is a one-time cleanup and seed script
// Call this endpoint to clean the database and add dummy data
export async function POST(request: Request) {
  try {
    // Optional: Add authentication check here
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ADMIN_SECRET_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 1: Delete all existing bookings
    const { error: deleteError } = await supabaseAdmin
      .from('bookings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using a condition that's always true)

    if (deleteError) {
      console.error('Error deleting bookings:', deleteError);
      return NextResponse.json({ error: `Failed to delete bookings: ${deleteError.message}` }, { status: 500 });
    }

    // Step 2: Delete all scheduled emails
    const { error: deleteEmailsError } = await supabaseAdmin
      .from('scheduled_emails')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteEmailsError) {
      console.warn('Error deleting scheduled emails (table may not exist):', deleteEmailsError);
      // Continue even if this fails - table might not exist yet
    }

    // Step 3: Create 3 dummy bookings with different statuses
    const now = new Date();
    const dummyBookings: any[] = [
      {
        id: 'dummy-1-quoted',
        uid: 'web',
        final_quote: {
          id: 'dummy-1-quoted',
          status: 'quoted',
          contact: {
            name: 'Sarah Johnson',
            email: 'sarah.johnson@example.com',
            phone: '+1-416-555-0101',
          },
          booking: {
            days: [
              {
                date: 'December 15, 2024',
                serviceName: 'Bridal Makeup',
                serviceType: 'mobile',
                serviceOption: 'Full Glam',
                location: 'Toronto',
                getReadyTime: '8:00 AM',
                addOns: ['False Lashes'],
              },
            ],
            hasMobileService: true,
            address: {
              street: '123 Main Street',
              city: 'Toronto',
              province: 'ON',
              postalCode: 'M5V 2T6',
            },
          },
          quotes: {
            lead: {
              total: 500.00,
              subtotal: 442.48,
              tax: 57.52,
              lineItems: [
                { description: 'Bridal Makeup - Full Glam', price: 400.00 },
                { description: 'False Lashes', price: 42.48 },
              ],
            },
            team: {
              total: 350.00,
              subtotal: 309.73,
              tax: 40.27,
              lineItems: [
                { description: 'Bridal Makeup - Full Glam', price: 300.00 },
                { description: 'False Lashes', price: 9.73 },
              ],
            },
          },
        },
        created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        updated_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'dummy-2-pending',
        uid: 'web',
        final_quote: {
          id: 'dummy-2-pending',
          status: 'quoted',
          selectedQuote: 'lead',
          contact: {
            name: 'Emily Chen',
            email: 'emily.chen@example.com',
            phone: '+1-416-555-0102',
          },
          booking: {
            days: [
              {
                date: 'December 20, 2024',
                serviceName: 'Bridal Makeup',
                serviceType: 'mobile',
                serviceOption: 'Natural Glam',
                location: 'Mississauga',
                getReadyTime: '7:00 AM',
                addOns: [],
              },
            ],
            hasMobileService: true,
            address: {
              street: '456 Oak Avenue',
              city: 'Mississauga',
              province: 'ON',
              postalCode: 'L5A 1B2',
            },
          },
          quotes: {
            lead: {
              total: 450.00,
              subtotal: 398.23,
              tax: 51.77,
              lineItems: [
                { description: 'Bridal Makeup - Natural Glam', price: 450.00 },
              ],
            },
            team: {
              total: 300.00,
              subtotal: 265.49,
              tax: 34.51,
              lineItems: [
                { description: 'Bridal Makeup - Natural Glam', price: 300.00 },
              ],
            },
          },
          paymentDetails: {
            method: 'interac',
            status: 'deposit-pending',
            depositAmount: 225.00,
            screenshotUrl: 'https://example.com/screenshot1.jpg',
          },
        },
        created_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        updated_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      },
      {
        id: 'dummy-3-confirmed',
        uid: 'web',
        final_quote: {
          id: 'dummy-3-confirmed',
          status: 'confirmed',
          selectedQuote: 'lead',
          contact: {
            name: 'Jessica Martinez',
            email: 'jessica.martinez@example.com',
            phone: '+1-416-555-0103',
          },
          booking: {
            days: [
              {
                date: 'December 25, 2024',
                serviceName: 'Bridal Makeup',
                serviceType: 'studio',
                serviceOption: 'Full Glam',
                location: 'Studio',
                getReadyTime: '9:00 AM',
                addOns: ['False Lashes', 'Hair Styling'],
              },
            ],
            hasMobileService: false,
          },
          quotes: {
            lead: {
              total: 600.00,
              subtotal: 530.97,
              tax: 69.03,
              lineItems: [
                { description: 'Bridal Makeup - Full Glam', price: 450.00 },
                { description: 'False Lashes', price: 50.00 },
                { description: 'Hair Styling', price: 30.97 },
              ],
            },
            team: {
              total: 400.00,
              subtotal: 353.98,
              tax: 46.02,
              lineItems: [
                { description: 'Bridal Makeup - Full Glam', price: 300.00 },
                { description: 'False Lashes', price: 30.00 },
                { description: 'Hair Styling', price: 23.98 },
              ],
            },
          },
          paymentDetails: {
            method: 'stripe',
            status: 'deposit-paid',
            depositAmount: 300.00,
          },
        },
        created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
        updated_at: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
      },
    ];

    // Insert dummy bookings
    const { error: insertError } = await supabaseAdmin
      .from('bookings')
      .insert(dummyBookings);

    if (insertError) {
      console.error('Error inserting dummy bookings:', insertError);
      return NextResponse.json({ error: `Failed to insert dummy bookings: ${insertError.message}` }, { status: 500 });
    }

    // Step 4: Create scheduled emails for the dummy bookings
    const scheduledEmails: any[] = [];

    // For dummy-1-quoted (created 2 hours ago)
    const dummy1Created = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    scheduledEmails.push(
      {
        booking_id: 'dummy-1-quoted',
        email_type: 'followup-3h',
        scheduled_for: new Date(dummy1Created.getTime() + 3 * 60 * 60 * 1000).toISOString(), // 1 hour from now
        sent: false,
      },
      {
        booking_id: 'dummy-1-quoted',
        email_type: 'followup-6h',
        scheduled_for: new Date(dummy1Created.getTime() + 6 * 60 * 60 * 1000).toISOString(), // 4 hours from now
        sent: false,
      },
      {
        booking_id: 'dummy-1-quoted',
        email_type: 'followup-24h',
        scheduled_for: new Date(dummy1Created.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 22 hours from now
        sent: false,
      }
    );

    // For dummy-2-pending (created 4 hours ago)
    const dummy2Created = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    scheduledEmails.push(
      {
        booking_id: 'dummy-2-pending',
        email_type: 'followup-3h',
        scheduled_for: new Date(dummy2Created.getTime() + 3 * 60 * 60 * 1000).toISOString(), // 1 hour ago (should be sent)
        sent: true,
        sent_at: new Date(dummy2Created.getTime() + 3 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(), // 5 min after scheduled
      },
      {
        booking_id: 'dummy-2-pending',
        email_type: 'followup-6h',
        scheduled_for: new Date(dummy2Created.getTime() + 6 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        sent: false,
      },
      {
        booking_id: 'dummy-2-pending',
        email_type: 'followup-24h',
        scheduled_for: new Date(dummy2Created.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 20 hours from now
        sent: false,
      }
    );

    // For dummy-3-confirmed (created 24 hours ago) - all emails should be sent
    const dummy3Created = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    scheduledEmails.push(
      {
        booking_id: 'dummy-3-confirmed',
        email_type: 'followup-3h',
        scheduled_for: new Date(dummy3Created.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        sent: true,
        sent_at: new Date(dummy3Created.getTime() + 3 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
      },
      {
        booking_id: 'dummy-3-confirmed',
        email_type: 'followup-6h',
        scheduled_for: new Date(dummy3Created.getTime() + 6 * 60 * 60 * 1000).toISOString(),
        sent: true,
        sent_at: new Date(dummy3Created.getTime() + 6 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
      }
      // No 24h email for studio bookings
    );

    // Insert scheduled emails (only if table exists)
    const { error: emailsError } = await supabaseAdmin
      .from('scheduled_emails')
      .insert(scheduledEmails);

    if (emailsError) {
      console.warn('Error inserting scheduled emails (table may not exist):', emailsError);
      // Continue even if this fails
    }

    return NextResponse.json({
      success: true,
      message: 'Database cleaned and seeded with 3 dummy bookings',
      bookingsCreated: dummyBookings.length,
      scheduledEmailsCreated: scheduledEmails.length,
    });

  } catch (error: any) {
    console.error('Error in cleanup and seed:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}















