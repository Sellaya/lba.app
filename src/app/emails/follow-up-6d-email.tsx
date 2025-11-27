import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface FollowUp6DEmailProps {
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

const offerBox = {
  background: 'linear-gradient(135deg, hsl(0, 0%, 0%) 0%, hsl(0, 0%, 20%) 100%)',
  border: '3px solid hsl(0, 0%, 0%)',
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
  backgroundColor: '#000000', // Use hex for better email client compatibility
  borderRadius: '8px',
  color: '#ffffff', // Fixed: should be white text on black background
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
  border: 'none',
};

const footer = {
  padding: '30px 0 0 0',
  textAlign: 'center' as const,
  fontSize: '13px',
  color: '#999',
};

const countdownBox = {
  padding: '20px',
  border: '2px dashed #ffffff',
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  marginBottom: '20px',
  textAlign: 'center' as const,
};

const infoBox = {
  padding: '20px',
  border: '1px solid hsl(0, 0%, 85%)',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  marginBottom: '20px',
};

const FollowUp6DEmailTemplate: React.FC<Readonly<FollowUp6DEmailProps>> = ({ quote, baseUrl }) => {
  const quoteLink = `${baseUrl}/book/${quote.id}`;

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
          <p style={{...paragraph, color: '#6c757d', fontSize: '18px', marginBottom: 0}}>
            Special Offer: 5% Off Your Booking
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hi {quote.contact.name},
          </p>
          <p style={paragraph}>
            We wanted to reach out one more time with a special offer. We know that choosing the right makeup artist is an important decision, and we'd love to make it easier for you to say yes.
          </p>
          
          <div style={offerBox}>
            <p style={{...paragraph, marginBottom: '12px', fontWeight: 700, fontSize: '28px', color: '#ffffff'}}>
              🎉 Exclusive Offer: 5% Off Your Total
            </p>
            <p style={{...paragraph, marginBottom: '20px', fontSize: '18px', color: '#ffffff'}}>
              Book within the next 48 hours and receive 5% off your total booking amount!
            </p>
            <div style={countdownBox}>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
                ⏰ Limited-Time Offer – Valid for 48 Hours Only
              </p>
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'hsl(345, 60%, 98%)', border: '1px solid hsl(0, 0%, 85%)', borderRadius: '8px', margin: '20px 0' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'hsl(240, 10%, 3.9%)', fontStyle: 'italic', textAlign: 'center' }}>
              <strong>Note:</strong> The 5% discount will be automatically applied to your final quote when you complete your booking within 48 hours.
            </p>
          </div>

          <div style={infoBox}>
            <p style={{...paragraph, marginBottom: '12px', fontWeight: 600, fontSize: '17px', textAlign: 'center'}}>
              What You'll Get
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', lineHeight: '1.8', color: 'hsl(240, 10%, 3.9%)' }}>
              <li>5% discount on your total booking amount</li>
              <li>Same exceptional service and professional team</li>
              <li>Secure your preferred date and time</li>
              <li>50% advance payment still required to lock in your booking</li>
            </ul>
          </div>
          
          <div style={instructionBox}>
            <p style={{ ...paragraph, marginTop: 0, marginBottom: '24px', color: 'hsl(240, 5.9%, 10%)', fontSize: '18px', fontWeight: 600 }}>
              Don't miss out on this exclusive offer!
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
            <p style={{ fontSize: '13px', color: '#999', marginTop: '16px', marginBottom: 0 }}>
              This offer is valid for the next 48 hours only. Book now to take advantage of this special discount!
            </p>
          </div>

          <p style={paragraph}>
            We're committed to making your special day perfect, and this offer is our way of showing how much we value your business. Don't let this opportunity pass you by.
          </p>

          <p style={paragraph}>
            If you have any questions about this offer or your booking, please reply to this email. We're here to help!
          </p>
        </div>
        
        <p style={{ ...paragraph, fontSize: '14px', color: '#6c757d', textAlign: 'center', marginBottom: 0, marginTop: '20px' }}>
          This is a limited-time offer. Act now to secure your discount!
        </p>
        
        <div style={footer}>
          <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a></p>
        </div>
      </div>
    </div>
  );
};

export default FollowUp6DEmailTemplate;


