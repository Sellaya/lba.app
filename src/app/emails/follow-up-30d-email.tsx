import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface FollowUp30DEmailProps {
  quote: FinalQuote;
  baseUrl: string;
}

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

const finalOfferBox = {
  background: 'linear-gradient(135deg, hsl(0, 0%, 0%) 0%, hsl(0, 0%, 20%) 100%)',
  border: '2px solid hsl(0, 0%, 0%)',
  borderRadius: '12px',
  padding: '32px',
  textAlign: 'center' as const,
  margin: '30px 0',
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

const FollowUp30DEmailTemplate: React.FC<Readonly<FollowUp30DEmailProps>> = ({ quote, baseUrl }) => {
  const quoteLink = `${baseUrl}/book/${quote.id}`;

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
          <p style={{...paragraph, color: '#6c757d', fontSize: '18px', marginBottom: 0}}>
            Final Opportunity to Book Your Perfect Look
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hi {quote.contact.name},
          </p>
          <p style={paragraph}>
            We wanted to reach out one final time regarding your quote. We understand that planning for special events takes time, and we want to make sure you have every opportunity to secure your booking with Looks by Anum.
          </p>

          <div style={finalOfferBox}>
            <p style={{...paragraph, marginBottom: '12px', fontWeight: 700, fontSize: '28px', color: '#ffffff'}}>
              🎯 Last Chance to Book
            </p>
            <p style={{...paragraph, marginBottom: '20px', fontSize: '18px', color: '#ffffff'}}>
              This is your final opportunity to secure your booking. Your quote is still available, but we encourage you to act soon as our calendar continues to fill up.
            </p>
            <div style={{ padding: '15px', border: '2px dashed #ffffff', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.1)', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
                ⏰ Don't Miss Out on Your Perfect Look!
              </p>
            </div>
          </div>

          <div style={instructionBox}>
            <p style={{ ...paragraph, marginTop: 0, marginBottom: '24px', color: 'hsl(240, 5.9%, 10%)', fontSize: '18px', fontWeight: 600 }}>
              Ready to complete your booking?
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
              This link will take you directly to your personalized quote page where you can complete your booking.
            </p>
          </div>

          <p style={{ ...paragraph, fontSize: '14px', color: '#6c757d', textAlign: 'center', marginBottom: 0, marginTop: '20px' }}>
            If you have any questions or need assistance, please reply directly to this email. We're here to help make your special day perfect!
          </p>
        </div>

        <div style={footer}>
          <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a></p>
        </div>
      </div>
    </div>
  );
};

export default FollowUp30DEmailTemplate;

