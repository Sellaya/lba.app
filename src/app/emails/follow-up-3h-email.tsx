import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface FollowUp3HEmailProps {
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

const instructionBox = {
  background: 'hsl(0, 0%, 90%)',
  border: '1px solid hsl(0, 0%, 85%)',
  borderRadius: '12px',
  padding: '30px',
  textAlign: 'center' as const,
  margin: '30px 0',
};

const button = {
  backgroundColor: '#000000', // Use hex for better email client compatibility
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '18px 32px',
  display: 'block', // Changed from inline-block for better email client support
  width: '100%',
  maxWidth: '280px',
  margin: '0 auto',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
  border: 'none',
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

const FollowUp3HEmailTemplate: React.FC<Readonly<FollowUp3HEmailProps>> = ({ quote, baseUrl }) => {
  const quoteLink = `${baseUrl}/book/${quote.id}`;

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
          <p style={{...paragraph, color: '#6c757d', fontSize: '18px', marginBottom: 0}}>
            Just Checking In
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hi {quote.contact.name},
          </p>
          <p style={paragraph}>
            We wanted to gently remind you about your makeup quote. We know you're busy, but we'd love to help you secure your perfect look for your special day.
          </p>
          
          <div style={infoBox}>
            <p style={{...paragraph, marginBottom: '12px', fontWeight: 600, fontSize: '17px', textAlign: 'center'}}>
              Important Reminders
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', lineHeight: '1.8', color: 'hsl(240, 10%, 3.9%)' }}>
              <li>A 50% advance payment is required to secure your booking</li>
              <li>Your date is not reserved until payment is approved</li>
              <li>You can view both package options and complete your booking anytime</li>
            </ul>
          </div>
          
          <div style={instructionBox}>
            <p style={{ ...paragraph, marginTop: 0, marginBottom: '24px', color: 'hsl(240, 5.9%, 10%)', fontSize: '18px' }}>
              Ready to proceed?
            </p>
            <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
              <tr>
                <td style={{ textAlign: 'center' as const, padding: '0' }}>
                  <a href={quoteLink} target="_blank" rel="noopener noreferrer" style={button}>
                    View Your Quote & Complete Booking
                  </a>
                </td>
              </tr>
            </table>
            <p style={{ fontSize: '14px', color: '#777', marginTop: '16px', marginBottom: 0 }}>
              This link will take you directly to your personalized quote page.
            </p>
          </div>
        </div>
        
        <p style={{ ...paragraph, fontSize: '14px', color: '#6c757d', textAlign: 'center', marginBottom: 0, marginTop: '20px' }}>
          If you have any questions or need assistance, please reply directly to this email. We're here to help!
        </p>
        
        <div style={footer}>
          <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a></p>
        </div>
      </div>
    </div>
  );
};

export default FollowUp3HEmailTemplate;


