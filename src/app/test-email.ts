'use server';

import type { FinalQuote } from '@/lib/types';
import { sendQuoteEmail } from '@/lib/email';
import { formatToronto } from '@/lib/toronto-time';

/**
 * A server action to send a test email.
 * This can be used to verify the email configuration.
 */
export async function sendTestEmailAction(): Promise<{success: boolean; message: string}> {
  console.log('Attempting to send test email...');
  const testQuote: FinalQuote = {
    id: 'TEST-001',
    contact: { name: 'Test User', email: 'orders@looksbyanum.com', phone: 'N/A' },
    booking: {
      days: [
        {
          date: formatToronto(new Date(), 'PPP'),
          getReadyTime: '12:00 PM',
          serviceName: 'Test Service',
          serviceOption: 'Makeup & Hair',
          serviceType: 'mobile',
          location: 'Test Location',
          addOns: ['Test Add-on'],
        },
      ],
      hasMobileService: true,
      address: {
        street: '123 Test St',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M1M 1M1',
      }
    },
    quotes: {
      lead: {
        lineItems: [{ description: 'Test Item', price: 100 }],
        subtotal: 100,
        tax: 13,
        total: 113,
      },
      team: {
        lineItems: [{ description: 'Test Item', price: 80 }],
        subtotal: 80,
        tax: 10.4,
        total: 90.4,
      },
    },
    selectedQuote: 'lead',
    status: 'confirmed',
  };

  try {
    await sendQuoteEmail(testQuote);
    console.log('Test email action completed successfully.');
    return { success: true, message: `Test email sent successfully! Please check the inboxes for 'orders@looksbyanum.com' and the admin email.` };
  } catch (error: any) {
    console.error('Test email action failed:', error);
    // Return a user-friendly error message
    return { success: false, message: `Failed to send test email. Reason: ${error.message}` };
  }
}
