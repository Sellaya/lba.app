import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface FollowUp24HEmailProps {
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
  border: '1px solid hsl(345, 20%, 90%)',
};

const header = {
  textAlign: 'center' as const,
  paddingBottom: '20px',
  borderBottom: '1px solid hsl(345, 20%, 90%)',
};

const heading = {
  fontSize: '42px',
  lineHeight: '1.2',
  fontWeight: 'bold',
  color: 'hsl(345, 80%, 50%)',
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
  background: 'linear-gradient(135deg, hsl(345, 80%, 50%) 0%, hsl(345, 70%, 60%) 100%)',
  border: '3px solid hsl(345, 80%, 50%)',
  borderRadius: '12px',
  padding: '32px',
  textAlign: 'center' as const,
  margin: '30px 0',
  color: '#ffffff',
};

const instructionBox = {
  background: 'hsl(345, 60%, 94%)',
  border: '1px solid hsl(345, 20%, 90%)',
  borderRadius: '12px',
  padding: '30px',
  textAlign: 'center' as const,
  margin: '30px 0',
};

const button = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  color: 'hsl(345, 80%, 50%)',
  fontSize: '18px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '18px 32px',
  display: 'inline-block',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
};

const countdownBox = {
  padding: '20px',
  border: '2px dashed hsl(345, 80%, 50%)',
  borderRadius: '12px',
  backgroundColor: 'hsl(345, 60%, 98%)',
  marginBottom: '20px',
  textAlign: 'center' as const,
};

const footer = {
  padding: '30px 0 0 0',
  textAlign: 'center' as const,
  fontSize: '13px',
  color: '#999',
};

const FollowUp24HEmailTemplate: React.FC<Readonly<FollowUp24HEmailProps>> = ({ quote, baseUrl }) => {
  const quoteLink = `${baseUrl}/book/${quote.id}`;
  const hasMobileService = quote.booking.days.some(d => d.serviceType === 'mobile');

  // Only show this email for mobile bookings
  if (!hasMobileService) {
    return null;
  }

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
          <p style={{...paragraph, color: '#6c757d', fontSize: '18px', marginBottom: 0}}>
            Limited-Time Offer: Travel Fee Waived!
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hi {quote.contact.name},
          </p>
          <p style={paragraph}>
            We have a special offer for you! Since you're considering a mobile makeup service, we want to make it even easier for you to book with us.
          </p>
          
          <div style={offerBox}>
            <p style={{...paragraph, marginBottom: '12px', fontWeight: 700, fontSize: '28px', color: '#ffffff'}}>
              🎉 Special Offer: Travel Fee Waived!
            </p>
            <p style={{...paragraph, marginBottom: '20px', fontSize: '18px', color: '#ffffff'}}>
              If you book within the next 24 hours, your travel fee will be completely waived!
            </p>
            <div style={countdownBox}>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'hsl(345, 80%, 50%)' }}>
                ⏰ Limited-Time Offer – Expires in 24 Hours
              </p>
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'hsl(345, 60%, 98%)', border: '1px solid hsl(345, 20%, 90%)', borderRadius: '8px', margin: '20px 0' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'hsl(240, 10%, 3.9%)', fontStyle: 'italic', textAlign: 'center' }}>
              <strong>Note:</strong> Travel fee will be adjusted in your final payment.
            </p>
          </div>
          
          <div style={instructionBox}>
            <p style={{ ...paragraph, marginTop: 0, marginBottom: '24px', color: 'hsl(240, 5.9%, 10%)', fontSize: '18px', fontWeight: 600 }}>
              Don't miss out on this exclusive offer!
            </p>
            <a href={quoteLink} target="_blank" rel="noopener noreferrer" style={button}>
              Book Now & Save on Travel Fee
            </a>
            <p style={{ fontSize: '13px', color: '#999', marginTop: '16px', marginBottom: 0 }}>
              This offer is valid for the next 24 hours only. Book now to take advantage of this special discount!
            </p>
          </div>

          <div style={{ padding: '20px', border: '1px solid hsl(345, 20%, 90%)', borderRadius: '12px', backgroundColor: '#ffffff', marginTop: '24px' }}>
            <p style={{...paragraph, marginBottom: '12px', fontWeight: 600, fontSize: '17px', textAlign: 'center'}}>
              What You'll Save
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', lineHeight: '1.8', color: 'hsl(240, 10%, 3.9%)' }}>
              <li>Complete travel fee waiver (savings vary by location)</li>
              <li>Same high-quality service and professional team</li>
              <li>Secure your preferred date and time</li>
              <li>50% advance payment still required to lock in your booking</li>
            </ul>
          </div>
        </div>
        
        <p style={{ ...paragraph, fontSize: '14px', color: '#6c757d', textAlign: 'center', marginBottom: 0, marginTop: '20px' }}>
          This is a limited-time offer. Book within 24 hours to take advantage of the travel fee waiver!
        </p>
        
        <div style={footer}>
          <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(345, 80%, 50%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a>.</p>
        </div>
      </div>
    </div>
  );
};

export default FollowUp24HEmailTemplate;


