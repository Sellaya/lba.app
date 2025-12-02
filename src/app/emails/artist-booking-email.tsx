import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface ArtistBookingEmailProps {
  quote: FinalQuote;
  artistName: string;
  baseUrl: string;
  calendarLinks?: {
    google: string;
    outlook: string;
    yahoo: string;
    ics: string;
  };
}

// --- Inline CSS Styles using the App's Theme Colors ---
const main = {
  backgroundColor: 'hsl(345, 60%, 98%)',
  fontFamily: "'Alegreya', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  padding: '20px',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px',
  width: '100%',
  maxWidth: '680px',
  borderRadius: '12px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  border: '1px solid hsl(0, 0%, 85%)',
};

const header = {
  textAlign: 'center' as const,
  paddingBottom: '30px',
  borderBottom: '2px solid hsl(0, 0%, 85%)',
};

const heading = {
  fontSize: '42px',
  lineHeight: '1.2',
  fontWeight: 'bold',
  color: 'hsl(0, 0%, 0%)',
  margin: '0 0 16px 0',
  fontFamily: "'Belleza', sans-serif",
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.8',
  color: 'hsl(240, 10%, 3.9%)',
  margin: '0 0 24px 0',
};

const section = {
  padding: '30px 0',
};

const highlightBox = {
  backgroundColor: 'hsl(345, 60%, 98%)',
  border: '2px solid hsl(0, 0%, 0%)',
  borderRadius: '12px',
  padding: '30px',
  margin: '30px 0',
  textAlign: 'center' as const,
};

const bookingCard = {
  padding: '24px',
  border: '1px solid hsl(0, 0%, 85%)',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  marginBottom: '20px',
};

const bookingTitle = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: 'hsl(0, 0%, 0%)',
  margin: '0 0 4px 0',
  fontFamily: "'Belleza', sans-serif",
};

const bookingSubtitle = {
  fontSize: '16px',
  color: '#777',
  margin: '0 0 16px 0',
};

const bookingDetail = {
  fontSize: '15px',
  color: 'hsl(240, 10%, 3.9%)',
  margin: '12px 0 0 0',
  paddingLeft: '20px',
  position: 'relative' as const,
};

const bulletPoint = {
  position: 'absolute' as const,
  left: '0px',
  top: '2px',
  color: 'hsl(0, 0%, 0%)',
  fontSize: '12px',
};

const footer = {
  textAlign: 'center' as const,
  paddingTop: '30px',
  borderTop: '1px solid hsl(0, 0%, 85%)',
  marginTop: '30px',
  fontSize: '14px',
  color: '#6c757d',
};

const buttonStyle = {
  display: 'block', // Changed from inline-block for better email client support
  padding: '12px 24px',
  backgroundColor: '#000000', // Use hex for better email client compatibility
  color: '#ffffff',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: '600',
  fontSize: '15px',
  margin: '8px auto',
  width: '100%',
  maxWidth: '280px',
  textAlign: 'center' as const,
  border: 'none',
};

const calendarButtonContainer = {
  textAlign: 'center' as const,
  margin: '30px 0',
  padding: '24px',
  backgroundColor: 'hsl(345, 60%, 98%)',
  borderRadius: '12px',
  border: '1px solid hsl(0, 0%, 85%)',
};

const ArtistBookingEmailTemplate: React.FC<Readonly<ArtistBookingEmailProps>> = ({ quote, artistName, baseUrl, calendarLinks }) => {
  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
          <p style={{...paragraph, color: 'hsl(0, 0%, 0%)', fontSize: '20px', fontWeight: 600, marginBottom: 0}}>
            New Booking Assignment 🎨
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hi {artistName},
          </p>
          
          <p style={paragraph}>
            You have been assigned a new booking! Please review the service details below.
          </p>

          <div style={highlightBox}>
            <p style={{...paragraph, fontSize: '18px', fontWeight: 600, color: 'hsl(0, 0%, 0%)', marginBottom: '12px'}}>
              Booking Information
            </p>
            <p style={{...paragraph, marginBottom: 0, fontSize: '15px'}}>
              Booking ID: <strong>{quote.id}</strong>
            </p>
            <p style={{...paragraph, marginBottom: 0, fontSize: '15px'}}>
              Customer: <strong>{quote.contact.name}</strong>
            </p>
          </div>
        </div>

        <div style={{ ...section, paddingTop: 0 }}>
          <h2 style={{...bookingTitle, fontSize: '24px', textAlign: 'center' as const, marginBottom: '24px'}}>Service Details</h2>
          
          {quote.booking.days.map((day, index) => (
            <div key={index} style={bookingCard}>
              <p style={bookingTitle}>Day {index + 1}: {day.serviceName}</p>
              <p style={bookingSubtitle}>{day.date} at {day.getReadyTime}</p>
              <hr style={{ border: 'none', borderTop: '1px solid hsl(0, 0%, 88%)', margin: '16px 0' }} />
              <p style={bookingDetail}><span style={bulletPoint}>&#9679;</span> Style: {day.serviceOption}</p>
              <p style={bookingDetail}><span style={bulletPoint}>&#9679;</span> Location: {day.location}</p>
              {day.addOns.length > 0 && 
                <div style={{ ...bookingDetail, marginTop: '16px' }}>
                  <p style={{ margin: 0, fontWeight: 'bold', color: 'hsl(240, 10%, 3.9%)' }}>Add-ons:</p>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', listStyleType: "'— '" }}>
                    {day.addOns.map((addon, i) => <li key={i} style={{ marginBottom: '4px' }}>{addon}</li>)}
                  </ul>
                </div>
              }
            </div>
          ))}

          {quote.booking.trial && (() => {
            // Use trial's service option if available, otherwise default
            const trialServiceOption = quote.booking.trial?.serviceOption || 'makeup-hair';
            const trialServiceOptionLabel = trialServiceOption === 'makeup-hair' ? 'Makeup & Hair' : 
                                            trialServiceOption === 'makeup-only' ? 'Makeup Only' : 'Hair Only';
            return (
              <div style={bookingCard}>
                <p style={bookingTitle}>Bridal Trial</p>
                <p style={bookingSubtitle}>{quote.booking.trial.date} at {quote.booking.trial.time}</p>
                <p style={{...bookingSubtitle, fontSize: '13px', marginTop: '4px', color: '#666'}}>Service: {trialServiceOptionLabel}</p>
              </div>
            );
          })()}

          {quote.booking.bridalParty && quote.booking.bridalParty.services.length > 0 && (
            <div style={bookingCard}>
              <p style={bookingTitle}>Bridal Party Services</p>
              <hr style={{ border: 'none', borderTop: '1px solid hsl(0, 0%, 88%)', margin: '16px 0' }} />
              {quote.booking.bridalParty.services.map((partySvc, i) => (
                <p key={i} style={bookingDetail}><span style={bulletPoint}>&#9679;</span> {partySvc.service} (x{partySvc.quantity})</p>
              ))}
              {quote.booking.bridalParty.airbrush > 0 && (
                <p style={bookingDetail}><span style={bulletPoint}>&#9679;</span> Airbrush Service (x{quote.booking.bridalParty.airbrush})</p>
              )}
            </div>
          )}

          {quote.booking.address && (
            <div style={bookingCard}>
              <p style={bookingTitle}>Service Address</p>
              <hr style={{ border: 'none', borderTop: '1px solid hsl(0, 0%, 88%)', margin: '16px 0' }} />
              <p style={{...paragraph, margin: 0, fontStyle: 'italic' }}>
                {quote.booking.address.street},<br/>
                {quote.booking.address.city}, {quote.booking.address.province}, {quote.booking.address.postalCode}
              </p>
            </div>
          )}

          {quote.booking.inspirations && ((quote.booking.inspirations.images?.length ?? 0) > 0 || (quote.booking.inspirations.links?.length ?? 0) > 0) && (
            <div style={bookingCard}>
              <p style={bookingTitle}>Client Inspirations</p>
              <hr style={{ border: 'none', borderTop: '1px solid hsl(0, 0%, 88%)', margin: '16px 0' }} />
              
              {quote.booking.inspirations.images && quote.booking.inspirations.images.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{...paragraph, marginBottom: '12px', fontWeight: 600, fontSize: '15px'}}>
                    Inspiration Images:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {quote.booking.inspirations.images.map((imageUrl, index) => (
                      <a
                        key={index}
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'block' }}
                      >
                        <img
                          src={imageUrl}
                          alt={`Inspiration ${index + 1}`}
                          style={{
                            width: '150px',
                            height: '150px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '2px solid hsl(0, 0%, 85%)',
                            cursor: 'pointer',
                          }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              
              {quote.booking.inspirations.links && quote.booking.inspirations.links.length > 0 && (
                <div>
                  <p style={{...paragraph, marginBottom: '12px', fontWeight: 600, fontSize: '15px'}}>
                    Inspiration Links:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '24px', listStyleType: 'disc' }}>
                    {quote.booking.inspirations.links.map((link, index) => (
                      <li key={index} style={{ marginBottom: '8px', fontSize: '15px', lineHeight: '1.6' }}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: 'hsl(0, 0%, 0%)',
                            textDecoration: 'underline',
                          }}
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ ...section, paddingTop: 0 }}>
          <h2 style={{...bookingTitle, fontSize: '24px', textAlign: 'center' as const, marginBottom: '24px'}}>Customer Contact Information</h2>
          <div style={bookingCard}>
            <p style={bookingDetail}><span style={bulletPoint}>&#9679;</span> Name: <strong>{quote.contact.name}</strong></p>
            <p style={bookingDetail}><span style={bulletPoint}>&#9679;</span> Email: <strong>{quote.contact.email}</strong></p>
            {quote.contact.phone && (
              <p style={bookingDetail}><span style={bulletPoint}>&#9679;</span> Phone: <strong>{quote.contact.phone}</strong></p>
            )}
          </div>
        </div>

        {/* Add to Calendar Section */}
        {calendarLinks && (
          <div style={calendarButtonContainer}>
            <h3 style={{...bookingTitle, fontSize: '20px', textAlign: 'center' as const, marginBottom: '12px'}}>
              📅 Add to Calendar
            </h3>
            <p style={{...paragraph, fontSize: '14px', marginBottom: '20px', textAlign: 'center' as const, color: '#666'}}>
              Click one of the buttons below to add this booking to your calendar:
            </p>
            <div style={{ textAlign: 'center' as const, width: '100%' }}>
              <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '8px auto', width: '100%', maxWidth: '280px' }}>
                <tr>
                  <td style={{ textAlign: 'center' as const, padding: '8px 0' }}>
                    <a href={calendarLinks.google} target="_blank" rel="noopener noreferrer" style={buttonStyle}>
                      📅 Google Calendar
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '8px auto', width: '100%', maxWidth: '280px' }}>
                <tr>
                  <td style={{ textAlign: 'center' as const, padding: '8px 0' }}>
                    <a href={calendarLinks.outlook} target="_blank" rel="noopener noreferrer" style={buttonStyle}>
                      📅 Outlook Calendar
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '8px auto', width: '100%', maxWidth: '280px' }}>
                <tr>
                  <td style={{ textAlign: 'center' as const, padding: '8px 0' }}>
                    <a href={calendarLinks.yahoo} target="_blank" rel="noopener noreferrer" style={buttonStyle}>
                      📅 Yahoo Calendar
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '8px auto', width: '100%', maxWidth: '280px' }}>
                <tr>
                  <td style={{ textAlign: 'center' as const, padding: '8px 0' }}>
                    <a href={calendarLinks.ics} style={{...buttonStyle, backgroundColor: '#6c757d'}}>
                      📥 Download .ics File
                    </a>
                  </td>
                </tr>
              </table>
            </div>
          </div>
        )}
        
        <div style={{...section, paddingTop: 0, paddingBottom: 0}}>
          <div style={{...bookingCard, backgroundColor: 'hsl(345, 60%, 98%)', border: '1px solid hsl(0, 0%, 85%)'}}>
            <p style={{...paragraph, fontSize: '15px', marginBottom: '12px', fontWeight: 600, color: 'hsl(0, 0%, 0%)'}}>
              Important Reminders:
            </p>
            <ul style={{ margin: 0, paddingLeft: '24px', color: 'hsl(240, 10%, 3.9%)' }}>
              <li style={{ marginBottom: '8px', fontSize: '15px', lineHeight: '1.6' }}>
                Please ensure you have all necessary supplies and arrive on time
              </li>
              <li style={{ marginBottom: '8px', fontSize: '15px', lineHeight: '1.6' }}>
                Review all service details and customer preferences before the appointment
              </li>
              <li style={{ marginBottom: '8px', fontSize: '15px', lineHeight: '1.6' }}>
                If you have any questions or concerns, please contact the admin immediately
              </li>
            </ul>
          </div>
        </div>
        
        <div style={footer}>
          <p style={{margin: '8px 0'}}>
            © 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ArtistBookingEmailTemplate;

