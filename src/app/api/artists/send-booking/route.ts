import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendArtistBookingEmail } from '@/lib/email';
import type { FinalQuote } from '@/lib/types';
import { parseToronto, setTorontoTime, fromTorontoTime, getTorontoNow } from '@/lib/toronto-time';

// Helper function to get base URL
function getBaseUrl(request: Request): string {
  const origin = request.headers.get('origin');
  if (origin) return origin;
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { artistId, bookingId, method } = body; // method: 'email' | 'whatsapp' | 'calendar'

    if (!artistId || !bookingId || !method) {
      return NextResponse.json(
        { error: 'Missing required fields: artistId, bookingId, method' },
        { status: 400 }
      );
    }

    // Fetch artist
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('makeup_artists')
      .select('*')
      .eq('id', artistId as string)
      .single();

    if (artistError || !artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Fetch booking
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !bookingData) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const finalQuote: FinalQuote = bookingData.final_quote || bookingData.finalQuote;

    if (!finalQuote) {
      return NextResponse.json({ error: 'Booking data is incomplete' }, { status: 500 });
    }

    // Handle different methods
    if (method === 'email') {
      try {
        // Generate calendar links
        const baseUrl = getBaseUrl(request);
        const calendarLinks = generateCalendarLinks(finalQuote, baseUrl);
        
        await sendArtistBookingEmail(finalQuote, artist.email, artist.name, calendarLinks);
        return NextResponse.json({ 
          success: true, 
          message: `Booking details sent to ${artist.name} via email` 
        });
      } catch (emailError: any) {
        console.error('Error sending email:', emailError);
        return NextResponse.json(
          { error: `Failed to send email: ${emailError.message}` },
          { status: 500 }
        );
      }
    } else if (method === 'whatsapp') {
      // Generate WhatsApp link with booking details
      const bookingDetails = formatBookingDetailsForWhatsApp(finalQuote);
      const whatsappLink = `https://wa.me/${artist.whatsapp}?text=${encodeURIComponent(bookingDetails)}`;
      
      return NextResponse.json({ 
        success: true, 
        whatsappLink,
        message: `WhatsApp link generated for ${artist.name}` 
      });
    } else if (method === 'calendar') {
      // Generate calendar event (ICS file)
      const icsContent = generateCalendarEvent(finalQuote, artist.name);
      
      return NextResponse.json({ 
        success: true, 
        icsContent,
        filename: `booking-${bookingId}.ics`,
        message: `Calendar event generated for ${artist.name}` 
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid method. Use: email, whatsapp, or calendar' },
        { status: 400 }
      );
    }
  } catch (e: any) {
    console.error('Error in POST /api/artists/send-booking:', e);
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

function formatBookingDetailsForWhatsApp(quote: FinalQuote): string {
  const lines: string[] = [];
  lines.push(`🎨 *New Booking Assignment*`);
  lines.push(``);
  lines.push(`*Customer:* ${quote.contact.name}`);
  lines.push(`*Booking ID:* ${quote.id}`);
  lines.push(``);
  lines.push(`*Service Details:*`);
  
  // Validate days exist before iterating
  if (quote.booking.days && quote.booking.days.length > 0) {
    quote.booking.days.forEach((day, index) => {
    lines.push(`\n*Day ${index + 1}:* ${day.serviceName}`);
    lines.push(`📅 Date: ${day.date}`);
    lines.push(`⏰ Time: ${day.getReadyTime}`);
    lines.push(`📍 Location: ${day.location}`);
    lines.push(`✨ Style: ${day.serviceOption}`);
      if (day.addOns && day.addOns.length > 0) {
        lines.push(`➕ Add-ons: ${day.addOns.join(', ')}`);
      }
    });
  }

  if (quote.booking.trial) {
    const trialServiceOption = quote.booking.trial?.serviceOption || 'makeup-hair';
    const trialServiceOptionLabel = trialServiceOption === 'makeup-hair' ? 'Makeup & Hair' : 
                                    trialServiceOption === 'makeup-only' ? 'Makeup Only' : 'Hair Only';
    lines.push(``);
    lines.push(`*Bridal Trial:*`);
    lines.push(`📅 Date: ${quote.booking.trial.date}`);
    lines.push(`⏰ Time: ${quote.booking.trial.time}`);
    lines.push(`💄 Service: ${trialServiceOptionLabel}`);
  }

  if (quote.booking.bridalParty && quote.booking.bridalParty.services && quote.booking.bridalParty.services.length > 0) {
    lines.push(``);
    lines.push(`*Bridal Party Services:*`);
    quote.booking.bridalParty.services.forEach(service => {
      lines.push(`• ${service.service} (x${service.quantity})`);
    });
    if (quote.booking.bridalParty.airbrush > 0) {
      lines.push(`• Airbrush Service (x${quote.booking.bridalParty.airbrush})`);
    }
  }

  if (quote.booking.address) {
    lines.push(``);
    lines.push(`*Service Address:*`);
    lines.push(`${quote.booking.address.street}`);
    lines.push(`${quote.booking.address.city}, ${quote.booking.address.province} ${quote.booking.address.postalCode}`);
  }

  // Add inspirations if available
  if (quote.booking.inspirations) {
    lines.push(``);
    lines.push(`*Client Inspirations:*`);
    
    if (quote.booking.inspirations.images && quote.booking.inspirations.images.length > 0) {
      lines.push(`📸 *Inspiration Images:*`);
      quote.booking.inspirations.images.forEach((imageUrl, index) => {
        lines.push(`${index + 1}. ${imageUrl}`);
      });
    }
    
    if (quote.booking.inspirations.links && quote.booking.inspirations.links.length > 0) {
      lines.push(`🔗 *Inspiration Links:*`);
      quote.booking.inspirations.links.forEach((link, index) => {
        lines.push(`${index + 1}. ${link}`);
      });
    }
  }

  lines.push(``);
  lines.push(`*Contact Information:*`);
  lines.push(`📧 Email: ${quote.contact.email}`);
  if (quote.contact.phone) {
    lines.push(`📱 Phone: ${quote.contact.phone}`);
  }

  return lines.join('\n');
}

// Generate calendar links for different calendar services
function generateCalendarLinks(quote: FinalQuote, baseUrl: string): {
  google: string;
  outlook: string;
  yahoo: string;
  ics: string;
} {
  // Validate booking days exist
  if (!quote.booking.days || quote.booking.days.length === 0) {
    throw new Error('Booking has no service days');
  }
  
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
  
  // Parse date
  let eventDate: Date;
  if (typeof firstDay.date === 'string') {
    try {
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

  // Parse time
  const timeStr = firstDay.getReadyTime.trim();
  let hours = 10;
  let minutes = 0;
  if (timeStr.includes('AM') || timeStr.includes('PM')) {
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
    const timeParts = timeStr.split(':').map(Number);
    hours = timeParts[0] || 10;
    minutes = timeParts[1] || 0;
  }
  
  // Set time in Toronto timezone
  eventDate = setTorontoTime(eventDate, hours, minutes, 0, 0);
  const endDate = new Date(eventDate);
  endDate.setHours(endDate.getHours() + 3);

  // Format dates for URLs (YYYYMMDDTHHmmssZ)
  const formatDateForURL = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const startDateStr = formatDateForURL(eventDate);
  const endDateStr = formatDateForURL(endDate);

  // Event details
  const title = encodeURIComponent(`Makeup Service - ${quote.contact.name}`);
  const description = encodeURIComponent(formatBookingDetailsForCalendar(quote));
  const location = encodeURIComponent(firstDay.location);

  // Google Calendar URL
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateStr}/${endDateStr}&details=${description}&location=${location}`;

  // Outlook Calendar URL
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${eventDate.toISOString()}&enddt=${endDate.toISOString()}&body=${description}&location=${location}`;

  // Yahoo Calendar URL
  const yahooUrl = `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${title}&st=${startDateStr}&dur=${Math.round((endDate.getTime() - eventDate.getTime()) / 60000)}&desc=${description}&in_loc=${location}`;

  // ICS file URL (hosted on the server)
  const icsUrl = `${baseUrl}/api/artists/send-booking/ics?bookingId=${quote.id}`;

  return {
    google: googleUrl,
    outlook: outlookUrl,
    yahoo: yahooUrl,
    ics: icsUrl,
  };
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
    // Calendar format expects UTC time
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

  // Add inspirations if available
  if (quote.booking.inspirations) {
    lines.push(``);
    lines.push(`Client Inspirations:`);
    
    if (quote.booking.inspirations.images && quote.booking.inspirations.images.length > 0) {
      lines.push(`Inspiration Images:`);
      quote.booking.inspirations.images.forEach((imageUrl, index) => {
        lines.push(`  ${index + 1}. ${imageUrl}`);
      });
    }
    
    if (quote.booking.inspirations.links && quote.booking.inspirations.links.length > 0) {
      lines.push(`Inspiration Links:`);
      quote.booking.inspirations.links.forEach((link, index) => {
        lines.push(`  ${index + 1}. ${link}`);
      });
    }
  }

  return lines.join('\n');
}

