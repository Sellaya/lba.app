
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Plus, Trash2, Loader2, Minus, AlertTriangle, Users, ArrowLeft, ArrowRight, Send, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateQuoteAction } from '@/actions';
import type { ActionState, Day, ServiceOption, BridalTrial, BridalPartyServices, ServiceType } from '@/lib/types';
import { SERVICES, MOBILE_LOCATION_OPTIONS, SERVICE_TYPE_OPTIONS, STUDIO_ADDRESS } from '@/lib/services';
import { SERVICE_OPTION_DETAILS } from '@/lib/types';
import type { MOBILE_LOCATION_IDS } from '@/lib/services';
import { saveQuoteAndEmailAction } from '@/app/admin/actions';

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
        id: Date.now(), date: new Date(), getReadyTime: '10:00', serviceId: null, serviceOption: 'makeup-hair',
        hairExtensions: 0, jewellerySetting: false, sareeDraping: false, hijabSetting: false,
        serviceType: 'mobile', mobileLocation: 'toronto',
        partyServices: getDefaultPartyServices()
    }];
};

const getInitialBridalTrial = (fieldValues: Record<string, any> | undefined): BridalTrial => {
    if (fieldValues && Object.keys(fieldValues).length > 0 && 'addTrial' in fieldValues) {
        return {
            addTrial: fieldValues.addTrial === 'on',
            date: fieldValues.trialDate ? new Date(fieldValues.trialDate) : undefined,
            time: fieldValues.trialTime || '11:00'
        };
    }
    return {
        addTrial: false,
        date: undefined,
        time: '11:00'
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

export default function BookingFlow() {
  const [state, formAction] = useActionState(generateQuoteAction, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState<string>(() => {
    // Initialize with formatted value if available
    const initialPhone = state.fieldValues?.phone as string || '';
    return initialPhone ? formatPhoneNumber(initialPhone) : '';
  });

  const [days, setDays] = useState<Day[]>([]);
  const [bridalTrial, setBridalTrial] = useState<BridalTrial>(() => getInitialBridalTrial(state.fieldValues));
  
  useEffect(() => {
    // Initialize state on client to avoid hydration mismatch
    setDays(getInitialDays());
  }, []);

  // Update phone number when fieldValues change (e.g., after form submission with errors)
  useEffect(() => {
    if (state.fieldValues?.phone) {
      const formatted = formatPhoneNumber(state.fieldValues.phone as string);
      setPhoneNumber(formatted);
    }
  }, [state.fieldValues?.phone]);

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
    if (state.status === 'error' && state.message) {
      const stepWithError =
        state.errors?.trialDate ? 2
        : state.errors?.name || state.errors?.email || state.errors?.phone ? STEPS.find(s => s.name === 'Contact Details')!.id
        : 1;
      
      setCurrentStep(stepWithError);

      toast({
          variant: 'destructive',
          title: 'Booking Error',
          description: state.message,
      });
    }

    if (state.status === 'success' && state.quote) {
      const quote = state.quote;
      // Save the booking using server action and redirect
      saveQuoteAndEmailAction(quote).then((result) => {
        if (result.success) {
          router.push(`/book/${quote.id}`);
        } else {
          toast({ variant: 'destructive', title: 'Save Failed', description: result.message || 'Could not save your booking. Please try again.' });
        }
      }).catch(err => {
        console.error("Failed to save booking or send email:", err);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save your booking. Please try again.' });
      });
    }

  }, [state, toast, STEPS, router]);


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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 px-2 animate-in fade-in duration-500">
            <Progress value={progress} className="h-2" />
            <div className="flex flex-wrap justify-between gap-2 mt-2">
                {STEPS.map((step, index) => (
                    <div key={step.id} className={cn(
                        "text-xs sm:text-sm flex-1 min-w-0",
                        step.id < currentStep ? "text-primary font-medium" :
                        step.id === currentStep ? "text-primary font-bold" : "text-muted-foreground",
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
        className="space-y-8"
      >
        {state.status === 'error' && state.message && !state.errors && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could not generate quote</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
            </Alert>
        )}

        <div className={cn(currentStep !== 1 && 'hidden')}>
            <Card className="shadow-lg animate-in fade-in-50 slide-in-from-top-10 duration-700">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">1. Services & Dates</CardTitle>
                    <CardDescription>Select services, dates, and times for your booking.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="space-y-6">
                      {days.map((day, index) => (
                          <BookingDayCard
                              key={day.id}
                              day={day}
                              index={index}
                              updateDay={(id, data) => setDays(days.map(d => d.id === id ? {...d, ...data} : d))}
                              removeDay={(id) => setDays(days.filter(d => d.id !== id))}
                              isOnlyDay={days.length <= 1}
                              errors={state.errors}
                          />
                      ))}
                      <Button type="button" variant="outline" onClick={() => setDays([...days, { id: Date.now(), date: new Date(), getReadyTime: '10:00', serviceId: null, serviceOption: 'makeup-hair', hairExtensions: 0, jewellerySetting: false, sareeDraping: false, hijabSetting: false, serviceType: 'mobile', mobileLocation: 'toronto', partyServices: getDefaultPartyServices() }])} className="w-full">
                      <Plus className="mr-2 h-4 w-4" /> Add Another Day
                      </Button>
                    </div>
                </CardContent>
            </Card>
        </div>


        {hasBridalService && (
          <div className={cn(currentStep !== 2 && 'hidden')}>
              <BridalServiceOptions
                bridalTrial={bridalTrial}
                updateBridalTrial={(data) => setBridalTrial(prev => ({...prev, ...data}))}
                days={days}
                setDays={setDays}
                errors={state.errors}
              />
          </div>
        )}

        <div className={cn(currentStep !== STEPS.find(s => s.name === 'Contact Details')?.id && 'hidden')}>
            <Card className="shadow-lg animate-in fade-in-50 slide-in-from-top-10 duration-700">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">{STEPS[STEPS.length -1].name}</CardTitle>
                    <CardDescription>Please provide your contact information to finalize the quote.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div>
                        <div className="space-y-4 mt-2">
                            <div>
                                <Label htmlFor="name">Full Name *</Label>
                                <Input id="name" name="name" placeholder="Jane Doe" required defaultValue={state.fieldValues?.name as string || ''} />
                                {state.errors?.name && <p className="text-sm text-destructive mt-1">{state.errors.name[0]}</p>}
                            </div>
                            <div>
                                <Label htmlFor="email">Email Address *</Label>
                                <Input id="email" name="email" type="email" placeholder="jane.doe@example.com" required defaultValue={state.fieldValues?.email as string || ''} />
                                {state.errors?.email && <p className="text-sm text-destructive mt-1">{state.errors.email[0]}</p>}
                            </div>
                            <div>
                                <Label htmlFor="phone">Phone Number *</Label>
                                <Input 
                                    id="phone" 
                                    name="phone" 
                                    type="tel" 
                                    placeholder="(416) 555-1234" 
                                    required 
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        const formatted = formatPhoneNumber(e.target.value);
                                        setPhoneNumber(formatted);
                                    }}
                                    maxLength={14} // (XXX) XXX-XXXX = 14 characters
                                />
                                {state.errors?.phone && <p className="text-sm text-destructive mt-1">{state.errors.phone[0]}</p>}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row justify-between gap-4">
          <Button type="button" variant="outline" onClick={prevStep} className={cn(currentStep === 1 && 'invisible', 'w-full sm:w-auto')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {currentStep < STEPS[STEPS.length - 1].id ? (
            <Button type="button" onClick={nextStep} className="w-full sm:w-auto">
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
        <div className="space-y-6 p-4 rounded-lg border bg-card/50 relative animate-in fade-in-50">
            <input type="hidden" name={`day_id_${index}`} value={day.id} />
             {!isOnlyDay && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeDay(day.id)} className="absolute top-2 right-2 hover:bg-destructive/20 hover:text-destructive">
                    <Trash2 className="h-5 w-5" />
                </Button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                    <Label htmlFor={`date-${index}`}>Day {index + 1} - Date *</Label>
                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                        <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal",!day.date && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {day.date ? format(day.date, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={day.date} onSelect={(date) => { updateDay(day.id, { date: date as Date }); setIsPopoverOpen(false); }} disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return date < today;
                        }} initialFocus /></PopoverContent>
                    </Popover>
                    <input type="hidden" name={`date_${index}`} value={day.date?.toISOString() || ''} />
                </div>
                <div>
                    <Label htmlFor={`getReadyTime-${index}`}>Get Ready Time *</Label>
                    <Select name={`getReadyTime_${index}`} value={day.getReadyTime} onValueChange={(value) => updateDay(day.id, { getReadyTime: value })} required>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {timeSlots.map(slot => <SelectItem key={slot} value={slot}>{format(new Date(`1970-01-01T${slot}`), 'p')}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                    <div>
                    <Label htmlFor={`service-${index}`}>Service *</Label>
                    <Select name={`service_${index}`} value={day.serviceId || ''} onValueChange={(serviceId) => {
                        const isBridalOrSemiBridal = serviceId === 'bridal' || serviceId === 'semi-bridal';
                        updateDay(day.id, { 
                            serviceId: serviceId || null,
                            partyServices: isBridalOrSemiBridal ? (day.partyServices || getDefaultPartyServices()) : undefined
                        });
                    }} required>
                        <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                        <SelectContent>{SERVICES.map((s) => (<SelectItem key={s.id} value={s.id}><div className="flex items-center gap-2"><s.icon className="h-4 w-4 text-muted-foreground" /><span>{s.name}</span></div></SelectItem>))}</SelectContent>
                    </Select>
                </div>
            </div>

            <Separator />
            <div>
                <Label className="text-md font-medium">Service Type *</Label>
                <RadioGroup name={`serviceType_${index}`} value={day.serviceType} onValueChange={(value) => updateDay(day.id, { serviceType: value as ServiceType })} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2" required>
                    {Object.values(SERVICE_TYPE_OPTIONS).map(opt => (
                        <Label key={opt.id} className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground has-[[data-state=checked]]:border-primary transition-colors">
                            <RadioGroupItem value={opt.id} id={`${day.id}-${opt.id}`} />
                            <div className='flex flex-col'>
                                <span className="font-semibold">{opt.label}</span>
                                <span className="text-sm text-muted-foreground">{opt.description}</span>
                            </div>
                        </Label>
                    ))}
                </RadioGroup>
                {errors?.serviceType && <p className="text-sm text-destructive mt-2">{errors.serviceType[0]}</p>}
            </div>
            
            {day.serviceType === 'studio' && (
                 <div className="p-4 border rounded-lg bg-accent/50 animate-in fade-in-0 slide-in-from-top-5 duration-300">
                    <h3 className="font-medium text-sm mb-2">Studio Location</h3>
                    <a href={STUDIO_ADDRESS.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm space-y-1 group">
                        <p>{STUDIO_ADDRESS.street}</p>
                        <p className='text-muted-foreground'>{STUDIO_ADDRESS.city}, {STUDIO_ADDRESS.province} {STUDIO_ADDRESS.postalCode}</p>
                        <div className='flex items-center gap-2 pt-1'>
                            <MapPin className='w-4 h-4 text-primary'/>
                            <span className='text-primary font-medium group-hover:underline'>View on Google Maps</span>
                        </div>
                    </a>
                </div>
            )}

            {day.serviceType === 'mobile' && (
                <div className="animate-in fade-in-0 slide-in-from-top-5 duration-300 space-y-4">
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
                        <div className='animate-in fade-in-0 slide-in-from-top-2 duration-300 pl-4 border-l-2 border-primary/20'>
                            <Label className="text-md font-medium">Approximate Drive Distance</Label>
                             <RadioGroup value={day.mobileLocation} onValueChange={(value) => updateDay(day.id, { mobileLocation: value as MOBILE_LOCATION_IDS })} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2" required>
                                {Object.values(MOBILE_LOCATION_OPTIONS).filter(opt => opt.id !== 'toronto').map(opt => (
                                    <Label key={opt.id} className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground has-[[data-state=checked]]:border-primary transition-colors">
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
                </div>
            )}
            
            {service && (
                <Card className='mt-4 bg-background/50'>
                    <CardHeader className='p-4'>
                        <CardTitle className='text-lg'>{shouldUseGenericTitle ? 'Add-ons' : "Bride's Add-ons"}</CardTitle>
                    </CardHeader>
                    <CardContent className='p-4 pt-0 space-y-4'>
                            <div className="flex items-center justify-between">
                            <Label htmlFor={`jewellerySetting-${index}`} className="flex flex-col gap-1 cursor-pointer">
                                <span>Jewellery/Dupatta Setting</span>
                                <span className='text-xs text-muted-foreground'>Price revealed in quote</span>
                            </Label>
                            <Switch id={`jewellerySetting-${index}`} name={`jewellerySetting_${index}`} checked={day.jewellerySetting} onCheckedChange={(checked) => updateDay(day.id, { jewellerySetting: checked })} />
                        </div>
                        
                        {showAddons && <>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <Label htmlFor={`sareeDraping-${index}`} className="flex flex-col gap-1 cursor-pointer">
                                <span>Saree Draping</span>
                                <span className='text-xs text-muted-foreground'>Price revealed in quote</span>
                            </Label>
                                <Switch id={`sareeDraping-${index}`} name={`sareeDraping_${index}`} checked={day.sareeDraping} onCheckedChange={(checked) => updateDay(day.id, { sareeDraping: checked })} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                    <Label htmlFor={`hijabSetting-${index}`} className="flex flex-col gap-1 cursor-pointer">
                                <span>Hijab Setting</span>
                                <span className='text-xs text-muted-foreground'>Price revealed in quote</span>
                            </Label>
                                <Switch id={`hijabSetting-${index}`} name={`hijabSetting_${index}`} checked={day.hijabSetting} onCheckedChange={(checked) => updateDay(day.id, { hijabSetting: checked })} />
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
    <div className="space-y-8 animate-in fade-in-50 slide-in-from-top-10 duration-700">
      {hasBridalOnly && (
      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl">Bridal Trial</CardTitle>
                    <CardDescription>Add a trial session before your big day. Price revealed in quote.</CardDescription>
                </div>
                <Switch name="addTrial" checked={bridalTrial.addTrial} onCheckedChange={(checked) => updateBridalTrial({ addTrial: checked })} />
            </div>
        </CardHeader>
        {bridalTrial.addTrial && (
            <CardContent className="space-y-4 animate-in fade-in-0 slide-in-from-top-5 duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="trialDate">Trial Date *</Label>
                        <Popover open={isTrialPopoverOpen} onOpenChange={setIsTrialPopoverOpen}>
                            <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !bridalTrial.date && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {bridalTrial.date ? format(bridalTrial.date, "PPP") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={bridalTrial.date} onSelect={(date) => { updateBridalTrial({ date: date as Date }); setIsTrialPopoverOpen(false); }} disabled={(date) => {
                                const bridalDay = days.find(d=>d.serviceId === 'bridal')?.date;
                                const today = new Date();
                                today.setHours(0,0,0,0);
                                if (!bridalDay) return date < today;
                                return date >= bridalDay || date < today;
                            }} initialFocus/>
                            </PopoverContent>
                        </Popover>
                        <input type="hidden" name="trialDate" value={bridalTrial.date?.toISOString() || ''} />
                    </div>
                    <div>
                        <Label htmlFor="trialTime">Trial Time *</Label>
                        <Select name="trialTime" value={bridalTrial.time} onValueChange={(value) => updateBridalTrial({ time: value })} required={bridalTrial.addTrial}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {timeSlots.map(slot => <SelectItem key={slot} value={slot}>{format(new Date(`1970-01-01T${slot}`), 'p')}</SelectItem>)}
                        </SelectContent>
                        </Select>
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
                          <Users className='w-6 h-6 text-primary'/>
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
                  </div>
              </CardHeader>
            {partyServices.addServices && (
                <CardContent className="space-y-6 pt-2 animate-in fade-in-0 slide-in-from-top-5 duration-300">
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
        <Button type="submit" size="lg" className="font-bold" disabled={pending}>
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
