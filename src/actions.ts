'use server';
import 'dotenv/config';
import { z } from 'zod';
import { formatToronto, getTorontoNow } from '@/lib/toronto-time';
import { updateAvailability } from '@/ai/flows/intelligent-availability';
import { SERVICES, MOBILE_LOCATION_OPTIONS, ADDON_PRICES, BRIDAL_PARTY_PRICES, GST_RATE } from '@/lib/services';
import type { ActionState, FinalQuote, Day, BridalTrial, ServiceOption, BridalPartyServices, ServiceType, PartyBooking, PaymentStatus, Quote } from '@/lib/types';
import { SERVICE_OPTION_DETAILS } from '@/lib/types';
import {
  getServices,
  getAddonPrice,
  getMobileLocationSurcharge,
  getBridalPartyPrice,
  getServiceOptionModifier,
  getMobileLocationOptions,
  getBridalTrialPrice,
} from '@/lib/pricing';


const phoneRegex = /^(?:\+?1\s?)?\(?([2-9][0-8][0-9])\)?\s?-?([2-9][0-9]{2})\s?-?([0-9]{4})$/;
const postalCodeRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;


const FormSchema = z.object({
  name: z.string().min(2, { message: 'Please enter your full name.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  phone: z.string().regex(phoneRegex, { message: 'Please enter a valid phone number.' }),
});

function parseDaysFromFormData(formData: FormData): Omit<Day, 'id'>[] {
    const daysData: Omit<Day, 'id'>[] = [];
    let i = 0;
    while (formData.has(`date_${i}`)) {
        const dateStr = formData.get(`date_${i}`) as string;
        const serviceId = formData.get(`service_${i}`) as string | null;
        const dayId = formData.get(`day_id_${i}`) as string | null;
        if(dateStr && serviceId){
            const isBridalOrSemiBridal = serviceId === 'bridal' || serviceId === 'semi-bridal';
            let partyServices: BridalPartyServices | undefined = undefined;
            
            if (isBridalOrSemiBridal && dayId) {
                const addServices = formData.get(`addPartyServices_${dayId}`) === 'on';
                partyServices = {
                    addServices,
                    hairAndMakeup: parseInt(formData.get(`party_${dayId}_hairAndMakeup`) as string || '0', 10),
                    makeupOnly: parseInt(formData.get(`party_${dayId}_makeupOnly`) as string || '0', 10),
                    hairOnly: parseInt(formData.get(`party_${dayId}_hairOnly`) as string || '0', 10),
                    dupattaSetting: parseInt(formData.get(`party_${dayId}_dupattaSetting`) as string || '0', 10),
                    hairExtensionInstallation: parseInt(formData.get(`party_${dayId}_hairExtensionInstallation`) as string || '0', 10),
                    partySareeDraping: parseInt(formData.get(`party_${dayId}_partySareeDraping`) as string || '0', 10),
                    partyHijabSetting: parseInt(formData.get(`party_${dayId}_partyHijabSetting`) as string || '0', 10),
                    airbrush: parseInt(formData.get(`party_${dayId}_airbrush`) as string || '0', 10),
                };
            }
            
            const partyPeopleCount = serviceId === 'party' 
                ? parseInt(formData.get(`partyPeopleCount_${i}`) as string || '1', 10)
                : undefined;

            daysData.push({
                date: new Date(dateStr),
                getReadyTime: formData.get(`getReadyTime_${i}`) as string,
                serviceId: serviceId,
                serviceOption: formData.get(`serviceOption_${i}`) as ServiceOption | null,
                hairExtensions: parseInt(formData.get(`hairExtensions_${i}`) as string || '0', 10),
                jewellerySetting: formData.get(`jewellerySetting_${i}`) === 'on',
                sareeDraping: formData.get(`sareeDraping_${i}`) === 'on',
                hijabSetting: formData.get(`hijabSetting_${i}`) === 'on',
                serviceType: formData.get(`serviceType_${i}`) as ServiceType,
                mobileLocation: formData.get(`mobileLocation_${i}`) as keyof typeof MOBILE_LOCATION_OPTIONS | undefined,
                partyServices,
                partyPeopleCount,
            });
        }
        i++;
    }
    return daysData;
}

function parseBridalTrialFromFormData(formData: FormData): BridalTrial {
    const addTrial = formData.get('addTrial') === 'on';
    const trialDateStr = formData.get('trialDate') as string | null;
    return {
        addTrial,
        date: trialDateStr ? new Date(trialDateStr) : undefined,
        time: formData.get('trialTime') as string,
        serviceOption: (formData.get('trialServiceOption') as ServiceOption) || 'makeup-hair',
    }
}

type PriceTier = 'lead' | 'team';

const calculateQuoteForTier = async (tier: PriceTier, days: Omit<Day, 'id'>[], bridalTrial: BridalTrial): Promise<Quote> => {
    const lineItems: { description: string; price: number }[] = [];
    let subtotal = 0;

    // Fetch current pricing
    const services = await getServices();
    const mobileLocationOptions = await getMobileLocationOptions();

    for (const day of days) {
        const service = services.find((s) => s.id === day.serviceId);
        if (service && day.date && day.getReadyTime) {
          const selectedOption = service.askServiceType
            ? day.serviceOption || 'makeup-hair'
            : 'makeup-hair';
          const optionDetail = SERVICE_OPTION_DETAILS[selectedOption];
          let price: number;

          const optionOverride = service.optionPrices?.[selectedOption];
          if (service.askServiceType && optionOverride) {
            price = optionOverride[tier];
          } else if (service.askServiceType) {
            const optionModifier = await getServiceOptionModifier(selectedOption, tier);
            price = service.basePrice[tier] * optionModifier;
          } else {
            price = service.basePrice[tier];
          }
          
          // For Party Glam, multiply by people count
          const peopleCount = service.id === 'party' ? (day.partyPeopleCount || 1) : 1;
          const totalPrice = price * peopleCount;
          
          const serviceDescription = service.id === 'party' 
            ? `Day ${days.indexOf(day) + 1}: ${service.name} (${service.askServiceType ? optionDetail.label : 'Standard'}) - ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`
            : `Day ${days.indexOf(day) + 1}: ${service.name} (${service.askServiceType ? optionDetail.label : 'Standard'})`;
          
          lineItems.push({
            description: serviceDescription,
            price: totalPrice,
          });
          subtotal += totalPrice;

          const resolveAddonPrice = async (
            addonKey: keyof NonNullable<typeof service.addonOverrides>,
            defaultAddonId: Parameters<typeof getAddonPrice>[0]
          ) => {
            if (service.addonOverrides?.[addonKey]) {
              return service.addonOverrides[addonKey]![tier];
            }
            return await getAddonPrice(defaultAddonId, tier);
          };
          
          if (day.hairExtensions > 0) {
              const extensionUnitPrice = await resolveAddonPrice('hairExtension', 'hairExtension');
              const extensionPrice = day.hairExtensions * extensionUnitPrice * peopleCount;
              const extensionDescription = service.id === 'party' 
                ? `  - Hair Extensions (x${day.hairExtensions} per person × ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'})`
                : `  - Bride's Hair Extensions (x${day.hairExtensions})`;
              lineItems.push({ description: extensionDescription, price: extensionPrice });
              subtotal += extensionPrice;
          }
          if (day.jewellerySetting) {
              const jewelleryPrice = await resolveAddonPrice('jewellerySetting', 'jewellerySetting');
              const jewelleryTotalPrice = jewelleryPrice * peopleCount;
              const jewelleryDescription = service.id === 'party'
                ? `  - Jewellery/Dupatta Setting (× ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'})`
                : `  - Bride's Jewellery Setting`;
              lineItems.push({ description: jewelleryDescription, price: jewelleryTotalPrice });
              subtotal += jewelleryTotalPrice;
          }
          if ((service.id === 'bridal' || service.id === 'semi-bridal' || service.id === 'party') && day.sareeDraping) {
              // If bridal/semi-bridal with party services, use $50 for saree draping
              let sareePrice: number;
              if ((service.id === 'bridal' || service.id === 'semi-bridal') && day.partyServices && day.partyServices.addServices) {
                  // Use $50 for both lead and team when party services are present
                  sareePrice = 50;
              } else {
                  sareePrice = await resolveAddonPrice('sareeDraping', 'sareeDraping');
              }
              const sareeTotalPrice = sareePrice * peopleCount;
              const sareeDescription = service.id === 'party'
                ? `  - Saree Draping (× ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'})`
                : `  - Bride's Saree Draping`;
              lineItems.push({ description: sareeDescription, price: sareeTotalPrice });
              subtotal += sareeTotalPrice;
          }
           if ((service.id === 'bridal' || service.id === 'semi-bridal' || service.id === 'party') && day.hijabSetting) {
              const hijabPrice = await resolveAddonPrice('hijabSetting', 'hijabSetting');
              const hijabTotalPrice = hijabPrice * peopleCount;
              const hijabDescription = service.id === 'party'
                ? `  - Hijab Setting (× ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'})`
                : `  - Bride's Hijab Setting`;
              lineItems.push({ description: hijabDescription, price: hijabTotalPrice });
              subtotal += hijabTotalPrice;
          }
          
          if (day.serviceType === 'mobile' && day.mobileLocation && mobileLocationOptions[day.mobileLocation]) {
              const locationInfo = mobileLocationOptions[day.mobileLocation];
              const daySurcharge = await getMobileLocationSurcharge(day.mobileLocation, tier);
              if (daySurcharge > 0) {
                  lineItems.push({ description: `  - Travel Surcharge (${locationInfo.label})`, price: daySurcharge });
                  subtotal += daySurcharge;
              }
          }
          
          // Check for late night/early morning surcharge (9 PM to 6 AM)
          if (day.getReadyTime) {
              const [hours] = day.getReadyTime.split(':').map(Number);
              const hour = hours || 0;
              // Check if time is between 21:00 (9 PM) and 05:59 (5:59 AM)
              if (hour >= 21 || hour < 6) {
                  const lateNightSurcharge = 25;
                  // Format time for display (e.g., "9:00 PM" instead of "21:00")
                  const formattedTime = formatToronto(new Date(`1970-01-01T${day.getReadyTime}`), 'p');
                  lineItems.push({ description: `  - Late Night/Early Morning Surcharge (${formattedTime})`, price: lateNightSurcharge });
                  subtotal += lateNightSurcharge;
              }
          }
          
          // Calculate party services for this day if it's bridal/semi-bridal
          // If both bridal and semi-bridal are on the same date, only calculate from bridal day
          if (day.partyServices && day.partyServices.addServices) {
              // Check if there's a bridal service on the same date
              const sameDateDays = days.filter(d => 
                  d.date && day.date && 
                  d.date.toISOString().split('T')[0] === day.date.toISOString().split('T')[0]
              );
              const hasBridalOnSameDate = sameDateDays.some(d => d.serviceId === 'bridal');
              const isSemiBridal = service.id === 'semi-bridal';
              
              // Skip semi-bridal party services if bridal is on the same date
              if (isSemiBridal && hasBridalOnSameDate) {
                  // Don't calculate party services for semi-bridal if bridal is on same date
              } else {
                  const partyServices = day.partyServices;
                  const serviceName = service.id === 'bridal' ? 'Bridal' : 'Semi-Bridal';
                  const dayIndex = days.indexOf(day) + 1;
                  
                  if(partyServices.hairAndMakeup > 0) {
                      const price = partyServices.hairAndMakeup * await getBridalPartyPrice('hairAndMakeup', tier);
                      lineItems.push({ description: `Day ${dayIndex} - ${serviceName} Party: Hair & Makeup (x${partyServices.hairAndMakeup})`, price });
                      subtotal += price;
                  }
                  if(partyServices.makeupOnly > 0) {
                      const price = partyServices.makeupOnly * await getBridalPartyPrice('makeupOnly', tier);
                      lineItems.push({ description: `Day ${dayIndex} - ${serviceName} Party: Makeup Only (x${partyServices.makeupOnly})`, price });
                      subtotal += price;
                  }
                  if(partyServices.hairOnly > 0) {
                      const price = partyServices.hairOnly * await getBridalPartyPrice('hairOnly', tier);
                      lineItems.push({ description: `Day ${dayIndex} - ${serviceName} Party: Hair Only (x${partyServices.hairOnly})`, price });
                      subtotal += price;
                  }
                  if(partyServices.dupattaSetting > 0) {
                      const price = partyServices.dupattaSetting * await getBridalPartyPrice('dupattaSetting', tier);
                      lineItems.push({ description: `Day ${dayIndex} - ${serviceName} Party: Dupatta Setting (x${partyServices.dupattaSetting})`, price });
                      subtotal += price;
                  }
                  if(partyServices.hairExtensionInstallation > 0) {
                      const price = partyServices.hairExtensionInstallation * await getBridalPartyPrice('hairExtensionInstallation', tier);
                      lineItems.push({ description: `Day ${dayIndex} - ${serviceName} Party: Hair Extensions (x${partyServices.hairExtensionInstallation})`, price });
                      subtotal += price;
                  }
                  if(partyServices.partySareeDraping > 0) {
                      const price = partyServices.partySareeDraping * await getBridalPartyPrice('partySareeDraping', tier);
                      lineItems.push({ description: `Day ${dayIndex} - ${serviceName} Party: Saree Draping (x${partyServices.partySareeDraping})`, price });
                      subtotal += price;
                  }
                  if(partyServices.partyHijabSetting > 0) {
                      const price = partyServices.partyHijabSetting * await getBridalPartyPrice('partyHijabSetting', tier);
                      lineItems.push({ description: `Day ${dayIndex} - ${serviceName} Party: Hijab Setting (x${partyServices.partyHijabSetting})`, price });
                      subtotal += price;
                  }
                  if(partyServices.airbrush > 0) {
                      const price = partyServices.airbrush * await getBridalPartyPrice('airbrush', tier);
                      lineItems.push({ description: `Day ${dayIndex} - ${serviceName} Party: Air Brush (x${partyServices.airbrush})`, price });
                      subtotal += price;
                  }
              }
          }
        }
    }

    if (bridalTrial.addTrial) {
        // Use the trial's selected service option
        const trialServiceOption: ServiceOption = bridalTrial.serviceOption || 'makeup-hair';
        const trialPrice = await getBridalTrialPrice(trialServiceOption, tier);
        const optionDetail = SERVICE_OPTION_DETAILS[trialServiceOption];
        lineItems.push({ 
            description: `Bridal Trial (${optionDetail.label})`, 
            price: trialPrice 
        });
        subtotal += trialPrice;
    }
    
    const tax = subtotal * GST_RATE;
    const total = subtotal + tax;

    return { lineItems, subtotal, tax, total };
}


export async function generateQuoteAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
    console.log('========================================');
    console.log('generateQuoteAction: CALLED!');
    console.log('generateQuoteAction: prevState:', prevState);
    console.log('generateQuoteAction: formData keys:', Array.from(formData.keys()));
    
    try {
        console.log('generateQuoteAction: Starting quote generation...');
        
        const fieldValues = {
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            ...Object.fromEntries(formData.entries()),
        };

        console.log('generateQuoteAction: fieldValues:', {
            name: fieldValues.name,
            email: fieldValues.email,
            phone: fieldValues.phone?.substring(0, 10) + '...'
        });

        const validatedFields = FormSchema.safeParse(fieldValues);
    
        if (!validatedFields.success) {
            console.log('generateQuoteAction: Validation failed');
            return {
                status: 'error',
                message: 'Please correct the errors below.',
                quote: null,
                errors: validatedFields.error.flatten().fieldErrors,
                fieldValues
            };
        }

        const days = parseDaysFromFormData(formData);
        const bridalTrial = parseBridalTrialFromFormData(formData);

        if (days.length === 0 || days.some(d => !d.date || !d.serviceId || !d.getReadyTime)) {
            console.log('generateQuoteAction: Days validation failed');
            return {
                status: 'error',
                message: 'Please select a date, time, and service for each booking.',
                quote: null,
                errors: { form: ['Please select a date, time, and service for each booking day.'] },
                fieldValues
            };
        }

        if (days.some(d => d.serviceType === 'mobile' && !d.mobileLocation)) {
            console.log('generateQuoteAction: Mobile location validation failed');
            return {
                status: 'error',
                message: 'Please select a mobile service location for all mobile service days.',
                quote: null,
                errors: { mobileLocation: ['Please select a mobile service location for all mobile service days.'] },
                fieldValues
            };
        }
        
        const bridalServiceDay = days.find(d => d.serviceId === 'bridal');
        if (bridalServiceDay && bridalTrial.addTrial && bridalServiceDay?.date && bridalTrial.date) {
            if (bridalTrial.date >= bridalServiceDay.date) {
                console.log('generateQuoteAction: Trial date validation failed');
                return {
                    status: 'error',
                    message: 'Bridal trial date must be before the event date.',
                    quote: null,
                    errors: { trialDate: ['Trial date must be before the event date.'] },
                    fieldValues
                };
            }
        }
        if (bridalServiceDay && bridalTrial.addTrial && (!bridalTrial.date || !bridalTrial.time)) {
            console.log('generateQuoteAction: Trial date/time validation failed');
            return {
                status: 'error',
                message: 'Please select a date and time for the bridal trial.',
                quote: null,
                errors: { trialDate: ['Please select a date and time for the trial.'] },
                fieldValues
            };
        }

        console.log('generateQuoteAction: Validations passed, calculating quotes...');

        // Sort days chronologically
        days.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
        
        // Validate days array is not empty
        if (days.length === 0) {
            return {
                status: 'error',
                message: 'No booking days provided',
                quote: null,
                errors: { form: ['At least one booking day is required.'] },
                fieldValues
            };
        }
        
        const firstDate = days[0].date;
        const firstTime = days[0].getReadyTime;
        const combinedDateTime = firstDate && firstTime ? `${formatToronto(firstDate, 'yyyy-MM-dd')}T${firstTime}:00Z` : getTorontoNow().toISOString();

        const totalDuration = days.reduce((acc, day) => {
            const service = SERVICES.find(s => s.id === day.serviceId);
            return acc + (service?.duration || 0);
        }, 0);

        // Calculate travel time based on service locations
        const hasMobileService = days.some(d => d.serviceType === 'mobile');
        const travelTime = hasMobileService ? 60 : 0; // 60 mins travel time for mobile services within GTA
        
        const availabilityInput = {
            existingBookings: JSON.stringify([]), // Empty array - actual bookings should be fetched from database if needed
            serviceDuration: totalDuration,
            travelTime: travelTime,
            newAppointmentDateTime: combinedDateTime,
        };

        try {
            const availabilityResult = await updateAvailability(availabilityInput);

            if (!availabilityResult.isAvailable) {
                console.log('generateQuoteAction: Availability check failed');
                return {
                    status: 'error',
                    message: availabilityResult.reason || "The selected time slot is not available due to a schedule conflict.",
                    quote: null,
                    errors: null,
                    fieldValues
                };
            }
        } catch (error) {
            console.error("generateQuoteAction: AI availability check failed:", error);
            // Continue even if availability check fails
        }
        
        console.log('generateQuoteAction: Calculating quotes for lead and team tiers...');
        const quoteLead = await calculateQuoteForTier('lead', days, bridalTrial);
        const quoteTeam = await calculateQuoteForTier('team', days, bridalTrial);

        const bookingDays: FinalQuote['booking']['days'] = [];
        const addOnsByDay: Record<number, string[]> = {};

        days.forEach((day, index) => {
            const service = SERVICES.find((s) => s.id === day.serviceId);
            if (service && day.date && day.getReadyTime) {
                const serviceOption = service.askServiceType && day.serviceOption ? SERVICE_OPTION_DETAILS[day.serviceOption] : SERVICE_OPTION_DETAILS['makeup-hair'];
                addOnsByDay[index] = [];
                
                const peopleCount = service.id === 'party' ? (day.partyPeopleCount || 1) : 1;
                
                if (day.hairExtensions > 0) {
                    if (service.id === 'party') {
                        addOnsByDay[index].push(`Hair Extensions (x${day.hairExtensions} per person × ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'})`);
                    } else {
                        addOnsByDay[index].push(`Bride's Hair Extensions (x${day.hairExtensions})`);
                    }
                }
                if (day.jewellerySetting) {
                    if (service.id === 'party') {
                        addOnsByDay[index].push(`Jewellery/Dupatta Setting (× ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'})`);
                    } else {
                        addOnsByDay[index].push("Bride's Jewellery Setting");
                    }
                }
                if ((service.id === 'bridal' || service.id === 'semi-bridal' || service.id === 'party') && day.sareeDraping) {
                    if (service.id === 'party') {
                        addOnsByDay[index].push(`Saree Draping (× ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'})`);
                    } else {
                        addOnsByDay[index].push("Bride's Saree Draping");
                    }
                }
                if ((service.id === 'bridal' || service.id === 'semi-bridal' || service.id === 'party') && day.hijabSetting) {
                    if (service.id === 'party') {
                        addOnsByDay[index].push(`Hijab Setting (× ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'})`);
                    } else {
                        addOnsByDay[index].push("Bride's Hijab Setting");
                    }
                }

                const serviceNameDisplay = service.id === 'party' && day.partyPeopleCount 
                    ? `${service.name} (${day.partyPeopleCount} ${day.partyPeopleCount === 1 ? 'person' : 'people'})`
                    : service.name;
                
                bookingDays.push({ 
                    date: formatToronto(day.date, "PPP"), 
                    getReadyTime: day.getReadyTime,
                    serviceName: serviceNameDisplay,
                    serviceType: day.serviceType,
                    location: day.serviceType === 'mobile' && day.mobileLocation ? MOBILE_LOCATION_OPTIONS[day.mobileLocation].label : "Studio",
                    serviceOption: service.askServiceType ? serviceOption.label : 'Standard',
                    addOns: addOnsByDay[index]
                });
            }
        });

        // Aggregate party services from all bridal/semi-bridal days
        const aggregatedPartyServices: BridalPartyServices = {
            addServices: false,
            hairAndMakeup: 0,
            makeupOnly: 0,
            hairOnly: 0,
            dupattaSetting: 0,
            hairExtensionInstallation: 0,
            partySareeDraping: 0,
            partyHijabSetting: 0,
            airbrush: 0,
        };
        
        days.forEach(day => {
            if (day.partyServices && day.partyServices.addServices) {
                // If both bridal and semi-bridal are on the same date, only aggregate from bridal
                if (day.serviceId === 'semi-bridal' && day.date) {
                    const sameDateDays = days.filter(d => 
                        d.date && 
                        d.date.toISOString().split('T')[0] === day.date!.toISOString().split('T')[0]
                    );
                    const hasBridalOnSameDate = sameDateDays.some(d => d.serviceId === 'bridal');
                    if (hasBridalOnSameDate) {
                        // Skip semi-bridal party services if bridal is on same date
                        return;
                    }
                }
                
                aggregatedPartyServices.addServices = true;
                aggregatedPartyServices.hairAndMakeup += day.partyServices.hairAndMakeup;
                aggregatedPartyServices.makeupOnly += day.partyServices.makeupOnly;
                aggregatedPartyServices.hairOnly += day.partyServices.hairOnly;
                aggregatedPartyServices.dupattaSetting += day.partyServices.dupattaSetting;
                aggregatedPartyServices.hairExtensionInstallation += day.partyServices.hairExtensionInstallation;
                aggregatedPartyServices.partySareeDraping += day.partyServices.partySareeDraping;
                aggregatedPartyServices.partyHijabSetting += day.partyServices.partyHijabSetting;
                aggregatedPartyServices.airbrush += day.partyServices.airbrush;
            }
        });
        
        const bridalPartyBookings: FinalQuote['booking']['bridalParty'] | undefined = aggregatedPartyServices.addServices ? { services: [], airbrush: aggregatedPartyServices.airbrush } : undefined;
        
        if (aggregatedPartyServices.addServices && bridalPartyBookings) {
            if(aggregatedPartyServices.hairAndMakeup > 0) bridalPartyBookings.services.push({ service: 'Hair & Makeup', quantity: aggregatedPartyServices.hairAndMakeup });
            if(aggregatedPartyServices.makeupOnly > 0) bridalPartyBookings.services.push({ service: 'Makeup Only', quantity: aggregatedPartyServices.makeupOnly });
            if(aggregatedPartyServices.hairOnly > 0) bridalPartyBookings.services.push({ service: 'Hair Only', quantity: aggregatedPartyServices.hairOnly });
            if(aggregatedPartyServices.dupattaSetting > 0) bridalPartyBookings.services.push({ service: 'Dupatta/Veil Setting', quantity: aggregatedPartyServices.dupattaSetting });
            if(aggregatedPartyServices.hairExtensionInstallation > 0) bridalPartyBookings.services.push({ service: 'Hair Extension Installation', quantity: aggregatedPartyServices.hairExtensionInstallation });
            if(aggregatedPartyServices.partySareeDraping > 0) bridalPartyBookings.services.push({ service: 'Saree Draping', quantity: aggregatedPartyServices.partySareeDraping });
            if(aggregatedPartyServices.partyHijabSetting > 0) bridalPartyBookings.services.push({ service: 'Hijab Setting', quantity: aggregatedPartyServices.partyHijabSetting });
        }
        
        const bookingId = Math.floor(1000 + Math.random() * 9000).toString();

        const booking: FinalQuote['booking'] = {
            days: bookingDays,
            hasMobileService: days.some(d => d.serviceType === 'mobile'),
        };

        if (bridalServiceDay && bridalTrial.addTrial && bridalTrial.date && bridalTrial.time) {
            booking.trial = { 
                date: formatToronto(bridalTrial.date, "PPP"), 
                time: bridalTrial.time,
                serviceOption: bridalTrial.serviceOption || 'makeup-hair'
            };
        }

        if (bridalPartyBookings) {
            booking.bridalParty = bridalPartyBookings;
        }

        const finalQuote: FinalQuote = {
            id: bookingId,
            contact: {
                name: validatedFields.data.name,
                email: validatedFields.data.email,
                phone: validatedFields.data.phone,
            },
            booking,
            quotes: {
                lead: quoteLead,
                team: quoteTeam,
            },
            status: 'quoted',
            quoteGeneratedAt: getTorontoNow().toISOString() // Track when client took/generated the quote
        };
        
        // Instead of saving here and redirecting, return the quote to the client.
        // The client component will handle saving and redirection.
        console.log('generateQuoteAction: Quote generated successfully, ID:', finalQuote.id);
        return {
            status: 'success',
            message: 'Quote generated successfully!',
            quote: finalQuote,
            errors: null,
            fieldValues
        };
    } catch (error: any) {
        console.error('generateQuoteAction: Error generating quote:', error);
        console.error('generateQuoteAction: Error stack:', error?.stack);
        return {
            status: 'error',
            message: error?.message || 'An unexpected error occurred while generating your quote. Please try again.',
            quote: null,
            errors: null,
            fieldValues: {}
        };
    }
}
