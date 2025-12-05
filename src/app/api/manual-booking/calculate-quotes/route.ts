import { NextRequest, NextResponse } from 'next/server';
import type { Day, BridalTrial, Quote, PriceTier } from '@/lib/types';

// Calculate quote for a tier (replicating logic from actions.ts)
async function calculateQuote(tier: PriceTier, days: Omit<Day, 'id'>[], bridalTrial: BridalTrial): Promise<Quote> {
  // Import the necessary functions
  const { getServices, getMobileLocationOptions, getAddonPrice, getBridalPartyPrice, getBridalTrialPrice, getServiceOptionModifier, getMobileLocationSurcharge } = await import('@/lib/pricing');
  const { SERVICES, MOBILE_LOCATION_OPTIONS, GST_RATE } = await import('@/lib/services');
  const { SERVICE_OPTION_DETAILS } = await import('@/lib/types');
  const { formatToronto } = await import('@/lib/toronto-time');
  
  const lineItems: { description: string; price: number }[] = [];
  let subtotal = 0;

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
        let sareePrice: number;
        if ((service.id === 'bridal' || service.id === 'semi-bridal') && day.partyServices && day.partyServices.addServices) {
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
      
      // Late night/early morning surcharge
      if (day.getReadyTime) {
        const [hours] = day.getReadyTime.split(':').map(Number);
        const hour = hours || 0;
        if (hour >= 21 || hour < 6) {
          const lateNightSurcharge = 25;
          const formattedTime = formatToronto(new Date(`1970-01-01T${day.getReadyTime}`), 'p');
          lineItems.push({ description: `  - Late Night/Early Morning Surcharge (${formattedTime})`, price: lateNightSurcharge });
          subtotal += lateNightSurcharge;
        }
      }
      
      // Party services
      if (day.partyServices && day.partyServices.addServices) {
        const sameDateDays = days.filter(d => 
          d.date && day.date && 
          d.date.toISOString().split('T')[0] === day.date.toISOString().split('T')[0]
        );
        const hasBridalOnSameDate = sameDateDays.some(d => d.serviceId === 'bridal');
        const isSemiBridal = service.id === 'semi-bridal';
        
        if (!(isSemiBridal && hasBridalOnSameDate)) {
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
    const trialServiceOption = bridalTrial.serviceOption || 'makeup-hair';
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { days, bridalTrial } = body;

    if (!days || !Array.isArray(days)) {
      return NextResponse.json({ error: 'Invalid request: days array required' }, { status: 400 });
    }

    // Convert date strings back to Date objects
    // Days come from the client with date as Date object or ISO string
    const processedDays = days.map((day: any) => ({
      ...day,
      date: day.date ? (day.date instanceof Date ? day.date : new Date(day.date)) : null,
    }));

    // Calculate both quotes
    const [leadQuote, teamQuote] = await Promise.all([
      calculateQuote('lead', processedDays, bridalTrial || { addTrial: false, date: undefined, time: '11:00', serviceOption: 'makeup-hair' }),
      calculateQuote('team', processedDays, bridalTrial || { addTrial: false, date: undefined, time: '11:00', serviceOption: 'makeup-hair' }),
    ]);

    return NextResponse.json({
      success: true,
      quotes: {
        lead: leadQuote,
        team: teamQuote,
      },
    });
  } catch (error: any) {
    console.error('Error calculating quotes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate quotes' },
      { status: 500 }
    );
  }
}

