import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface FollowUp6HEmailProps {
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
  background: 'hsl(0, 60%, 98%)',
  border: '2px solid hsl(0, 0%, 0%)',
  borderRadius: '12px',
  padding: '24px',
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
  margin: '8px auto',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
  border: 'none',
};

const contactButton = {
  backgroundColor: '#25D366',
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
  margin: '8px auto',
  boxShadow: '0 4px 14px rgba(37, 211, 102, 0.25)',
  border: 'none',
};

const emailButton = {
  backgroundColor: '#212529', // Use hex instead of hsl for better email client compatibility
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
  margin: '8px auto',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
  border: 'none',
};

const footer = {
  padding: '30px 0 0 0',
  textAlign: 'center' as const,
  fontSize: '13px',
  color: '#999',
};

const FollowUp6HEmailTemplate: React.FC<Readonly<FollowUp6HEmailProps>> = ({ quote, baseUrl }) => {
  const quoteLink = `${baseUrl}/book/${quote.id}`;
  // WhatsApp number - update this with the actual WhatsApp business number
  // Format: country code + number without + or spaces (e.g., 14161234567 for US/Canada)
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '14161234567';
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=Hi%20Anum,%20I%20have%20questions%20about%20my%20booking%20${quote.id}`;
  const emailLink = `mailto:orders@looksbyanum.com?subject=Question%20about%20Booking%20${quote.id}`;

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
          <p style={{...paragraph, color: '#6c757d', fontSize: '18px', marginBottom: 0}}>
            Secure Your Spot – Spots Fill Up Fast!
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hi {quote.contact.name},
          </p>
          <p style={paragraph}>
            We wanted to reach out again because <strong>spots fill up quickly</strong>, especially during peak season. We'd hate for you to miss out on your preferred date and time!
          </p>
          
          <div style={urgencyBox}>
            <p style={{...paragraph, marginBottom: '12px', fontWeight: 700, fontSize: '20px', color: 'hsl(0, 84%, 60%)'}}>
              ⚠️ Don't Wait Too Long
            </p>
            <p style={{...paragraph, marginBottom: 0, fontSize: '15px'}}>
              Your date is not reserved until your 50% advance payment is approved. Popular dates get booked quickly, so we encourage you to secure your booking soon.
            </p>
          </div>
          
          <div style={instructionBox}>
            <p style={{ ...paragraph, marginTop: 0, marginBottom: '24px', color: 'hsl(240, 5.9%, 10%)', fontSize: '18px', fontWeight: 600 }}>
              Ready to secure your booking?
            </p>
            <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
              <tr>
                <td style={{ textAlign: 'center' as const, padding: '0' }}>
                  <a href={quoteLink} target="_blank" rel="noopener noreferrer" style={button}>
                    Complete Your Booking Now
                  </a>
                </td>
              </tr>
            </table>
          </div>

          <div style={{ padding: '24px', border: '1px solid hsl(0, 0%, 85%)', borderRadius: '12px', backgroundColor: '#ffffff', marginTop: '32px' }}>
            <p style={{...paragraph, textAlign: 'center', marginBottom: '16px', fontWeight: 600, fontSize: '18px'}}>
              Have Questions? Contact Anum Directly
            </p>
            <p style={{...paragraph, textAlign: 'center', marginBottom: '20px', fontSize: '15px'}}>
              If you have any questions or need guidance, feel free to reach out to Anum directly. She's here to help you make the best decision for your special day.
            </p>
            <div style={{ textAlign: 'center', marginTop: '24px', width: '100%' }}>
              <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
                <tr>
                  <td style={{ textAlign: 'center' as const, padding: '8px 0' }}>
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={contactButton}>
                      💬 WhatsApp Anum
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '8px auto 0', width: '100%', maxWidth: '280px' }}>
                <tr>
                  <td style={{ textAlign: 'center' as const, padding: '8px 0' }}>
                    <a href={emailLink} style={emailButton}>
                      ✉️ Email Anum
                    </a>
                  </td>
                </tr>
              </table>
            </div>
          </div>
        </div>
        
        <p style={{ ...paragraph, fontSize: '14px', color: '#6c757d', textAlign: 'center', marginBottom: 0, marginTop: '20px' }}>
          We look forward to helping you look and feel absolutely stunning!
        </p>
        
        <div style={footer}>
          <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a></p>
        </div>
      </div>
    </div>
  );
};

export default FollowUp6HEmailTemplate;

