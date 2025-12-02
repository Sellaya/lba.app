import type { LucideIcon } from "lucide-react";
import { MOBILE_LOCATION_OPTIONS } from "./services";

export type ServiceOption = 'makeup-hair' | 'makeup-only' | 'hair-only';

export const SERVICE_OPTION_DETAILS: Record<ServiceOption, { label: string; priceModifier: number; teamPriceModifier?: number }> = {
    'makeup-hair': { label: 'Makeup & Hair', priceModifier: 1, teamPriceModifier: 1 },
    'makeup-only': { label: 'Makeup Only', priceModifier: 0.61, teamPriceModifier: 0.611 }, // For Bridal Team: 360 * 0.611 = ~220. For Semi-Bridal Team: 280 * 0.643 = ~180. For Party/Photoshoot: 200 * 0.55 = 110
    'hair-only': { label: 'Hair Only', priceModifier: 0.44, teamPriceModifier: 0.444 }, // For Bridal Team: 360 * 0.444 = ~160. For Semi-Bridal Team: 280 * 0.5 = 140. For Party/Photoshoot: 200 * 0.55 = 110
};

export type PriceTier = 'lead' | 'team';

export type DualPrice = {
    lead: number;
    team: number;
}

export type Service = {
  id: string;
  name: string;
  description: string;
  basePrice: DualPrice;
  duration: number; // in minutes
  icon: LucideIcon;
  askServiceType: boolean; // Can choose makeup/hair/both
  optionPrices?: Partial<Record<ServiceOption, DualPrice>>;
  addonOverrides?: Partial<
    Record<'hairExtension' | 'jewellerySetting' | 'sareeDraping' | 'hijabSetting', DualPrice>
  >;
};

export type BridalPartyServices = {
    addServices: boolean;
    hairAndMakeup: number;
    makeupOnly: number;
    hairOnly: number;
    dupattaSetting: number;
    hairExtensionInstallation: number;
    partySareeDraping: number;
    partyHijabSetting: number;
    airbrush: number;
};

export type ServiceType = 'studio' | 'mobile';

export type Day = {
  id: number;
  date: Date | undefined;
  getReadyTime: string; // e.g., "10:00"
  serviceId: string | null;
  serviceOption: ServiceOption | null;
  hairExtensions: number; // Number of extensions
  jewellerySetting: boolean;
  sareeDraping: boolean;
  hijabSetting: boolean;
  serviceType: ServiceType;
  mobileLocation?: keyof typeof MOBILE_LOCATION_OPTIONS;
  partyServices?: BridalPartyServices; // Party services for this specific day (if bridal/semi-bridal)
  partyPeopleCount?: number; // Number of people for Party Glam service
};

export type BridalTrial = {
    addTrial: boolean;
    date: Date | undefined;
    time: string;
    serviceOption: ServiceOption;
}

export type Quote = {
  lineItems: { description: string; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
};

export type Address = {
    street: string;
    city: string;
    province: 'ON';
    postalCode: string;
};

export type PartyBooking = {
    service: string;
    quantity: number;
};

export type PaymentMethod = 'stripe' | 'interac';
export type PaymentStatus = 'deposit-pending' | 'deposit-paid' | 'payment-approved' | 'screenshot-rejected';

export type PaymentDetails = {
    method: PaymentMethod;
    status: PaymentStatus;
    depositAmount: number;
    screenshotUrl?: string;
    transactionId?: string; // For Stripe payments (advance payment)
    // Promotional code tracking
    promotionalCode?: string; // The code entered (e.g., "SAVE10")
    promotionalCodeId?: string; // Stripe promotion code ID
    couponId?: string; // Stripe coupon ID
    discountAmount?: number; // Amount discounted in dollars
    // Final payment (remaining 50%)
    finalPayment?: {
        method?: PaymentMethod;
        status?: PaymentStatus;
        amount: number;
        screenshotUrl?: string;
        transactionId?: string; // For Stripe payments
        // Promotional code for final payment too
        promotionalCode?: string;
        promotionalCodeId?: string;
        couponId?: string;
        discountAmount?: number;
    };
};

export type FinalQuote = {
  id: string; // Unique booking ID
  contact: { name: string; email: string; phone: string; };
  booking: {
    days: { 
        date: string; 
        getReadyTime: string;
        serviceName: string;
        serviceOption: string;
        serviceType: ServiceType;
        location: string;
        addOns: string[];
    }[];
    hasMobileService: boolean;
    bridalParty?: {
        services: PartyBooking[];
        airbrush: number;
    },
    address?: Address;
    trial?: {
        date: string;
        time: string;
        serviceOption?: string; // Service option for the trial (makeup-hair, makeup-only, hair-only)
    };
    inspirations?: {
        images?: string[]; // Array of image URLs
        links?: string[]; // Array of Instagram/TikTok links
    };
    makeupImages?: string[]; // Array of makeup photo URLs uploaded by client after appointment
  };
  quotes: {
    lead: Quote;
    team: Quote;
  };
  selectedQuote?: PriceTier;
  paymentDetails?: PaymentDetails;
  status: 'quoted' | 'confirmed' | 'cancelled';
  contractSignedDate?: string; // ISO date string when contract was signed
  quoteGeneratedAt?: string; // ISO date string when the quote was generated/taken by client
  consultationRequest?: {
    whatsappNumber: string;
    preferredDate: string;
    preferredTime: string;
    message: string;
    submittedAt: string; // ISO date string when request was submitted
  };
  whatsappMessages?: {
    initial?: {
      sent: boolean;
      sentAt?: string; // ISO date string when initial WhatsApp message was sent
      messageSid?: string; // Twilio message SID
      delivered?: boolean; // Whether message was delivered to user
      deliveryStatus?: string; // Twilio delivery status (queued, sending, sent, delivered, undelivered, failed)
      error?: string; // Error message if sending failed
    };
    followup7d?: {
      sent: boolean;
      sentAt?: string; // ISO date string when 7-day follow-up was sent
      scheduledFor?: string; // ISO date string when 7-day follow-up is scheduled
      messageSid?: string; // Twilio message SID
      delivered?: boolean; // Whether message was delivered to user
      deliveryStatus?: string; // Twilio delivery status (queued, sending, sent, delivered, undelivered, failed)
      error?: string; // Error message if sending failed
    };
    reminder2w?: {
      sent: boolean;
      sentAt?: string; // ISO date string when 2-week reminder was sent
      scheduledFor?: string; // ISO date string when 2-week reminder is scheduled
      messageSid?: string; // Twilio message SID
      delivered?: boolean; // Whether message was delivered to user
      deliveryStatus?: string; // Twilio delivery status (queued, sending, sent, delivered, undelivered, failed)
      error?: string; // Error message if sending failed
    };
    reminder1w?: {
      sent: boolean;
      sentAt?: string; // ISO date string when 1-week reminder was sent
      scheduledFor?: string; // ISO date string when 1-week reminder is scheduled
      messageSid?: string; // Twilio message SID
      delivered?: boolean; // Whether message was delivered to user
      deliveryStatus?: string; // Twilio delivery status (queued, sending, sent, delivered, undelivered, failed)
      error?: string; // Error message if sending failed
    };
  };
};

export type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  quote: FinalQuote | null;
  errors: Record<string, string[] | undefined> | null;
  fieldValues?: Record<string, any>;
};
