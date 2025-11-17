import type { FinalQuote, PriceTier } from '@/lib/types';

export function ContractDisplay({ quote, selectedTier }: { quote: FinalQuote; selectedTier?: PriceTier }) {
  // Guard clause to prevent rendering if the tier isn't selected yet.
  if (!selectedTier) {
    return null;
  }

  const selectedQuote = quote.quotes[selectedTier];
  const depositAmount = selectedQuote.total * 0.5;

  return (
    <div className="p-4 sm:p-6 border rounded-lg bg-background/50 prose prose-sm max-w-none prose-headings:font-headline prose-h4:text-lg prose-h4:mb-2 prose-p:my-2 prose-ul:my-2">
      <h4>1. Parties</h4>
      <p>This Service Agreement ("Agreement") is made between <strong>{quote.contact.name}</strong> ("Client") and <strong>Sellaya.ca</strong> ("Artist").</p>

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
        {quote.booking.trial && (
          <li><strong>Bridal Trial</strong> on <strong>{quote.booking.trial.date}</strong> at <strong>{quote.booking.trial.time}</strong>.</li>
        )}
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
      <p>The total fee for the services is <strong>${selectedQuote.total.toFixed(2)}</strong> (including GST).</p>
      <p>A non-refundable deposit of <strong>${depositAmount.toFixed(2)} (50%)</strong> is required to secure the booking. This deposit is non-refundable and non-transferable.</p>
      <p>The remaining balance of <strong>${(selectedQuote.total - depositAmount).toFixed(2)}</strong> is due on or before the day of the first scheduled service.</p>

      <h4>4. Cancellations</h4>
      <p>Cancellations must be made in writing. If the Client cancels, the deposit will not be refunded. If the Artist must cancel, a full refund of the deposit will be issued.</p>
      
      <h4>5. Delays</h4>
      <p>A late fee will be charged if the Client is late for the appointment. The Artist will do their best to accommodate, but cannot guarantee the full service if the Client is significantly delayed.</p>

      <h4>6. Health and Safety</h4>
      <p>Client must disclose any allergies or skin conditions prior to the service. The Artist reserves the right to refuse service for any health-related concerns (e.g., contagious illness, open wounds).</p>

      <h4>7. Agreement</h4>
      <p>By checking the box below, the Client acknowledges they have read, understood, and agreed to the terms and conditions of this Agreement.</p>
    </div>
  );
}
