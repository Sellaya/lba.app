'use server';
import 'dotenv/config';
import { z } from 'zod';
import { format } from 'date-fns';
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
          
          lineItems.push({
            description: `Day ${days.indexOf(day) + 1}: ${service.name} (${service.askServiceType ? optionDetail.label : 'Standard'})`,
            price: price,
          });
          subtotal += price;

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
              const extensionPrice = day.hairExtensions * extensionUnitPrice;
              lineItems.push({ description: `  - Bride's Hair Extensions (x${day.hairExtensions})`, price: extensionPrice });
              subtotal += extensionPrice;
          }
          if (day.jewellerySetting) {
              const jewelleryPrice = await resolveAddonPrice('jewellerySetting', 'jewellerySetting');
              lineItems.push({ description: `  - Bride's Jewellery Setting`, price: jewelleryPrice });
              subtotal += jewelleryPrice;
          }
          if ((service.id === 'bridal' || service.id === 'semi-bridal') && day.sareeDraping) {
              const sareePrice = await resolveAddonPrice('sareeDraping', 'sareeDraping');
              lineItems.push({ description: `  - Bride's Saree Draping`, price: sareePrice });
              subtotal += sareePrice;
          }
           if ((service.id === 'bridal' || service.id === 'semi-bridal') && day.hijabSetting) {
              const hijabPrice = await resolveAddonPrice('hijabSetting', 'hijabSetting');
              lineItems.push({ description: `  - Bride's Hijab Setting`, price: hijabPrice });
              subtotal += hijabPrice;
          }
          
          if (day.serviceType === 'mobile' && day.mobileLocation && mobileLocationOptions[day.mobileLocation]) {
              const locationInfo = mobileLocationOptions[day.mobileLocation];
              const daySurcharge = await getMobileLocationSurcharge(day.mobileLocation, tier);
              if (daySurcharge > 0) {
                  lineItems.push({ description: `  - Travel Surcharge (${locationInfo.label})`, price: daySurcharge });
                  subtotal += daySurcharge;
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
        const trialPrice = await getAddonPrice('bridalTrial', tier);
        lineItems.push({ description: 'Bridal Trial', price: trialPrice });
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
    const fieldValues = {
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        ...Object.fromEntries(formData.entries()),
    };

    const validatedFields = FormSchema.safeParse(fieldValues);
    
    if (!validatedFields.success) {
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
        return {
            status: 'error',
            message: 'Please select a date, time, and service for each booking.',
            quote: null,
            errors: { form: ['Please select a date, time, and service for each booking day.'] },
            fieldValues
        };
    }

     if (days.some(d => d.serviceType === 'mobile' && !d.mobileLocation)) {
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
        return {
            status: 'error',
message: 'Please select a date and time for the bridal trial.',
            quote: null,
            errors: { trialDate: ['Please select a date and time for the trial.'] },
            fieldValues
        }
    }


    // Sort days chronologically
    days.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
    
    const firstDate = days[0].date;
    const firstTime = days[0].getReadyTime;
    const combinedDateTime = firstDate && firstTime ? `${format(firstDate, 'yyyy-MM-dd')}T${firstTime}:00Z` : new Date().toISOString();


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
            return {
                status: 'error',
                message: availabilityResult.reason || "The selected time slot is not available due to a schedule conflict.",
                quote: null,
                errors: null,
                fieldValues
            };
        }
    } catch (error) {
        console.error("AI availability check failed:", error);
    }
    
    const quoteLead = await calculateQuoteForTier('lead', days, bridalTrial);
    const quoteTeam = await calculateQuoteForTier('team', days, bridalTrial);

    const bookingDays: FinalQuote['booking']['days'] = [];
    const addOnsByDay: Record<number, string[]> = {};

    days.forEach((day, index) => {
        const service = SERVICES.find((s) => s.id === day.serviceId);
        if (service && day.date && day.getReadyTime) {
            const serviceOption = service.askServiceType && day.serviceOption ? SERVICE_OPTION_DETAILS[day.serviceOption] : SERVICE_OPTION_DETAILS['makeup-hair'];
            addOnsByDay[index] = [];
            
            if (day.hairExtensions > 0) addOnsByDay[index].push(`Bride's Hair Extensions (x${day.hairExtensions})`);
            if (day.jewellerySetting) addOnsByDay[index].push("Bride's Jewellery Setting");
            if ((service.id === 'bridal' || service.id === 'semi-bridal') && day.sareeDraping) addOnsByDay[index].push("Bride's Saree Draping");
            if ((service.id === 'bridal' || service.id === 'semi-bridal') && day.hijabSetting) addOnsByDay[index].push("Bride's Hijab Setting");

            bookingDays.push({ 
                date: format(day.date, "PPP"), 
                getReadyTime: day.getReadyTime,
                serviceName: service.name,
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
        booking.trial = { date: format(bridalTrial.date, "PPP"), time: bridalTrial.time };
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
        status: 'quoted'
    };
    
    // Instead of saving here and redirecting, return the quote to the client.
    // The client component will handle saving and redirection.
     return {
        status: 'success',
        message: 'Quote generated successfully!',
        quote: finalQuote,
        errors: null,
        fieldValues
    };
}
