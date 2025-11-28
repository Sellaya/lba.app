import * as React from 'react';
import type { FinalQuote, Quote } from '@/lib/types';
import { GST_RATE } from '@/lib/services';
import ContractEmailTemplate from '@/app/emails/contract-email';
import { formatPrice } from '@/lib/price-format';

interface QuoteEmailTemplateProps {
  quote: FinalQuote;
  baseUrl: string;
}

// --- Inline CSS Styles using the App's Theme Colors ---
const main = {
  backgroundColor: 'hsl(345, 60%, 98%)', // Keep background as is
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
  color: 'hsl(0, 0%, 0%)', // Black from --primary
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

const bookingSummaryCard = {
    padding: '24px',
    border: '1px solid hsl(0, 0%, 85%)', // --border (gray)
    borderRadius: '12px',
    backgroundColor: 'hsl(345, 60%, 98%)', // --background
    marginBottom: '20px',
}

const bookingSummaryTitle = {
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'hsl(0, 0%, 0%)', // --primary
    margin: '0 0 4px 0',
    fontFamily: "'Belleza', sans-serif",
};
const bookingSummarySubtitle = {
    fontSize: '16px',
    color: '#777',
    margin: '0 0 16px 0',
}

const bookingSummaryDetail = {
    fontSize: '15px',
    color: 'hsl(240, 10%, 3.9%)', // --foreground
    margin: '12px 0 0 0',
    paddingLeft: '20px',
    position: 'relative' as const,
}
const bulletPoint = {
    position: 'absolute' as const,
    left: '0px',
    top: '2px',
    color: 'hsl(0, 0%, 0%)', // --primary
    fontSize: '12px',
}

const priceBox = { 
  padding: '24px', 
  border: '1px solid hsl(0, 0%, 85%)', // --border (gray)
  borderRadius: '12px', 
  marginBottom: '24px', 
  backgroundColor: '#ffffff' 
};

const priceTitle = { 
  ...sectionTitle, 
  fontSize: '22px', 
  textAlign: 'center' as const,
  marginTop: 0, 
  marginBottom: '24px',
  color: 'hsl(0, 0%, 0%)', // --primary
};

const priceTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const priceItemCell = {
  padding: '8px 0',
  fontSize: '15px',
  color: 'hsl(240, 10%, 3.9%)',
};

const priceValueCell = {
  ...priceItemCell,
  textAlign: 'right' as const,
  fontWeight: 600,
  fontFamily: 'monospace',
};

const totalRow = {
  borderTop: '1px solid hsl(0, 0%, 85%)',
};

const totalCell = {
  padding: '16px 0 8px 0',
  fontSize: '15px',
};

const grandTotalRow = {
  borderTop: '2px solid hsl(240, 10%, 3.9%)',
};

const grandTotalLabelCell = {
  ...totalCell,
  fontSize: '18px',
  fontWeight: 700,
};

const grandTotalPriceCell = {
  ...grandTotalLabelCell,
  textAlign: 'right' as const,
  color: 'hsl(0, 0%, 0%)',
  fontSize: '24px',
};


const footer = {
  padding: '30px 0 0 0',
  textAlign: 'center' as const,
  fontSize: '13px',
  color: '#999',
};


const PriceBreakdown = ({ quote, title }: { quote: Quote; title: string }) => (
  <div style={priceBox}>
    <h3 style={priceTitle}>{title}</h3>
    <table style={priceTable}>
      <tbody>
        {quote.lineItems.map((lineItem, index) => (
          <tr key={index}>
            <td style={{...priceItemCell, paddingLeft: lineItem.description.startsWith('  -') || lineItem.description.startsWith('Party:') ? '20px' : '0' }}>
              {lineItem.description.replace(/  - /g, '')}
            </td>
            <td style={priceValueCell}>: ${formatPrice(lineItem.price)}</td>
          </tr>
        ))}
        <tr style={totalRow}>
          <td style={totalCell}>Subtotal</td>
          <td style={{...priceValueCell, ...totalCell}}>: ${formatPrice(quote.subtotal)}</td>
        </tr>
        <tr>
          <td style={priceItemCell}>GST ({(GST_RATE * 100).toFixed(0)}%)</td>
          <td style={priceValueCell}>: ${formatPrice(quote.tax)}</td>
        </tr>
        <tr style={grandTotalRow}>
          <td style={grandTotalLabelCell}>Grand Total</td>
          <td style={grandTotalPriceCell}>: ${formatPrice(quote.total)}</td>
        </tr>
      </tbody>
    </table>
  </div>
);

const QuoteEmailTemplate: React.FC<Readonly<QuoteEmailTemplateProps>> = ({ quote, baseUrl }) => {
  const isConfirmed = quote.status === 'confirmed';
  const quoteLink = `${baseUrl}/book/${quote.id}`;
  
  // Check if payment has been made (advance payment or final payment)
  const hasPayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || 
     quote.paymentDetails.status === 'payment-approved' ||
     quote.paymentDetails.finalPayment?.status === 'deposit-paid' ||
     quote.paymentDetails.finalPayment?.status === 'payment-approved');

  // For confirmed bookings or when payment is made, show only the selected package
  // IMPORTANT: After payment (Stripe or Interac), always show only the selected package, not both
  // If payment is made but selectedQuote is not set, infer it from payment amount
  // Check if payment method exists (indicates payment was made)
  const hasPaymentMethod = quote.paymentDetails?.method === 'stripe' || quote.paymentDetails?.method === 'interac';
  
  // Determine the selected quote - use existing, or infer from payment amount if missing
  let displaySelectedQuote = quote.selectedQuote;
  if (!displaySelectedQuote && (isConfirmed || hasPayment || hasPaymentMethod) && quote.quotes) {
    // Infer selected quote from payment amount
    const paymentAmount = quote.paymentDetails?.depositAmount || 
                         (quote.paymentDetails?.finalPayment?.amount) ||
                         0;
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
    // If still not found, default to 'lead' for confirmed bookings
    if (!displaySelectedQuote && isConfirmed) {
      displaySelectedQuote = 'lead';
    }
  }
  
  // Show confirmed booking view if payment is made and we have a selected quote (or can infer it)
  if ((isConfirmed || hasPayment || hasPaymentMethod) && displaySelectedQuote) {
    return (
      <div style={main}>
        <div style={container}>
          <div style={header}>
            <h1 style={heading}>Looks by Anum</h1>
            <p style={{...paragraph, color: '#6c757d', fontSize: '18px', marginBottom: 0}}>
              Your Booking is Confirmed!
            </p>
          </div>

          <div style={section}>
            <p style={paragraph}>
              Hi {quote.contact.name},
            </p>
            <p style={paragraph}>
              Thank you for confirming your booking! We are thrilled to be a part of your special day. Please review your confirmed service details below.
            </p>
          </div>

          <div style={{ ...section, paddingTop: 0 }}>
            <h2 style={sectionTitle}>Booking Summary</h2>
            
            {quote.booking.days.map((day, index) => (
              <div key={index} style={bookingSummaryCard}>
                <p style={bookingSummaryTitle}>Day {index + 1}: {day.serviceName}</p>
                <p style={bookingSummarySubtitle}>{day.date} at {day.getReadyTime}</p>
                <hr style={{ border: 'none', borderTop: '1px solid hsl(0, 0%, 88%)', margin: '16px 0' }} />
                <p style={bookingSummaryDetail}><span style={bulletPoint}>&#9679;</span> Style: {day.serviceOption}</p>
                <p style={bookingSummaryDetail}><span style={bulletPoint}>&#9679;</span> Location: {day.location}</p>
                {day.addOns.length > 0 && 
                    <div style={{ ...bookingSummaryDetail, marginTop: '16px' }}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: 'hsl(240, 10%, 3.9%)' }}>Add-ons:</p>
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', listStyleType: "'— '" }}>
                             {day.addOns.map((addon, i) => <li key={i} style={{ marginBottom: '4px' }}>{addon}</li>)}
                        </ul>
                    </div>
                }
              </div>
            ))}

            {quote.booking.trial && (() => {
              // Use trial's service option if available, otherwise default
              const trialServiceOption = quote.booking.trial?.serviceOption || 'makeup-hair';
              const trialServiceOptionLabel = trialServiceOption === 'makeup-hair' ? 'Makeup & Hair' : 
                                              trialServiceOption === 'makeup-only' ? 'Makeup Only' : 'Hair Only';
              return (
                <div style={bookingSummaryCard}>
                  <p style={bookingSummaryTitle}>Bridal Trial</p>
                  <p style={bookingSummarySubtitle}>{quote.booking.trial.date} at {quote.booking.trial.time}</p>
                  <p style={{...bookingSummarySubtitle, fontSize: '13px', marginTop: '4px', color: '#666'}}>Service: {trialServiceOptionLabel}</p>
                </div>
              );
            })()}

            {quote.booking.bridalParty && quote.booking.bridalParty.services.length > 0 && (
              <div style={bookingSummaryCard}>
                <p style={bookingSummaryTitle}>Bridal Party Services</p>
                 <hr style={{ border: 'none', borderTop: '1px solid hsl(0, 0%, 88%)', margin: '16px 0' }} />
                {quote.booking.bridalParty.services.map((partySvc, i) => (
                  <p key={i} style={bookingSummaryDetail}><span style={bulletPoint}>&#9679;</span> {partySvc.service} (x{partySvc.quantity})</p>
                ))}
                {quote.booking.bridalParty.airbrush > 0 && <p style={bookingSummaryDetail}><span style={bulletPoint}>&#9679;</span>Airbrush Service (x{quote.booking.bridalParty.airbrush})</p>}
              </div>
            )}

            {quote.booking.address && (
              <div style={bookingSummaryCard}>
                <p style={bookingSummaryTitle}>Service Address</p>
                 <hr style={{ border: 'none', borderTop: '1px solid hsl(0, 0%, 88%)', margin: '16px 0' }} />
                <p style={{...paragraph, margin: 0, fontStyle: 'italic' }}>
                  {quote.booking.address.street},<br/>
                  {quote.booking.address.city}, {quote.booking.address.province}, {quote.booking.address.postalCode}
                </p>
              </div>
            )}
          </div>
          
          <div style={{ ...section, borderBottom: 'none', paddingTop: 0 }}>
            <h2 style={sectionTitle}>Final Price</h2>
            <PriceBreakdown quote={quote.quotes[displaySelectedQuote]} title={displaySelectedQuote === 'lead' ? "Anum - Lead Artist" : "Team Artist"}/>
            <div style={{...priceBox, marginTop: '24px', backgroundColor: 'hsl(345, 60%, 98%)'}}>
              <h3 style={{...priceTitle, fontSize: '20px', marginBottom: '16px'}}>Payment Schedule</h3>
              <table style={priceTable}>
                <tbody>
                  <tr>
                    <td style={priceItemCell}>Total Amount (including 13% GST):</td>
                    <td style={priceValueCell}>: ${formatPrice(quote.quotes[displaySelectedQuote].total)}</td>
                  </tr>
                  <tr style={totalRow}>
                    <td style={{...totalCell, fontWeight: 600, color: 'hsl(0, 0%, 0%)'}}>50% Advance Payment (Required Now):</td>
                    <td style={{...priceValueCell, ...totalCell, color: 'hsl(0, 0%, 0%)', fontWeight: 700}}>: ${formatPrice(quote.quotes[displaySelectedQuote].total * 0.5)}</td>
                  </tr>
                  <tr>
                    <td style={priceItemCell}>50% Remaining Balance (Due on Booking Day):</td>
                    <td style={priceValueCell}>: ${formatPrice(quote.quotes[displaySelectedQuote].total * 0.5)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {quote.contractSignedDate && displaySelectedQuote && (
            <div style={{...section, marginTop: '40px', padding: '30px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px'}}>
              <h2 style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' as const}}>Your Signed Contract</h2>
              <p style={{...paragraph, marginBottom: '20px'}}>
                Please find your signed service agreement below. This contract outlines all terms and conditions of our service agreement.
              </p>
              <div style={{marginTop: '20px', padding: '20px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px'}}>
                <ContractEmailTemplate 
                  quote={quote} 
                  selectedTier={displaySelectedQuote} 
                  signedDate={quote.contractSignedDate}
                />
              </div>
            </div>
          )}
          
          <p style={{ ...paragraph, fontSize: '14px', color: '#6c757d', textAlign: 'center', marginBottom: 0, marginTop: '20px' }}>
            We look forward to seeing you!
          </p>
          
          <div style={footer}>
            <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a></p>
          </div>
        </div>
      </div>
    );
  }

  // For initial quotes, show the simplified two-quote email
  return (
    <div style={main}>
      <div style={container}>
        <div style={header}>
          <h1 style={heading}>Looks by Anum</h1>
          <p style={{...paragraph, color: '#6c757d', fontSize: '18px', marginBottom: 0}}>
            Your Personalized Makeup Quote
          </p>
        </div>

        <div style={section}>
          <p style={paragraph}>
            Hi {quote.contact.name},
          </p>
          <p style={paragraph}>
            Thank you for your interest in our makeup services! We've prepared two personalized quote options for you based on your selections. Each package includes all the services you requested, and you can choose the one that best fits your needs and budget.
          </p>
          <p style={{...paragraph, fontWeight: 600, color: 'hsl(0, 0%, 0%)'}}>
            You can open each quote separately to view full details, compare pricing (including 13% tax), see the required 50% advance payment, and proceed with your booking.
          </p>
        </div>

        <div style={{ ...section, paddingTop: 0 }}>
          <h2 style={sectionTitle}>Your Two Available Packages</h2>
          
          {/* Lead Artist Quote Card */}
          <div style={{...priceBox, marginBottom: '32px', backgroundColor: '#ffffff', border: '2px solid hsl(0, 0%, 85%)'}}>
            <h3 style={{...priceTitle, fontSize: '24px', marginBottom: '8px'}}>Lead Makeup Artist – Anum</h3>
            <p style={{...paragraph, textAlign: 'center', fontSize: '14px', color: '#777', marginBottom: '20px', marginTop: 0}}>
              Premium service with our lead artist
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '36px', fontWeight: 700, color: 'hsl(0, 0%, 0%)', fontFamily: 'monospace' }}>
                  ${formatPrice(quote.quotes.lead.total)}
                </span>
                <p style={{ fontSize: '13px', color: '#777', margin: '4px 0 0 0' }}>Total (including 13% GST)</p>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'hsl(345, 60%, 98%)', borderRadius: '8px', marginTop: '16px' }}>
                <p style={{ fontSize: '14px', margin: '4px 0', textAlign: 'center' }}>
                  <strong style={{ color: 'hsl(0, 0%, 0%)' }}>50% Advance:</strong> ${formatPrice(quote.quotes.lead.total * 0.5)} • 
                  <strong> 50% Due on Day:</strong> ${formatPrice(quote.quotes.lead.total * 0.5)}
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '24px', width: '100%' }}>
              <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
                <tr>
                  <td style={{ textAlign: 'center' as const, padding: '0' }}>
                    <a href={quoteLink} target="_blank" rel="noopener noreferrer" style={button}>
                      View This Quote & Continue
                    </a>
                  </td>
                </tr>
              </table>
            </div>
          </div>

          {/* Team Package Quote Card */}
          <div style={{...priceBox, marginBottom: '32px', backgroundColor: '#ffffff', border: '2px solid hsl(0, 0%, 85%)'}}>
            <h3 style={{...priceTitle, fontSize: '24px', marginBottom: '8px'}}>Team Package</h3>
            <p style={{...paragraph, textAlign: 'center', fontSize: '14px', color: '#777', marginBottom: '20px', marginTop: 0}}>
              Professional service with our team
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '36px', fontWeight: 700, color: 'hsl(0, 0%, 0%)', fontFamily: 'monospace' }}>
                  ${formatPrice(quote.quotes.team.total)}
                </span>
                <p style={{ fontSize: '13px', color: '#777', margin: '4px 0 0 0' }}>Total (including 13% GST)</p>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'hsl(345, 60%, 98%)', borderRadius: '8px', marginTop: '16px' }}>
                <p style={{ fontSize: '14px', margin: '4px 0', textAlign: 'center' }}>
                  <strong style={{ color: 'hsl(0, 0%, 0%)' }}>50% Advance:</strong> ${formatPrice(quote.quotes.team.total * 0.5)} • 
                  <strong> 50% Due on Day:</strong> ${formatPrice(quote.quotes.team.total * 0.5)}
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '24px', width: '100%' }}>
              <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ margin: '0 auto', width: '100%', maxWidth: '280px' }}>
                <tr>
                  <td style={{ textAlign: 'center' as const, padding: '0' }}>
                    <a href={quoteLink} target="_blank" rel="noopener noreferrer" style={button}>
                      View This Quote & Continue
                    </a>
                  </td>
                </tr>
              </table>
            </div>
          </div>

          <div style={{ padding: '24px', backgroundColor: 'hsl(345, 60%, 98%)', borderRadius: '12px', border: '1px solid hsl(0, 0%, 85%)', marginTop: '32px' }}>
            <p style={{...paragraph, textAlign: 'center', marginBottom: '12px', fontWeight: 600, fontSize: '17px'}}>
              How to Choose Your Package
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', lineHeight: '1.8', color: 'hsl(240, 10%, 3.9%)' }}>
              <li>Click either button above to open your personalized quote page</li>
              <li>Compare the full details, pricing breakdown, and services included</li>
              <li>Select the package you prefer when you're ready</li>
              <li>Complete your booking with a 50% advance payment</li>
            </ul>
            
          </div>
        </div>
        
        <p style={{ ...paragraph, fontSize: '14px', color: '#6c757d', textAlign: 'center', marginBottom: 0, marginTop: '20px' }}>
          This quote is valid for 7 days. If you have any questions, please reply directly to this email.
        </p>
        
        <div style={footer}>
          <p>© 2025 Looks by Anum | Product by <a href="https://www.instagram.com/sellayadigital" target="_blank" rel="noopener noreferrer" style={{color: 'hsl(0, 0%, 0%)', textDecoration: 'underline', fontWeight: '500'}}>Sellaya</a></p>
        </div>
      </div>
    </div>
  );
}

export default QuoteEmailTemplate;
