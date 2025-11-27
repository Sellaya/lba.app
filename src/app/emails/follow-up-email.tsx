import * as React from 'react';
import type { FinalQuote } from '@/lib/types';
import { formatPrice } from '@/lib/price-format';

interface FollowUpEmailProps {
  quote: FinalQuote;
  baseUrl: string;
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
  border: '1px solid hsl(0, 0%, 85%)', // --border (gray)
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
  color: 'hsl(0, 0%, 0%)', // --primary (black)
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

const instructionBox = {
    background: 'hsl(0, 0%, 90%)', // --accent (light gray)
    border: '1px solid hsl(0, 0%, 85%)', // --border (gray)
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

const bookingSummaryCard = {
    padding: '24px',
    border: '1px solid hsl(0, 0%, 85%)', // --border (gray)
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    marginBottom: '20px',
}

const bookingSummaryTitle = {
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'hsl(0, 0%, 0%)', // --primary (black)
    margin: '0 0 4px 0',
    fontFamily: "'Belleza', sans-serif",
};

const FollowUpEmailTemplate: React.FC<Readonly<FollowUpEmailProps>> = ({ quote, baseUrl }) => (
  <div style={main}>
    <div style={container}>
      <div style={header}>
        <h1 style={heading}>Looks by Anum</h1>
        <p style={{...paragraph, color: '#6c757d', fontSize: '18px', marginBottom: 0}}>Don't Miss Out on Your Perfect Look!</p>
      </div>

      <div style={section}>
        <p style={paragraph}>
          Hi {quote.contact.name},
        </p>
        <p style={paragraph}>
          We noticed you recently requested a quote for our makeup services but haven't confirmed your booking yet. We'd love to help you look and feel your absolute best for your event!
        </p>
         <p style={{...paragraph, fontStyle: 'italic', color: 'hsl(240, 5.9%, 10%)' }}>
          Slots fill up quickly, especially around peak season. Confirming soon will ensure your preferred date and time are locked in.
        </p>
        
        <div style={instructionBox}>
            <p style={{ ...paragraph, marginTop: 0, marginBottom: '24px', color: 'hsl(240, 5.9%, 10%)', fontSize: '18px' }}>
              Ready to secure your spot?
            </p>
            <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
              <tr>
                <td style={{ textAlign: 'center' as const, padding: '0' }}>
                  <a href={`${baseUrl}/book/${quote.id}`} target="_blank" rel="noopener noreferrer" style={button}>
                    View Your Quote & Complete Booking
                  </a>
                </td>
              </tr>
            </table>
            <p style={{ fontSize: '13px', color: '#999', marginTop: '16px', marginBottom: 0 }}>
                This link will show your real-time booking status and allow you to complete payment.
            </p>
        </div>
      </div>

      <div style={{ ...section, borderBottom: 'none', paddingTop: 0 }}>
        <h2 style={sectionTitle}>Your Quote Reminder</h2>
        
        <div style={bookingSummaryCard}>
            <h3 style={{ ...bookingSummaryTitle, fontSize: '22px', textAlign: 'center', marginBottom: '20px' }}>
                Your Requested Services
            </h3>
            {quote.booking.days.map((day, index) => (
              <div key={index} style={{ marginBottom: '16px', borderTop: index > 0 ? '1px solid #eee' : 'none', paddingTop: index > 0 ? '16px' : '0' }}>
                <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: 'hsl(240, 10%, 3.9%)', fontSize: '16px' }}>
                  {day.serviceName} on {day.date}
                </p>
                <p style={{ margin: 0, paddingLeft: '15px', color: '#555' }}>
                  &bull; Time: {day.getReadyTime}<br/>
                  &bull; Location: {day.location}
                </p>
              </div>
            ))}
        </div>
        
        {/* Payment Breakdown */}
        <div style={{...bookingSummaryCard, marginTop: '20px'}}>
          <h3 style={{ ...bookingSummaryTitle, fontSize: '20px', textAlign: 'center', marginBottom: '16px' }}>
            Payment Information
          </h3>
          <p style={{...paragraph, fontSize: '15px', textAlign: 'center', marginBottom: '16px'}}>
            All bookings require a 50% advance payment to secure your date. The remaining 50% is due on the day of your booking.
          </p>
          
          {/* Show only selected package if payment is made, otherwise show both */}
          {(() => {
            const hasPayment = quote.paymentDetails && 
              (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
            
            // Determine the selected quote - use existing, or infer from payment amount if missing
            let displaySelectedQuote = quote.selectedQuote;
            if (!displaySelectedQuote && hasPayment && quote.quotes) {
              // Infer selected quote from payment amount
              const paymentAmount = quote.paymentDetails?.depositAmount || 0;
              if (paymentAmount > 0) {
                const leadDeposit = quote.quotes.lead?.total * 0.5 || 0;
                const teamDeposit = quote.quotes.team?.total * 0.5 || 0;
                // Find which tier matches the payment amount (with small tolerance for rounding)
                if (Math.abs(paymentAmount - leadDeposit) < 1) {
                  displaySelectedQuote = 'lead';
                } else if (Math.abs(paymentAmount - teamDeposit) < 1) {
                  displaySelectedQuote = 'team';
                }
              }
            }
            
            if (hasPayment && displaySelectedQuote) {
              // Show only the selected package
              const selectedQuoteData = quote.quotes[displaySelectedQuote];
              return (
                <div style={{ padding: '16px', backgroundColor: 'hsl(345, 60%, 98%)', borderRadius: '8px', border: '1px solid hsl(0, 0%, 85%)', marginTop: '20px' }}>
                  <h4 style={{...bookingSummaryTitle, fontSize: '16px', marginBottom: '8px', textAlign: 'center'}}>
                    {displaySelectedQuote === 'lead' ? 'Lead Artist - Anum' : 'Team Package'}
                  </h4>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>Total: <strong>${formatPrice(selectedQuoteData.total)}</strong></p>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: 'hsl(0, 0%, 0%)' }}>50% Advance: <strong>${formatPrice(selectedQuoteData.total * 0.5)}</strong></p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>50% Due on Day: <strong>${formatPrice(selectedQuoteData.total * 0.5)}</strong></p>
                </div>
              );
            } else {
              // Show both packages
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                    <div style={{ padding: '16px', backgroundColor: 'hsl(345, 60%, 98%)', borderRadius: '8px', border: '1px solid hsl(0, 0%, 85%)' }}>
                      <h4 style={{...bookingSummaryTitle, fontSize: '16px', marginBottom: '8px', textAlign: 'center'}}>Option 1: Lead Artist</h4>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>Total: <strong>${formatPrice(quote.quotes.lead.total)}</strong></p>
                      <p style={{ margin: '4px 0', fontSize: '14px', color: 'hsl(0, 0%, 0%)' }}>50% Advance: <strong>${formatPrice(quote.quotes.lead.total * 0.5)}</strong></p>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>50% Due on Day: <strong>${formatPrice(quote.quotes.lead.total * 0.5)}</strong></p>
                    </div>
                    <div style={{ padding: '16px', backgroundColor: 'hsl(345, 60%, 98%)', borderRadius: '8px', border: '1px solid hsl(0, 0%, 85%)' }}>
                      <h4 style={{...bookingSummaryTitle, fontSize: '16px', marginBottom: '8px', textAlign: 'center'}}>Option 2: Team</h4>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>Total: <strong>${formatPrice(quote.quotes.team.total)}</strong></p>
                      <p style={{ margin: '4px 0', fontSize: '14px', color: 'hsl(0, 0%, 0%)' }}>50% Advance: <strong>${formatPrice(quote.quotes.team.total * 0.5)}</strong></p>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>50% Due on Day: <strong>${formatPrice(quote.quotes.team.total * 0.5)}</strong></p>
                    </div>
                  </div>
                  <p style={{...paragraph, fontSize: '13px', textAlign: 'center', marginTop: '16px', marginBottom: 0, color: '#777'}}>
                    All prices include 13% GST. You can view complete pricing breakdown and select your preferred option when you complete your booking.
                  </p>
                </>
              );
            }
          })()}
        </div>
        
        {/* Status Update Section */}
        {quote.paymentDetails && (
          <div style={{...bookingSummaryCard, marginTop: '20px', backgroundColor: quote.paymentDetails.status === 'screenshot-rejected' ? 'hsl(0, 60%, 98%)' : 'hsl(345, 60%, 98%)'}}>
            <h3 style={{ ...bookingSummaryTitle, fontSize: '18px', textAlign: 'center', marginBottom: '12px' }}>
              Current Status
            </h3>
            {quote.paymentDetails.status === 'deposit-pending' && (
              <p style={{...paragraph, fontSize: '15px', textAlign: 'center', marginBottom: 0, color: 'hsl(240, 10%, 3.9%)'}}>
                <strong>Awaiting Payment Approval</strong><br/>
                Your payment screenshot is being reviewed. You will receive a confirmation email once approved.
              </p>
            )}
            {quote.paymentDetails.status === 'payment-approved' && (
              <p style={{...paragraph, fontSize: '15px', textAlign: 'center', marginBottom: 0, color: 'hsl(142, 76%, 36%)'}}>
                <strong>Payment Approved – Booking Confirmed</strong><br/>
                Your booking is confirmed! The remaining 50% balance is due on the day of your service.
              </p>
            )}
            {quote.paymentDetails.status === 'screenshot-rejected' && (
              <p style={{...paragraph, fontSize: '15px', textAlign: 'center', marginBottom: 0, color: 'hsl(0, 84%, 60%)'}}>
                <strong>Screenshot Rejected</strong><br/>
                Please upload the correct screenshot to proceed with your booking.
              </p>
            )}
          </div>
        )}
      </div>
      
      <p style={{ ...paragraph, fontSize: '14px', color: '#6c757d', textAlign: 'center', marginBottom: 0, marginTop: '20px' }}>
        If you have any questions or would like to make changes, please reply directly to this email. We're here to help!
      </p>
      
      <div style={footer}>
        <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a></p>
      </div>
    </div>
  </div>
);

export default FollowUpEmailTemplate;
