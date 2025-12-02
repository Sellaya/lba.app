import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface EventReminder24HEmailProps {
  quote: FinalQuote;
  baseUrl: string;
}

// --- Inline CSS Styles using App's Theme Colors ---
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

const reminderBox = {
  backgroundColor: 'hsl(345, 60%, 98%)',
  border: '2px solid hsl(0, 0%, 0%)',
  borderRadius: '12px',
  padding: '30px',
  margin: '30px 0',
  textAlign: 'center' as const,
};

const infoBox = {
  backgroundColor: '#ffffff',
  border: '1px solid hsl(0, 0%, 85%)',
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '20px',
};

const infoTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: 'hsl(0, 0%, 0%)',
  margin: '0 0 16px 0',
  fontFamily: "'Belleza', sans-serif",
};

const infoDetail = {
  fontSize: '15px',
  color: 'hsl(240, 10%, 3.9%)',
  margin: '8px 0',
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

const checklistBox = {
  backgroundColor: 'hsl(345, 60%, 98%)',
  border: '1px solid hsl(0, 0%, 85%)',
  borderRadius: '12px',
  padding: '24px',
  marginTop: '24px',
};

const checklistItem = {
  fontSize: '15px',
  color: 'hsl(240, 10%, 3.9%)',
  margin: '12px 0',
  paddingLeft: '24px',
  lineHeight: '1.6',
  position: 'relative' as const,
};

const footer = {
  textAlign: 'center' as const,
  paddingTop: '30px',
  borderTop: '1px solid hsl(0, 0%, 85%)',
  marginTop: '30px',
  fontSize: '14px',
  color: '#6c757d',
};

const EventReminder24HEmailTemplate: React.FC<Readonly<EventReminder24HEmailProps>> = ({ quote, baseUrl }) => {
  // Validate booking days exist
  if (!quote.booking.days || quote.booking.days.length === 0 || !quote.booking.days[0]) {
    throw new Error('Booking has no service days');
  }
  
  const firstDay = quote.booking.days[0];
  const quoteLink = `${baseUrl}/book/${quote.id}`;

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
          <p style={{...paragraph, color: 'hsl(0, 0%, 0%)', fontSize: '22px', fontWeight: 600, marginBottom: 0}}>
            Your Event is Tomorrow! ✨
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hi {quote.contact.name},
          </p>
          
          <p style={paragraph}>
            We're so excited to be part of your special day tomorrow! This is just a friendly reminder to help you prepare for your makeup appointment.
          </p>

          <div style={reminderBox}>
            <p style={{...paragraph, fontSize: '20px', fontWeight: 700, color: 'hsl(0, 0%, 0%)', marginBottom: '12px'}}>
              📅 Your Appointment Details
            </p>
            <p style={{...paragraph, fontSize: '18px', marginBottom: '8px', fontWeight: 600}}>
              {firstDay.date}
            </p>
            <p style={{...paragraph, fontSize: '16px', marginBottom: 0}}>
              Arrival Time: <strong>{firstDay.getReadyTime}</strong>
            </p>
          </div>

          <div style={infoBox}>
            <p style={infoTitle}>Service Information</p>
            <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Service:</strong> {firstDay.serviceName}</p>
            <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Style:</strong> {firstDay.serviceOption}</p>
            <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Location:</strong> {firstDay.location}</p>
            {quote.booking.address && (
              <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Address:</strong> {quote.booking.address.street}, {quote.booking.address.city}, {quote.booking.address.province} {quote.booking.address.postalCode}</p>
            )}
          </div>

          {quote.booking.days.length > 1 && (
            <div style={infoBox}>
              <p style={infoTitle}>Additional Service Days</p>
              {quote.booking.days.slice(1).map((day, index) => (
                <div key={index} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: index < quote.booking.days.length - 2 ? '1px solid hsl(0, 0%, 85%)' : 'none' }}>
                  <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Day {index + 2}:</strong> {day.serviceName}</p>
                  <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Date:</strong> {day.date} at {day.getReadyTime}</p>
                  <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Location:</strong> {day.location}</p>
                </div>
              ))}
            </div>
          )}

          {quote.booking.trial && (() => {
            // Use trial's service option if available, otherwise default
            const trialServiceOption = quote.booking.trial?.serviceOption || 'makeup-hair';
            const trialServiceOptionLabel = trialServiceOption === 'makeup-hair' ? 'Makeup & Hair' : 
                                            trialServiceOption === 'makeup-only' ? 'Makeup Only' : 'Hair Only';
            return (
              <div style={infoBox}>
                <p style={infoTitle}>Bridal Trial</p>
                <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Date:</strong> {quote.booking.trial.date}</p>
                <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Time:</strong> {quote.booking.trial.time}</p>
                <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Service:</strong> {trialServiceOptionLabel}</p>
              </div>
            );
          })()}

          <div style={checklistBox}>
            <p style={{...paragraph, marginBottom: '16px', fontWeight: 600, fontSize: '17px', color: 'hsl(0, 0%, 0%)'}}>
              📋 Preparation Checklist
            </p>
            <p style={checklistItem}>
              <span style={{...bulletPoint, left: '4px'}}>✓</span>
              Get a good night's sleep for glowing skin tomorrow
            </p>
            <p style={checklistItem}>
              <span style={{...bulletPoint, left: '4px'}}>✓</span>
              Cleanse your face thoroughly before the appointment
            </p>
            <p style={checklistItem}>
              <span style={{...bulletPoint, left: '4px'}}>✓</span>
              Have your outfit ready and easily accessible
            </p>
            <p style={checklistItem}>
              <span style={{...bulletPoint, left: '4px'}}>✓</span>
              Ensure you have a well-lit area for the makeup application
            </p>
            <p style={checklistItem}>
              <span style={{...bulletPoint, left: '4px'}}>✓</span>
              Have any reference images or inspiration ready to share
            </p>
            <p style={checklistItem}>
              <span style={{...bulletPoint, left: '4px'}}>✓</span>
              Confirm the address and directions if it's a mobile service
            </p>
            <p style={checklistItem}>
              <span style={{...bulletPoint, left: '4px'}}>✓</span>
              Have your final payment ready if it's due on the day
            </p>
          </div>

          <div style={{...infoBox, backgroundColor: 'hsl(345, 60%, 98%)', border: '2px solid hsl(0, 0%, 0%)'}}>
            <p style={{...paragraph, marginBottom: '12px', fontWeight: 600, fontSize: '17px', color: 'hsl(0, 0%, 0%)', textAlign: 'center'}}>
              💬 Need to Make Changes?
            </p>
            <p style={{...paragraph, marginBottom: 0, fontSize: '15px', textAlign: 'center'}}>
              If you need to make any last-minute adjustments or have questions, please contact us as soon as possible. We're here to help make your day perfect!
            </p>
          </div>

          <p style={{...paragraph, fontSize: '15px', textAlign: 'center', marginTop: '30px', marginBottom: 0}}>
            We can't wait to see you tomorrow and help you look absolutely stunning! ✨
          </p>
        </div>
        
        <div style={footer}>
          <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a></p>
        </div>
      </div>
    </div>
  );
};

export default EventReminder24HEmailTemplate;





