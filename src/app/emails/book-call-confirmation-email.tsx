import React from 'react';

interface BookCallConfirmationEmailProps {
  customerName: string;
  preferredDate: string;
  preferredTime: string;
  message?: string;
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

const highlightBox = {
  padding: '20px',
  backgroundColor: '#dbeafe',
  border: '2px solid #3b82f6',
  borderRadius: '8px',
  marginTop: '20px',
};

const highlightText = {
  fontSize: '15px',
  lineHeight: '1.7',
  color: '#1e40af',
  margin: 0,
};

export default function BookCallConfirmationEmail({
  customerName,
  preferredDate,
  preferredTime,
}: BookCallConfirmationEmailProps) {
  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Call Booking Confirmed</h1>
          <p style={{ ...paragraph, marginBottom: 0, color: 'hsl(240, 5%, 50%)' }}>
            Thank you for requesting a call with Anum
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hello {customerName},
          </p>
          
          <p style={paragraph}>
            Thank you for requesting a call with Anum! We have received your request and Anum will contact you at your preferred time to discuss your quote and answer any questions you may have.
          </p>

          <div style={infoCard}>
            <h2 style={infoTitle}>Your Preferred Call Time</h2>
            <div style={infoRow}>
              <span style={infoLabel}>Date:</span>
              <span style={infoValue}>{preferredDate}</span>
            </div>
            <div style={{ ...infoRow, borderBottom: 'none' }}>
              <span style={infoLabel}>Time:</span>
              <span style={infoValue}>{preferredTime}</span>
            </div>
          </div>

          <div style={highlightBox}>
            <p style={highlightText}>
              <strong>What's Next?</strong><br />
              Anum will contact you at the time you specified. If you need to reschedule or have any questions, please don't hesitate to reach out.
            </p>
          </div>
        </div>

        <p style={{ fontSize: '16px', color: 'hsl(240, 10%, 3.9%)', marginTop: '30px', lineHeight: '1.7', textAlign: 'center' }}>
          We look forward to speaking with you soon!
        </p>

        <p style={{ fontSize: '14px', color: 'hsl(240, 5%, 50%)', marginTop: '20px', lineHeight: '1.6', textAlign: 'center' }}>
          Best regards,<br />
          <strong style={{ color: 'hsl(0, 0%, 0%)' }}>Looks by Anum</strong>
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
