import { supabaseAdmin } from './supabase/server';
import { SERVICES as DEFAULT_SERVICES, ADDON_PRICES as DEFAULT_ADDON_PRICES, MOBILE_LOCATION_OPTIONS as DEFAULT_MOBILE_LOCATION_OPTIONS, BRIDAL_PARTY_PRICES as DEFAULT_BRIDAL_PARTY_PRICES, BRIDAL_TRIAL_PRICES as DEFAULT_BRIDAL_TRIAL_PRICES } from './services';
import { SERVICE_OPTION_DETAILS as DEFAULT_SERVICE_OPTION_DETAILS } from './types';
import type { Service, DualPrice, ServiceOption } from './types';
import type { MOBILE_LOCATION_IDS } from './services';

// Cache for pricing data
let pricingCache: {
  services: Map<string, DualPrice>;
  addons: Map<string, DualPrice>;
  mobileLocations: Map<string, DualPrice>;
  bridalParty: Map<string, DualPrice>;
  bridalTrial: Map<string, DualPrice>; // Key is service option (makeup-hair, makeup-only, hair-only)
  serviceOptions: Map<string, { priceModifier: number; teamPriceModifier: number }>;
  lastFetch: number | null;
} = {
  services: new Map(),
  addons: new Map(),
  mobileLocations: new Map(),
  bridalParty: new Map(),
  bridalTrial: new Map(),
  serviceOptions: new Map(),
  lastFetch: null,
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch pricing from database and cache it
 */
async function fetchPricingFromDB(): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .select('*');

    if (error) {
      // Check if table doesn't exist
      const isTableNotFound = 
        error.code === '42P01' || 
        error.code === 'PGRST116' ||
        error.message?.includes('does not exist') || 
        error.message?.includes('schema cache') ||
        error.message?.includes('Could not find the table');
      
      if (isTableNotFound) {
        console.warn('pricing_config table does not exist yet, using defaults');
      } else {
        console.warn('Failed to fetch pricing from database, using defaults:', error.message);
      }
      return;
    }

    if (!data || data.length === 0) {
      console.warn('No pricing data in database, using defaults');
      return;
    }

    // Clear existing cache
    pricingCache.services.clear();
    pricingCache.addons.clear();
    pricingCache.mobileLocations.clear();
    pricingCache.bridalParty.clear();
    pricingCache.bridalTrial.clear();
    pricingCache.serviceOptions.clear();

    // Populate cache
    data.forEach((item) => {
      const price: DualPrice = {
        lead: parseFloat(item.price_lead) || 0,
        team: parseFloat(item.price_team) || 0,
      };

      switch (item.category) {
        case 'service':
          pricingCache.services.set(item.item_id, price);
          break;
        case 'addon':
          pricingCache.addons.set(item.item_id, price);
          break;
        case 'mobile_location':
          pricingCache.mobileLocations.set(item.item_id, price);
          break;
        case 'bridal_party':
          pricingCache.bridalParty.set(item.item_id, price);
          break;
        case 'bridal_trial':
          pricingCache.bridalTrial.set(item.item_id, price);
          break;
        case 'service_option':
          pricingCache.serviceOptions.set(item.item_id, {
            priceModifier: parseFloat(item.price_lead) || 1,
            teamPriceModifier: parseFloat(item.price_team) || 1,
          });
          break;
      }
    });

    pricingCache.lastFetch = Date.now();
  } catch (error) {
    console.warn('Error fetching pricing from database, using defaults:', error);
  }
}

/**
 * Get pricing with cache management
 */
async function getPricing(): Promise<typeof pricingCache> {
  const now = Date.now();
  if (
    pricingCache.lastFetch === null ||
    now - pricingCache.lastFetch > CACHE_DURATION ||
    (pricingCache.services.size === 0 && pricingCache.addons.size === 0)
  ) {
    await fetchPricingFromDB();
  }
  return pricingCache;
}

/**
 * Get service price (with fallback to default)
 */
export async function getServicePrice(serviceId: string, tier: 'lead' | 'team'): Promise<number> {
  const cache = await getPricing();
  const cachedPrice = cache.services.get(serviceId);
  if (cachedPrice) {
    return cachedPrice[tier];
  }

  // Fallback to default
  const defaultService = DEFAULT_SERVICES.find((s) => s.id === serviceId);
  return defaultService?.basePrice[tier] || 0;
}

/**
 * Get all services with current pricing
 */
export async function getServices(): Promise<Service[]> {
  const cache = await getPricing();
  return DEFAULT_SERVICES.map((service) => {
    const cachedPrice = cache.services.get(service.id);
    return {
      ...service,
      basePrice: cachedPrice || service.basePrice,
    };
  });
}

/**
 * Get addon price (with fallback to default)
 */
export async function getAddonPrice(addonId: keyof typeof DEFAULT_ADDON_PRICES, tier: 'lead' | 'team'): Promise<number> {
  const cache = await getPricing();
  const cachedPrice = cache.addons.get(addonId);
  if (cachedPrice) {
    return cachedPrice[tier];
  }

  // Fallback to default
  return DEFAULT_ADDON_PRICES[addonId]?.[tier] || 0;
}

/**
 * Get all addon prices
 */
export async function getAddonPrices(): Promise<typeof DEFAULT_ADDON_PRICES> {
  const cache = await getPricing();
  const result: any = {};

  Object.keys(DEFAULT_ADDON_PRICES).forEach((key) => {
    const cachedPrice = cache.addons.get(key);
    result[key] = cachedPrice || DEFAULT_ADDON_PRICES[key as keyof typeof DEFAULT_ADDON_PRICES];
  });

  return result;
}

/**
 * Get mobile location surcharge (with fallback to default)
 */
export async function getMobileLocationSurcharge(
  locationId: MOBILE_LOCATION_IDS,
  tier: 'lead' | 'team'
): Promise<number> {
  const cache = await getPricing();
  const cachedPrice = cache.mobileLocations.get(locationId);
  if (cachedPrice) {
    return cachedPrice[tier];
  }

  // Fallback to default
  return DEFAULT_MOBILE_LOCATION_OPTIONS[locationId]?.surcharge[tier] || 0;
}

/**
 * Get all mobile location options with current pricing
 */
export async function getMobileLocationOptions(): Promise<typeof DEFAULT_MOBILE_LOCATION_OPTIONS> {
  const cache = await getPricing();
  const result: any = {};

  Object.entries(DEFAULT_MOBILE_LOCATION_OPTIONS).forEach(([key, location]) => {
    const cachedPrice = cache.mobileLocations.get(key);
    result[key] = {
      ...location,
      surcharge: cachedPrice || location.surcharge,
    };
  });

  return result;
}

/**
 * Get bridal party price (with fallback to default)
 */
export async function getBridalPartyPrice(
  serviceId: keyof typeof DEFAULT_BRIDAL_PARTY_PRICES,
  tier: 'lead' | 'team'
): Promise<number> {
  const cache = await getPricing();
  const cachedPrice = cache.bridalParty.get(serviceId);
  if (cachedPrice) {
    return cachedPrice[tier];
  }

  // Fallback to default
  return DEFAULT_BRIDAL_PARTY_PRICES[serviceId]?.[tier] || 0;
}

/**
 * Get all bridal party prices
 */
export async function getBridalPartyPrices(): Promise<typeof DEFAULT_BRIDAL_PARTY_PRICES> {
  const cache = await getPricing();
  const result: any = {};

  Object.keys(DEFAULT_BRIDAL_PARTY_PRICES).forEach((key) => {
    const cachedPrice = cache.bridalParty.get(key);
    result[key] = cachedPrice || DEFAULT_BRIDAL_PARTY_PRICES[key as keyof typeof DEFAULT_BRIDAL_PARTY_PRICES];
  });

  return result;
}

/**
 * Get service option modifier (with fallback to default)
 */
export async function getServiceOptionModifier(
  optionId: keyof typeof DEFAULT_SERVICE_OPTION_DETAILS,
  tier: 'lead' | 'team'
): Promise<number> {
  const cache = await getPricing();
  const cached = cache.serviceOptions.get(optionId);
  if (cached) {
    return tier === 'team' && cached.teamPriceModifier !== undefined
      ? cached.teamPriceModifier
      : cached.priceModifier;
  }

  // Fallback to default
  const defaultOption = DEFAULT_SERVICE_OPTION_DETAILS[optionId];
  if (!defaultOption) return 1;
  return tier === 'team' && defaultOption.teamPriceModifier !== undefined
    ? defaultOption.teamPriceModifier
    : defaultOption.priceModifier;
}

/**
 * Get all service option details
 */
export async function getServiceOptionDetails(): Promise<typeof DEFAULT_SERVICE_OPTION_DETAILS> {
  const cache = await getPricing();
  const result: any = {};

  Object.entries(DEFAULT_SERVICE_OPTION_DETAILS).forEach(([key, details]) => {
    const cached = cache.serviceOptions.get(key);
    if (cached) {
      result[key] = {
        label: details.label,
        priceModifier: cached.priceModifier,
        teamPriceModifier: cached.teamPriceModifier,
      };
    } else {
      result[key] = details;
    }
  });

  return result;
}

/**
 * Get bridal trial price based on service option (with fallback to default)
 */
export async function getBridalTrialPrice(
  serviceOption: ServiceOption,
  tier: 'lead' | 'team'
): Promise<number> {
  const cache = await getPricing();
  const cachedPrice = cache.bridalTrial.get(serviceOption);
  if (cachedPrice) {
    return cachedPrice[tier];
  }

  // Fallback to default
  return DEFAULT_BRIDAL_TRIAL_PRICES[serviceOption]?.[tier] || 0;
}

/**
 * Get all bridal trial prices
 */
export async function getBridalTrialPrices(): Promise<typeof DEFAULT_BRIDAL_TRIAL_PRICES> {
  const cache = await getPricing();
  const result: any = {};

  Object.keys(DEFAULT_BRIDAL_TRIAL_PRICES).forEach((key) => {
    const cachedPrice = cache.bridalTrial.get(key);
    result[key] = cachedPrice || DEFAULT_BRIDAL_TRIAL_PRICES[key as keyof typeof DEFAULT_BRIDAL_TRIAL_PRICES];
  });

  return result;
}

/**
 * Invalidate pricing cache (call this after updating prices)
 */
export function invalidatePricingCache(): void {
  pricingCache.lastFetch = null;
  pricingCache.services.clear();
  pricingCache.addons.clear();
  pricingCache.mobileLocations.clear();
  pricingCache.bridalParty.clear();
  pricingCache.bridalTrial.clear();
  pricingCache.serviceOptions.clear();
}

