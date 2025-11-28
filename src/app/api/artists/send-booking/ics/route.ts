import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { FinalQuote } from '@/lib/types';
import { parseToronto, setTorontoTime, fromTorontoTime, getTorontoNow } from '@/lib/toronto-time';

// GET endpoint to serve ICS file for calendar download
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Fetch booking from database
    const { data: bookingDoc, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !bookingDoc) {
      console.error('Error fetching booking:', bookingError);
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    const finalQuote: FinalQuote = bookingDoc.final_quote || bookingDoc.finalQuote;

    if (!finalQuote || !finalQuote.booking || !finalQuote.booking.days || finalQuote.booking.days.length === 0) {
      return NextResponse.json(
        { error: 'Booking data is incomplete' },
        { status: 500 }
      );
    }

    // Generate ICS content
    const icsContent = generateCalendarEvent(finalQuote, 'Makeup Artist');

    // Return ICS file with proper headers
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="booking-${bookingId}.ics"`,
      },
    });
  } catch (e: any) {
    console.error('Error in GET /api/artists/send-booking/ics:', e);
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

function generateCalendarEvent(quote: FinalQuote, artistName: string): string {
  // Validate booking days exist
  if (!quote.booking.days || quote.booking.days.length === 0) {
    throw new Error('Booking has no service days');
  }
  
  // Use the first booking day for the calendar event
  const firstDay = quote.booking.days[0];
  if (!firstDay) {
    throw new Error('First booking day is missing');
  }
  
  // Validate required fields
  if (!firstDay.date) {
    throw new Error('Booking day is missing date');
  }
  if (!firstDay.getReadyTime) {
    throw new Error('Booking day is missing getReadyTime');
  }
  if (!firstDay.location) {
    throw new Error('Booking day is missing location');
  }
  
  // Parse date - it's stored in 'PPP' format (e.g., "January 1, 2024")
  // All dates/times should be in Toronto timezone
  let eventDate: Date;
  if (typeof firstDay.date === 'string') {
    try {
      // Parse date string in 'PPP' format as Toronto time
      const parsedDate = parseToronto(firstDay.date, 'PPP');
      eventDate = parsedDate;
    } catch (error) {
      console.error(`Failed to parse date: ${firstDay.date}`, error);
      eventDate = getTorontoNow();
    }
  } else if (firstDay.date && typeof firstDay.date === 'object' && 'getTime' in firstDay.date) {
    eventDate = new Date(firstDay.date as Date);
  } else {
    eventDate = getTorontoNow();
  }

  // Parse time - getReadyTime can be "10:00", "10:00 AM", "10:00:00", etc.
  const timeStr = firstDay.getReadyTime.trim();
  let hours = 10;
  let minutes = 0;
  
  // Handle different time formats
  if (timeStr.includes('AM') || timeStr.includes('PM')) {
    // Format: "10:00 AM" or "10:00 PM"
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      if (timeMatch[3].toUpperCase() === 'PM' && hours !== 12) {
        hours += 12;
      } else if (timeMatch[3].toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
      }
    }
  } else {
    // Format: "10:00" or "10:00:00"
    const timeParts = timeStr.split(':').map(Number);
    hours = timeParts[0] || 10;
    minutes = timeParts[1] || 0;
  }

  // Set time in Toronto timezone
  eventDate = setTorontoTime(eventDate, hours, minutes, 0, 0);

  // Event duration: 3 hours (adjust as needed)
  const endDate = new Date(eventDate);
  endDate.setHours(endDate.getHours() + 3);
  
  // Convert to UTC for calendar format
  const eventDateUTC = fromTorontoTime(eventDate);
  const endDateUTC = fromTorontoTime(endDate);

  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const summary = `Makeup Service - ${quote.contact.name}`;
  const description = formatBookingDetailsForCalendar(quote);

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Looks by Anum//Booking System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:booking-${quote.id}@looksbyanum.com`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(eventDateUTC)}`,
    `DTEND:${formatDate(endDateUTC)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n').replace(/,/g, '\\,')}`,
    `LOCATION:${firstDay.location}`,
    `ORGANIZER;CN=Looks by Anum:mailto:orders@looksbyanum.com`,
    `ATTENDEE;CN=${artistName};RSVP=TRUE:mailto:${quote.contact.email}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Makeup service in 1 hour',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return ics;
}

function formatBookingDetailsForCalendar(quote: FinalQuote): string {
  const lines: string[] = [];
  lines.push(`Booking ID: ${quote.id}`);
  lines.push(`Customer: ${quote.contact.name}`);
  lines.push(`Email: ${quote.contact.email}`);
  if (quote.contact.phone) {
    lines.push(`Phone: ${quote.contact.phone}`);
  }
  lines.push(``);
  lines.push(`Service Details:`);
  
  // Validate days exist before iterating
  if (quote.booking.days && quote.booking.days.length > 0) {
    quote.booking.days.forEach((day, index) => {
      lines.push(`Day ${index + 1}: ${day.serviceName}`);
      lines.push(`  Date: ${day.date}`);
      lines.push(`  Time: ${day.getReadyTime}`);
      lines.push(`  Location: ${day.location}`);
      lines.push(`  Style: ${day.serviceOption}`);
      if (day.addOns && day.addOns.length > 0) {
        lines.push(`  Add-ons: ${day.addOns.join(', ')}`);
      }
    });
  }

  if (quote.booking.trial) {
    const trialServiceOption = quote.booking.trial?.serviceOption || 'makeup-hair';
    const trialServiceOptionLabel = trialServiceOption === 'makeup-hair' ? 'Makeup & Hair' : 
                                    trialServiceOption === 'makeup-only' ? 'Makeup Only' : 'Hair Only';
    lines.push(``);
    lines.push(`Bridal Trial: ${quote.booking.trial.date} at ${quote.booking.trial.time} (${trialServiceOptionLabel})`);
  }

  if (quote.booking.bridalParty && quote.booking.bridalParty.services && quote.booking.bridalParty.services.length > 0) {
    lines.push(``);
    lines.push(`Bridal Party Services:`);
    quote.booking.bridalParty.services.forEach(service => {
      lines.push(`  - ${service.service} (x${service.quantity})`);
    });
  }

  if (quote.booking.address) {
    lines.push(``);
    lines.push(`Service Address:`);
    lines.push(`${quote.booking.address.street}, ${quote.booking.address.city}, ${quote.booking.address.province} ${quote.booking.address.postalCode}`);
  }

  return lines.join('\n');
}

