
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { formatToronto, getTorontoToday, getTorontoNow } from '@/lib/toronto-time';
import { Calendar as CalendarIcon, Plus, Trash2, Loader2, Minus, AlertTriangle, Users, ArrowLeft, ArrowRight, Send, MapPin } from 'lucide-react';
import { CalendarVector, SparkleVector } from '@/components/beauty-vectors';
import { useToast } from '@/hooks/use-toast';
import { generateQuoteAction } from '@/actions';
import type { ActionState, Day, ServiceOption, BridalTrial, BridalPartyServices, ServiceType } from '@/lib/types';
import { SERVICES, MOBILE_LOCATION_OPTIONS, SERVICE_TYPE_OPTIONS, STUDIO_ADDRESS } from '@/lib/services';
import { SERVICE_OPTION_DETAILS } from '@/lib/types';
import type { MOBILE_LOCATION_IDS } from '@/lib/services';
import { saveQuoteAndEmailAction } from '@/app/admin/actions';
import { trackQuoteGenerated } from '@/lib/facebook-pixel';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';


const initialState: ActionState = {
  status: 'idle',
  message: '',
  quote: null,
  errors: null,
  fieldValues: {},
};

const getInitialDays = (): Day[] => {
    return [{ 
        id: Date.now(), date: getTorontoNow(), getReadyTime: '10:00', serviceId: null, serviceOption: 'makeup-hair',
        hairExtensions: 0, jewellerySetting: false, sareeDraping: false, hijabSetting: false,
        serviceType: 'mobile', mobileLocation: 'toronto',
        partyServices: getDefaultPartyServices(),
        partyPeopleCount: 1
    }];
};

const getInitialBridalTrial = (fieldValues: Record<string, any> | undefined): BridalTrial => {
    if (fieldValues && Object.keys(fieldValues).length > 0 && 'addTrial' in fieldValues) {
        return {
            addTrial: fieldValues.addTrial === 'on',
            date: fieldValues.trialDate ? new Date(fieldValues.trialDate) : undefined,
            time: fieldValues.trialTime || '11:00',
            serviceOption: (fieldValues.trialServiceOption as ServiceOption) || 'makeup-hair'
        };
    }
    return {
        addTrial: false,
        date: undefined,
        time: '11:00',
        serviceOption: 'makeup-hair'
    };
};

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

const BASE_STEPS = [
  { id: 1, name: 'Services & Dates' },
  { id: 3, name: 'Contact Details' },
];

const BRIDAL_STEP = { id: 2, name: 'Bridal Options' };

// Format phone number as user types (US/Canada format: (XXX) XXX-XXXX)
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const cleaned = value.replace(/\D/g, '');
  
  // Limit to 10 digits (US/Canada phone number)
  const limited = cleaned.slice(0, 10);
  
  // Format based on length
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

// Helper function to check if time is between 9 PM (21:00) and 6 AM (06:00)
const isLateNightEarlyMorning = (time: string): boolean => {
  // Parse time string (format: "HH:MM" or "HH:MM:SS")
  const [hours, minutes] = time.split(':').map(Number);
  const hour = hours || 0;
  
  // Check if time is between 21:00 (9 PM) and 05:59:59 (5:59 AM)
  // Or exactly 06:00 (6 AM) should not be included
  return hour >= 21 || hour < 6;
};

export default function BookingFlow() {
  const [state, formAction] = useActionState(generateQuoteAction, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  
  // Ensure state is always defined
  const safeState = state || initialState;
  
  // Log formAction to verify it's properly bound (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('BookingFlow: formAction type:', typeof formAction);
      console.log('BookingFlow: formAction value:', formAction);
    }
  }, [formAction]);
  
  // Log state changes for debugging (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('BookingFlow: State changed:', {
        status: safeState.status,
        hasQuote: !!safeState.quote,
        message: safeState.message,
        hasErrors: !!safeState.errors,
        quoteId: safeState.quote?.id
      });
    }
  }, [safeState]);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState<string>(() => {
    // Initialize with formatted value if available
    const initialPhone = safeState.fieldValues?.phone as string || '';
    return initialPhone ? formatPhoneNumber(initialPhone) : '';
  });

  // Start with empty array on both server and client to ensure hydration match
  const [days, setDays] = useState<Day[]>([]);
  
  // Initialize days on client mount only (after hydration) to avoid hydration mismatch
  useEffect(() => {
    if (days.length === 0) {
      setDays(getInitialDays());
    }
  }, [days.length]);
  const [bridalTrial, setBridalTrial] = useState<BridalTrial>(() => getInitialBridalTrial(safeState.fieldValues));
  const [hasProcessedQuote, setHasProcessedQuote] = useState(false);
  const [showTrialDateDialog, setShowTrialDateDialog] = useState(false);
  const [pendingBridalOptionChange, setPendingBridalOptionChange] = useState<{ dayId: number; newOption: ServiceOption } | null>(null);
  const previousBridalOptionRef = useRef<ServiceOption | null>(null);

  // Update phone number when fieldValues change (e.g., after form submission with errors)
  useEffect(() => {
    if (safeState.fieldValues?.phone) {
      const formatted = formatPhoneNumber(safeState.fieldValues.phone as string);
      setPhoneNumber(formatted);
    }
  }, [safeState.fieldValues?.phone]);

  const hasBridalService = useMemo(() => days.some(day => day.serviceId === 'bridal' || day.serviceId === 'semi-bridal'), [days]);

  const STEPS = useMemo(() => {
    if (hasBridalService) {
      const steps = [...BASE_STEPS];
      steps.splice(1, 0, BRIDAL_STEP);
      return steps;
    }
    return BASE_STEPS;
  }, [hasBridalService]);

  useEffect(() => {
    console.log('BookingFlow: useEffect triggered, status:', safeState.status, 'hasQuote:', !!safeState.quote, 'hasProcessed:', hasProcessedQuote);
    
    if (safeState.status === 'error' && safeState.message) {
      const stepWithError =
        safeState.errors?.trialDate ? 2
        : safeState.errors?.name || safeState.errors?.email || safeState.errors?.phone ? STEPS.find(s => s.name === 'Contact Details')!.id
        : 1;
      
      setCurrentStep(stepWithError);

      toast({
          variant: 'destructive',
          title: 'Booking Error',
          description: safeState.message,
      });
    }

    // CRITICAL: Only process quote once to prevent multiple saves/redirects
    if (safeState.status === 'success' && safeState.quote && !hasProcessedQuote) {
      console.log('BookingFlow: Processing quote for the first time, ID:', safeState.quote.id);
      setHasProcessedQuote(true); // Prevent duplicate processing
      
      const quote = safeState.quote;
      // Track quote generation
      const selectedQuote = quote.selectedQuote || 'lead';
      const quoteData = quote.quotes?.[selectedQuote];
      
      // Track quote generation (non-blocking - wrapped in try-catch)
      try {
        if (quoteData) {
          const serviceTypes = quote.booking?.days?.map(day => day?.serviceName || 'Service').filter(Boolean).join(', ') || 'Makeup Service';
          
          trackQuoteGenerated({
            bookingId: quote.id,
            totalAmount: quoteData.total || 0,
            currency: 'CAD',
            serviceType: serviceTypes,
          });
        }
      } catch (trackingError) {
        // Tracking should never block quote generation
        console.warn('Failed to track quote generation:', trackingError);
      }
      
      // Save the booking using server action and redirect
      console.log('BookingFlow: Quote generated successfully, ID:', quote.id);
      console.log('BookingFlow: Saving quote and sending email for booking ID:', quote.id);
      console.log('BookingFlow: Quote contact email:', quote.contact?.email);
      
      // Use async function to properly handle the promise
      (async () => {
        try {
          const result = await saveQuoteAndEmailAction(quote);
          console.log('BookingFlow: Save result:', result);
          if (result.success) {
            console.log('BookingFlow: Quote saved successfully, redirecting to:', `/book/${quote.id}`);
            router.push(`/book/${quote.id}`);
          } else {
            console.error('BookingFlow: Save failed:', result.message);
            // Even if save failed, try to redirect to show the quote (might have been saved)
            router.push(`/book/${quote.id}`);
            toast({ variant: 'default', title: 'Warning', description: result.message || 'Quote generated but there was an issue saving. Please check your booking.' });
          }
        } catch (err) {
          console.error("BookingFlow: Failed to save booking or send email:", err);
          // Always redirect even on error - quote was generated successfully
          console.log('BookingFlow: Redirecting despite error');
          router.push(`/book/${quote.id}`);
          toast({ variant: 'default', title: 'Quote Generated', description: 'Quote generated successfully. Email may not have been sent - please check your booking.' });
        }
      })();
    }

  }, [safeState, toast, STEPS, router, hasProcessedQuote]);


  const nextStep = () => {
    if (currentStep === 1) {
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

    if (currentStep === 2 && hasBridalService) { // Bridal Options step
        const hasBridalOnly = days.some(day => day.serviceId === 'bridal');
        if (bridalTrial.addTrial && hasBridalOnly) {
            if (!bridalTrial.date || !bridalTrial.time) {
                toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select a date and time for the bridal trial.' });
                return;
            }
            const bridalDay = days.find(d => d.serviceId === 'bridal');
            if (bridalDay?.date && bridalTrial.date >= bridalDay.date) {
                toast({ variant: 'destructive', title: 'Validation Error', description: 'Bridal trial date must be before the main event date.' });
                return;
            }
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
  
  const progress = ((STEPS.findIndex(s => s.id === currentStep) + 1) / STEPS.length) * 100;

  const [stepDirection, setStepDirection] = useState<'left' | 'right'>('right');
  
  // Track step direction for animations
  const prevStepRef = useRef(currentStep);
  useEffect(() => {
    if (currentStep > prevStepRef.current) {
      setStepDirection('right');
    } else if (currentStep < prevStepRef.current) {
      setStepDirection('left');
    }
    prevStepRef.current = currentStep;
  }, [currentStep]);

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

       <form
        ref={formRef}
        action={formAction}
        className="space-y-5 sm:space-y-6 md:space-y-8"
      >
        {safeState.status === 'error' && safeState.message && !safeState.errors && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could not generate quote</AlertTitle>
                <AlertDescription>{safeState.message}</AlertDescription>
            </Alert>
        )}

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
                    <CardDescription className="text-sm sm:text-base">Select services, dates, and times for your booking.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 md:space-y-6 px-3 sm:px-6">
                    <div className="space-y-3 sm:space-y-4 animate-stagger">
                      {days.length === 0 ? null : (
                        <>
                          {days.map((day, index) => (
                              <div key={day.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                                <BookingDayCard
                                    day={day}
                                    index={index}
                                    updateDay={(id, data) => setDays(days.map(d => d.id === id ? {...d, ...data} : d))}
                                    removeDay={(id) => setDays(days.filter(d => d.id !== id))}
                                    isOnlyDay={days.length <= 1}
                                    errors={safeState.errors}
                                />
                              </div>
                          ))}
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setDays([...days, { id: Date.now(), date: getTorontoNow(), getReadyTime: '10:00', serviceId: null, serviceOption: 'makeup-hair', hairExtensions: 0, jewellerySetting: false, sareeDraping: false, hijabSetting: false, serviceType: 'mobile', mobileLocation: 'toronto', partyServices: getDefaultPartyServices(), partyPeopleCount: 1 }])} 
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
                errors={safeState.errors}
              />
          </div>
        )}

                <div className={cn(
                  currentStep !== STEPS.find(s => s.name === 'Contact Details')?.id && 'hidden',
                  stepDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'
                )}>
                    <Card className="shadow-lg animate-fade-in-scale">
                <CardHeader className="px-3 sm:px-6 pb-3 sm:pb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <SparkleVector size={28} className="text-black/40 animate-float" />
                        <CardTitle className="font-headline text-xl sm:text-2xl">{STEPS[STEPS.length -1].name}</CardTitle>
                    </div>
                    <CardDescription className="text-sm sm:text-base">Please provide your contact information to finalize the quote.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 md:space-y-8 px-3 sm:px-6">
                    <div className="animate-stagger">
                        <div className="space-y-3 sm:space-y-4 mt-2">
                            <div className="animate-fade-in-up">
                                <Label htmlFor="name">Full Name *</Label>
                                <Input 
                                  id="name" 
                                  name="name" 
                                  placeholder="Jane Doe" 
                                  required 
                                  defaultValue={safeState.fieldValues?.name as string || ''} 
                                  className="transition-smooth focus-ring"
                                />
                                {safeState.errors?.name && <p className="text-sm text-destructive mt-1 animate-fade-in-up">{safeState.errors.name[0]}</p>}
                            </div>
                            <div className="animate-fade-in-up">
                                <Label htmlFor="email">Email Address *</Label>
                                <Input 
                                  id="email" 
                                  name="email" 
                                  type="email" 
                                  placeholder="jane.doe@example.com" 
                                  required 
                                  defaultValue={safeState.fieldValues?.email as string || ''} 
                                  className="transition-smooth focus-ring"
                                />
                                {safeState.errors?.email && <p className="text-sm text-destructive mt-1 animate-fade-in-up">{safeState.errors.email[0]}</p>}
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
                                    maxLength={14} // (XXX) XXX-XXXX = 14 characters
                                    className="transition-smooth focus-ring"
                                />
                                {/* Hidden input to ensure phone value is submitted (controlled component doesn't submit automatically) */}
                                <input type="hidden" name="phone" value={phoneNumber.replace(/\D/g, '')} />
                                {safeState.errors?.phone && <p className="text-sm text-destructive mt-1 animate-fade-in-up">{safeState.errors.phone[0]}</p>}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

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
              className="w-full sm:w-auto h-10 sm:h-11 transition-smooth hover:scale-[1.02] active:scale-[0.98]"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <div className="w-full sm:w-auto">
              <SubmitButton />
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function BookingDayCard({ day, index, updateDay, removeDay, isOnlyDay, errors }: {
    day: Day;
    index: number;
    updateDay: (id: number, data: Partial<Omit<Day, 'id'>>) => void;
    removeDay: (id: number) => void;
    isOnlyDay: boolean;
    errors: ActionState['errors'];
}) {
    const service = SERVICES.find(s => s.id === day.serviceId);
    const showAddons = service?.id === 'bridal' || service?.id === 'semi-bridal';
    const shouldUseGenericTitle = service?.id === 'party' || service?.id === 'semi-bridal' || service?.id === 'photoshoot';
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    
    const isOutsideToronto = useMemo(() => day.mobileLocation !== 'toronto', [day.mobileLocation]);

    return (
        <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 rounded-lg border bg-card/50 relative">
            <input type="hidden" name={`day_id_${index}`} value={day.id} />
             {!isOnlyDay && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeDay(day.id)} className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 hover:bg-destructive/20 hover:text-destructive h-7 w-7 sm:h-8 sm:w-8">
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <div>
                    <Label htmlFor={`date-${index}`} className="text-sm sm:text-base">Day {index + 1} - Date *</Label>
                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                        <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 sm:h-10",!day.date && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {day.date ? formatToronto(day.date, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" side="bottom"><Calendar mode="single" selected={day.date} onSelect={(date) => { updateDay(day.id, { date: date as Date }); setIsPopoverOpen(false); }} disabled={(date) => {
                            const today = getTorontoToday();
                            return date < today;
                        }} initialFocus /></PopoverContent>
                    </Popover>
                    <input type="hidden" name={`date_${index}`} value={day.date?.toISOString() || ''} />
                </div>
                <div>
                    <Label htmlFor={`getReadyTime-${index}`} className="text-sm sm:text-base">Get Ready Time *</Label>
                    <Select name={`getReadyTime_${index}`} value={day.getReadyTime} onValueChange={(value) => updateDay(day.id, { getReadyTime: value })} required>
                        <SelectTrigger className="h-9 sm:h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {timeSlots.map(slot => <SelectItem key={slot} value={slot}>{formatToronto(new Date(`1970-01-01T${slot}`), 'p')}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {/* Hidden input for Select value - Radix UI Select doesn't submit automatically */}
                    <input type="hidden" name={`getReadyTime_${index}`} value={day.getReadyTime || ''} />
                    {day.getReadyTime && isLateNightEarlyMorning(day.getReadyTime) && (
                        <Alert className="mt-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                                Services scheduled between 9 PM and 6 AM are subject to an additional surcharge. Price will be shown in your quote.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
                    <div>
                    <Label htmlFor={`service-${index}`} className="text-sm sm:text-base">Service *</Label>
                    <Select name={`service_${index}`} value={day.serviceId || ''} onValueChange={(serviceId) => {
                        const isBridalOrSemiBridal = serviceId === 'bridal' || serviceId === 'semi-bridal';
                        const isParty = serviceId === 'party';
                        updateDay(day.id, { 
                            serviceId: serviceId || null,
                            partyServices: isBridalOrSemiBridal ? (day.partyServices || getDefaultPartyServices()) : undefined,
                            partyPeopleCount: isParty ? (day.partyPeopleCount || 1) : undefined
                        });
                    }} required>
                        <SelectTrigger className="h-9 sm:h-10"><SelectValue placeholder="Select a service" /></SelectTrigger>
                        <SelectContent>{SERVICES.map((s) => (<SelectItem key={s.id} value={s.id}><div className="flex items-center gap-2"><s.icon className="h-4 w-4 text-muted-foreground" /><span>{s.name}</span></div></SelectItem>))}</SelectContent>
                    </Select>
                    {/* Hidden input for Select value - Radix UI Select doesn't submit automatically */}
                    <input type="hidden" name={`service_${index}`} value={day.serviceId || ''} />
                </div>
            </div>

            <Separator />
            <div>
                <Label className="text-sm sm:text-base font-medium">Service Type *</Label>
                <RadioGroup name={`serviceType_${index}`} value={day.serviceType} onValueChange={(value) => updateDay(day.id, { serviceType: value as ServiceType })} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-2" required>
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
                {/* Hidden input for RadioGroup value - Radix UI RadioGroup doesn't submit automatically */}
                <input type="hidden" name={`serviceType_${index}`} value={day.serviceType || ''} />
                {errors?.serviceType && <p className="text-sm text-destructive mt-2">{errors.serviceType[0]}</p>}
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
                                    // Default to the first non-toronto option if switching to outside
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

                    <input type="hidden" name={`mobileLocation_${index}`} value={day.mobileLocation} />

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
                    {errors?.mobileLocation && <p className="text-sm text-destructive mt-2">{errors.mobileLocation[0]}</p>}
                </div>
            )}


            {service?.askServiceType && (
                <div className='pt-4'>
                    <Label>Service Option *</Label>
                    <RadioGroup name={`serviceOption_${index}`} value={day.serviceOption || 'makeup-hair'} onValueChange={(val) => updateDay(day.id, { serviceOption: val as ServiceOption })} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                            {Object.entries(SERVICE_OPTION_DETAILS).map(([id, {label}]) => (
                            <Label key={id} className="flex items-center space-x-2 border rounded-md p-2 justify-center cursor-pointer hover:bg-accent hover:text-accent-foreground has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground has-[[data-state=checked]]:border-primary transition-colors text-sm">
                                <RadioGroupItem value={id} id={`${day.id}-${id}`} />
                                <span>{label}</span>
                            </Label>
                        ))}
                    </RadioGroup>
                    {/* Hidden input for RadioGroup value - Radix UI RadioGroup doesn't submit automatically */}
                    <input type="hidden" name={`serviceOption_${index}`} value={day.serviceOption || 'makeup-hair'} />
                </div>
            )}
            
            {service && (
                <Card className='mt-3 sm:mt-4 bg-background/50'>
                    <CardHeader className='p-3 sm:p-4'>
                        <CardTitle className='text-base sm:text-lg'>{shouldUseGenericTitle ? 'Add-ons' : "Bride's Add-ons"}</CardTitle>
                    </CardHeader>
                    <CardContent className='p-3 sm:p-4 pt-0 space-y-3 sm:space-y-4'>
                        {/* Party Glam - People Count */}
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
                                            name={`partyPeopleCount_${index}`} 
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
                                    <input type="hidden" name={`partyPeopleCount_${index}`} value={(day as any).partyPeopleCount || 1} />
                                </div>
                                <Separator />
                            </>
                        )}

                            <div className="flex items-center justify-between">
                            <Label htmlFor={`jewellerySetting-${index}`} className="flex flex-col gap-1 cursor-pointer">
                                <span>Jewellery/Dupatta Setting</span>
                                <span className='text-xs text-muted-foreground'>Price revealed in quote</span>
                            </Label>
                            <Switch id={`jewellerySetting-${index}`} name={`jewellerySetting_${index}`} checked={day.jewellerySetting} onCheckedChange={(checked) => updateDay(day.id, { jewellerySetting: checked })} />
                            {/* Hidden input for Switch value - Radix UI Switch doesn't submit automatically */}
                            <input type="hidden" name={`jewellerySetting_${index}`} value={day.jewellerySetting ? 'on' : ''} />
                        </div>
                        
                        {(showAddons || service.id === 'party') && <>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <Label htmlFor={`sareeDraping-${index}`} className="flex flex-col gap-1 cursor-pointer">
                                <span>Saree Draping</span>
                                <span className='text-xs text-muted-foreground'>Price revealed in quote</span>
                            </Label>
                                <Switch id={`sareeDraping-${index}`} name={`sareeDraping_${index}`} checked={day.sareeDraping} onCheckedChange={(checked) => updateDay(day.id, { sareeDraping: checked })} />
                                {/* Hidden input for Switch value - Radix UI Switch doesn't submit automatically */}
                                <input type="hidden" name={`sareeDraping_${index}`} value={day.sareeDraping ? 'on' : ''} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                    <Label htmlFor={`hijabSetting-${index}`} className="flex flex-col gap-1 cursor-pointer">
                                <span>Hijab Setting</span>
                                <span className='text-xs text-muted-foreground'>Price revealed in quote</span>
                            </Label>
                                <Switch id={`hijabSetting-${index}`} name={`hijabSetting_${index}`} checked={day.hijabSetting} onCheckedChange={(checked) => updateDay(day.id, { hijabSetting: checked })} />
                                {/* Hidden input for Switch value - Radix UI Switch doesn't submit automatically */}
                                <input type="hidden" name={`hijabSetting_${index}`} value={day.hijabSetting ? 'on' : ''} />
                            </div>
                        </>}
                        <Separator />
                        <div>
                            <Label htmlFor={`hairExtensions-${index}`}>Hair Extensions</Label>
                            <p className="text-xs text-muted-foreground mb-2">Price revealed in quote</p>
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateDay(day.id, { hairExtensions: Math.max(0, day.hairExtensions - 1) })}><Minus className="h-4 w-4" /></Button>
                                <Input id={`hairExtensions-${index}`} name={`hairExtensions_${index}`} type="number" min="0" max="100" className="w-16 text-center" value={day.hairExtensions} onChange={(e) => {
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

function BridalServiceOptions({ bridalTrial, updateBridalTrial, days, setDays, errors }: {
  bridalTrial: BridalTrial;
  updateBridalTrial: (data: Partial<BridalTrial>) => void;
  days: Day[];
  setDays: (days: Day[] | ((prev: Day[]) => Day[])) => void;
  errors: ActionState['errors'];
}) {
  const [isTrialPopoverOpen, setIsTrialPopoverOpen] = useState(false);
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
                <Switch name="addTrial" checked={bridalTrial.addTrial} onCheckedChange={(checked) => updateBridalTrial({ addTrial: checked })} />
                {/* Hidden input for Switch value - Radix UI Switch doesn't submit automatically */}
                <input type="hidden" name="addTrial" value={bridalTrial.addTrial ? 'on' : ''} />
            </div>
        </CardHeader>
        {bridalTrial.addTrial && (
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
                <div>
                    <Label className="text-sm sm:text-base mb-2 block">Trial Service Option *</Label>
                    <RadioGroup 
                        name="trialServiceOption" 
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
                    <input type="hidden" name="trialServiceOption" value={bridalTrial.serviceOption || 'makeup-hair'} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                        <Label htmlFor="trialDate" className="text-sm sm:text-base">Trial Date *</Label>
                        <Popover open={isTrialPopoverOpen} onOpenChange={setIsTrialPopoverOpen}>
                            <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 sm:h-10", !bridalTrial.date && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {bridalTrial.date ? formatToronto(bridalTrial.date, "PPP") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" side="bottom">
                            <Calendar mode="single" selected={bridalTrial.date} onSelect={(date) => { updateBridalTrial({ date: date as Date }); setIsTrialPopoverOpen(false); }} disabled={(date) => {
                                const bridalDay = days.find(d=>d.serviceId === 'bridal')?.date;
                                const today = getTorontoToday();
                                if (!bridalDay) return date < today;
                                return date >= bridalDay || date < today;
                            }} initialFocus/>
                            </PopoverContent>
                        </Popover>
                        <input type="hidden" name="trialDate" value={bridalTrial.date?.toISOString() || ''} />
                    </div>
                    <div>
                        <Label htmlFor="trialTime" className="text-sm sm:text-base">Trial Time *</Label>
                        <Select name="trialTime" value={bridalTrial.time} onValueChange={(value) => updateBridalTrial({ time: value })} required={bridalTrial.addTrial}>
                        <SelectTrigger className="h-9 sm:h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {timeSlots.map(slot => <SelectItem key={slot} value={slot}>{formatToronto(new Date(`1970-01-01T${slot}`), 'p')}</SelectItem>)}
                        </SelectContent>
                        </Select>
                        {/* Hidden input for Select value - Radix UI Select doesn't submit automatically */}
                        <input type="hidden" name="trialTime" value={bridalTrial.time || ''} />
                    </div>
                </div>
                {errors?.trialDate && <p className="text-sm text-destructive mt-1">{errors.trialDate[0]}</p>}
            </CardContent>
        )}
      </Card>
      )}

      {/* Party Services for each Bridal/Semi-Bridal day */}
      {(() => {
        // Group days by date to check if both bridal and semi-bridal are on the same date
        const bridalSemiBridalDays = days.filter(day => day.serviceId === 'bridal' || day.serviceId === 'semi-bridal');
        const daysByDate = new Map<string, typeof bridalSemiBridalDays>();
        
        bridalSemiBridalDays.forEach(day => {
          if (day.date) {
            const dateKey = day.date.toISOString().split('T')[0]; // YYYY-MM-DD
            if (!daysByDate.has(dateKey)) {
              daysByDate.set(dateKey, []);
            }
            daysByDate.get(dateKey)!.push(day);
          }
        });
        
        // Filter: if a date has both bridal and semi-bridal, only show bridal
        const daysToShow = bridalSemiBridalDays.filter(day => {
          if (!day.date) return false;
          const dateKey = day.date.toISOString().split('T')[0];
          const daysOnSameDate = daysByDate.get(dateKey) || [];
          const hasBridal = daysOnSameDate.some(d => d.serviceId === 'bridal');
          const hasSemiBridal = daysOnSameDate.some(d => d.serviceId === 'semi-bridal');
          
          // If both exist on same date, only show bridal
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
                        name={`addPartyServices_${day.id}`} 
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
                      {/* Hidden input for Switch value - Radix UI Switch doesn't submit automatically */}
                      <input type="hidden" name={`addPartyServices_${day.id}`} value={partyServices.addServices ? 'on' : ''} />
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
  )
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
                    <Input id={id} name={`party_${dayId}_${name}`} type="number" min="0" max="100" className="w-16 text-center" value={value} onChange={(e) => {
                        const numValue = parseInt(e.target.value, 10) || 0;
                        onValueChange(Math.max(0, Math.min(100, numValue)));
                    }} />
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => onButtonClick(name, true)}><Plus className="h-4 w-4" /></Button>
                </div>
            </div>
        </div>
    )
}


function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button 
          type="submit"
          size="lg" 
          className="font-bold transition-smooth hover:scale-[1.02] active:scale-[0.98]" 
          disabled={pending}
          onClick={(e) => {
            console.log('BookingFlow: SubmitButton clicked, pending:', pending);
            console.log('BookingFlow: Form:', e.currentTarget.form);
            console.log('BookingFlow: Form action:', e.currentTarget.form?.action);
          }}
        >
            {pending ? <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
            </> : <>
                Generate My Quote
                <Send className="ml-2 h-4 w-4" />
            </>}
        </Button>
    )
}
