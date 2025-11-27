import * as React from 'react';
import type { FinalQuote } from '@/lib/types';

interface AppointmentDayReminderEmailProps {
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

const reminderBox = {
  backgroundColor: 'hsl(345, 60%, 98%)',
  border: '2px solid hsl(0, 0%, 0%)',
  borderRadius: '12px',
  padding: '30px',
  margin: '30px 0',
  textAlign: 'center' as const,
};

const infoBox = {
  backgroundColor: '#ffffff',
  border: '1px solid hsl(0, 0%, 85%)',
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '20px',
};

const infoTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: 'hsl(0, 0%, 0%)',
  margin: '0 0 16px 0',
  fontFamily: "'Belleza', sans-serif",
};

const infoDetail = {
  fontSize: '15px',
  color: 'hsl(240, 10%, 3.9%)',
  margin: '8px 0',
  paddingLeft: '20px',
  position: 'relative' as const,
};

const bulletPoint = {
  position: 'absolute' as const,
  left: '0px',
  top: '2px',
  color: 'hsl(0, 0%, 0%)',
  fontSize: '12px',
};

const warningBox = {
  backgroundColor: 'hsl(0, 0%, 95%)',
  border: '2px solid hsl(0, 0%, 0%)',
  borderRadius: '12px',
  padding: '24px',
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
  padding: '18px 32px',
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

const AppointmentDayReminderEmailTemplate: React.FC<Readonly<AppointmentDayReminderEmailProps>> = ({ quote, baseUrl }) => {
  // Validate booking days exist
  if (!quote.booking.days || quote.booking.days.length === 0 || !quote.booking.days[0]) {
    throw new Error('Booking has no service days');
  }
  
  const firstDay = quote.booking.days[0];
  const quoteLink = `${baseUrl}/book/${quote.id}`;
  
  // Calculate remaining payment amount
  const selectedQuote = quote.selectedQuote || 'lead';
  const quoteData = quote.quotes[selectedQuote];
  const totalAmount = quoteData?.total || 0;
  const advancePayment = quote.paymentDetails?.depositAmount || 0;
  // Check if final payment has been made
  const finalPaymentMade = quote.paymentDetails?.finalPayment && 
    (quote.paymentDetails.finalPayment.status === 'deposit-paid' || 
     quote.paymentDetails.finalPayment.status === 'payment-approved');
  // Always calculate remaining as 50% of total for consistency (only show if not paid)
  const remainingAmount = finalPaymentMade ? 0 : totalAmount * 0.5;

  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
          <p style={{...paragraph, color: 'hsl(0, 0%, 0%)', fontSize: '22px', fontWeight: 600, marginBottom: 0}}>
            Your Appointment is Today! ✨
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hi {quote.contact.name},
          </p>
          
          <p style={paragraph}>
            Your appointment with Looks by Anum is today! We're so excited to help you look absolutely stunning for your special day.
          </p>

          <div style={reminderBox}>
            <p style={{...paragraph, fontSize: '20px', fontWeight: 700, color: 'hsl(0, 0%, 0%)', marginBottom: '12px'}}>
              📅 Your Appointment Details
            </p>
            <p style={{...paragraph, fontSize: '18px', marginBottom: '8px', fontWeight: 600}}>
              {firstDay.date}
            </p>
            <p style={{...paragraph, fontSize: '16px', marginBottom: 0}}>
              Arrival Time: <strong>{firstDay.getReadyTime}</strong>
            </p>
          </div>

          <div style={infoBox}>
            <p style={infoTitle}>Service Information</p>
            <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Service:</strong> {firstDay.serviceName}</p>
            <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Style:</strong> {firstDay.serviceOption}</p>
            <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Location:</strong> {firstDay.location}</p>
            {quote.booking.address && (
              <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Address:</strong> {quote.booking.address.street}, {quote.booking.address.city}, {quote.booking.address.province} {quote.booking.address.postalCode}</p>
            )}
          </div>

          {quote.booking.days.length > 1 && (
            <div style={infoBox}>
              <p style={infoTitle}>Additional Service Days</p>
              {quote.booking.days.slice(1).map((day, index) => (
                <div key={index} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: index < quote.booking.days.length - 2 ? '1px solid hsl(0, 0%, 85%)' : 'none' }}>
                  <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Day {index + 2}:</strong> {day.serviceName}</p>
                  <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Date:</strong> {day.date} at {day.getReadyTime}</p>
                  <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Location:</strong> {day.location}</p>
                </div>
              ))}
            </div>
          )}

          {remainingAmount > 0 && (
            <>
              <div style={warningBox}>
                <p style={{...paragraph, fontSize: '18px', fontWeight: 700, color: 'hsl(0, 0%, 0%)', marginBottom: '12px'}}>
                  ⚠️ Important: Final Payment Required
                </p>
                <p style={{...paragraph, fontSize: '16px', marginBottom: '16px'}}>
                  Your remaining balance of <strong>${remainingAmount.toFixed(2)} CAD</strong> must be paid before the makeup artist begins work.
                </p>
                <p style={{...paragraph, fontSize: '15px', marginBottom: '20px', fontWeight: 600}}>
                  Please note: The makeup artist will only start work once the final payment has been completed.
                </p>
                <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
                  <tr>
                    <td style={{ textAlign: 'center' as const, padding: '0' }}>
                      <a href={quoteLink} target="_blank" rel="noopener noreferrer" style={button}>
                        Complete Final Payment
                      </a>
                    </td>
                  </tr>
                </table>
                <p style={{ fontSize: '14px', color: '#777', marginTop: '16px', marginBottom: 0 }}>
                  Click the button above to complete your payment securely.
                </p>
              </div>

              <div style={infoBox}>
                <p style={infoTitle}>Payment Summary</p>
                <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Total Amount:</strong> ${totalAmount.toFixed(2)} CAD</p>
                <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Advance Payment:</strong> ${advancePayment.toFixed(2)} CAD</p>
                <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> <strong>Remaining Balance:</strong> ${remainingAmount.toFixed(2)} CAD</p>
              </div>
            </>
          )}

          {remainingAmount === 0 && (
            <div style={{...reminderBox, backgroundColor: 'hsl(120, 40%, 95%)'}}>
              <p style={{...paragraph, fontSize: '18px', fontWeight: 700, color: 'hsl(0, 0%, 0%)', marginBottom: '12px'}}>
                ✅ Payment Complete
              </p>
              <p style={{...paragraph, fontSize: '16px', marginBottom: 0}}>
                Your booking is fully paid! We're all set for your appointment today.
              </p>
            </div>
          )}

          <div style={infoBox}>
            <p style={infoTitle}>What to Expect</p>
            <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> Our makeup artist will arrive at the scheduled time</p>
            <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> Please ensure you have a well-lit area ready</p>
            <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> Have any reference images or inspiration ready to share</p>
            <p style={infoDetail}><span style={bulletPoint}>&#9679;</span> If you have any last-minute questions, please contact us as soon as possible</p>
          </div>

          <p style={{...paragraph, fontSize: '15px', textAlign: 'center', marginTop: '30px', marginBottom: 0}}>
            We can't wait to see you and help you look absolutely stunning! ✨
          </p>
        </div>
        
        <div style={footer}>
          <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a></p>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDayReminderEmailTemplate;

