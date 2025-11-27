import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface RejectionEmailProps {
  quote: FinalQuote;
  baseUrl: string;
  isFinalPayment?: boolean;
}

// --- Inline CSS Styles using App's Theme Colors ---
const main = {
  backgroundColor: 'hsl(345, 60%, 98%)', // --background
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
  border: '1px solid hsl(0, 0%, 85%)', // --border
};

const header = {
  textAlign: 'center' as const,
  paddingBottom: '20px',
  borderBottom: '1px solid hsl(0, 0%, 85%)', // --border
};

const heading = {
  fontSize: '42px',
  lineHeight: '1.2',
  fontWeight: 'bold',
  color: 'hsl(0, 0%, 0%)', // Deep Purple-Pink from --primary
  margin: '0 0 12px 0',
  fontFamily: "'Belleza', sans-serif",
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.7',
  color: 'hsl(240, 10%, 3.9%)', // --foreground
  margin: '0 0 24px 0',
};

const section = {
  padding: '30px 0',
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
  marginTop: '40px',
  paddingTop: '20px',
  borderTop: '1px solid hsl(0, 0%, 85%)', // --border
  textAlign: 'center' as const,
  fontSize: '14px',
  color: '#777',
};

export default function RejectionEmail({ quote, baseUrl, isFinalPayment = false }: RejectionEmailProps) {
  const bookingUrl = `${baseUrl}/book/${quote.id}`;
  const paymentType = isFinalPayment ? 'final payment' : 'advance payment';

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>{isFinalPayment ? 'Final ' : ''}Payment Screenshot Rejected</h1>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hello {quote.contact.name},
          </p>
          
          <p style={paragraph}>
            Your {paymentType} screenshot for booking #{quote.id} could not be verified. Please upload a correct screenshot to proceed with your booking.
          </p>

          <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
            <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
              <tr>
                <td style={{ textAlign: 'center' as const, padding: '0' }}>
                  <a href={bookingUrl} style={button}>
                    Re-upload Screenshot
                  </a>
                </td>
              </tr>
            </table>
            <p style={{ fontSize: '13px', color: '#999', marginTop: '16px', marginBottom: 0 }}>
              This link will show your real-time booking status and allow you to upload a new screenshot.
            </p>
          </div>
          
          <div style={{ padding: '24px', border: '1px solid hsl(0, 0%, 85%)', borderRadius: '12px', backgroundColor: 'hsl(345, 60%, 98%)', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'hsl(240, 10%, 3.9%)', marginBottom: '12px', textAlign: 'center' as const }}>
              Payment Instructions
            </h3>
            <p style={{...paragraph, fontSize: '14px', marginBottom: '12px'}}>
              To complete your booking, please:
            </p>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
              <li>Send {isFinalPayment ? 'the remaining 50% final payment' : 'a 50% advance payment'} via Interac e-Transfer to <strong>info@looksbyanum.com</strong></li>
              <li>Write your booking ID (<strong>{quote.id}</strong>) in the message for your booking reference</li>
              <li>Take a clear screenshot of the confirmation page</li>
              <li>Upload the screenshot using the link above</li>
            </ol>
            {!isFinalPayment && (
              <p style={{...paragraph, fontSize: '13px', marginTop: '16px', marginBottom: 0, color: '#777', textAlign: 'center' as const}}>
                The remaining 50% balance will be due on the day of your booking.
              </p>
            )}
          </div>

          <p style={paragraph}>
            If you have any questions, please don't hesitate to contact us.
          </p>
        </div>

        <div style={footer}>
          <p>Best regards,<br />Looks by Anum</p>
        </div>

        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid hsl(0, 0%, 85%)', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'hsl(240, 5%, 50%)', margin: 0, lineHeight: '1.5' }}>
            © 2025 Looks by Anum | Product by{' '}
            <a 
              href="https://www.instagram.com/sellayadigital" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: 'hsl(0, 0%, 0%)', 
                textDecoration: 'none',
                fontWeight: '500',
              }}
            >
              Sellaya
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
