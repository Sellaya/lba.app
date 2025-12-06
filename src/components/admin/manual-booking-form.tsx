'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, ArrowLeft, ArrowRight, User, Users, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatToronto, getTorontoToday, getTorontoNow } from '@/lib/toronto-time';
import { Calendar as CalendarIcon } from 'lucide-react';
import { CalendarVector, SparkleVector } from '@/components/beauty-vectors';
import { SERVICES, MOBILE_LOCATION_OPTIONS, SERVICE_TYPE_OPTIONS, STUDIO_ADDRESS, GST_RATE } from '@/lib/services';
import { SERVICE_OPTION_DETAILS } from '@/lib/types';
import type { FinalQuote, ServiceType, ServiceOption, Address, Quote, PriceTier, Day, BridalTrial, BridalPartyServices, PaymentStatus, PaymentMethod } from '@/lib/types';
import { formatPrice } from '@/lib/price-format';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Trash2, Minus } from 'lucide-react';
import type { MOBILE_LOCATION_IDS } from '@/lib/services';

const getDefaultPartyServices = (): BridalPartyServices => ({
  addServices: false, 
  hairAndMakeup: 0, 
  makeupOnly: 0, 
  hairOnly: 0, 
  dupattaSetting: 0,
  hairExtensionInstallation: 0, 
  partySareeDraping: 0, 
  partyHijabSetting: 0, 
  airbrush: 0,
});

const getInitialDays = (): Day[] => {
  return [{ 
    id: Date.now(), 
    date: getTorontoNow(), 
    getReadyTime: '10:00', 
    serviceId: null, 
    serviceOption: 'makeup-hair',
    hairExtensions: 0, 
    jewellerySetting: false, 
    sareeDraping: false, 
    hijabSetting: false,
    serviceType: 'mobile', 
    mobileLocation: 'toronto',
    partyServices: getDefaultPartyServices(),
    partyPeopleCount: 1
  }];
};

const getInitialBridalTrial = (): BridalTrial => ({
  addTrial: false,
  date: undefined,
  time: '11:00',
  serviceOption: 'makeup-hair'
});

function generateTimeSlots() {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
}

const timeSlots = generateTimeSlots();

// Format phone number as user types (US/Canada format: (XXX) XXX-XXXX)
const formatPhoneNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  const limited = cleaned.slice(0, 10);
  if (limited.length === 0) {
    return '';
  } else if (limited.length <= 3) {
    return `(${limited}`;
  } else if (limited.length <= 6) {
    return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  } else {
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  }
};

const BASE_STEPS = [
  { id: 1, name: 'Services & Dates' },
  { id: 3, name: 'Contact Details' },
];

const BRIDAL_STEP = { id: 2, name: 'Bridal Options' };

// Calculate quotes via API
async function calculateQuotes(days: Day[], bridalTrial: BridalTrial): Promise<{ lead: Quote; team: Quote }> {
  const response = await fetch('/api/manual-booking/calculate-quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days, bridalTrial }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to calculate quotes');
  }

  const result = await response.json();
  return result.quotes;
}

export function ManualBookingForm({ onSuccess, onCancel }: { onSuccess?: () => void; onCancel?: () => void }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculatingQuotes, setIsCalculatingQuotes] = useState(false);
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [stepDirection, setStepDirection] = useState<'left' | 'right'>('right');
  const prevStepRef = useRef(currentStep);
  
  // Contact Information
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Booking Days
  const [days, setDays] = useState<Day[]>([]);
  
  // Initialize days on mount
  useEffect(() => {
    if (days.length === 0) {
      setDays(getInitialDays());
    }
  }, [days.length]);
  
  // Bridal Trial
  const [bridalTrial, setBridalTrial] = useState<BridalTrial>(getInitialBridalTrial);
  
  // Address (for mobile services)
  const [address, setAddress] = useState<Address>({
    street: '',
    city: '',
    province: 'ON',
    postalCode: ''
  });
  
  // Quotes
  const [leadQuote, setLeadQuote] = useState<Quote | null>(null);
  const [teamQuote, setTeamQuote] = useState<Quote | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<PriceTier | undefined>();
  
  // Status
  const [status, setStatus] = useState<'quoted' | 'confirmed' | 'cancelled'>('quoted');
  
  // Payment Status (for manual bookings)
  const [advancePaymentStatus, setAdvancePaymentStatus] = useState<PaymentStatus | 'none'>('none');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<PaymentMethod | 'none'>('none');
  const [finalPaymentStatus, setFinalPaymentStatus] = useState<PaymentStatus | 'none'>('none');
  const [finalPaymentMethod, setFinalPaymentMethod] = useState<PaymentMethod | 'none'>('none');
  
  // Follow-up Notes
  const [followupNotes, setFollowupNotes] = useState('');

  const hasBridalService = useMemo(() => days.some(day => day.serviceId === 'bridal' || day.serviceId === 'semi-bridal'), [days]);

  const STEPS = useMemo(() => {
    if (hasBridalService) {
      const steps = [...BASE_STEPS];
      steps.splice(1, 0, BRIDAL_STEP);
      return steps;
    }
    return BASE_STEPS;
  }, [hasBridalService]);

  // Track step direction for animations
  useEffect(() => {
    if (currentStep > prevStepRef.current) {
      setStepDirection('right');
    } else if (currentStep < prevStepRef.current) {
      setStepDirection('left');
    }
    prevStepRef.current = currentStep;
  }, [currentStep]);

  const progress = ((STEPS.findIndex(s => s.id === currentStep) + 1) / STEPS.length) * 100;

  const nextStep = async () => {
    if (currentStep === 1) {
      // Validate days
      for (const day of days) {
        if (!day.serviceId) {
          toast({ variant: 'destructive', title: 'Validation Error', description: `Please select a service for Day ${days.indexOf(day) + 1}.` });
          return;
        }
        if (day.serviceType === 'mobile' && !day.mobileLocation) {
          toast({ variant: 'destructive', title: 'Validation Error', description: `Please select a mobile service location for Day ${days.indexOf(day) + 1}.` });
          return;
        }
      }
    }

    if (currentStep === 2 && hasBridalService) {
      const hasBridalOnly = days.some(day => day.serviceId === 'bridal');
      if (bridalTrial.addTrial && hasBridalOnly) {
        if (!bridalTrial.date || !bridalTrial.time) {
          toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select a date and time for the bridal trial.' });
          return;
        }
        const bridalDay = days.find(d => d.serviceId === 'bridal');
        if (bridalDay?.date && bridalTrial.date && bridalTrial.date >= bridalDay.date) {
          toast({ variant: 'destructive', title: 'Validation Error', description: 'Bridal trial date must be before the main event date.' });
          return;
        }
      }
    }

    // If moving to contact details step, calculate quotes
    const contactStepId = STEPS.find(s => s.name === 'Contact Details')?.id;
    if (currentStep === (hasBridalService ? 2 : 1) && contactStepId) {
      // Calculate quotes before moving to contact step
      setIsCalculatingQuotes(true);
      try {
        const quotes = await calculateQuotes(days, bridalTrial);
        setLeadQuote(quotes.lead);
        setTeamQuote(quotes.team);
      } catch (error) {
        console.error('Error calculating quotes:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to calculate quotes. Please try again.' });
        return;
      } finally {
        setIsCalculatingQuotes(false);
      }
    }

    const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const prevStep = () => {
    const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!contactName?.trim() || !contactEmail?.trim() || !phoneNumber?.trim()) {
      toast({ title: 'Error', description: 'Please fill in all contact information', variant: 'destructive' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail.trim())) {
      toast({ title: 'Error', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }

    if (!selectedQuote) {
      toast({ title: 'Error', description: 'Please select a quote tier (Lead Artist or Team)', variant: 'destructive' });
      return;
    }

    // Check if mobile service needs address
    const hasMobileService = days.some(d => d.serviceType === 'mobile');
    if (hasMobileService && (!address.street?.trim() || !address.city?.trim() || !address.postalCode?.trim())) {
      toast({ title: 'Error', description: 'Please fill in the complete address for mobile service', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate booking ID (same format as original: 4-digit number between 1000-9999)
      const bookingId = Math.floor(1000 + Math.random() * 9000).toString();

      // Build booking days array - convert dates to PPP format
      const bookingDays = days.map((day, index) => {
        const service = SERVICES.find(s => s.id === day.serviceId);
        const location = day.serviceType === 'mobile' 
          ? MOBILE_LOCATION_OPTIONS[day.mobileLocation || 'toronto']?.label || 'Mobile Location'
          : 'Studio';
        
        // Convert date to PPP format
        let formattedDate: string;
        try {
          const dateObj = day.date || getTorontoNow();
          formattedDate = formatToronto(dateObj, 'PPP');
        } catch (error) {
          console.error('Error formatting date:', error);
          formattedDate = day.date?.toISOString() || '';
        }

        // Build add-ons array
        const addOns: string[] = [];
        if (day.hairExtensions > 0) {
          addOns.push(`Hair Extensions (x${day.hairExtensions})`);
        }
        if (day.jewellerySetting) {
          addOns.push("Jewellery/Dupatta Setting");
        }
        if (day.sareeDraping) {
          addOns.push("Saree Draping");
        }
        if (day.hijabSetting) {
          addOns.push("Hijab Setting");
        }
        
        return {
          date: formattedDate,
          getReadyTime: day.getReadyTime,
          serviceName: service?.name || '',
          serviceOption: day.serviceOption || 'makeup-hair',
          serviceType: day.serviceType,
          location,
          addOns,
        };
      });

      // Get selected quote data
      const selectedQuoteData = selectedQuote === 'lead' ? leadQuote : teamQuote;
      if (!selectedQuoteData) {
        throw new Error('Selected quote data not available');
      }

      // Build payment details if any payment status is set
      let paymentDetails: FinalQuote['paymentDetails'] | undefined;
      const depositAmount = selectedQuoteData.total * 0.5;
      const finalPaymentAmount = selectedQuoteData.total * 0.5;

      if (advancePaymentStatus !== 'none' || finalPaymentStatus !== 'none') {
        paymentDetails = {
          method: advancePaymentMethod !== 'none' ? advancePaymentMethod : 'interac',
          status: advancePaymentStatus !== 'none' ? advancePaymentStatus : 'deposit-pending',
          depositAmount,
        };

        if (finalPaymentStatus !== 'none') {
          paymentDetails.finalPayment = {
            method: finalPaymentMethod !== 'none' ? finalPaymentMethod : undefined,
            status: finalPaymentStatus,
            amount: finalPaymentAmount,
          };
        }
      }

      // Build bridal party data if needed
      let bridalPartyData: FinalQuote['booking']['bridalParty'] | undefined;
      const hasBridalPartyServices = days.some(d => (d.serviceId === 'bridal' || d.serviceId === 'semi-bridal') && d.partyServices?.addServices);
      if (hasBridalPartyServices) {
        // Aggregate party services from all bridal/semi-bridal days
        const aggregated: BridalPartyServices = getDefaultPartyServices();
        days.forEach(day => {
          if ((day.serviceId === 'bridal' || day.serviceId === 'semi-bridal') && day.partyServices?.addServices) {
            aggregated.hairAndMakeup += day.partyServices.hairAndMakeup || 0;
            aggregated.makeupOnly += day.partyServices.makeupOnly || 0;
            aggregated.hairOnly += day.partyServices.hairOnly || 0;
            aggregated.dupattaSetting += day.partyServices.dupattaSetting || 0;
            aggregated.hairExtensionInstallation += day.partyServices.hairExtensionInstallation || 0;
            aggregated.partySareeDraping += day.partyServices.partySareeDraping || 0;
            aggregated.partyHijabSetting += day.partyServices.partyHijabSetting || 0;
            aggregated.airbrush += day.partyServices.airbrush || 0;
          }
        });
        
        const services: Array<{ service: string; quantity: number }> = [];
        if (aggregated.hairAndMakeup > 0) services.push({ service: 'hairAndMakeup', quantity: aggregated.hairAndMakeup });
        if (aggregated.makeupOnly > 0) services.push({ service: 'makeupOnly', quantity: aggregated.makeupOnly });
        if (aggregated.hairOnly > 0) services.push({ service: 'hairOnly', quantity: aggregated.hairOnly });
        if (aggregated.dupattaSetting > 0) services.push({ service: 'dupattaSetting', quantity: aggregated.dupattaSetting });
        if (aggregated.hairExtensionInstallation > 0) services.push({ service: 'hairExtensionInstallation', quantity: aggregated.hairExtensionInstallation });
        if (aggregated.partySareeDraping > 0) services.push({ service: 'partySareeDraping', quantity: aggregated.partySareeDraping });
        if (aggregated.partyHijabSetting > 0) services.push({ service: 'partyHijabSetting', quantity: aggregated.partyHijabSetting });
        
        bridalPartyData = {
          services,
          airbrush: aggregated.airbrush,
        };
      }

      // Build final quote
      const finalQuote: FinalQuote = {
        id: bookingId,
        contact: {
          name: contactName.trim(),
          email: contactEmail.trim(),
          phone: phoneNumber.replace(/\D/g, ''), // Store as digits only
        },
        booking: {
          days: bookingDays,
          hasMobileService: days.some(d => d.serviceType === 'mobile'),
          ...(days.some(d => d.serviceType === 'mobile') && { address }),
          ...(bridalTrial.addTrial && {
            trial: {
              date: bridalTrial.date ? formatToronto(bridalTrial.date, 'PPP') : '',
              time: bridalTrial.time,
              serviceOption: bridalTrial.serviceOption,
            },
          }),
          ...(bridalPartyData && { bridalParty: bridalPartyData }),
        },
        quotes: {
          lead: leadQuote || { lineItems: [], subtotal: 0, tax: 0, total: 0 },
          team: teamQuote || { lineItems: [], subtotal: 0, tax: 0, total: 0 },
        },
        selectedQuote,
        status,
        quoteGeneratedAt: new Date().toISOString(),
        ...(paymentDetails && { paymentDetails }),
        ...(followupNotes && { followupNotes }),
        isManualBooking: true, // Flag to disable automated emails/messages
      };

      // Save to API
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalQuote }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create booking');
      }

      toast({ title: 'Success', description: 'Manual booking created successfully' });
      
      // Reset form
      setContactName('');
      setContactEmail('');
      setPhoneNumber('');
      setDays(getInitialDays());
      setBridalTrial(getInitialBridalTrial());
      setAddress({ street: '', city: '', province: 'ON', postalCode: '' });
      setLeadQuote(null);
      setTeamQuote(null);
      setSelectedQuote(undefined);
      setStatus('quoted');
      setAdvancePaymentStatus('none');
      setAdvancePaymentMethod('none');
      setFinalPaymentStatus('none');
      setFinalPaymentMethod('none');
      setFollowupNotes('');
      setCurrentStep(1);
      
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error creating manual booking:', error);
      toast({ title: 'Error', description: error.message || 'Failed to create booking', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Import BookingDayCard and BridalServiceOptions from booking-flow
  // For now, we'll create inline versions that match the exact structure
  // (We can't directly import them as they're not exported, so we'll replicate the structure)

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-3 sm:mb-4 md:mb-5 px-1 sm:px-2 animate-fade-in-up">
        <Progress value={progress} className="h-2 transition-smooth" />
        <div className="flex flex-wrap justify-between gap-1 sm:gap-2 mt-2">
          {STEPS.map((step, index) => (
            <div key={step.id} className={cn(
              "text-xs sm:text-sm flex-1 min-w-0 transition-smooth",
              step.id < currentStep ? "text-black font-medium" :
              step.id === currentStep ? "text-black font-bold" : "text-muted-foreground",
              STEPS.length > 2 && index === 1 ? 'text-center' : '',
              STEPS.length > 2 && index === 2 ? 'text-right' : '',
              STEPS.length === 2 && index === 1 ? 'text-right' : '',
            )}>
              <span className="truncate block">{step.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5 sm:space-y-6 md:space-y-8">
        {/* Step 1: Services & Dates */}
        <div className={cn(
          currentStep !== 1 && 'hidden',
          stepDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'
        )}>
          <Card className="shadow-lg animate-fade-in-scale">
            <CardHeader className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="flex items-center gap-3 mb-2">
                <CalendarVector size={28} className="text-black/40 animate-float" />
                <CardTitle className="font-headline text-xl sm:text-2xl">1. Services & Dates</CardTitle>
              </div>
              <CardDescription className="text-sm sm:text-base">Select services, dates, and times for the booking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 md:space-y-6 px-3 sm:px-6">
              <div className="space-y-3 sm:space-y-4 animate-stagger">
                {days.length === 0 ? null : (
                  <>
                    {days.map((day, index) => (
                      <BookingDayCard
                        key={day.id}
                        day={day}
                        index={index}
                        updateDay={(id, data) => setDays(days.map(d => d.id === id ? {...d, ...data} : d))}
                        removeDay={(id) => setDays(days.filter(d => d.id !== id))}
                        isOnlyDay={days.length <= 1}
                      />
                    ))}
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setDays([...days, { 
                        id: Date.now(), 
                        date: getTorontoNow(), 
                        getReadyTime: '10:00', 
                        serviceId: null, 
                        serviceOption: 'makeup-hair', 
                        hairExtensions: 0, 
                        jewellerySetting: false, 
                        sareeDraping: false, 
                        hijabSetting: false, 
                        serviceType: 'mobile', 
                        mobileLocation: 'toronto', 
                        partyServices: getDefaultPartyServices(), 
                        partyPeopleCount: 1 
                      }])} 
                      className="w-full transition-smooth hover:scale-[1.02]"
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Another Day
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 2: Bridal Options (if bridal service) */}
        {hasBridalService && (
          <div className={cn(
            currentStep !== 2 && 'hidden',
            stepDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'
          )}>
            <BridalServiceOptions
              bridalTrial={bridalTrial}
              updateBridalTrial={(data) => setBridalTrial(prev => ({...prev, ...data}))}
              days={days}
              setDays={setDays}
            />
          </div>
        )}

        {/* Step 3: Contact Details */}
        <div className={cn(
          currentStep !== STEPS.find(s => s.name === 'Contact Details')?.id && 'hidden',
          stepDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'
        )}>
          <Card className="shadow-lg animate-fade-in-scale">
            <CardHeader className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="flex items-center gap-3 mb-2">
                <SparkleVector size={28} className="text-black/40 animate-float" />
                <CardTitle className="font-headline text-xl sm:text-2xl">{STEPS[STEPS.length - 1].name}</CardTitle>
              </div>
              <CardDescription className="text-sm sm:text-base">Please provide contact information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 md:space-y-8 px-3 sm:px-6">
              <div className="animate-stagger">
                <div className="space-y-3 sm:space-y-4 mt-2">
                  <div className="animate-fade-in-up">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input 
                      id="name" 
                      placeholder="Jane Doe" 
                      required 
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="transition-smooth focus-ring"
                    />
                  </div>
                  <div className="animate-fade-in-up">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="jane.doe@example.com" 
                      required 
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="transition-smooth focus-ring"
                    />
                  </div>
                  <div className="animate-fade-in-up">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input 
                      id="phone" 
                      type="tel" 
                      placeholder="(416) 555-1234" 
                      required 
                      value={phoneNumber}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        setPhoneNumber(formatted);
                      }}
                      maxLength={14}
                      className="transition-smooth focus-ring"
                    />
                  </div>
                </div>
              </div>

              {/* Address for mobile services */}
              {days.some(d => d.serviceType === 'mobile') && (
                <div className="space-y-3 sm:space-y-4 mt-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Service Address *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="street">Street Address *</Label>
                      <Input
                        id="street"
                        value={address.street}
                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                        placeholder="123 Main St"
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        placeholder="Toronto"
                      />
                    </div>
                    <div>
                      <Label htmlFor="postalCode">Postal Code *</Label>
                      <Input
                        id="postalCode"
                        value={address.postalCode}
                        onChange={(e) => setAddress({ ...address, postalCode: e.target.value.toUpperCase().replace(/\s/g, '') })}
                        placeholder="M5H 2N2"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Status and Notes */}
              <div className="space-y-4 mt-4 pt-4 border-t">
                <div>
                  <Label>Booking Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as 'quoted' | 'confirmed' | 'cancelled')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quoted">Quoted</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Status Management */}
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Payment Status</Label>
                  
                  {/* Advance Payment */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Advance Payment (50%)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="advanceStatus" className="text-xs text-muted-foreground mb-1">Status</Label>
                        <Select 
                          value={advancePaymentStatus} 
                          onValueChange={(value) => {
                            setAdvancePaymentStatus(value as PaymentStatus | 'none');
                            if (value === 'none') {
                              setAdvancePaymentMethod('none');
                            }
                          }}
                        >
                          <SelectTrigger id="advanceStatus">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not Set</SelectItem>
                            <SelectItem value="deposit-pending">Pending</SelectItem>
                            <SelectItem value="deposit-paid">Paid</SelectItem>
                            <SelectItem value="payment-approved">Approved</SelectItem>
                            <SelectItem value="screenshot-rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="advanceMethod" className="text-xs text-muted-foreground mb-1">Method</Label>
                        <Select 
                          value={advancePaymentMethod} 
                          onValueChange={(value) => setAdvancePaymentMethod(value as PaymentMethod | 'none')}
                          disabled={advancePaymentStatus === 'none'}
                        >
                          <SelectTrigger id="advanceMethod">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not Set</SelectItem>
                            <SelectItem value="stripe">Stripe</SelectItem>
                            <SelectItem value="interac">Interac</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Final Payment */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Final Payment (50%)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="finalStatus" className="text-xs text-muted-foreground mb-1">Status</Label>
                        <Select 
                          value={finalPaymentStatus} 
                          onValueChange={(value) => {
                            setFinalPaymentStatus(value as PaymentStatus | 'none');
                            if (value === 'none') {
                              setFinalPaymentMethod('none');
                            }
                          }}
                        >
                          <SelectTrigger id="finalStatus">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not Set</SelectItem>
                            <SelectItem value="deposit-pending">Pending</SelectItem>
                            <SelectItem value="deposit-paid">Paid</SelectItem>
                            <SelectItem value="payment-approved">Approved</SelectItem>
                            <SelectItem value="screenshot-rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="finalMethod" className="text-xs text-muted-foreground mb-1">Method</Label>
                        <Select 
                          value={finalPaymentMethod} 
                          onValueChange={(value) => setFinalPaymentMethod(value as PaymentMethod | 'none')}
                          disabled={finalPaymentStatus === 'none'}
                        >
                          <SelectTrigger id="finalMethod">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not Set</SelectItem>
                            <SelectItem value="stripe">Stripe</SelectItem>
                            <SelectItem value="interac">Interac</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="followupNotes">Follow-up Notes (Optional)</Label>
                  <Input
                    id="followupNotes"
                    value={followupNotes}
                    onChange={(e) => setFollowupNotes(e.target.value)}
                    placeholder="Add any notes for follow-up..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 4: Quote Selection */}
        {currentStep === (STEPS.length + 1) && leadQuote && teamQuote && (
          <div className={cn(
            stepDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'
          )}>
            <Card className="shadow-lg animate-fade-in-scale">
              <CardHeader className="px-3 sm:px-6 pb-3 sm:pb-6">
                <CardTitle className="font-headline text-xl sm:text-2xl">Select Quote</CardTitle>
                <CardDescription className="text-sm sm:text-base">Choose between Lead Artist or Team pricing.</CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <RadioGroup 
                  value={selectedQuote} 
                  onValueChange={(val) => setSelectedQuote(val as PriceTier)} 
                  className={cn(
                    "grid grid-cols-1 gap-4 sm:gap-6 p-3 sm:p-4 rounded-2xl border border-white/50 bg-white/75 backdrop-blur-md shadow-sm",
                    "sm:grid-cols-2"
                  )}
                >
                  <QuoteTierCard 
                    title="Anum - Lead Artist"
                    icon={<User className="w-8 h-8 text-black" />}
                    quote={leadQuote}
                    tier="lead"
                    selectedTier={selectedQuote}
                    onSelect={setSelectedQuote}
                  />
                  <QuoteTierCard 
                    title="Team"
                    icon={<Users className="w-8 h-8 text-black" />}
                    quote={teamQuote}
                    tier="team"
                    selectedTier={selectedQuote}
                    onSelect={setSelectedQuote}
                  />
                </RadioGroup>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-3 sm:mt-4 md:mt-6 flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 animate-fade-in-up">
          <Button 
            type="button" 
            variant="outline" 
            onClick={prevStep} 
            className={cn(
              currentStep === 1 && 'invisible', 
              'w-full sm:w-auto h-10 sm:h-11 transition-smooth hover:scale-[1.02] active:scale-[0.98]'
            )}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {currentStep < STEPS[STEPS.length - 1].id ? (
            <Button 
              type="button" 
              onClick={nextStep} 
              disabled={isCalculatingQuotes}
              className="w-full sm:w-auto h-10 sm:h-11 transition-smooth hover:scale-[1.02] active:scale-[0.98]"
            >
              {isCalculatingQuotes ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          ) : currentStep === STEPS[STEPS.length - 1].id ? (
            <Button 
              type="button" 
              onClick={async () => {
                // Calculate quotes and move to quote selection step
                setIsCalculatingQuotes(true);
                try {
                  const quotes = await calculateQuotes(days, bridalTrial);
                  setLeadQuote(quotes.lead);
                  setTeamQuote(quotes.team);
                  setCurrentStep(STEPS.length + 1); // Move to quote selection step
                } catch (error) {
                  console.error('Error calculating quotes:', error);
                  toast({ variant: 'destructive', title: 'Error', description: 'Failed to calculate quotes. Please try again.' });
                } finally {
                  setIsCalculatingQuotes(false);
                }
              }}
              disabled={isCalculatingQuotes}
              className="w-full sm:w-auto h-10 sm:h-11 transition-smooth hover:scale-[1.02] active:scale-[0.98]"
            >
              {isCalculatingQuotes ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating Quotes...
                </>
              ) : (
                <>
                  View Quotes
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button 
              type="button"
              onClick={handleSubmit} 
              disabled={isSubmitting || !selectedQuote}
              className="w-full sm:w-auto h-10 sm:h-11 transition-smooth hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Booking'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Quote Tier Card Component (matching quote-confirmation.tsx design)
function QuoteTierCard({ title, icon, quote, tier, selectedTier, onSelect }: { 
  title: string; 
  icon: React.ReactNode;
  quote: Quote;
  tier: PriceTier;
  selectedTier: PriceTier | undefined;
  onSelect: (tier: PriceTier) => void;
}) {
  const isSelected = selectedTier === tier;
  return (
    <Label
      htmlFor={`tier-${tier}`}
      className={cn(
        "block rounded-2xl cursor-pointer overflow-hidden transition-smooth border border-white/60 bg-gradient-to-br from-white/90 via-white/40 to-white/10 backdrop-blur-xl shadow-md",
        isSelected
          ? "border-black/70 ring-2 ring-black/70 shadow-lg scale-[1.02]"
          : "hover:border-white/80 hover:shadow-lg hover:scale-[1.01]"
      )}
    >
      <RadioGroupItem value={tier} id={`tier-${tier}`} className="sr-only" />
      <Card className="shadow-none border-none bg-transparent">
        <CardHeader className="flex-row items-center gap-4 space-y-0">
          {icon}
          <div>
            <CardTitle className="font-headline text-2xl">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {quote.lineItems.map((item, index) => (
              <li key={index} className="flex justify-between">
                <span className={item.description.startsWith('  -') || item.description.startsWith('Party:') ? 'pl-4 text-muted-foreground' : ''}>{item.description}</span>
                <span className="font-medium">${formatPrice(item.price)}</span>
              </li>
            ))}
          </ul>
          <Separator className="my-2" />
          <ul className="space-y-1 text-sm font-medium">
            <li className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${formatPrice(quote.subtotal)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">GST (13%)</span>
              <span>${formatPrice(quote.tax)}</span>
            </li>
          </ul>
          <Separator className="my-2" />
          <div className="flex justify-between items-baseline">
            <div className="flex flex-col">
              <span className="text-base font-bold">Total</span>
              <span className="text-xs text-muted-foreground mt-0.5">include 13% GST</span>
            </div>
            <span className="text-xl font-bold text-black">${formatPrice(quote.total)}</span>
          </div>
        </CardContent>
        <CardContent className="bg-secondary/30 p-4 rounded-b-lg space-y-2">
          <div className="w-full pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center">
              50% advance (${formatPrice(quote.total * 0.5)}) required now<br />
              50% (${formatPrice(quote.total * 0.5)}) due on booking day
            </p>
          </div>
        </CardContent>
      </Card>
    </Label>
  );
}

// BookingDayCard Component (matching booking-flow.tsx structure)
function BookingDayCard({ day, index, updateDay, removeDay, isOnlyDay }: {
  day: Day;
  index: number;
  updateDay: (id: number, data: Partial<Omit<Day, 'id'>>) => void;
  removeDay: (id: number) => void;
  isOnlyDay: boolean;
}) {
  const service = SERVICES.find(s => s.id === day.serviceId);
  const showAddons = service?.id === 'bridal' || service?.id === 'semi-bridal';
  const shouldUseGenericTitle = service?.id === 'party' || service?.id === 'semi-bridal' || service?.id === 'photoshoot';
  const isOutsideToronto = useMemo(() => day.mobileLocation !== 'toronto', [day.mobileLocation]);

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 rounded-lg border bg-card/50 relative">
      {!isOnlyDay && (
        <Button type="button" variant="ghost" size="icon" onClick={() => removeDay(day.id)} className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 hover:bg-destructive/20 hover:text-destructive h-7 w-7 sm:h-8 sm:w-8">
          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <div>
          <Label htmlFor={`date-${index}`} className="text-sm sm:text-base">Day {index + 1} - Date *</Label>
          <Popover modal={true}>
            <PopoverTrigger asChild>
              <Button 
                variant={"outline"} 
                className={cn("w-full justify-start text-left font-normal h-9 sm:h-10 touch-manipulation", !day.date && "text-muted-foreground")} 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {day.date ? formatToronto(day.date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0 z-[200]" 
              align="start" 
              side="bottom" 
              sideOffset={8}
            >
              <Calendar 
                mode="single" 
                selected={day.date} 
                onSelect={(date) => { 
                  if (date) {
                    updateDay(day.id, { date: date as Date }); 
                  }
                }} 
                disabled={(date) => {
                  const today = getTorontoToday();
                  return date < today;
                }} 
                initialFocus 
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label htmlFor={`getReadyTime-${index}`} className="text-sm sm:text-base">Get Ready Time *</Label>
          <Select value={day.getReadyTime} onValueChange={(value) => updateDay(day.id, { getReadyTime: value })} required>
            <SelectTrigger className="h-9 sm:h-10 touch-manipulation"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[200] max-h-[50vh] overflow-y-auto">
              {timeSlots.map(slot => (
                <SelectItem key={slot} value={slot}>
                  {formatToronto(new Date(`1970-01-01T${slot}`), 'p')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`service-${index}`} className="text-sm sm:text-base">Service *</Label>
          <Select value={day.serviceId || ''} onValueChange={(serviceId) => {
            const isBridalOrSemiBridal = serviceId === 'bridal' || serviceId === 'semi-bridal';
            const isParty = serviceId === 'party';
            updateDay(day.id, { 
              serviceId: serviceId || null,
              partyServices: isBridalOrSemiBridal ? (day.partyServices || getDefaultPartyServices()) : undefined,
              partyPeopleCount: isParty ? (day.partyPeopleCount || 1) : undefined
            });
          }} required>
            <SelectTrigger className="h-9 sm:h-10 touch-manipulation"><SelectValue placeholder="Select a service" /></SelectTrigger>
            <SelectContent className="z-[200] max-h-[50vh] overflow-y-auto">
              {SERVICES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{s.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />
      
      <div>
        <Label className="text-sm sm:text-base font-medium">Service Type *</Label>
        <RadioGroup value={day.serviceType} onValueChange={(value) => updateDay(day.id, { serviceType: value as ServiceType })} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-2" required>
          {Object.values(SERVICE_TYPE_OPTIONS).map(opt => (
            <Label key={opt.id} className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground has-[[data-state=checked]]:border-black transition-colors">
              <RadioGroupItem value={opt.id} id={`${day.id}-${opt.id}`} />
              <div className='flex flex-col'>
                <span className="font-semibold">{opt.label}</span>
                <span className="text-sm text-muted-foreground">{opt.description}</span>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </div>
      
      {day.serviceType === 'studio' && (
        <div className="p-4 border rounded-lg bg-accent/50">
          <h3 className="font-medium text-sm mb-2">Studio Location</h3>
          <a href={STUDIO_ADDRESS.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm space-y-1 group">
            <p>{STUDIO_ADDRESS.street}</p>
            <p className='text-muted-foreground'>{STUDIO_ADDRESS.city}, {STUDIO_ADDRESS.province} {STUDIO_ADDRESS.postalCode}</p>
            <div className='flex items-center gap-2 pt-1'>
              <MapPin className='w-4 h-4 text-black'/>
              <span className='text-black font-medium group-hover:underline'>View on Google Maps</span>
            </div>
          </a>
        </div>
      )}

      {day.serviceType === 'mobile' && (
        <div className="space-y-4">
          <div>
            <Label className="text-md font-medium">Mobile Service Location *</Label>
            <RadioGroup
              value={isOutsideToronto ? 'outside-gta' : 'toronto'}
              onValueChange={(value) => {
                if (value === 'toronto') {
                  updateDay(day.id, { mobileLocation: 'toronto' });
                } else {
                  const firstOutsideOption = Object.keys(MOBILE_LOCATION_OPTIONS).find(key => key !== 'toronto') as MOBILE_LOCATION_IDS;
                  updateDay(day.id, { mobileLocation: firstOutsideOption });
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2"
            >
              <Label className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground has-[[data-state=checked]]:border-primary transition-colors">
                <RadioGroupItem value="toronto" id={`${day.id}-loc-gta`} />
                <span className="font-semibold">Toronto / GTA</span>
              </Label>
              <Label className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground has-[[data-state=checked]]:border-primary transition-colors">
                <RadioGroupItem value="outside-gta" id={`${day.id}-loc-outside`} />
                <span className="font-semibold">Outside Toronto / GTA</span>
              </Label>
            </RadioGroup>
          </div>

          {isOutsideToronto && (
            <div className='pl-4 border-l-2 border-gray-300'>
              <Label className="text-md font-medium">Approximate Drive Distance</Label>
              <RadioGroup value={day.mobileLocation} onValueChange={(value) => updateDay(day.id, { mobileLocation: value as MOBILE_LOCATION_IDS })} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2" required>
                {Object.values(MOBILE_LOCATION_OPTIONS).filter(opt => opt.id !== 'toronto').map(opt => (
                  <Label key={opt.id} className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground has-[[data-state=checked]]:border-black transition-colors">
                    <RadioGroupItem value={opt.id} id={`${day.id}-mobile-${opt.id}`} />
                    <span>{opt.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>
      )}

      {service?.askServiceType && (
        <div className='pt-4'>
          <Label>Service Option *</Label>
          <RadioGroup value={day.serviceOption || 'makeup-hair'} onValueChange={(val) => updateDay(day.id, { serviceOption: val as ServiceOption })} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {Object.entries(SERVICE_OPTION_DETAILS).map(([id, {label}]) => (
              <Label key={id} className="flex items-center space-x-2 border rounded-md p-2 justify-center cursor-pointer hover:bg-accent hover:text-accent-foreground has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground has-[[data-state=checked]]:border-primary transition-colors text-sm">
                <RadioGroupItem value={id} id={`${day.id}-${id}`} />
                <span>{label}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>
      )}
      
      {service && (
        <Card className='mt-3 sm:mt-4 bg-background/50'>
          <CardHeader className='p-3 sm:p-4'>
            <CardTitle className='text-base sm:text-lg'>{shouldUseGenericTitle ? 'Add-ons' : "Bride's Add-ons"}</CardTitle>
          </CardHeader>
          <CardContent className='p-3 sm:p-4 pt-0 space-y-3 sm:space-y-4'>
            {service.id === 'party' && (
              <>
                <div>
                  <Label htmlFor={`partyPeopleCount-${index}`}>Number of People *</Label>
                  <p className="text-xs text-muted-foreground mb-2">How many people need services?</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => {
                      const currentCount = (day as any).partyPeopleCount || 1;
                      updateDay(day.id, { ...day, partyPeopleCount: Math.max(1, currentCount - 1) } as any);
                    }}><Minus className="h-4 w-4" /></Button>
                    <Input 
                      id={`partyPeopleCount-${index}`}
                      type="number" 
                      min="1" 
                      max="100" 
                      className="w-20 text-center" 
                      value={(day as any).partyPeopleCount || 1} 
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10) || 1;
                        updateDay(day.id, { ...day, partyPeopleCount: Math.max(1, Math.min(100, value)) } as any);
                      }} 
                      required
                    />
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => {
                      const currentCount = (day as any).partyPeopleCount || 1;
                      updateDay(day.id, { ...day, partyPeopleCount: currentCount + 1 } as any);
                    }}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <Separator />
              </>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor={`jewellerySetting-${index}`} className="flex flex-col gap-1 cursor-pointer">
                <span>Jewellery/Dupatta Setting</span>
                <span className='text-xs text-muted-foreground'>Price revealed in quote</span>
              </Label>
              <Switch id={`jewellerySetting-${index}`} checked={day.jewellerySetting} onCheckedChange={(checked) => updateDay(day.id, { jewellerySetting: checked })} />
            </div>
            
            {(showAddons || service.id === 'party') && <>
              <Separator />
              <div className="flex items-center justify-between">
                <Label htmlFor={`sareeDraping-${index}`} className="flex flex-col gap-1 cursor-pointer">
                  <span>Saree Draping</span>
                  <span className='text-xs text-muted-foreground'>Price revealed in quote</span>
                </Label>
                <Switch id={`sareeDraping-${index}`} checked={day.sareeDraping} onCheckedChange={(checked) => updateDay(day.id, { sareeDraping: checked })} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label htmlFor={`hijabSetting-${index}`} className="flex flex-col gap-1 cursor-pointer">
                  <span>Hijab Setting</span>
                  <span className='text-xs text-muted-foreground'>Price revealed in quote</span>
                </Label>
                <Switch id={`hijabSetting-${index}`} checked={day.hijabSetting} onCheckedChange={(checked) => updateDay(day.id, { hijabSetting: checked })} />
              </div>
            </>}
            <Separator />
            <div>
              <Label htmlFor={`hairExtensions-${index}`}>Hair Extensions</Label>
              <p className="text-xs text-muted-foreground mb-2">Price revealed in quote</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateDay(day.id, { hairExtensions: Math.max(0, day.hairExtensions - 1) })}><Minus className="h-4 w-4" /></Button>
                <Input id={`hairExtensions-${index}`} type="number" min="0" max="100" className="w-16 text-center" value={day.hairExtensions} onChange={(e) => {
                  const value = parseInt(e.target.value, 10) || 0;
                  updateDay(day.id, { hairExtensions: Math.max(0, Math.min(100, value)) });
                }} />
                <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateDay(day.id, { hairExtensions: day.hairExtensions + 1 })}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// BridalServiceOptions Component (matching booking-flow.tsx structure)
function BridalServiceOptions({ bridalTrial, updateBridalTrial, days, setDays }: {
  bridalTrial: BridalTrial;
  updateBridalTrial: (data: Partial<BridalTrial>) => void;
  days: Day[];
  setDays: (days: Day[] | ((prev: Day[]) => Day[])) => void;
}) {
  const hasBridalOnly = days.some(day => day.serviceId === 'bridal');

  return (
    <div className="space-y-8">
      {hasBridalOnly && (
        <Card className="shadow-lg">
          <CardHeader className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div>
                <CardTitle className="font-headline text-xl sm:text-2xl">Bridal Trial</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Add a trial session before your big day. Select your preferred service option for the trial. Price revealed in quote.
                </CardDescription>
              </div>
              <Switch checked={bridalTrial.addTrial} onCheckedChange={(checked) => updateBridalTrial({ addTrial: checked })} />
            </div>
          </CardHeader>
          {bridalTrial.addTrial && (
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
              <div>
                <Label className="text-sm sm:text-base mb-2 block">Trial Service Option *</Label>
                <RadioGroup 
                  value={bridalTrial.serviceOption || 'makeup-hair'} 
                  onValueChange={(val) => updateBridalTrial({ serviceOption: val as ServiceOption })} 
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2"
                >
                  {Object.entries(SERVICE_OPTION_DETAILS).map(([id, {label}]) => (
                    <Label key={id} className="flex items-center space-x-2 border rounded-md p-2 justify-center cursor-pointer hover:bg-accent hover:text-accent-foreground has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground has-[[data-state=checked]]:border-primary transition-colors text-sm">
                      <RadioGroupItem value={id} id={`trial-${id}`} />
                      <span>{label}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="trialDate" className="text-sm sm:text-base">Trial Date *</Label>
                  <Popover modal={true}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant={"outline"} 
                        className={cn("w-full justify-start text-left font-normal h-9 sm:h-10 touch-manipulation", !bridalTrial.date && "text-muted-foreground")} 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {bridalTrial.date ? formatToronto(bridalTrial.date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-auto p-0 z-[200]" 
                      align="start" 
                      side="bottom" 
                      sideOffset={8}
                    >
                      <Calendar 
                        mode="single" 
                        selected={bridalTrial.date} 
                        onSelect={(date) => { 
                          if (date) {
                            updateBridalTrial({ date: date as Date }); 
                          }
                        }} 
                        disabled={(date) => {
                          const bridalDay = days.find(d=>d.serviceId === 'bridal')?.date;
                          const today = getTorontoToday();
                          if (!bridalDay) return date < today;
                          return date >= bridalDay || date < today;
                        }} 
                        initialFocus 
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="trialTime" className="text-sm sm:text-base">Trial Time *</Label>
                  <Select value={bridalTrial.time} onValueChange={(value) => updateBridalTrial({ time: value })} required={bridalTrial.addTrial}>
                    <SelectTrigger className="h-9 sm:h-10 touch-manipulation"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[200] max-h-[50vh] overflow-y-auto">
                      {timeSlots.map(slot => (
                        <SelectItem key={slot} value={slot}>
                          {formatToronto(new Date(`1970-01-01T${slot}`), 'p')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Party Services for each Bridal/Semi-Bridal day */}
      {(() => {
        const bridalSemiBridalDays = days.filter(day => day.serviceId === 'bridal' || day.serviceId === 'semi-bridal');
        const daysByDate = new Map<string, typeof bridalSemiBridalDays>();
        
        bridalSemiBridalDays.forEach(day => {
          if (day.date) {
            const dateKey = day.date.toISOString().split('T')[0];
            if (!daysByDate.has(dateKey)) {
              daysByDate.set(dateKey, []);
            }
            daysByDate.get(dateKey)!.push(day);
          }
        });
        
        const daysToShow = bridalSemiBridalDays.filter(day => {
          if (!day.date) return false;
          const dateKey = day.date.toISOString().split('T')[0];
          const daysOnSameDate = daysByDate.get(dateKey) || [];
          const hasBridal = daysOnSameDate.some(d => d.serviceId === 'bridal');
          const hasSemiBridal = daysOnSameDate.some(d => d.serviceId === 'semi-bridal');
          
          if (hasBridal && hasSemiBridal) {
            return day.serviceId === 'bridal';
          }
          return true;
        });
        
        return daysToShow.map((day) => {
          const dayNumber = days.findIndex(d => d.id === day.id) + 1;
          const serviceName = day.serviceId === 'bridal' ? 'Bridal' : 'Semi-Bridal';
          const partyServices = day.partyServices || getDefaultPartyServices();
          
          return (
            <Card key={day.id} className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className='flex items-center gap-4'>
                    <Users className='w-6 h-6 text-black'/>
                    <div>
                      <CardTitle className="font-headline text-2xl">{serviceName} Party Services - Day {dayNumber}</CardTitle>
                      <CardDescription>Aside from the {day.serviceId === 'bridal' ? 'bride' : 'client'}, are there other members requiring services for this day?</CardDescription>
                    </div>
                  </div>
                  <Switch 
                    checked={partyServices.addServices} 
                    onCheckedChange={(checked) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id 
                          ? { ...d, partyServices: { ...partyServices, addServices: checked } }
                          : d
                      );
                      setDays(updatedDays);
                    }} 
                  />
                </div>
              </CardHeader>
              {partyServices.addServices && (
                <CardContent className="space-y-6 pt-2">
                  <PartyServiceInput
                    name="hairAndMakeup"
                    label="Both Hair & Makeup"
                    description={`Complete styling package. This does not include the ${day.serviceId === 'bridal' ? 'bride' : 'client'}.`}
                    value={partyServices.hairAndMakeup}
                    onValueChange={(val) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id 
                          ? { ...d, partyServices: { ...partyServices, hairAndMakeup: val } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    onButtonClick={(field, increase) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id && d.partyServices
                          ? { ...d, partyServices: { ...d.partyServices, [field]: Math.max(0, (d.partyServices[field] as number) + (increase ? 1 : -1)) } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    dayId={day.id}
                  />
                  <PartyServiceInput
                    name="makeupOnly"
                    label="Makeup Only"
                    description={`These people do not need hair done. This does not include the ${day.serviceId === 'bridal' ? 'bride' : 'client'}.`}
                    value={partyServices.makeupOnly}
                    onValueChange={(val) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id 
                          ? { ...d, partyServices: { ...partyServices, makeupOnly: val } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    onButtonClick={(field, increase) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id && d.partyServices
                          ? { ...d, partyServices: { ...d.partyServices, [field]: Math.max(0, (d.partyServices[field] as number) + (increase ? 1 : -1)) } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    dayId={day.id}
                  />
                  <PartyServiceInput
                    name="hairOnly"
                    label="Hair Only"
                    description={`These people do not need makeup done. This does not include the ${day.serviceId === 'bridal' ? 'bride' : 'client'}.`}
                    value={partyServices.hairOnly}
                    onValueChange={(val) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id 
                          ? { ...d, partyServices: { ...partyServices, hairOnly: val } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    onButtonClick={(field, increase) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id && d.partyServices
                          ? { ...d, partyServices: { ...d.partyServices, [field]: Math.max(0, (d.partyServices[field] as number) + (increase ? 1 : -1)) } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    dayId={day.id}
                  />
                  <Separator/>
                  <PartyServiceInput
                    name="dupattaSetting"
                    label="Dupatta/Veil Setting"
                    description="Professional assistance with dupatta or veil arrangement."
                    value={partyServices.dupattaSetting}
                    onValueChange={(val) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id 
                          ? { ...d, partyServices: { ...partyServices, dupattaSetting: val } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    onButtonClick={(field, increase) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id && d.partyServices
                          ? { ...d, partyServices: { ...d.partyServices, [field]: Math.max(0, (d.partyServices[field] as number) + (increase ? 1 : -1)) } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    dayId={day.id}
                  />
                  <PartyServiceInput
                    name="hairExtensionInstallation"
                    label="Hair Extensions Installation"
                    description="*Note: We do not provide the hair extensions. Each person must have their own."
                    value={partyServices.hairExtensionInstallation}
                    onValueChange={(val) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id 
                          ? { ...d, partyServices: { ...partyServices, hairExtensionInstallation: val } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    onButtonClick={(field, increase) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id && d.partyServices
                          ? { ...d, partyServices: { ...d.partyServices, [field]: Math.max(0, (d.partyServices[field] as number) + (increase ? 1 : -1)) } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    dayId={day.id}
                  />
                  <PartyServiceInput
                    name="partySareeDraping"
                    label="Saree Draping"
                    description="Traditional technique creating beautiful draping effect for dupatta or veil."
                    value={partyServices.partySareeDraping}
                    onValueChange={(val) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id 
                          ? { ...d, partyServices: { ...partyServices, partySareeDraping: val } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    onButtonClick={(field, increase) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id && d.partyServices
                          ? { ...d, partyServices: { ...d.partyServices, [field]: Math.max(0, (d.partyServices[field] as number) + (increase ? 1 : -1)) } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    dayId={day.id}
                  />
                  <PartyServiceInput
                    name="partyHijabSetting"
                    label="Hijab Setting"
                    description="Professional assistance with hijab styling and arrangement."
                    value={partyServices.partyHijabSetting}
                    onValueChange={(val) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id 
                          ? { ...d, partyServices: { ...partyServices, partyHijabSetting: val } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    onButtonClick={(field, increase) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id && d.partyServices
                          ? { ...d, partyServices: { ...d.partyServices, [field]: Math.max(0, (d.partyServices[field] as number) + (increase ? 1 : -1)) } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    dayId={day.id}
                  />
                  <Separator/>
                  <PartyServiceInput
                    name="airbrush"
                    label="Air Brush Service"
                    description="Add airbrushing for a flawless finish."
                    value={partyServices.airbrush}
                    onValueChange={(val) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id 
                          ? { ...d, partyServices: { ...partyServices, airbrush: val } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    onButtonClick={(field, increase) => {
                      const updatedDays = days.map(d => 
                        d.id === day.id && d.partyServices
                          ? { ...d, partyServices: { ...d.partyServices, [field]: Math.max(0, (d.partyServices[field] as number) + (increase ? 1 : -1)) } }
                          : d
                      );
                      setDays(updatedDays);
                    }}
                    dayId={day.id}
                  />
                </CardContent>
              )}
            </Card>
          );
        });
      })()}
    </div>
  );
}

function PartyServiceInput({ name, label, description, value, onValueChange, onButtonClick, dayId }: {
  name: keyof BridalPartyServices,
  label: string,
  description: string,
  value: number,
  onValueChange: (value: number) => void,
  onButtonClick: (field: keyof BridalPartyServices, increase: boolean) => void,
  dayId: number;
}) {
  const id = `party-${dayId}-${name}`;
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="flex flex-col gap-1">
          <span>{label}</span>
          <span className='text-xs text-muted-foreground font-normal'>{description}</span>
        </Label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => onButtonClick(name, false)}><Minus className="h-4 w-4" /></Button>
          <Input id={id} type="number" min="0" max="100" className="w-16 text-center" value={value} onChange={(e) => {
            const numValue = parseInt(e.target.value, 10) || 0;
            onValueChange(Math.max(0, Math.min(100, numValue)));
          }} />
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => onButtonClick(name, true)}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
