import type { FinalQuote, PriceTier } from '@/lib/types';
import { formatToronto } from '@/lib/toronto-time';
import { formatPrice } from '@/lib/price-format';

export function ContractDisplay({ 
  quote, 
  selectedTier,
  signedDate 
}: { 
  quote: FinalQuote; 
  selectedTier?: PriceTier;
  signedDate?: Date | string;
}) {
  // Guard clause to prevent rendering if the tier isn't selected yet.
  if (!selectedTier) {
    return null;
  }

  const selectedQuote = quote.quotes[selectedTier];
  const depositAmount = selectedQuote.total * 0.5;
  const contractDate = signedDate 
    ? formatToronto(new Date(signedDate), 'MMMM dd, yyyy')
    : formatToronto(new Date(), 'MMMM dd, yyyy');

  return (
    <div className="p-4 sm:p-6 border rounded-lg bg-background/50 prose prose-sm max-w-none prose-headings:font-headline prose-h4:text-lg prose-h4:mb-2 prose-p:my-2 prose-ul:my-2">
      <div className="text-right mb-4 text-sm text-muted-foreground not-prose">
        <p>Date: <strong>{contractDate}</strong></p>
      </div>

      <h4>1. Parties</h4>
      <p>This Service Agreement ("Agreement") is made between <strong>{quote.contact.name}</strong> ("Client") and <strong>Looks by Anum</strong> ("Artist").</p>

      <h4>2. Services</h4>
      <p>The Artist agrees to provide the following makeup and/or hair services:</p>
      <ul>
        {quote.booking.days.map((day, index) => (
          <li key={index}>
            <strong>{day.serviceName}</strong> on <strong>{day.date}</strong> at approximately <strong>{day.getReadyTime}</strong>.
            <br />
            Location: {day.location}.
            {quote.booking.address && day.serviceType === 'mobile' && ` (${quote.booking.address.street}, ${quote.booking.address.city})`}
            <ul>
              <li>Service: {day.serviceOption}</li>
              {day.addOns.map((addon, i) => <li key={i}>{addon}</li>)}
            </ul>
          </li>
        ))}
        {quote.booking.trial && (() => {
          const trialServiceOption = quote.booking.trial?.serviceOption || 'makeup-hair';
          const trialServiceOptionLabel = trialServiceOption === 'makeup-hair' ? 'Makeup & Hair' : 
                                          trialServiceOption === 'makeup-only' ? 'Makeup Only' : 'Hair Only';
          return (
            <li key="trial"><strong>Bridal Trial</strong> on <strong>{quote.booking.trial.date}</strong> at <strong>{quote.booking.trial.time}</strong> ({trialServiceOptionLabel}).</li>
          );
        })()}
        {quote.booking.bridalParty && quote.booking.bridalParty.services.length > 0 && (
          <li>
            <strong>Bridal Party Services</strong>:
            <ul>
              {quote.booking.bridalParty.services.map((s, i) => <li key={i}>{s.service} (x{s.quantity})</li>)}
              {quote.booking.bridalParty.airbrush > 0 && <li>Airbrush Service (x{quote.booking.bridalParty.airbrush})</li>}
            </ul>
          </li>
        )}
      </ul>

      <h4>3. Payment</h4>
      <p>The total fee for the services is <strong>${formatPrice(selectedQuote.total)}</strong> (including GST).</p>
      <p>A non-refundable deposit of <strong>${formatPrice(depositAmount)} (50%)</strong> is required to secure the booking. This deposit is non-refundable and non-transferable.</p>
      <p>The remaining balance of <strong>${formatPrice(selectedQuote.total - depositAmount)}</strong> is due on or before the day of the first scheduled service.</p>

      <h4>4. Client Responsibilities</h4>
      <ul>
        <li>Provide accurate and detailed information regarding the desired makeup and hair services.</li>
        <li>Ensure a suitable location with proper lighting and access to an electrical outlet for our team to set up.</li>
        <li>Arrive with clean, dry hair and a clean face, free from any makeup and hair products.</li>
        <li>If there are any parking fees or charges incurred at the location of the event, the client will be responsible for covering those costs.</li>
        <li>Disclose any known allergies, skin conditions, or sensitivities prior to the service.</li>
      </ul>

      <h4>5. Cancellation Policy</h4>
      <p>All cancellations must be made in writing.</p>
      <ul>
        <li>In the event of cancellation by the client, the deposit is non-refundable.</li>
        <li>If cancellation occurs less than 3 days before the event, the full remaining balance will still be due.</li>
        <li>If the Artist must cancel, a full refund of the deposit will be issued, and the Artist will make reasonable efforts to find a replacement artist.</li>
      </ul>

      <h4>6. Delays</h4>
      <p>A late fee may be charged if the Client is late for the appointment. The Artist will do their best to accommodate, but cannot guarantee the full service if the Client is significantly delayed.</p>

      <h4>7. Health and Safety</h4>
      <ul>
        <li>Client must disclose any allergies, skin conditions, or sensitivities prior to the service.</li>
        <li>The Artist reserves the right to refuse service for any health-related concerns (e.g., contagious illness, open wounds, skin infections).</li>
        <li>Looks By Anum will not be held responsible for any allergic reactions or injuries that may occur as a result of the makeup and hair services provided, provided that the Artist has followed standard industry practices and the Client has disclosed all known allergies or sensitivities.</li>
      </ul>

      <h4>8. Liability</h4>
      <ul>
        <li>Looks By Anum will not be held responsible for any allergic reactions or injuries that may occur as a result of the makeup and hair services provided, provided that the Artist has followed standard industry practices.</li>
        <li>It is the client's responsibility to inform the artist of any known allergies or sensitivities prior to the service.</li>
        <li>The client agrees to indemnify and hold Looks By Anum harmless from any claims or damages arising from the services provided, except in cases of gross negligence or willful misconduct by the Artist.</li>
      </ul>

      <h4>9. Agreement</h4>
      <p>By checking the box below, the Client acknowledges that they have read, understood, and agree to all the terms and conditions outlined in this Agreement.</p>
      
      {signedDate && (
        <div className="mt-6 pt-4 border-t not-prose">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-4">
            <div>
              <p className="font-semibold mb-2">Client Signature:</p>
              <div className="border-b-2 border-black h-12"></div>
              <p className="text-sm mt-1">{quote.contact.name}</p>
            </div>
            <div>
              <p className="font-semibold mb-2">Date:</p>
              <div className="border-b-2 border-black h-12"></div>
              <p className="text-sm mt-1">{contractDate}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
