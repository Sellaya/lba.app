import { Camera, Gem, PartyPopper, Sparkles } from "lucide-react";
import type { Service, DualPrice } from "./types";

export const GST_RATE = 0.13;

export const SERVICES: Service[] = [
  {
    id: "bridal",
    name: "Bridal Makeup",
    description: "Look your absolute best on your special day.",
    basePrice: { lead: 450, team: 360 },
    duration: 120,
    icon: Gem,
    askServiceType: true,
    optionPrices: {
      'makeup-hair': { lead: 450, team: 360 },
      'hair-only': { lead: 200, team: 160 },
      'makeup-only': { lead: 275, team: 220 },
    },
    addonOverrides: {
      hairExtension: { lead: 20, team: 20 },
      jewellerySetting: { lead: 50, team: 50 },
      sareeDraping: { lead: 50, team: 50 },
      hijabSetting: { lead: 30, team: 30 },
    },
  },
  {
    id: "semi-bridal",
    name: "Semi-Bridal / Engagement",
    description: "For engagement parties or other pre-wedding events.",
    basePrice: { lead: 350, team: 280 },
    duration: 90,
    icon: Sparkles,
    askServiceType: true,
    optionPrices: {
      'makeup-hair': { lead: 350, team: 280 },
      'hair-only': { lead: 175, team: 140 },
      'makeup-only': { lead: 225, team: 180 },
    },
    addonOverrides: {
      hairExtension: { lead: 20, team: 20 },
      jewellerySetting: { lead: 50, team: 50 },
      sareeDraping: { lead: 50, team: 50 },
      hijabSetting: { lead: 30, team: 30 },
    },
  },
  {
    id: "party",
    name: "Party Glam",
    description: "A glamorous look for any party or night out.",
    basePrice: { lead: 250, team: 200 },
    duration: 75,
    icon: PartyPopper,
    askServiceType: true,
    optionPrices: {
      'makeup-hair': { lead: 250, team: 200 },
      'hair-only': { lead: 130, team: 110 },
      'makeup-only': { lead: 140, team: 110 },
    },
    addonOverrides: {
      hairExtension: { lead: 20, team: 20 },
      jewellerySetting: { lead: 20, team: 20 },
      sareeDraping: { lead: 30, team: 30 },
      hijabSetting: { lead: 15, team: 15 },
    },
  },
  {
    id: "photoshoot",
    name: "Photoshoot Makeup",
    description: "Camera-ready makeup that looks flawless.",
    basePrice: { lead: 250, team: 200 },
    duration: 90,
    icon: Camera,
    askServiceType: true,
    optionPrices: {
      'makeup-hair': { lead: 250, team: 200 },
      'hair-only': { lead: 130, team: 110 },
      'makeup-only': { lead: 140, team: 110 },
    },
    addonOverrides: {
      hairExtension: { lead: 20, team: 20 },
      jewellerySetting: { lead: 20, team: 20 },
      sareeDraping: { lead: 30, team: 30 },
      hijabSetting: { lead: 15, team: 15 },
    },
  },
];

export const SERVICE_TYPE_OPTIONS = {
  mobile: {
    id: 'mobile',
    label: 'Mobile Service',
    description: 'We come to you.',
  },
  studio: {
    id: 'studio',
    label: 'Studio Service',
    description: 'You come to us.',
  }
}

export const STUDIO_ADDRESS: {street: string, city: string, province: string, postalCode: string, country: string, googleMapsUrl: string} = {
    street: "30 McCormack Rd",
    city: "Caledon",
    province: "ON",
    postalCode: "L7C 4J6",
    country: "Canada",
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=30+McCormack+Rd+Caledon+ON+L7C+4J6"
}

export const MOBILE_LOCATION_OPTIONS: Record<string, { id: string; label: string; surcharge: DualPrice }> = {
  toronto: {
    id: 'toronto',
    label: 'Toronto / GTA',
    surcharge: { lead: 50, team: 25 },
  },
  'immediate-neighbors': {
    id: 'immediate-neighbors',
    label: 'Immediate Neighbors (15-30 Minutes)',
    surcharge: { lead: 80, team: 45 },
  },
  'moderate-distance': {
    id: 'moderate-distance',
    label: 'Moderate Distance (30 Minutes to 1 Hour Drive)',
    surcharge: { lead: 120, team: 70 },
  },
  'further-out': {
    id: 'further-out',
    label: 'Further Out But Still Reachable (1 Hour Plus)',
    surcharge: { lead: 180, team: 100 },
  },
};

export type MOBILE_LOCATION_IDS = keyof typeof MOBILE_LOCATION_OPTIONS;


export const ADDON_PRICES = {
    hairExtension: { lead: 20, team: 20 },
    jewellerySetting: { lead: 50, team: 50 },
    sareeDraping: { lead: 50, team: 50 },
    hijabSetting: { lead: 30, team: 30 },
    // Legacy bridalTrial pricing (for backward compatibility with existing bookings)
    bridalTrial: { lead: 250, team: 200 },
};

// Bridal trial pricing based on service option
export const BRIDAL_TRIAL_PRICES = {
    'makeup-hair': { lead: 250, team: 200 },
    'makeup-only': { lead: 150, team: 120 },
    'hair-only': { lead: 150, team: 120 },
};

export const BRIDAL_PARTY_PRICES = {
    hairAndMakeup: { lead: 200, team: 200 },
    makeupOnly: { lead: 100, team: 100 },
    hairOnly: { lead: 100, team: 100 },
    dupattaSetting: { lead: 20, team: 20 },
    hairExtensionInstallation: { lead: 20, team: 20 },
    partySareeDraping: { lead: 30, team: 30 },
    partyHijabSetting: { lead: 15, team: 15 },
    airbrush: { lead: 60, team: 60 },
};
