import React from 'react';

interface BookCallAdminEmailProps {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  whatsappNumber: string;
  preferredDate: string;
  preferredTime: string;
  message: string;
  bookingId: string;
  quoteLink: string;
}

// --- Inline CSS Styles using the App's Theme Colors ---
const main = {
  backgroundColor: 'hsl(345, 60%, 98%)', // Light Gray/Off-white from --background
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

const sectionTitle = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: 'hsl(240, 10%, 3.9%)', // --foreground
  marginBottom: '24px',
  fontFamily: "'Belleza', sans-serif",
  textAlign: 'center' as const,
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

const infoCard = {
  padding: '24px',
  border: '1px solid hsl(0, 0%, 85%)', // --border
  borderRadius: '12px',
  backgroundColor: 'hsl(345, 60%, 98%)', // --background
  marginBottom: '20px',
};

const infoTitle = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: 'hsl(0, 0%, 0%)', // --primary
  margin: '0 0 16px 0',
  fontFamily: "'Belleza', sans-serif",
};

const infoRow = {
  padding: '8px 0',
  borderBottom: '1px solid hsl(0, 0%, 85%)',
};

const infoLabel = {
  fontSize: '14px',
  color: 'hsl(240, 5%, 50%)', // muted-foreground
  fontWeight: '600',
  display: 'inline-block',
  width: '140px',
};

const infoValue = {
  fontSize: '15px',
  color: 'hsl(240, 10%, 3.9%)', // --foreground
  fontWeight: '500',
};

const messageBox = {
  padding: '20px',
  backgroundColor: '#ffffff',
  border: '2px solid hsl(0, 0%, 0%)',
  borderRadius: '8px',
  marginTop: '16px',
};

const messageText = {
  fontSize: '15px',
  lineHeight: '1.7',
  color: 'hsl(240, 10%, 3.9%)',
  whiteSpace: 'pre-wrap' as const,
  margin: 0,
};

const whatsappButton = {
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
  margin: '0 auto',
  boxShadow: '0 4px 14px rgba(37, 211, 102, 0.25)',
  border: 'none',
};

export default function BookCallAdminEmail({
  customerName,
  customerEmail,
  customerPhone,
  whatsappNumber,
  preferredDate,
  preferredTime,
  message,
  bookingId,
  quoteLink,
}: BookCallAdminEmailProps) {
  const whatsappLink = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`;

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>📞 New Call Booking Request</h1>
          <p style={{ ...paragraph, marginBottom: 0, color: 'hsl(240, 5%, 50%)' }}>
            A customer has requested to book a call with you
          </p>
        </div>

        <div style={section}>
          <div style={infoCard}>
            <h2 style={infoTitle}>Customer Information</h2>
            <div style={infoRow}>
              <span style={infoLabel}>Name:</span>
              <span style={infoValue}>{customerName}</span>
            </div>
            <div style={infoRow}>
              <span style={infoLabel}>Email:</span>
              <a href={`mailto:${customerEmail}`} style={{ ...infoValue, color: 'hsl(0, 0%, 0%)', textDecoration: 'none' }}>
                {customerEmail}
              </a>
            </div>
            {customerPhone && (
              <div style={infoRow}>
                <span style={infoLabel}>Phone:</span>
                <a href={`tel:${customerPhone}`} style={{ ...infoValue, color: 'hsl(0, 0%, 0%)', textDecoration: 'none' }}>
                  {customerPhone}
                </a>
              </div>
            )}
            <div style={{ ...infoRow, borderBottom: 'none' }}>
              <span style={infoLabel}>WhatsApp:</span>
              <a 
                href={whatsappLink} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  ...infoValue, 
                  color: '#25D366', 
                  textDecoration: 'none',
                  fontWeight: '600',
                }}
              >
                {whatsappNumber}
              </a>
            </div>
          </div>

          <div style={infoCard}>
            <h2 style={infoTitle}>Preferred Call Time</h2>
            <div style={infoRow}>
              <span style={infoLabel}>Date:</span>
              <span style={infoValue}>{preferredDate}</span>
            </div>
            <div style={{ ...infoRow, borderBottom: 'none' }}>
              <span style={infoLabel}>Time:</span>
              <span style={infoValue}>{preferredTime}</span>
            </div>
          </div>

          {message && (
            <div style={infoCard}>
              <h2 style={infoTitle}>Customer Message</h2>
              <div style={messageBox}>
                <p style={messageText}>{message}</p>
              </div>
            </div>
          )}

          <div style={infoCard}>
            <h2 style={infoTitle}>Booking Details</h2>
            <div style={infoRow}>
              <span style={infoLabel}>Booking ID:</span>
              <span style={infoValue}>{bookingId}</span>
            </div>
            <div style={{ ...infoRow, borderBottom: 'none' }}>
              <span style={infoLabel}>Quote Link:</span>
              <a 
                href={quoteLink} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ ...infoValue, color: 'hsl(0, 0%, 0%)', textDecoration: 'none' }}
              >
                View Quote & Booking Details
              </a>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', paddingTop: '20px', borderTop: '1px solid hsl(0, 0%, 85%)', width: '100%' }}>
          <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
            <tr>
              <td style={{ textAlign: 'center' as const, padding: '0' }}>
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={whatsappButton}>
                  Contact Customer on WhatsApp
                </a>
              </td>
            </tr>
          </table>
          <div style={{ marginTop: '20px' }}>
            <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
              <tr>
                <td style={{ textAlign: 'center' as const, padding: '0' }}>
                  <a href={quoteLink} target="_blank" rel="noopener noreferrer" style={button}>
                    View Full Quote & Booking
                  </a>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <p style={{ fontSize: '14px', color: 'hsl(240, 5%, 50%)', marginTop: '30px', lineHeight: '1.6', textAlign: 'center' }}>
          This is an automated notification from the Looks by Anum booking system.
        </p>

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
