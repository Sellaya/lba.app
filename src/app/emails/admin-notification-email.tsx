import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface AdminNotificationEmailProps {
  quote: FinalQuote;
  baseUrl: string;
}

// --- Inline CSS Styles ---
const main = {
  backgroundColor: '#f9f9f9',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
  padding: '20px',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px',
  width: '100%',
  maxWidth: '640px',
  borderRadius: '12px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
  border: '1px solid #eaeaea',
};

const header = {
  textAlign: 'center' as const,
  paddingBottom: '20px',
};

const heading = {
  fontSize: '36px',
  lineHeight: '1.2',
  fontWeight: 'bold',
  color: '#212529',
  margin: '0 0 12px 0',
  fontFamily: "'Belleza', sans-serif",
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.7',
  color: '#555',
  margin: '0 0 20px 0',
};

const section = {
  padding: '30px 0',
  borderBottom: '1px solid #eaeaea',
};

const instructionBox = {
    background: '#f8f9ff',
    border: '1px solid #e1e5fd',
    borderRadius: '12px',
    padding: '30px',
    textAlign: 'center' as const,
    margin: '30px 0',
};

const bookingIdLabel = {
    fontSize: '16px',
    color: '#2d3a7c',
    marginBottom: '8px',
};

const bookingIdText = {
    fontSize: '28px',
    fontWeight: 700,
    color: '#2c41c7',
    fontFamily: 'monospace',
    margin: '0 0 24px 0',
};

const button = {
  backgroundColor: '#4a69ff',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '16px 28px',
  display: 'block', // Changed from inline-block for better email client support
  width: '100%',
  maxWidth: '280px',
  margin: '0 auto',
  boxShadow: '0 4px 14px rgba(74, 105, 255, 0.25)',
  border: 'none',
};

const footer = {
  padding: '30px 0 0 0',
  textAlign: 'center' as const,
  fontSize: '12px',
  color: '#999',
};


const AdminNotificationEmailTemplate: React.FC<Readonly<AdminNotificationEmailProps>> = ({ quote, baseUrl }) => {
  // Determine if this is for final payment or advance payment
  const isFinalPayment = quote.paymentDetails?.finalPayment?.status === 'deposit-pending' && quote.paymentDetails?.finalPayment?.screenshotUrl;
  const paymentType = isFinalPayment ? 'Final Payment' : 'Advance Payment';
  
  return (
  <div style={main}>
    <div style={container}>
      <div style={header}>
        <h1 style={heading}>Admin Notification</h1>
        <p style={{...paragraph, color: '#6c757d', marginBottom: 0}}>Action Required: {paymentType} e-Transfer Submitted</p>
      </div>

      <div style={section}>
        <p style={paragraph}>
          Hi Admin,
        </p>
        <p style={paragraph}>
          A {paymentType.toLowerCase()} screenshot has been submitted by a client and requires your review and approval.
        </p>
        
        <div style={instructionBox}>
            <p style={bookingIdLabel}>Booking ID:</p>
            <p style={bookingIdText}>{quote.id}</p>
            <p style={{ ...paragraph, marginTop: 0, color: '#2d3a7c' }}>
              <strong>Client:</strong> {quote.contact.name}
            </p>
            <p style={{ ...paragraph, marginTop: 0, marginBottom: '24px', color: '#2d3a7c' }}>
              Please visit the admin dashboard to review the screenshot and approve the payment.
            </p>
            <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
              <tr>
                <td style={{ textAlign: 'center' as const, padding: '0' }}>
                  <a href={`${baseUrl}/admin`} target="_blank" rel="noopener noreferrer" style={button}>
                    Go to Admin Dashboard
                  </a>
                </td>
              </tr>
            </table>
        </div>
      </div>
      
      <p style={{ ...paragraph, fontSize: '14px', color: '#6c757d', textAlign: 'center', marginBottom: 0 }}>
        {isFinalPayment 
          ? 'Once you approve the final payment, the booking will be marked as fully paid.'
          : 'Once you approve the payment, the client will automatically receive their confirmation email.'}
      </p>
      
      <div style={footer}>
        <p>This is an automated notification from the Looks by Anum booking system.</p>
        <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a></p>
      </div>
    </div>
  </div>
  );
};

export default AdminNotificationEmailTemplate;
