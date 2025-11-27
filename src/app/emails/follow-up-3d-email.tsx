import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface FollowUp3DEmailProps {
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
  paddingBottom: '20px',
  borderBottom: '1px solid hsl(0, 0%, 85%)',
};

const heading = {
  fontSize: '42px',
  lineHeight: '1.2',
  fontWeight: 'bold',
  color: 'hsl(0, 0%, 0%)',
  margin: '0 0 12px 0',
  fontFamily: "'Belleza', sans-serif",
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.7',
  color: 'hsl(240, 10%, 3.9%)',
  margin: '0 0 24px 0',
};

const section = {
  padding: '30px 0',
};

const urgencyBox = {
  background: 'linear-gradient(135deg, hsl(0, 0%, 0%) 0%, hsl(0, 0%, 20%) 100%)',
  border: '2px solid hsl(0, 0%, 0%)',
  borderRadius: '12px',
  padding: '32px',
  textAlign: 'center' as const,
  margin: '30px 0',
  color: '#ffffff',
};

const instructionBox = {
  background: 'hsl(0, 0%, 90%)',
  border: '1px solid hsl(0, 0%, 85%)',
  borderRadius: '12px',
  padding: '30px',
  textAlign: 'center' as const,
  margin: '30px 0',
};

const button = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  color: '#000000', // Use hex for better email client compatibility
  fontSize: '18px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '18px 32px',
  display: 'block', // Changed from inline-block for better email client support
  width: '100%',
  maxWidth: '280px',
  margin: '0 auto',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
  border: '2px solid #000000',
};

const footer = {
  padding: '30px 0 0 0',
  textAlign: 'center' as const,
  fontSize: '13px',
  color: '#999',
};

const infoBox = {
  padding: '20px',
  border: '1px solid hsl(0, 0%, 85%)',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  marginBottom: '20px',
};

const FollowUp3DEmailTemplate: React.FC<Readonly<FollowUp3DEmailProps>> = ({ quote, baseUrl }) => {
  const quoteLink = `${baseUrl}/book/${quote.id}`;

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
          <p style={{...paragraph, color: '#6c757d', fontSize: '18px', marginBottom: 0}}>
            Don't Miss Out on Your Perfect Look
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hi {quote.contact.name},
          </p>
          <p style={paragraph}>
            We wanted to reach out again because we know how important it is to secure your preferred date and time. Our calendar fills up quickly, especially for special occasions, and we'd hate for you to miss out on the perfect look for your event.
          </p>
          
          <div style={urgencyBox}>
            <p style={{...paragraph, marginBottom: '12px', fontWeight: 700, fontSize: '24px', color: '#ffffff'}}>
              ⚡ Secure Your Spot Today
            </p>
            <p style={{...paragraph, marginBottom: '20px', fontSize: '16px', color: '#ffffff'}}>
              Dates are booking fast, and we want to ensure you get the time slot that works best for you. Don't wait until it's too late!
            </p>
          </div>

          <div style={infoBox}>
            <p style={{...paragraph, marginBottom: '12px', fontWeight: 600, fontSize: '17px', textAlign: 'center'}}>
              Why Book Now?
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', lineHeight: '1.8', color: 'hsl(240, 10%, 3.9%)' }}>
              <li>Secure your preferred date and time before it's taken</li>
              <li>Lock in your booking with just a 50% advance payment</li>
              <li>Peace of mind knowing your special day is covered</li>
              <li>Professional service from our experienced team</li>
            </ul>
          </div>
          
          <div style={instructionBox}>
            <p style={{ ...paragraph, marginTop: 0, marginBottom: '24px', color: 'hsl(240, 5.9%, 10%)', fontSize: '18px', fontWeight: 600 }}>
              Complete Your Booking Now
            </p>
            <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
              <tr>
                <td style={{ textAlign: 'center' as const, padding: '0' }}>
                  <a href={quoteLink} target="_blank" rel="noopener noreferrer" style={button}>
                    View Your Quote & Book Now
                  </a>
                </td>
              </tr>
            </table>
            <p style={{ fontSize: '14px', color: '#777', marginTop: '16px', marginBottom: 0 }}>
              Your personalized quote is ready. Complete your booking in just a few clicks.
            </p>
          </div>

          <p style={paragraph}>
            We understand that planning an event involves many moving parts. That's why we've made the booking process as simple as possible. With just a few minutes, you can secure your spot and cross one important item off your to-do list.
          </p>

          <p style={paragraph}>
            If you have any questions or concerns, please reply to this email. We're here to help make this process as smooth as possible for you.
          </p>
        </div>
        
        <p style={{ ...paragraph, fontSize: '14px', color: '#6c757d', textAlign: 'center', marginBottom: 0, marginTop: '20px' }}>
          We're excited to help you look and feel your best!
        </p>
        
        <div style={footer}>
          <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a></p>
        </div>
      </div>
    </div>
  );
};

export default FollowUp3DEmailTemplate;


