import * as React from 'react';
import type { FinalQuote, PriceTier } from '@/lib/types';
import { formatPrice } from '@/lib/price-format';
import { formatToronto } from '@/lib/toronto-time';

interface ContractEmailProps {
  quote: FinalQuote;
  selectedTier: PriceTier;
  signedDate: string;
}

export default function ContractEmailTemplate({ quote, selectedTier, signedDate }: ContractEmailProps) {
  const contractDate = formatToronto(new Date(signedDate), 'MMMM dd, yyyy');
  const selectedQuote = quote.quotes[selectedTier];
  const depositAmount = selectedQuote.total * 0.5;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '800px', margin: '0 auto', backgroundColor: '#ffffff' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', fontSize: '28px', fontWeight: 'bold' }}>Service Agreement</h1>
      
      <div style={{ textAlign: 'right', marginBottom: '20px', fontSize: '14px', color: '#666' }}>
        Date: <strong>{contractDate}</strong>
      </div>

      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>1. Parties</h3>
      <p style={{ marginBottom: '16px', lineHeight: '1.6' }}>
        This Service Agreement ("Agreement") is made between <strong>{quote.contact.name}</strong> ("Client") and <strong>Looks by Anum</strong> ("Artist").
      </p>

      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>2. Services</h3>
      <p style={{ marginBottom: '12px', lineHeight: '1.6' }}>The Artist agrees to provide the following makeup and/or hair services:</p>
      <ul style={{ marginLeft: '20px', marginBottom: '16px', lineHeight: '1.8' }}>
        {quote.booking.days.map((day, index) => (
          <li key={index} style={{ marginBottom: '12px' }}>
            <strong>{day.serviceName}</strong> on <strong>{day.date}</strong> at approximately <strong>{day.getReadyTime}</strong>.
            <br />
            Location: {day.location}.
            {quote.booking.address && day.serviceType === 'mobile' && ` (${quote.booking.address.street}, ${quote.booking.address.city})`}
            <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
              <li>Service: {day.serviceOption}</li>
              {day.addOns.map((addon, i) => <li key={i}>{addon}</li>)}
            </ul>
          </li>
        ))}
        {quote.booking.trial && (() => {
          // Use trial's service option if available, otherwise default
          const trialServiceOption = quote.booking.trial?.serviceOption || 'makeup-hair';
          const trialServiceOptionLabel = trialServiceOption === 'makeup-hair' ? 'Makeup & Hair' : 
                                          trialServiceOption === 'makeup-only' ? 'Makeup Only' : 'Hair Only';
          return (
            <li style={{ marginBottom: '12px' }}>
              <strong>Bridal Trial</strong> on <strong>{quote.booking.trial.date}</strong> at <strong>{quote.booking.trial.time}</strong> ({trialServiceOptionLabel}).
            </li>
          );
        })()}
        {quote.booking.bridalParty && quote.booking.bridalParty.services.length > 0 && (
          <li style={{ marginBottom: '12px' }}>
            <strong>Bridal Party Services</strong>:
            <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
              {quote.booking.bridalParty.services.map((s, i) => <li key={i}>{s.service} (x{s.quantity})</li>)}
              {quote.booking.bridalParty.airbrush > 0 && <li>Airbrush Service (x{quote.booking.bridalParty.airbrush})</li>}
            </ul>
          </li>
        )}
      </ul>

      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>3. Payment</h3>
      <p style={{ marginBottom: '12px', lineHeight: '1.6' }}>
        The total fee for the services is <strong>${formatPrice(selectedQuote.total)}</strong> (including GST).
      </p>
      <p style={{ marginBottom: '12px', lineHeight: '1.6' }}>
        A non-refundable deposit of <strong>${formatPrice(depositAmount)} (50%)</strong> is required to secure the booking. This deposit is non-refundable and non-transferable.
      </p>
      <p style={{ marginBottom: '16px', lineHeight: '1.6' }}>
        The remaining balance of <strong>${formatPrice(selectedQuote.total - depositAmount)}</strong> is due on or before the day of the first scheduled service.
      </p>

      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>4. Client Responsibilities</h3>
      <ul style={{ marginLeft: '20px', marginBottom: '16px', lineHeight: '1.8' }}>
        <li style={{ marginBottom: '8px' }}>Provide accurate and detailed information regarding the desired makeup and hair services.</li>
        <li style={{ marginBottom: '8px' }}>Ensure a suitable location with proper lighting and access to an electrical outlet for our team to set up.</li>
        <li style={{ marginBottom: '8px' }}>Arrive with clean, dry hair and a clean face, free from any makeup and hair products.</li>
        <li style={{ marginBottom: '8px' }}>If there are any parking fees or charges incurred at the location of the event, the client will be responsible for covering those costs.</li>
        <li style={{ marginBottom: '8px' }}>Disclose any known allergies, skin conditions, or sensitivities prior to the service.</li>
      </ul>

      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>5. Cancellation Policy</h3>
      <p style={{ marginBottom: '12px', lineHeight: '1.6' }}>All cancellations must be made in writing.</p>
      <ul style={{ marginLeft: '20px', marginBottom: '16px', lineHeight: '1.8' }}>
        <li style={{ marginBottom: '8px' }}>In the event of cancellation by the client, the deposit is non-refundable.</li>
        <li style={{ marginBottom: '8px' }}>If cancellation occurs less than 3 days before the event, the full remaining balance will still be due.</li>
        <li style={{ marginBottom: '8px' }}>If the Artist must cancel, a full refund of the deposit will be issued, and the Artist will make reasonable efforts to find a replacement artist.</li>
      </ul>

      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>6. Delays</h3>
      <p style={{ marginBottom: '16px', lineHeight: '1.6' }}>
        A late fee may be charged if the Client is late for the appointment. The Artist will do their best to accommodate, but cannot guarantee the full service if the Client is significantly delayed.
      </p>

      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>7. Health and Safety</h3>
      <ul style={{ marginLeft: '20px', marginBottom: '16px', lineHeight: '1.8' }}>
        <li style={{ marginBottom: '8px' }}>Client must disclose any allergies, skin conditions, or sensitivities prior to the service.</li>
        <li style={{ marginBottom: '8px' }}>The Artist reserves the right to refuse service for any health-related concerns (e.g., contagious illness, open wounds, skin infections).</li>
        <li style={{ marginBottom: '8px' }}>Looks By Anum will not be held responsible for any allergic reactions or injuries that may occur as a result of the makeup and hair services provided, provided that the Artist has followed standard industry practices and the Client has disclosed all known allergies or sensitivities.</li>
      </ul>

      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>8. Liability</h3>
      <ul style={{ marginLeft: '20px', marginBottom: '16px', lineHeight: '1.8' }}>
        <li style={{ marginBottom: '8px' }}>Looks By Anum will not be held responsible for any allergic reactions or injuries that may occur as a result of the makeup and hair services provided, provided that the Artist has followed standard industry practices.</li>
        <li style={{ marginBottom: '8px' }}>It is the client's responsibility to inform the artist of any known allergies or sensitivities prior to the service.</li>
        <li style={{ marginBottom: '8px' }}>The client agrees to indemnify and hold Looks By Anum harmless from any claims or damages arising from the services provided, except in cases of gross negligence or willful misconduct by the Artist.</li>
      </ul>

      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>9. Agreement</h3>
      <p style={{ marginBottom: '16px', lineHeight: '1.6' }}>
        By signing this contract, the Client acknowledges that they have read, understood, and agree to all the terms and conditions outlined in this Agreement.
      </p>
      
      <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '2px solid #000' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '30px' }}>
          <div>
            <p style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '16px' }}>Client Signature:</p>
            <div style={{ borderBottom: '2px solid #000', height: '50px', marginBottom: '10px' }}></div>
            <p style={{ fontSize: '14px', marginTop: '5px' }}>{quote.contact.name}</p>
          </div>
          <div>
            <p style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '16px' }}>Date:</p>
            <div style={{ borderBottom: '2px solid #000', height: '50px', marginBottom: '10px' }}></div>
            <p style={{ fontSize: '14px', marginTop: '5px' }}>{contractDate}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

