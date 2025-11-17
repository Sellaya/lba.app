import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface FinalPaymentConfirmationEmailProps {
  quote: FinalQuote;
  baseUrl: string;
}

// --- Inline CSS Styles using the App's Theme Colors ---
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
  paddingBottom: '30px',
  borderBottom: '2px solid hsl(345, 20%, 90%)',
};

const heading = {
  fontSize: '42px',
  lineHeight: '1.2',
  fontWeight: 'bold',
  color: 'hsl(345, 80%, 50%)',
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
  border: '2px solid hsl(345, 80%, 50%)',
  borderRadius: '12px',
  padding: '30px',
  margin: '30px 0',
  textAlign: 'center' as const,
};

const footer = {
  textAlign: 'center' as const,
  paddingTop: '30px',
  borderTop: '1px solid hsl(345, 20%, 90%)',
  marginTop: '30px',
  fontSize: '14px',
  color: '#6c757d',
};

const FinalPaymentConfirmationEmailTemplate: React.FC<Readonly<FinalPaymentConfirmationEmailProps>> = ({ quote, baseUrl }) => {
  const quoteLink = `${baseUrl}/book/${quote.id}`;

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
          <p style={{...paragraph, color: 'hsl(345, 80%, 50%)', fontSize: '20px', fontWeight: 600, marginBottom: 0}}>
            Payment Complete – Thank You! ✨
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Dear {quote.contact.name},
          </p>
          
          <p style={paragraph}>
            We are absolutely thrilled to confirm that your final payment has been successfully processed! Your booking with Looks by Anum is now fully paid and confirmed.
          </p>

          <div style={highlightBox}>
            <p style={{...paragraph, fontSize: '18px', fontWeight: 600, color: 'hsl(345, 80%, 50%)', marginBottom: '12px'}}>
              Your Booking is Complete! 🎉
            </p>
            <p style={{...paragraph, marginBottom: 0, fontSize: '15px'}}>
              Booking ID: <strong>{quote.id}</strong>
            </p>
            {quote.selectedQuote && (
              <p style={{...paragraph, marginBottom: 0, fontSize: '15px'}}>
                Package: <strong>{quote.selectedQuote === 'lead' ? 'Anum - Lead Artist' : 'Team Package'}</strong>
              </p>
            )}
          </div>

          <p style={paragraph}>
            It has been such a pleasure working with you throughout this booking process. Your trust in us means the world to our team, and we are genuinely excited to create a beautiful, memorable experience for you.
          </p>

          <p style={paragraph}>
            As we prepare for your special day, please know that we are here for you every step of the way. If you have any questions, need to make any adjustments, or simply want to chat about your vision, please don't hesitate to reach out to us.
          </p>

          <p style={{...paragraph, fontSize: '18px', fontWeight: 600, color: 'hsl(345, 80%, 50%)', textAlign: 'center' as const, marginTop: '40px'}}>
            We Will Miss You! 💕
          </p>

          <p style={{...paragraph, textAlign: 'center' as const, fontStyle: 'italic', color: '#555'}}>
            While we're counting down the days until we see you, we also want you to know that we will miss having you as part of our Looks by Anum family after your special day. Your presence and trust have been a true gift to us.
          </p>

          <p style={{...paragraph, textAlign: 'center' as const, fontWeight: 600, color: 'hsl(345, 80%, 50%)'}}>
            We are already looking forward to your next order with us!
          </p>

          <p style={paragraph}>
            Whether it's another special occasion, a photoshoot, or simply a day when you want to feel extra beautiful, we would be honored to be your makeup artists again. Your journey with us doesn't end here – it's just the beginning of a beautiful relationship.
          </p>

          <div style={{...section, paddingTop: 0, textAlign: 'center' as const}}>
            <a href={quoteLink} style={{
              ...highlightBox,
              display: 'inline-block',
              textDecoration: 'none',
              backgroundColor: 'hsl(345, 80%, 50%)',
              color: '#ffffff',
              border: 'none',
              padding: '18px 36px',
              fontSize: '16px',
              fontWeight: 'bold',
              borderRadius: '8px',
              boxShadow: '0 4px 14px rgba(225, 29, 72, 0.25)',
            }}>
              View Your Booking Details
            </a>
          </div>

          <p style={{...paragraph, textAlign: 'center' as const, marginTop: '40px', fontSize: '15px'}}>
            With heartfelt gratitude and excitement,<br />
            <strong style={{color: 'hsl(345, 80%, 50%)'}}>Anum & The Looks by Anum Team</strong>
          </p>
        </div>

        <div style={footer}>
          <p style={{margin: '8px 0'}}>
            © 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(345, 80%, 50%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a>.
          </p>
          <p style={{margin: '8px 0', fontSize: '12px', color: '#999'}}>
            If you have any questions, please reply to this email or contact us directly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FinalPaymentConfirmationEmailTemplate;

