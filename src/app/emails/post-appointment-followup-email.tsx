import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface PostAppointmentFollowupEmailProps {
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
  paddingBottom: '30px',
  borderBottom: '2px solid hsl(0, 0%, 85%)',
};

const heading = {
  fontSize: '42px',
  lineHeight: '1.2',
  fontWeight: 'bold',
  color: 'hsl(0, 0%, 0%)',
  margin: '0 0 16px 0',
  fontFamily: "'Belleza', sans-serif",
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.8',
  color: 'hsl(240, 10%, 3.9%)',
  margin: '0 0 24px 0',
};

const section = {
  padding: '30px 0',
};

const highlightBox = {
  backgroundColor: 'hsl(345, 60%, 98%)',
  border: '2px solid hsl(0, 0%, 0%)',
  borderRadius: '12px',
  padding: '30px',
  margin: '30px 0',
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
  padding: '18px 36px',
  display: 'block', // Changed from inline-block for better email client support
  width: '100%',
  maxWidth: '280px',
  margin: '0 auto',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
  border: 'none',
};

const footer = {
  textAlign: 'center' as const,
  paddingTop: '30px',
  borderTop: '1px solid hsl(0, 0%, 85%)',
  marginTop: '30px',
  fontSize: '14px',
  color: '#6c757d',
};

const PostAppointmentFollowupEmailTemplate: React.FC<Readonly<PostAppointmentFollowupEmailProps>> = ({ quote, baseUrl }) => {
  const uploadLink = `${baseUrl}/book/${quote.id}/upload-photos`;

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hi {quote.contact.name},
          </p>
          
          <p style={paragraph}>
            I hope you're doing amazing! It was such a pleasure doing your makeup today. I just wanted to check in and make sure everything stayed perfect for you after the appointment.
          </p>

          <p style={paragraph}>
            If you have any photos from today's look, we would absolutely love to see them!
          </p>

          <div style={highlightBox}>
            <p style={{...paragraph, fontSize: '18px', fontWeight: 600, color: 'hsl(0, 0%, 0%)', marginBottom: '16px'}}>
              Share Your Photos With Us 📸
            </p>
            <p style={{...paragraph, marginBottom: '24px', fontSize: '15px'}}>
              Upload your favorite photos from today's appointment using the link below. With your permission, we'd be happy to share your pictures on our social media.
            </p>
            <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
              <tr>
                <td style={{ textAlign: 'center' as const, padding: '0' }}>
                  <a href={uploadLink} style={button}>
                    Upload Your Photos
                  </a>
                </td>
              </tr>
            </table>
          </div>

          <p style={paragraph}>
            And if you post any yourself, feel free to tag <strong>@looksbyanum</strong> — we'll make sure to give you a story shoutout!
          </p>

          <p style={paragraph}>
            Thank you again for choosing Looks by Anum. If you ever need anything or have feedback, we're always here for you.
          </p>

          <p style={{...paragraph, textAlign: 'center' as const, marginTop: '40px', fontSize: '15px'}}>
            Warm regards,<br />
            <strong style={{color: 'hsl(0, 0%, 0%)'}}>Anum & The Looks by Anum Team</strong>
          </p>
        </div>

        <div style={footer}>
          <p style={{margin: '8px 0'}}>
            © 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a>
          </p>
          <p style={{margin: '8px 0', fontSize: '12px', color: '#999'}}>
            If you have any questions, please reply to this email or contact us directly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PostAppointmentFollowupEmailTemplate;

