
'use client';

import * as React from 'react';
import { useMemo, useState, useRef } from 'react';
import { CheckCircle2, User, Users, Loader2, MapPin, ShieldCheck, FileText, Banknote, CreditCard, ArrowRight, ArrowLeft, AlertTriangle, Phone, CalendarIcon, X, Plus, Image as ImageIcon, Link as LinkIcon, Share2, MessageCircle, Clock } from "lucide-react";
import { MakeupBrushVector, MirrorVector, HairVector, SparkleVector, CheckmarkVector } from '@/components/beauty-vectors';
import type { FinalQuote, PriceTier, Quote, PaymentMethod, PaymentDetails, Address } from "@/lib/types";
import type { BookingDocument } from '@/firebase/firestore/bookings';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { STUDIO_ADDRESS } from '@/lib/services';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/price-format';
import { Separator } from '@/components/ui/separator';
import { ContractDisplay } from '@/components/contract-display';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { sendAdminScreenshotNotificationAction } from '@/app/admin/actions';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatToronto } from '@/lib/toronto-time';
import { BrandingFooter } from '@/components/branding-footer';
import Link from 'next/link';
import { Home } from 'lucide-react';
import { trackEvent } from '@/lib/facebook-pixel';
import { Progress } from '@/components/ui/progress';

type ConfirmationStep = 'select-tier' | 'address' | 'sign-contract' | 'payment' | 'confirmed';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
// Validate that we're using a publishable key (starts with pk_) and not a secret key (starts with sk_)
const isValidPublishableKey = publishableKey && publishableKey.startsWith('pk_') && !publishableKey.startsWith('sk_');
const stripePromise: Promise<Stripe | null> | null = isValidPublishableKey ? loadStripe(publishableKey) : null;

if (publishableKey && !isValidPublishableKey) {
  console.error('Invalid Stripe publishable key. Publishable keys must start with "pk_". Secret keys (starting with "sk_") cannot be used with Stripe.js.');
}

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
            <CardFooter className="bg-secondary/30 p-4 rounded-b-lg space-y-2">
                <div className="w-full pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground text-center">
                        50% advance (${formatPrice(quote.total * 0.5)}) required now<br />
                        50% (${formatPrice(quote.total * 0.5)}) due on booking day
                    </p>
                </div>
            </CardFooter>
        </Card>
    </Label>
  )
}

export function QuoteConfirmation({ quote: initialQuote }: { quote: FinalQuote }) {
  const { toast } = useToast();

  // Safety check: ensure quote has required structure
  if (!initialQuote || !initialQuote.quotes || !initialQuote.contact) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-1 flex-col items-center justify-center text-center p-4">
          <AlertTriangle className="w-12 h-12 text-destructive mt-4" />
          <h1 className="text-2xl font-bold text-destructive mt-4">Invalid Quote Data</h1>
          <p className="mt-2 text-muted-foreground">The quote data is incomplete or invalid.</p>
        </div>
      </div>
    );
  }

  const [quote, setQuote] = useState(initialQuote);
  const [currentStep, setCurrentStep] = useState<ConfirmationStep>(() => quote.status === 'confirmed' ? 'confirmed' : 'select-tier');
  const [contractSigned, setContractSigned] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [address, setAddress] = useState<Address>(() => quote.booking.address || { street: '', city: '', province: 'ON', postalCode: '' });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [inspirationImages, setInspirationImages] = useState<File[]>([]);
  const [inspirationImageUrls, setInspirationImageUrls] = useState<string[]>(() => quote.booking.inspirations?.images || []);
  const [inspirationLinks, setInspirationLinks] = useState<string[]>(() => {
    const existingLinks = quote.booking.inspirations?.links || [];
    return existingLinks.length > 0 ? existingLinks : [''];
  });
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [showWinterOfferPopup, setShowWinterOfferPopup] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(quote.paymentDetails?.method);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  
  // Final payment state
  const [finalPaymentMethod, setFinalPaymentMethod] = useState<PaymentMethod | undefined>(quote.paymentDetails?.finalPayment?.method);
  const [finalScreenshotFile, setFinalScreenshotFile] = useState<File | null>(null);
  const [showFinalPayment, setShowFinalPayment] = useState(false);
  
  // First name for personalized copy (fallback to a friendly default)
  const firstName = useMemo(() => {
    const full = quote?.contact?.name?.trim() || '';
    const [first] = full.split(' ');
    return first || 'Beautiful';
  }, [quote?.contact?.name]);

  // Urgency notification state
  const [currentUrgencyMessage, setCurrentUrgencyMessage] = useState(0);
  
  // Define urgency messages outside component to avoid recreation
  const urgencyMessages = React.useMemo(
    () => [
      `${firstName}, your quote is ready`,
      `${firstName}, you're one step away from stunning`,
      `${firstName}, your date is getting popular`,
      `Most clients who book now save on last-minute rates`,
      `Let's lock in your beauty moment`,
      `Book your glam session now and let us handle the rest`,
      `${firstName}, this quote is customized for you`,
      `${firstName}, your date is still available — for now`,
    ],
    [firstName]
  );

  // Define bookingConfirmed before using it in useEffect
  const bookingConfirmed = useMemo(() => quote.status === 'confirmed', [quote.status]);

  // Rotate urgency messages every 5 seconds with smooth transitions
  React.useEffect(() => {
    if (currentStep !== 'select-tier' || bookingConfirmed) return;
    
    const interval = setInterval(() => {
      setCurrentUrgencyMessage((prev) => (prev + 1) % urgencyMessages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [currentStep, bookingConfirmed, urgencyMessages]);

  // Book a Call state
  const [isBookCallDialogOpen, setIsBookCallDialogOpen] = useState(false);
  const [isSubmittingCallBooking, setIsSubmittingCallBooking] = useState(false);
  const [callBookingDate, setCallBookingDate] = useState<Date | undefined>(undefined);
  const [callBookingTime, setCallBookingTime] = useState<string>('');
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [useContactPhone, setUseContactPhone] = useState<boolean>(false);
  const [callBookingMessage, setCallBookingMessage] = useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // If user lands with #book-call in the URL (e.g. from WhatsApp link),
  // automatically scroll to the section and open the Book a Call dialog.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#book-call') {
      // Small delay to ensure layout is ready before scrolling / opening dialog
      setTimeout(() => {
        const el = document.getElementById('book-call');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setIsBookCallDialogOpen(true);
      }, 400);
    }
  }, []);
  
  // Format phone number to +1 format (US/Canada)
  const formatToPlusOne = (phoneNumber: string): string => {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // If empty, return empty
    if (cleaned.length === 0) {
      return '';
    }
    
    // If starts with 1, use it; otherwise prepend 1
    let digits = cleaned;
    if (!cleaned.startsWith('1')) {
      digits = '1' + cleaned;
    }
    
    // Limit to 11 digits (1 + 10 digits for US/Canada)
    const limited = digits.slice(0, 11);
    
    // Return in +1 format
    return '+' + limited;
  };

  // Generate time slots from 9 AM to 9 PM (inclusive)
  const callTimeSlots = useMemo(() => {
    const slots: string[] = [];
    // Start at 9 AM (09:00) and go up to 9 PM (21:00)
    for (let hour = 9; hour <= 21; hour++) {
      // Add :00 slot (e.g., 09:00, 10:00, etc.)
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      // Add :30 slot only if not the last hour (9 PM)
      // This ensures we don't add 21:30, keeping the last slot at 21:00 (9 PM)
      if (hour < 21) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  const containsStudioService = useMemo(() => quote.booking?.days?.some(d => d?.serviceType === 'studio') || false, [quote.booking?.days]);
  const containsMobileService = useMemo(() => quote.booking?.days?.some(d => d?.serviceType === 'mobile') || false, [quote.booking?.days]);
  
  const showLeadArtistOption = useMemo(() => true, []);
  const showTeamOption = useMemo(() => containsMobileService || containsStudioService, [containsMobileService, containsStudioService]);
  
  const [selectedTier, setSelectedTier] = useState<PriceTier | undefined>(() => {
    if (quote.selectedQuote) return quote.selectedQuote;
    if (!showTeamOption && showLeadArtistOption) return 'lead';
    return undefined;
  });
  
  const depositAmount = useMemo(() => {
    if (!selectedTier) return 0;
    return quote.quotes[selectedTier].total * 0.5;
  }, [selectedTier, quote.quotes]);

  const requiresAddress = useMemo(() => quote.booking.hasMobileService && !quote.booking.address, [quote]);
  
  // Memoize STEPS array to avoid recreation on every render
  const STEPS = useMemo(() => [
    { id: 'select-tier', name: 'Select Tier', icon: Users, estimatedTime: 30 }, // 30 seconds
    ...(requiresAddress ? [{ id: 'address', name: 'Address', icon: MapPin, estimatedTime: 60 }] : []), // 1 minute
    { id: 'sign-contract', name: 'Sign Contract', icon: FileText, estimatedTime: 45 }, // 45 seconds
    { id: 'payment', name: 'Payment', icon: Banknote, estimatedTime: 90 } // 1.5 minutes
  ], [requiresAddress]);
  
  // Update quote when initialQuote changes (e.g., when user searches and views booking)
  React.useEffect(() => {
    setQuote(initialQuote);
    // Also update selectedTier when quote changes
    if (initialQuote.selectedQuote) {
      setSelectedTier(initialQuote.selectedQuote);
    } else if (!showTeamOption && showLeadArtistOption) {
      setSelectedTier('lead');
    }
  }, [initialQuote, showTeamOption, showLeadArtistOption]);

  React.useEffect(() => {
    // If the booking is already confirmed, jump to the last step.
    if (bookingConfirmed && currentStep !== 'confirmed') {
      setCurrentStep('confirmed');
    }
    // If screenshot is rejected, show payment step to allow re-upload
    if (quote.paymentDetails?.status === 'screenshot-rejected' && currentStep !== 'payment' && currentStep !== 'confirmed') {
      setCurrentStep('payment');
    }
    // Auto-show final payment section if final payment is rejected
    if (quote.paymentDetails?.finalPayment?.status === 'screenshot-rejected') {
      setShowFinalPayment(true);
    }
  }, [bookingConfirmed, currentStep, quote.paymentDetails?.status, quote.paymentDetails?.finalPayment?.status]);

  // Winter Offer popup - Show after 10 seconds on quote page only (select-tier step),
  // active from now (Nov 2025) through the end of December 2025
  React.useEffect(() => {
    // Only show during the Winter Offer period (Nov–Dec 2025) and on quote page (select-tier step)
    const now = new Date();
    const isWinterOfferActive =
      now.getFullYear() === 2025 && now.getMonth() >= 10 && now.getMonth() <= 11; // November (10) and December (11) 2025
    
    if (!isWinterOfferActive || bookingConfirmed || currentStep !== 'select-tier') {
      return;
    }

    // Show popup after 10 seconds on page load/refresh
    const timer = setTimeout(() => {
      setShowWinterOfferPopup(true);
      trackEvent('WinterOfferTriggered', {
        booking_id: quote.id,
      });
    }, 10000); // 10 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [bookingConfirmed, currentStep, quote.id]);

  const validateAddress = () => {
    const errors: Record<string, string> = {};
    if (!address.street) errors.street = "Street address is required.";
    if (!address.city) errors.city = "City is required.";
    if (!address.postalCode) errors.postalCode = "Postal code is required.";
    else if (!/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(address.postalCode)) {
        errors.postalCode = "Invalid postal code format.";
    }
    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };


  const handleSaveAddress = async () => {
      if (!validateAddress()) {
          toast({ variant: 'destructive', title: 'Invalid Address', description: 'Please correct the errors and try again.' });
          return;
      }
      setIsSaving(true);
      setIsUploadingImages(true);
      setError(null);
      
      try {
        // Upload new inspiration images (only files that haven't been uploaded yet)
        const uploadedImageUrls: string[] = [...inspirationImageUrls.filter(url => url.startsWith('http'))]; // Keep existing URLs
        for (const file of inspirationImages) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('userId', 'web');
          formData.append('type', 'inspiration');

          const uploadRes = await fetch(`/api/bookings/${quote.id}/upload-inspiration`, {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) {
            const errorData = await uploadRes.json().catch(() => ({ error: 'Failed to upload image' }));
            throw new Error(errorData.error || 'Failed to upload inspiration image');
          }

          const { url } = await uploadRes.json();
          uploadedImageUrls.push(url);
        }

        // Filter out empty links
        const validLinks = inspirationLinks.filter(link => link.trim() !== '');

        // Prepare inspirations data
        const inspirations = {
          images: uploadedImageUrls,
          links: validLinks,
        };

        const updatedQuote: FinalQuote = { 
          ...quote, 
          booking: { 
            ...quote.booking, 
            address,
            inspirations: (uploadedImageUrls.length > 0 || validLinks.length > 0) ? inspirations : undefined
          } 
        };

        const res = await fetch(`/api/bookings/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ finalQuote: updatedQuote }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({ error: 'Failed to save address' }));
            throw new Error(data.error || 'Failed to save address');
        }

        setQuote(updatedQuote);
        setCurrentStep('sign-contract');
      } catch (err: any) {
          setError(err.message || "Failed to save address. Please check your connection or permissions.");
          toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
      } finally {
          setIsSaving(false);
          setIsUploadingImages(false);
      }
  };

  const handleBookCall = async () => {
    // Determine the WhatsApp number to use
    const finalWhatsappNumber = useContactPhone && quote.contact.phone 
      ? quote.contact.phone 
      : whatsappNumber.trim();

    if (!callBookingDate || !callBookingTime || !finalWhatsappNumber) {
      toast({ 
        variant: 'destructive', 
        title: 'Missing Information', 
        description: 'Please fill in all fields: date, time, and WhatsApp number.' 
      });
      return;
    }

    // Format to +1 format regardless of input
    const whatsappFormatted = formatToPlusOne(finalWhatsappNumber);
    
    // Validate WhatsApp number format - should have 11 digits after +1
    const digitsOnly = whatsappFormatted.replace(/\D/g, '');
    if (digitsOnly.length < 11) {
      toast({ 
        variant: 'destructive', 
        title: 'Invalid WhatsApp Number', 
        description: 'Please enter a valid phone number (10 digits minimum).' 
      });
      return;
    }

    setIsSubmittingCallBooking(true);
    setError(null);

    try {
      const res = await fetch('/api/book-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: quote.contact.name,
          customerEmail: quote.contact.email,
          customerPhone: quote.contact.phone || '',
          whatsappNumber: whatsappFormatted, // Use +1 formatted number for WhatsApp link
          preferredDate: formatToronto(callBookingDate, 'PPP'),
          preferredTime: formatToronto(new Date(`1970-01-01T${callBookingTime}`), 'p'),
          message: callBookingMessage.trim() || '',
          bookingId: quote.id,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to submit call booking request');
      }

      toast({
        title: 'Call Booking Submitted!',
        description: 'Anum will contact you at your preferred time. You will receive a confirmation email shortly.',
      });

      // Reset form and close dialog
      setCallBookingDate(undefined);
      setCallBookingTime('');
      setWhatsappNumber('');
      setUseContactPhone(false);
      setCallBookingMessage('');
      setIsBookCallDialogOpen(false);

    } catch (err: any) {
      setError(err.message || 'Failed to submit call booking request');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to submit call booking request. Please try again.',
      });
    } finally {
      setIsSubmittingCallBooking(false);
    }
  };

  const handleFinalPayment = async () => {
    // Determine selected quote - use quote.selectedQuote, selectedTier, or default to 'lead' if booking is confirmed
    let paymentSelectedQuote = quote.selectedQuote || selectedTier;
    
    // If still no selected quote but booking is confirmed with advance payment, try to infer from available quotes
    if (!paymentSelectedQuote && bookingConfirmed && quote.paymentDetails && 
        (quote.paymentDetails.status === 'payment-approved' || quote.paymentDetails.status === 'deposit-paid')) {
      if (quote.quotes && quote.quotes.lead) {
        paymentSelectedQuote = 'lead';
      } else if (quote.quotes && quote.quotes.team) {
        paymentSelectedQuote = 'team';
      }
    }
    
    if (!paymentSelectedQuote || !finalPaymentMethod) {
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a payment method for the remaining balance.' });
        return;
    }
    if (finalPaymentMethod === 'interac' && !finalScreenshotFile) {
        toast({ variant: 'destructive', title: 'Screenshot Required', description: 'Please upload a payment screenshot for Interac transfers.' });
        return;
    }

    setIsSaving(true);
    setError(null);

    const finalAmount = quote.quotes[paymentSelectedQuote].total * 0.5;

    try {
        if (finalPaymentMethod === 'stripe') {
            const res = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    bookingId: quote.id, 
                    tier: paymentSelectedQuote,
                    isFinalPayment: true,
                    amount: finalAmount,
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                try {
                    const { error } = JSON.parse(errorText);
                    throw new Error(error || 'Failed to create Stripe session.');
                } catch (e) {
                    console.error("Stripe API route failed:", errorText);
                    throw new Error('Failed to create Stripe session. The server returned an invalid error format.');
                }
            }

            const { sessionId } = await res.json();
            if (!stripePromise) {
                throw new Error('Stripe publishable key is not configured.');
            }
            const stripe = await stripePromise;
            if (stripe) {
                // Track payment initiation
                if (selectedTier) {
                  trackEvent('InitiateCheckout', {
                    content_name: 'Advance Payment - Stripe',
                    content_category: 'Payment',
                    value: depositAmount,
                    currency: 'CAD',
                    booking_id: quote.id,
                    payment_method: 'stripe',
                    tier: selectedTier,
                  });
                }
                
                const { error } = await stripe.redirectToCheckout({ sessionId });
                if (error) {
                    throw new Error(error.message);
                }
            }
            return;
        }

        // Interac payment
        let screenshotUrl = '';
        if (finalPaymentMethod === 'interac' && finalScreenshotFile) {
            const formData = new FormData();
            formData.append('file', finalScreenshotFile);
            formData.append('userId', 'web');
            formData.append('isFinalPayment', 'true');

            const uploadRes = await fetch(`/api/bookings/${quote.id}/upload-screenshot`, {
                method: 'POST',
                body: formData,
            });

            if (!uploadRes.ok) {
                const data = await uploadRes.json().catch(() => ({ error: 'Failed to upload screenshot' }));
                throw new Error(data.error || 'Failed to upload screenshot');
            }

            const { url } = await uploadRes.json();
            screenshotUrl = url;
        }

        // Track final Interac payment submission
        trackEvent('InitiateCheckout', {
          content_name: 'Final Payment - Interac',
          content_category: 'Payment',
          value: finalAmount,
          currency: 'CAD',
          booking_id: quote.id,
          payment_method: 'interac',
          payment_type: 'final',
          tier: paymentSelectedQuote,
        });

        const updatedPaymentDetails: PaymentDetails = {
            ...quote.paymentDetails!,
            finalPayment: {
                method: finalPaymentMethod,
                status: 'deposit-pending',
                amount: finalAmount,
                screenshotUrl: screenshotUrl,
            },
        };

        const updatedQuote: FinalQuote = {
            ...quote,
            paymentDetails: updatedPaymentDetails,
        };

        const updateRes = await fetch(`/api/bookings/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ finalQuote: updatedQuote }),
        });

        if (!updateRes.ok) {
            const data = await updateRes.json().catch(() => ({ error: 'Failed to save booking' }));
            throw new Error(data.error || 'Failed to save booking');
        }

        // Notify admin about final payment screenshot
        await sendAdminScreenshotNotificationAction(quote.id);

        setQuote(updatedQuote);
        setShowFinalPayment(false);
        setFinalScreenshotFile(null);
        
        toast({
            title: 'Final Payment Submitted!',
            description: 'We have received your final payment screenshot for approval. You will receive confirmation within 24 hours.',
        });

    } catch (err: any) {
        setError(err.message || 'Failed to process final payment');
        toast({
            variant: 'destructive',
            title: 'Error',
            description: err.message || 'Failed to process final payment. Please try again.',
        });
    } finally {
        setIsSaving(false);
    }
  };

  const handleFinalizeBooking = async () => {
    if (!selectedTier || !paymentMethod) {
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select an artist tier and payment method.' });
        return;
    }
    if (paymentMethod === 'interac' && !screenshotFile) {
        toast({ variant: 'destructive', title: 'Screenshot Required', description: 'Please upload a payment screenshot for Interac transfers.' });
        return;
    }

    setIsSaving(true);
    setError(null);

    try {
        if (paymentMethod === 'stripe') {
            // Save selectedQuote before redirecting to Stripe checkout
            // This ensures the quote is saved even if user doesn't complete payment
            if (!quote.selectedQuote || quote.selectedQuote !== selectedTier) {
                const quoteUpdate: FinalQuote = {
                    ...quote,
                    selectedQuote: selectedTier,
                    // Ensure contract date is saved if not already saved
                    contractSignedDate: quote.contractSignedDate || new Date().toISOString(),
                };

                const saveRes = await fetch(`/api/bookings/${quote.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ finalQuote: quoteUpdate }),
                });

                if (saveRes.ok) {
                    setQuote(quoteUpdate);
                }
                // Continue even if save fails - tier is in Stripe metadata as fallback
            }

            const res = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: quote.id, tier: selectedTier }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                try {
                    const { error } = JSON.parse(errorText);
                    throw new Error(error || 'Failed to create Stripe session.');
                } catch (e) {
                     console.error("Stripe API route failed:", errorText);
                    throw new Error('Failed to create Stripe session. The server returned an invalid error format.');
                }
            }

            const { sessionId } = await res.json();
            if (!stripePromise) {
                throw new Error('Stripe publishable key is not configured.');
            }
            const stripe = await stripePromise;
            if (stripe) {
                const { error } = await stripe.redirectToCheckout({ sessionId });
                if (error) {
                    throw new Error(error.message);
                }
            }
            return;
        }

        let screenshotUrl = '';
        if (paymentMethod === 'interac' && screenshotFile) {
            const formData = new FormData();
            formData.append('file', screenshotFile);
            formData.append('userId', 'web');

            const uploadRes = await fetch(`/api/bookings/${quote.id}/upload-screenshot`, {
                method: 'POST',
                body: formData,
            });

            if (!uploadRes.ok) {
                const data = await uploadRes.json().catch(() => ({ error: 'Failed to upload screenshot' }));
                throw new Error(data.error || 'Failed to upload screenshot');
            }

            const { url } = await uploadRes.json();
            screenshotUrl = url;
        }

        // Track Interac payment submission
        trackEvent('InitiateCheckout', {
          content_name: 'Advance Payment - Interac',
          content_category: 'Payment',
          value: depositAmount,
          currency: 'CAD',
          booking_id: quote.id,
          payment_method: 'interac',
          tier: selectedTier,
        });

        const paymentDetails: PaymentDetails = {
            method: paymentMethod,
            status: 'deposit-pending',
            depositAmount: depositAmount,
            screenshotUrl: screenshotUrl,
        };

        const updatedQuote: FinalQuote = {
            ...quote,
            selectedQuote: selectedTier,
            paymentDetails: paymentDetails,
            // Ensure contract date is saved if not already saved
            contractSignedDate: quote.contractSignedDate || new Date().toISOString(),
        };

        const updateRes = await fetch(`/api/bookings/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ finalQuote: updatedQuote }),
        });

        if (!updateRes.ok) {
            const data = await updateRes.json().catch(() => ({ error: 'Failed to save booking' }));
            throw new Error(data.error || 'Failed to save booking');
        }

        await sendAdminScreenshotNotificationAction(updatedQuote.id);

        setQuote(updatedQuote);
        
        // Show different message for Interac vs Stripe
        if (paymentMethod === 'interac') {
            toast({
                title: 'Screenshot Uploaded!',
                description: 'We have received your screenshot for payment approval. Once it is reviewed and approved, you will receive a confirmation email within the next 24 hours.',
            });
        } else {
            toast({
                title: 'Booking Submitted!',
                description: 'Your booking is pending approval. You will receive a final confirmation email once your payment is verified.',
            });
        }
        setCurrentStep('confirmed');

    } catch (err: any) {
        console.error("Failed to finalize booking:", err);
        setError(err.message || 'Failed to finalize booking. Please check your connection or permissions.');
        toast({ variant: 'destructive', title: 'Finalization Failed', description: err.message });
    } finally {
        setIsSaving(false);
    }
};

  const handleProceed = async () => {
    if (currentStep === 'select-tier') {
      if (requiresAddress) {
        setCurrentStep('address');
      } else {
        setCurrentStep('sign-contract');
      }
    } else if (currentStep === 'address') {
        handleSaveAddress();
    } else if (currentStep === 'sign-contract') {
        // Save contract signed date when proceeding to payment
        if (contractSigned && !quote.contractSignedDate) {
          try {
            const updatedQuote: FinalQuote = {
              ...quote,
              contractSignedDate: new Date().toISOString(),
            };

            const res = await fetch(`/api/bookings/${quote.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ finalQuote: updatedQuote }),
            });

            if (res.ok) {
              setQuote(updatedQuote);
            }
          } catch (err) {
            console.error('Failed to save contract date:', err);
            // Continue anyway - don't block user from proceeding
          }
        }
        setCurrentStep('payment');
    }
  };

  const handleBack = () => {
    if (currentStep === 'payment') {
      setCurrentStep('sign-contract');
    } else if (currentStep === 'sign-contract') {
      if (requiresAddress) {
        setCurrentStep('address');
      } else {
        setCurrentStep('select-tier');
      }
    } else if (currentStep === 'address') {
      setCurrentStep('select-tier');
    }
  };

  // Calculate current step index with safety check for 'confirmed' step
  const currentStepIndex = currentStep === 'confirmed' 
    ? STEPS.length // Treat confirmed as completed (100%)
    : STEPS.findIndex(s => s.id === currentStep);
  
  // Calculate progress percentage with safety check
  const progressPercentage = STEPS.length > 0 
    ? ((currentStepIndex + 1) / STEPS.length) * 100 
    : 0;
  
  // Calculate estimated time remaining
  const remainingSteps = currentStepIndex >= STEPS.length ? [] : STEPS.slice(currentStepIndex);
  const estimatedTimeRemaining = remainingSteps.reduce((total, step) => total + (step.estimatedTime || 0), 0);
  
  // Calculate total estimated time
  const totalEstimatedTime = STEPS.reduce((total, step) => total + (step.estimatedTime || 0), 0);
  
  // Track step direction for animations
  const [stepDirection, setStepDirection] = useState<'left' | 'right'>('right');
  const prevStepRef = useRef(currentStep);
  React.useEffect(() => {
    const prevIndex = STEPS.findIndex(s => s.id === prevStepRef.current);
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > prevIndex) {
      setStepDirection('right');
    } else if (currentIndex < prevIndex) {
      setStepDirection('left');
    }
    prevStepRef.current = currentStep;
  }, [currentStep, STEPS]);

  const getFooterButtons = () => {
      if (currentStep === 'confirmed') return null;

      // Don't allow going back if payment has been made (submitted or approved)
      const hasPaymentSubmitted = quote.paymentDetails && 
        (quote.paymentDetails.status === 'deposit-paid' || 
         quote.paymentDetails.status === 'payment-approved' ||
         quote.paymentDetails.status === 'deposit-pending');
      
      const canGoBack = currentStepIndex > 0 && !bookingConfirmed && !hasPaymentSubmitted;
      
      let text = 'Proceed';
      let action: () => void = handleProceed;
      let disabled = false;
      let icon = <ArrowRight className="ml-2 h-5 w-5" />;

      switch(currentStep) {
          case 'select-tier':
              text = 'Proceed';
              disabled = !selectedTier;
              break;
          case 'address':
              text = isUploadingImages ? 'Uploading Images...' : 'Save Address & Proceed';
              action = handleSaveAddress;
              disabled = isSaving || isUploadingImages;
              break;
          case 'sign-contract':
              text = 'Proceed to Payment';
              disabled = !contractSigned || !hasSignature;
              break;
          case 'payment':
              text = paymentMethod === 'stripe' ? `Pay $${formatPrice(depositAmount)} with Card` : 'Submit for Approval';
              action = handleFinalizeBooking;
              disabled = isSaving || !paymentMethod || (paymentMethod === 'interac' && !screenshotFile);
              icon = paymentMethod === 'stripe' ? <CreditCard className="ml-2 h-5 w-5" /> : <ShieldCheck className="ml-2 h-5 w-5" />;
              break;
      }
      
      return (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full">
              {canGoBack && (
                  <Button 
                      type="button" 
                      variant="outline" 
                      size="lg" 
                      className="w-full sm:flex-1 font-bold text-base sm:text-lg h-11 sm:h-12 transition-smooth hover:scale-[1.02] active:scale-[0.98]" 
                      disabled={isSaving || isUploadingImages} 
                      onClick={handleBack}
                  >
                      <ArrowLeft className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      Back
                  </Button>
              )}
              <Button 
                  type="button" 
                  size="lg" 
                  className={cn(
                    "w-full font-bold text-base sm:text-lg h-11 sm:h-12",
                    canGoBack && "sm:flex-1",
                    "transition-smooth hover:scale-[1.02] active:scale-[0.98]"
                  )} 
                  disabled={disabled || isSaving || isUploadingImages} 
                  onClick={action}
              >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : null}
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">{text}</span>
                  {!isSaving && <span className="ml-2">{icon}</span>}
              </Button>
          </div>
      );
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-6 md:py-8 lg:py-12 min-h-screen flex flex-col px-3 sm:px-4">
      <Card className="flex-1 shadow-2xl border border-white/40 bg-white/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
        <CardHeader className="text-center items-center p-4 sm:p-6 md:p-8 bg-white/60 backdrop-blur-sm rounded-t-2xl border-b border-white/40">
          {(() => {
            // Final payment paid - fully paid
            if (quote.paymentDetails?.finalPayment?.status === 'payment-approved' || quote.paymentDetails?.finalPayment?.status === 'deposit-paid') {
              return <ShieldCheck className="h-16 w-16 text-green-500 animate-in fade-in zoom-in-50 duration-700 delay-200" />;
            }
            // Advance payment approved/paid
            if (quote.paymentDetails?.status === 'payment-approved' || quote.paymentDetails?.status === 'deposit-paid') {
              return <ShieldCheck className="h-16 w-16 text-green-500 animate-in fade-in zoom-in-50 duration-700 delay-200" />;
            }
            // Booking confirmed
            if (bookingConfirmed) {
              return <ShieldCheck className="h-16 w-16 text-green-500 animate-in fade-in zoom-in-50 duration-700 delay-200" />;
            }
            // Default icon
            return <CheckCircle2 className="h-16 w-16 text-black animate-in fade-in zoom-in-50 duration-700 delay-200" />;
          })()}
          <CardTitle className="font-headline text-3xl sm:text-4xl mt-4">
            {(() => {
              // On select-tier step, always show quote ready message
              if (currentStep === 'select-tier') {
                return 'Your Quote is Ready!';
              }
              
              // Final payment screenshot rejected
              if (quote.paymentDetails?.finalPayment?.status === 'screenshot-rejected') {
                return 'Final Payment Screenshot Rejected';
              }
              // Final payment pending approval
              if (quote.paymentDetails?.finalPayment?.status === 'deposit-pending') {
                return 'Final Payment Pending Approval';
              }
              // Final payment paid
              if (quote.paymentDetails?.finalPayment?.status === 'payment-approved' || quote.paymentDetails?.finalPayment?.status === 'deposit-paid') {
                return 'Payment Complete – Booking Confirmed';
              }
              // Advance payment screenshot rejected
              if (quote.paymentDetails?.status === 'screenshot-rejected') {
                return 'Screenshot Rejected';
              }
              // Advance payment pending approval (Interac) - only show if not on select-tier step
              if (quote.paymentDetails?.status === 'deposit-pending' && quote.paymentDetails?.method === 'interac' && (currentStep as ConfirmationStep) !== 'select-tier') {
                return 'Awaiting Payment Approval';
              }
              // Advance payment approved/paid, final payment not started
              if ((quote.paymentDetails?.status === 'payment-approved' || quote.paymentDetails?.status === 'deposit-paid') && !quote.paymentDetails?.finalPayment) {
                return 'Payment Approved – Booking Confirmed';
              }
              // Advance payment approved/paid, final payment required
              if (quote.paymentDetails?.status === 'payment-approved' || quote.paymentDetails?.status === 'deposit-paid') {
                return 'Payment Approved – Booking Confirmed';
              }
              // Booking confirmed but no payment details yet
              if (bookingConfirmed) {
                return 'Booking Confirmed!';
              }
              // Initial quote
              return 'Your Quote is Ready!';
            })()}
          </CardTitle>
          <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Booking ID: <span className="font-mono">{quote.id}</span>
            </p>
            {currentStep === 'select-tier' && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const quoteUrl = `${window.location.origin}/book/${quote.id}`;
                  
                  try {
                    await navigator.clipboard.writeText(quoteUrl);
                    toast({
                      title: 'Link copied!',
                      description: 'Booking page link copied to clipboard.',
                    });
                    trackEvent('ShareQuote', {
                      booking_id: quote.id,
                      method: 'clipboard',
                    });
                  } catch (err) {
                    toast({
                      title: 'Share your quote',
                      description: `Copy this link: ${quoteUrl}`,
                    });
                  }
                }}
                className="h-7 text-xs"
              >
                <Share2 className="h-3 w-3 mr-1.5" />
                Share Quote
              </Button>
            )}
          </div>
          <CardDescription className="text-base sm:text-lg max-w-prose">
            {(() => {
              // On select-tier step, always show quote selection message
              if (currentStep === 'select-tier') {
                return `Thank you, ${quote.contact.name}. Please review your quotes and select a package below to proceed with your booking.`;
              }
              
              // Final payment screenshot rejected
              if (quote.paymentDetails?.finalPayment?.status === 'screenshot-rejected') {
                return `Thank you, ${quote.contact.name}. Your final payment screenshot could not be verified. Please upload the correct screenshot to complete your booking.`;
              }
              // Final payment pending approval
              if (quote.paymentDetails?.finalPayment?.status === 'deposit-pending') {
                if (quote.paymentDetails?.finalPayment?.method === 'interac') {
                  return `Thank you, ${quote.contact.name}. We have received your final payment screenshot for approval. Once it is reviewed and approved, you will receive confirmation within 24 hours.`;
                }
                return `Thank you, ${quote.contact.name}. Your final payment is being processed. You will receive confirmation shortly.`;
              }
              // Final payment paid - fully paid
              if (quote.paymentDetails?.finalPayment?.status === 'payment-approved' || quote.paymentDetails?.finalPayment?.status === 'deposit-paid') {
                return `Thank you, ${quote.contact.name}. Your booking is fully paid and confirmed! We look forward to serving you on your special day.`;
              }
              // Advance payment screenshot rejected
              if (quote.paymentDetails?.status === 'screenshot-rejected') {
                return `Thank you, ${quote.contact.name}. Your payment screenshot could not be verified. Please upload the correct screenshot to proceed with your booking.`;
              }
              // Advance payment pending approval (Interac) - only show if not on select-tier step
              if (quote.paymentDetails?.status === 'deposit-pending' && quote.paymentDetails?.method === 'interac' && (currentStep as ConfirmationStep) !== 'select-tier') {
                return `Thank you, ${quote.contact.name}. We have received your screenshot for payment approval. Once it is reviewed and approved, you will receive a confirmation email within the next 24 hours.`;
              }
              // Advance payment approved/paid, final payment required
              if (quote.paymentDetails?.status === 'payment-approved' || quote.paymentDetails?.status === 'deposit-paid') {
                return `Thank you, ${quote.contact.name}. Your advance payment has been approved and your booking is confirmed! The remaining 50% balance is due on or before the day of your service.`;
              }
              // Booking confirmed but no payment details yet
              if (bookingConfirmed) {
                return `Thank you, ${quote.contact.name}. Your booking with ${quote.selectedQuote === 'lead' ? 'Anum - Lead Artist' : 'the Team'} is confirmed. A confirmation email will be sent to you shortly.`;
              }
              // Initial quote
              return `Thank you, ${quote.contact.name}. Please review your quotes and follow the steps below to confirm your booking.`;
            })()}
          </CardDescription>
            {error && (
              <Alert variant="destructive" className="mt-4 text-left">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>An Error Occurred</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
              </Alert>
          )}
          
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6">

          {(!bookingConfirmed || quote.paymentDetails?.status === 'screenshot-rejected') && (
            <div className="space-y-4 my-4 sm:my-6 rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md shadow-sm p-3 sm:p-4">
              {/* Enhanced Progress Bar with Percentage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                      Booking Progress
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {estimatedTimeRemaining <= 60 
                        ? `~${estimatedTimeRemaining}s remaining`
                        : `~${Math.round(estimatedTimeRemaining / 60)}min remaining`}
                    </span>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-bold text-foreground">
                        {Math.round(progressPercentage)}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                </div>
                <Progress value={progressPercentage} className="h-3" />
                <div className="flex items-center justify-between text-xs">
                  <p className="text-muted-foreground">
                    {progressPercentage < 25 
                      ? "You're just getting started! 🚀"
                      : progressPercentage < 50
                      ? "You're making great progress! ✨"
                      : progressPercentage < 75
                      ? "You're more than halfway there! 💪"
                      : "Almost done! Just a few more steps! 🎉"}
                  </p>
                  <p className="text-muted-foreground font-medium">
                    Total: ~{totalEstimatedTime <= 60 
                      ? `${totalEstimatedTime}s`
                      : `${Math.round(totalEstimatedTime / 60)}min`}
                  </p>
                </div>
              </div>
              
              {/* Step Indicator */}
              <div className="flex justify-center items-center gap-1 sm:gap-2 md:gap-6">
                {STEPS.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                        index < currentStepIndex ? "bg-black text-white" :
                        index === currentStepIndex ? "bg-black border-2 border-white ring-2 ring-black text-white" :
                        "bg-muted text-muted-foreground"
                      )}>
                        <step.icon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className={cn(
                          "text-xs sm:text-sm font-medium",
                          index <= currentStepIndex ? "text-black" : "text-muted-foreground"
                        )}>{step.name}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          ~{step.estimatedTime}s
                        </span>
                      </div>
                    </div>
                    {index < STEPS.length - 1 && <div className="flex-1 h-px bg-border max-w-8 sm:max-w-16" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Subtle urgency banner - Only show on select-tier step */}
          {currentStep === 'select-tier' && !bookingConfirmed && (
            <div className="mt-3 sm:mt-4 mb-3 sm:mb-4">
              <div className="mx-auto max-w-3xl rounded-full bg-black/80 text-white px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-center gap-2 sm:gap-3 shadow-md backdrop-blur-md border border-white/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p
                  key={currentUrgencyMessage}
                  className="text-[11px] sm:text-xs md:text-sm font-semibold tracking-[0.18em] uppercase whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  {urgencyMessages[currentUrgencyMessage]}
                </p>
              </div>
            </div>
          )}

          {/* Return to Home Button - Show when Interac screenshot is submitted and pending approval */}
          {(() => {
            const isAdvancePaymentPending = quote.paymentDetails?.status === 'deposit-pending' && 
              quote.paymentDetails?.method === 'interac' && 
              (currentStep as ConfirmationStep) !== 'select-tier';
            const isFinalPaymentPending = quote.paymentDetails?.finalPayment?.status === 'deposit-pending' && 
              quote.paymentDetails?.finalPayment?.method === 'interac';
            
            if (isAdvancePaymentPending || isFinalPaymentPending) {
              return (
                <div className="flex justify-center mt-4 sm:mt-6 mb-4 sm:mb-6">
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto min-w-[200px] font-semibold h-11 sm:h-12 text-base sm:text-lg"
                  >
                    <Link href="/">
                      <Home className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      Return to Home
                    </Link>
                  </Button>
                </div>
              );
            }
            return null;
          })()}

          <div className={cn(currentStep !== 'select-tier' && 'hidden')}>
              <RadioGroup 
                  value={selectedTier} 
                  onValueChange={(val) => {
                    const tier = val as PriceTier;
                    setSelectedTier(tier);
                    // Track tier selection
                    const selectedQuote = quote.quotes[tier];
                    trackEvent('SelectQuoteTier', {
                      content_name: `Quote Tier: ${tier === 'lead' ? 'Lead Artist' : 'Team'}`,
                      content_category: 'Quote',
                      value: selectedQuote?.total || 0,
                      currency: 'CAD',
                      booking_id: quote.id,
                      tier: tier,
                    });
                  }} 
                  className={cn(
                    "grid grid-cols-1 gap-4 sm:gap-6 p-3 sm:p-4 rounded-2xl border border-white/50 bg-white/75 backdrop-blur-md shadow-sm",
                    showLeadArtistOption && showTeamOption ? "sm:grid-cols-2" : "max-w-md mx-auto"
                  )}
              >
                  {showLeadArtistOption && (
                      <QuoteTierCard 
                      title="Anum - Lead Artist"
                      icon={<User className="w-8 h-8 text-black" />}
                      quote={quote.quotes.lead}
                      tier="lead"
                      selectedTier={selectedTier}
                      onSelect={setSelectedTier}
                      />
                  )}
                  {showTeamOption && (
                      <QuoteTierCard 
                      title="Team"
                      icon={<Users className="w-8 h-8 text-black" />}
                      quote={quote.quotes.team}
                      tier="team"
                      selectedTier={selectedTier}
                      onSelect={setSelectedTier}
                      />
                  )}
              </RadioGroup>
              
              {/* Book a Call Section - Enhanced Prominence (mobile-optimized) */}
              <div
                id="book-call"
                className="mt-4 sm:mt-6 md:mt-10 px-3 py-4 sm:px-6 sm:py-6 rounded-xl border border-white/60 bg-gradient-to-br from-white/90 via-white/80 to-primary/5 shadow-md sm:shadow-lg hover:shadow-xl backdrop-blur-md transition-shadow duration-300 relative overflow-hidden max-w-2xl mx-auto"
              >
                {/* Decorative accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full -ml-12 -mb-12 blur-2xl"></div>
                
                <div className="text-center space-y-3 sm:space-y-4 relative z-10">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                    <div className="p-2.5 sm:p-3 bg-primary/10 rounded-full flex items-center justify-center">
                      <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <h3 className="font-headline text-lg sm:text-2xl md:text-3xl font-bold text-foreground">
                      Have Questions About Your Quote?
                    </h3>
                  </div>
                  
                  {/* Professional features */}
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      <span>Direct answers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      <span>Quick response</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      <span>Expert guidance</span>
                    </div>
                  </div>
                  
                  <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
                    Book a call with Anum to discuss your quote and have any questions answered directly. We're here to help you make the perfect choice.
                  </p>
                  
                  <Dialog open={isBookCallDialogOpen} onOpenChange={setIsBookCallDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        size="lg" 
                        className="font-semibold text-sm sm:text-lg h-11 sm:h-14 px-6 sm:px-10 bg-black hover:bg-black/90 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                      >
                        <Phone className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                        Book a Call with Anum
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle className="text-lg sm:text-xl">Book a Call with Anum</DialogTitle>
                        <DialogDescription className="text-sm sm:text-base">
                          Fill in your preferred date and time, and we'll contact you to discuss your quote.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                        <div className="space-y-2">
                          <Label>Your Contact Information</Label>
                          <div className="p-3 bg-muted rounded-md text-sm">
                            <p><strong>Name:</strong> {quote.contact.name}</p>
                            <p><strong>Email:</strong> {quote.contact.email}</p>
                            {quote.contact.phone && (
                              <p><strong>Phone:</strong> {quote.contact.phone}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="whatsapp">WhatsApp Number *</Label>
                          {quote.contact.phone && (
                            <div className="flex items-center space-x-2 mb-2">
                              <Checkbox
                                id="use-contact-phone"
                                checked={useContactPhone}
                                onCheckedChange={(checked) => {
                                  setUseContactPhone(checked as boolean);
                                  if (checked) {
                                    // Use contact phone number for WhatsApp (will be formatted to +1 on submit)
                                    setWhatsappNumber(quote.contact.phone || '');
                                  } else {
                                    // Clear the field when unchecked
                                    setWhatsappNumber('');
                                  }
                                }}
                              />
                              <Label
                                htmlFor="use-contact-phone"
                                className="text-sm font-normal cursor-pointer"
                              >
                                Same as your contact number
                              </Label>
                            </div>
                          )}
                          <Input
                            id="whatsapp"
                            type="tel"
                            placeholder="+1 416 555 1234"
                            value={whatsappNumber}
                            onChange={(e) => {
                                if (!useContactPhone) {
                                  // Allow only digits, spaces, +, -, and parentheses
                                  const value = e.target.value.replace(/[^\d+\-() ]/g, '');
                                  setWhatsappNumber(value);
                                }
                            }}
                            disabled={useContactPhone}
                            required
                          />
                          {useContactPhone && (
                            <p className="text-xs text-muted-foreground">
                              Using your contact phone number for WhatsApp
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Preferred Date *</Label>
                          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal h-9 sm:h-10",
                                  !callBookingDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {callBookingDate ? formatToronto(callBookingDate, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" side="bottom">
                              <Calendar
                                mode="single"
                                selected={callBookingDate}
                                onSelect={(date) => {
                                  setCallBookingDate(date);
                                  if (date) {
                                    setIsDatePickerOpen(false);
                                  }
                                }}
                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="call-time">Preferred Time (9 AM - 9 PM) *</Label>
                          <Select value={callBookingTime} onValueChange={setCallBookingTime}>
                            <SelectTrigger id="call-time" className="h-9 sm:h-10">
                              <SelectValue placeholder="Select a time" />
                            </SelectTrigger>
                            <SelectContent>
                              {callTimeSlots.map((slot) => (
                                <SelectItem key={slot} value={slot}>
                                  {formatToronto(new Date(`1970-01-01T${slot}`), 'p')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="call-message">Tell us about your event or any questions *</Label>
                          <Textarea
                            id="call-message"
                            placeholder="Share details about your event, special requirements, or any questions you have about the booking..."
                            value={callBookingMessage}
                            onChange={(e) => setCallBookingMessage(e.target.value)}
                            rows={4}
                            required
                            className="resize-none text-sm sm:text-base"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsBookCallDialogOpen(false)}
                          disabled={isSubmittingCallBooking}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleBookCall}
                          disabled={isSubmittingCallBooking || !callBookingDate || !callBookingTime || (!useContactPhone && !whatsappNumber.trim()) || (useContactPhone && !quote.contact.phone) || !callBookingMessage.trim()}
                        >
                          {isSubmittingCallBooking ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Phone className="mr-2 h-4 w-4" />
                              Submit Request
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
          </div>
          
          <div className={cn(currentStep !== 'address' && 'hidden')}>
            <div className="space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6">
              <div className="p-3 sm:p-4 rounded-2xl border border-white/40 bg-white/75 backdrop-blur-md shadow-sm">
                <h3 className="font-headline text-lg sm:text-xl mb-3 sm:mb-4">Mobile Service Address</h3>
                <div className='space-y-3 sm:space-y-4'>
                          {addressErrors && Object.keys(addressErrors).length > 0 && (
                              <Alert variant="destructive">
                                  <AlertDescription>Please correct the address errors.</AlertDescription>
                              </Alert>
                          )}
                          <div>
                              <Label htmlFor="street">Street Address</Label>
                              <Input id="street" name="street" placeholder="123 Glamour Ave" required value={address.street} onChange={e => setAddress({...address, street: e.target.value})} />
                              {addressErrors?.street && <p className="text-sm text-destructive mt-1">{addressErrors.street}</p>}
                          </div>
                          <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4'>
                              <div>
                                  <Label htmlFor="city">City</Label>
                                  <Input id="city" name="city" placeholder="Toronto" required value={address.city} onChange={e => setAddress({...address, city: e.target.value})} />
                                  {addressErrors?.city && <p className="text-sm text-destructive mt-1">{addressErrors.city}</p>}
                              </div>
                              <div>
                                  <Label htmlFor="province">Province</Label>
                                  <Input id="province" name="province" value="ON" readOnly required />
                              </div>
                              <div>
                                  <Label htmlFor="postalCode">Postal Code</Label>
                                  <Input id="postalCode" name="postalCode" placeholder="M5V 2T6" required value={address.postalCode} onChange={e => setAddress({...address, postalCode: e.target.value})} />
                                  {addressErrors?.postalCode && <p className="text-sm text-destructive mt-1">{addressErrors.postalCode}</p>}
                              </div>
                          </div>
                      </div>
              </div>

              {/* Inspirations Section */}
              <div className="p-3 sm:p-4 rounded-2xl border border-white/40 bg-white/75 backdrop-blur-md shadow-sm mt-4 sm:mt-6">
                <h3 className="font-headline text-lg sm:text-xl mb-3 sm:mb-4">Inspirations (Optional)</h3>
                <p className="text-sm text-muted-foreground mb-3 sm:mb-4">
                  Share images or links to show us what kind of makeup look you're interested in
                </p>
                
                {/* Image Upload Section */}
                <div className="space-y-3 mb-6">
                  <Label className="text-sm font-medium">Upload Images</Label>
                  <div className="flex flex-wrap gap-3">
                    {inspirationImageUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={url} 
                          alt={`Inspiration ${index + 1}`}
                          className="w-24 h-24 object-cover rounded-md border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            const newUrls = inspirationImageUrls.filter((_, i) => i !== index);
                            const newFiles = inspirationImages.filter((_, i) => i !== index);
                            setInspirationImageUrls(newUrls);
                            setInspirationImages(newFiles);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-black transition-colors">
                      <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground text-center px-1">Add Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          files.forEach(file => {
                            if (file.size > 5 * 1024 * 1024) {
                              toast({
                                variant: 'destructive',
                                title: 'File too large',
                                description: `${file.name} is larger than 5MB. Please choose a smaller file.`,
                              });
                              return;
                            }
                            if (!file.type.startsWith('image/')) {
                              toast({
                                variant: 'destructive',
                                title: 'Invalid file type',
                                description: `${file.name} is not an image file.`,
                              });
                              return;
                            }
                            setInspirationImages([...inspirationImages, file]);
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              setInspirationImageUrls([...inspirationImageUrls, e.target?.result as string]);
                            };
                            reader.readAsDataURL(file);
                          });
                          e.target.value = '';
                        }}
                        multiple
                      />
                    </label>
                  </div>
                  {inspirationImages.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {inspirationImages.length} image(s) selected. Images will be uploaded when you save.
                    </p>
                  )}
                </div>

                {/* Links Section */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Instagram / TikTok Links</Label>
                  {inspirationLinks.map((link, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="https://www.instagram.com/p/... or https://www.tiktok.com/@..."
                        value={link}
                        onChange={(e) => {
                          const newLinks = [...inspirationLinks];
                          newLinks[index] = e.target.value;
                          setInspirationLinks(newLinks);
                        }}
                        className="flex-1"
                      />
                      {inspirationLinks.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setInspirationLinks(inspirationLinks.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setInspirationLinks([...inspirationLinks, ''])}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Link
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className={cn('space-y-6 px-6', currentStep !== 'sign-contract' && 'hidden')}>
            <h3 className="font-headline text-2xl text-center">Service Agreement</h3>
            {selectedTier && <ContractDisplay quote={quote} selectedTier={selectedTier} signedDate={quote.contractSignedDate || new Date().toISOString()} />}
            {/* Digital Signature Section */}
            <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 bg-muted rounded-md">
              <Label className="text-xs sm:text-sm font-medium">Digital Signature *</Label>
              <div className="border-2 border-dashed border-border rounded-md bg-background p-1.5 sm:p-2">
                <canvas
                  ref={signatureCanvasRef}
                  width={300}
                  height={80}
                  className="w-full max-w-full h-auto cursor-crosshair touch-none border rounded"
                  onMouseDown={(e) => {
                    if (!signatureCanvasRef.current) return;
                    const canvas = signatureCanvasRef.current;
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    
                    ctx.beginPath();
                    ctx.moveTo(
                      (e.clientX - rect.left) * scaleX,
                      (e.clientY - rect.top) * scaleY
                    );
                    setIsDrawing(true);
                  }}
                  onMouseMove={(e) => {
                    if (!isDrawing || !signatureCanvasRef.current) return;
                    const canvas = signatureCanvasRef.current;
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    
                    ctx.lineTo(
                      (e.clientX - rect.left) * scaleX,
                      (e.clientY - rect.top) * scaleY
                    );
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1.5;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke();
                  }}
                  onMouseUp={() => {
                    setIsDrawing(false);
                    if (signatureCanvasRef.current) {
                      const dataURL = signatureCanvasRef.current.toDataURL();
                      setSignature(dataURL);
                      setHasSignature(true);
                      setContractSigned(true);
                      // Track contract signing
                      trackEvent('SignContract', {
                        content_name: 'Contract Signed',
                        content_category: 'Contract',
                        booking_id: quote.id,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    setIsDrawing(false);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    if (!signatureCanvasRef.current) return;
                    const canvas = signatureCanvasRef.current;
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    
                    const touch = e.touches[0];
                    ctx.beginPath();
                    ctx.moveTo(
                      (touch.clientX - rect.left) * scaleX,
                      (touch.clientY - rect.top) * scaleY
                    );
                    setIsDrawing(true);
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    if (!isDrawing || !signatureCanvasRef.current) return;
                    const canvas = signatureCanvasRef.current;
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    
                    const touch = e.touches[0];
                    ctx.lineTo(
                      (touch.clientX - rect.left) * scaleX,
                      (touch.clientY - rect.top) * scaleY
                    );
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1.5;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    setIsDrawing(false);
                    if (signatureCanvasRef.current) {
                      const dataURL = signatureCanvasRef.current.toDataURL();
                      setSignature(dataURL);
                      setHasSignature(true);
                      setContractSigned(true);
                      // Track contract signing
                      trackEvent('SignContract', {
                        content_name: 'Contract Signed',
                        content_category: 'Contract',
                        booking_id: quote.id,
                      });
                    }
                  }}
                />
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                <p className="text-xs text-muted-foreground">
                  Please sign above using your mouse or touch screen
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    if (signatureCanvasRef.current) {
                      const ctx = signatureCanvasRef.current.getContext('2d');
                      if (ctx) {
                        ctx.clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
                        setSignature(null);
                        setHasSignature(false);
                        setContractSigned(false);
                      }
                    }
                  }}
                  disabled={!hasSignature}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-4 bg-muted rounded-md">
              <Checkbox id="terms" checked={contractSigned} onCheckedChange={(checked) => {
                const isChecked = Boolean(checked);
                setContractSigned(isChecked);
                if (!isChecked) {
                  // Clear signature if checkbox is unchecked
                  if (signatureCanvasRef.current) {
                    const ctx = signatureCanvasRef.current.getContext('2d');
                    if (ctx) {
                      ctx.clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
                      setSignature(null);
                      setHasSignature(false);
                    }
                  }
                }
              }} />
              <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                I have read, understood, and agreed to the terms and conditions of this service agreement.
              </Label>
            </div>
          </div>
          
           <div className={cn('space-y-6 px-6', currentStep !== 'payment' && 'hidden')}>
              <div className="text-center">
                  <h3 className="font-headline text-2xl">Secure Your Booking</h3>
                  <p className="text-muted-foreground">A 50% non-refundable deposit is required to finalize your booking.</p>
                  <p className="text-4xl font-bold text-black mt-2">${formatPrice(depositAmount)}</p>
              </div>

              <RadioGroup value={paymentMethod} onValueChange={(val) => setPaymentMethod(val as PaymentMethod)} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Label htmlFor='payment-stripe' className={cn('block border rounded-lg p-6 cursor-pointer', paymentMethod === 'stripe' ? 'border-black ring-2 ring-black' : 'hover:border-gray-400')}>
                      <div className='flex items-center gap-4'>
                           <RadioGroupItem value="stripe" id="payment-stripe" />
                           <h4 className="font-headline text-xl">Pay with Card</h4>
                           <CreditCard className='ml-auto w-8 h-8 text-muted-foreground'/>
                      </div>
                      <p className="text-sm text-muted-foreground mt-4">Securely pay the deposit with your credit card via Stripe.</p>
                  </Label>
                  <Label htmlFor='payment-interac' className={cn('block border rounded-lg p-6 cursor-pointer', paymentMethod === 'interac' ? 'border-black ring-2 ring-black' : 'hover:border-gray-400')}>
                       <div className='flex items-center gap-4'>
                          <RadioGroupItem value="interac" id="payment-interac" />
                          <h4 className="font-headline text-xl">Interac e-Transfer</h4>
                          <Banknote className='ml-auto w-8 h-8 text-muted-foreground'/>
                      </div>
                      <p className="text-sm text-muted-foreground mt-4">Send an e-Transfer and upload a screenshot for verification.</p>
                  </Label>
              </RadioGroup>

              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground text-center">
                  <strong>Note:</strong> Promotional codes and coupons can be applied when using card payment (Stripe). 
                  The discount will be applied during the checkout process.
                </p>
              </div>

              {paymentMethod === 'interac' && (
                  <div className="p-4 rounded-2xl border border-white/40 bg-white/75 backdrop-blur-md shadow-sm space-y-4 animate-in fade-in-0">
                      {quote.paymentDetails?.status === 'screenshot-rejected' && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Screenshot Rejected</AlertTitle>
                          <AlertDescription>
                            Your previous screenshot could not be verified. Please upload a clear, correct screenshot of your Interac e-Transfer confirmation.
                          </AlertDescription>
                        </Alert>
                      )}
                      <h4 className="font-semibold">e-Transfer Instructions</h4>
                      <ol className="list-decimal list-inside text-sm space-y-2 text-muted-foreground">
                          <li>Send <strong>${formatPrice(depositAmount)}</strong> to <strong>info@looksbyanum.com</strong></li>
                          <li>Write your booking ID (<strong>{quote.id}</strong>) in the message for your booking reference</li>
                          <li>Once sent, take a clear screenshot of the confirmation page showing all transaction details.</li>
                          <li>Upload the screenshot below and submit.</li>
                      </ol>
                      <div>
                          <Label htmlFor="screenshot">Upload Screenshot</Label>
                          <Input id="screenshot" type="file" accept="image/png, image/jpeg, image/jpg" onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              if (file) {
                                  // Validate file size (max 5MB)
                                  const maxSize = 5 * 1024 * 1024; // 5MB
                                  if (file.size > maxSize) {
                                      toast({
                                          variant: 'destructive',
                                          title: 'File Too Large',
                                          description: 'Please upload an image smaller than 5MB.',
                                      });
                                      e.target.value = '';
                                      return;
                                  }
                                  // Validate file type
                                  if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
                                      toast({
                                          variant: 'destructive',
                                          title: 'Invalid File Type',
                                          description: 'Please upload a PNG, JPEG, or JPG image.',
                                      });
                                      e.target.value = '';
                                      return;
                                  }
                              }
                              setScreenshotFile(file);
                          }} />
                          {screenshotFile && (
                              <p className='text-sm text-muted-foreground mt-2'>
                                  File selected: {screenshotFile.name} ({(screenshotFile.size / 1024 / 1024).toFixed(2)} MB)
                              </p>
                          )}
                      </div>
                  </div>
              )}
          </div>

          {/* Final Payment Section */}
          {(() => {
            // Check if advance payment is made
            const hasAdvancePayment = quote.paymentDetails && 
              (quote.paymentDetails.status === 'payment-approved' || 
               quote.paymentDetails.status === 'deposit-paid');
            
            // Determine selected quote - use quote.selectedQuote, selectedTier, or default to 'lead' if booking is confirmed
            let finalPaymentSelectedQuote = quote.selectedQuote || selectedTier;
            
            // If still no selected quote but booking is confirmed with advance payment, try to infer from available quotes
            if (!finalPaymentSelectedQuote && hasAdvancePayment && bookingConfirmed) {
              if (quote.quotes && quote.quotes.lead) {
                finalPaymentSelectedQuote = 'lead';
              } else if (quote.quotes && quote.quotes.team) {
                finalPaymentSelectedQuote = 'team';
              }
            }
            
            // Show final payment form when showFinalPayment is true, advance payment is made, and we have a valid quote
            if (showFinalPayment && hasAdvancePayment && finalPaymentSelectedQuote && quote.quotes && quote.quotes[finalPaymentSelectedQuote]) {
              const finalPaymentAmount = (quote.quotes[finalPaymentSelectedQuote].total * 0.5);
              
              return (
                <div className="p-6">
                  <div className="p-6 rounded-2xl border border-white/40 bg-white/80 backdrop-blur-md shadow-sm max-w-md mx-auto">
                    <h3 className="font-headline text-2xl text-center mb-4">Pay Remaining Balance</h3>
                    <div className="text-center mb-6">
                      <p className="text-muted-foreground">Pay the remaining 50% to complete your booking.</p>
                      <p className="text-4xl font-bold text-black mt-2">${formatPrice(finalPaymentAmount)}</p>
                    </div>

                <RadioGroup value={finalPaymentMethod} onValueChange={(val) => setFinalPaymentMethod(val as PaymentMethod)} className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <Label htmlFor='final-payment-stripe' className={cn('block border rounded-lg p-6 cursor-pointer', finalPaymentMethod === 'stripe' ? 'border-black ring-2 ring-black' : 'hover:border-gray-400')}>
                    <div className='flex items-center gap-4'>
                      <RadioGroupItem value="stripe" id="final-payment-stripe" />
                      <h4 className="font-headline text-xl">Pay with Card</h4>
                      <CreditCard className='ml-auto w-8 h-8 text-muted-foreground'/>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">Securely pay the remaining balance with your credit card via Stripe.</p>
                  </Label>
                  <Label htmlFor='final-payment-interac' className={cn('block border rounded-lg p-6 cursor-pointer', finalPaymentMethod === 'interac' ? 'border-black ring-2 ring-black' : 'hover:border-gray-400')}>
                    <div className='flex items-center gap-4'>
                      <RadioGroupItem value="interac" id="final-payment-interac" />
                      <h4 className="font-headline text-xl">Interac e-Transfer</h4>
                      <Banknote className='ml-auto w-8 h-8 text-muted-foreground'/>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">Send an e-Transfer and upload a screenshot for verification.</p>
                  </Label>
                </RadioGroup>

                <div className="p-4 border rounded-lg bg-muted/30 mb-6">
                  <p className="text-sm text-muted-foreground text-center">
                    <strong>Note:</strong> Promotional codes and coupons can be applied when using card payment (Stripe). 
                    The discount will be applied during the checkout process.
                  </p>
                </div>

                {finalPaymentMethod === 'interac' && (
                  <div className="p-4 rounded-2xl border border-white/40 bg-white/75 backdrop-blur-md shadow-sm space-y-4 mb-6">
                    {quote.paymentDetails?.finalPayment?.status === 'screenshot-rejected' && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Screenshot Rejected</AlertTitle>
                        <AlertDescription>
                          Your previous screenshot could not be verified. Please upload a clear, correct screenshot of your Interac e-Transfer confirmation.
                        </AlertDescription>
                      </Alert>
                    )}
                    <h4 className="font-semibold">e-Transfer Instructions</h4>
                    <ol className="list-decimal list-inside text-sm space-y-2 text-muted-foreground">
                      <li>Send <strong>${formatPrice(finalPaymentAmount)}</strong> to <strong>info@looksbyanum.com</strong></li>
                      <li>Write your booking ID (<strong>{quote.id}</strong>) in the message for your booking reference</li>
                      <li>Once sent, take a clear screenshot of the confirmation page showing all transaction details.</li>
                      <li>Upload the screenshot below and submit.</li>
                    </ol>
                    <div>
                      <Label htmlFor="final-screenshot">Upload Screenshot</Label>
                      <Input id="final-screenshot" type="file" accept="image/png, image/jpeg, image/jpg" onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                              // Validate file size (max 5MB)
                              const maxSize = 5 * 1024 * 1024; // 5MB
                              if (file.size > maxSize) {
                                  toast({
                                      variant: 'destructive',
                                      title: 'File Too Large',
                                      description: 'Please upload an image smaller than 5MB.',
                                  });
                                  e.target.value = '';
                                  return;
                              }
                              // Validate file type
                              if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
                                  toast({
                                      variant: 'destructive',
                                      title: 'Invalid File Type',
                                      description: 'Please upload a PNG, JPEG, or JPG image.',
                                  });
                                  e.target.value = '';
                                  return;
                              }
                          }
                          setFinalScreenshotFile(file);
                      }} />
                      {finalScreenshotFile && (
                          <p className='text-sm text-muted-foreground mt-2'>
                              File selected: {finalScreenshotFile.name} ({(finalScreenshotFile.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowFinalPayment(false);
                      setFinalPaymentMethod(undefined);
                      setFinalScreenshotFile(null);
                    }}
                    className="flex-1"
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleFinalPayment}
                    className="flex-1"
                    disabled={isSaving || !finalPaymentMethod || (finalPaymentMethod === 'interac' && !finalScreenshotFile)}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Banknote className="mr-2 h-4 w-4" />
                        Submit Payment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
              );
            }
            return null;
          })()}

          {/* Payment Summary Section - Show when advance payment is made (any payment method) */}
          {(() => {
            // Check if advance payment is made (regardless of method)
            const hasAdvancePayment = quote.paymentDetails && 
              (quote.paymentDetails.status === 'payment-approved' || 
               quote.paymentDetails.status === 'deposit-paid');
            
            // Determine selected quote - use quote.selectedQuote, selectedTier, or default to 'lead' if booking is confirmed
            let selectedQuote = quote.selectedQuote || selectedTier;
            
            // If still no selected quote but booking is confirmed with advance payment, try to infer from available quotes
            if (!selectedQuote && hasAdvancePayment && bookingConfirmed) {
              // Default to 'lead' if available, otherwise use 'team'
              if (quote.quotes && quote.quotes.lead) {
                selectedQuote = 'lead';
              } else if (quote.quotes && quote.quotes.team) {
                selectedQuote = 'team';
              }
            }
            
            // Show payment summary when advance payment is made and we have a valid quote
            // Always show if advance payment is made, even if we need to infer the quote
            if (hasAdvancePayment && selectedQuote && quote.quotes && quote.quotes[selectedQuote]) {
              const selectedQuoteData = quote.quotes[selectedQuote];
              const advanceAmount = quote.paymentDetails?.depositAmount || (selectedQuoteData.total * 0.5);
              const remainingAmount = selectedQuoteData.total * 0.5;
              
              // Check if final payment is pending (not paid yet)
              const finalPaymentPending = !quote.paymentDetails?.finalPayment || 
                (quote.paymentDetails.finalPayment.status !== 'payment-approved' && 
                 quote.paymentDetails.finalPayment.status !== 'deposit-paid');
              
              // Determine booking status message
              const getBookingStatusMessage = () => {
                // Final payment paid - fully paid
                if (quote.paymentDetails?.finalPayment?.status === 'payment-approved' || 
                    quote.paymentDetails?.finalPayment?.status === 'deposit-paid') {
                  return {
                    text: 'Fully Paid - Booking Confirmed',
                    variant: 'default' as const,
                    className: 'bg-green-500 hover:bg-green-600 text-white'
                  };
                }
                // Final payment pending
                if (quote.paymentDetails?.finalPayment?.status === 'deposit-pending') {
                  return {
                    text: 'Final Payment Pending Approval',
                    variant: 'secondary' as const,
                    className: 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  };
                }
                // Final payment rejected
                if (quote.paymentDetails?.finalPayment?.status === 'screenshot-rejected') {
                  return {
                    text: 'Final Payment Screenshot Rejected',
                    variant: 'destructive' as const,
                    className: 'bg-red-500 hover:bg-red-600 text-white'
                  };
                }
                // Advance payment approved, final payment not started
                return {
                  text: 'Advance Payment Approved - Booking Confirmed',
                  variant: 'default' as const,
                  className: 'bg-green-500 hover:bg-green-600 text-white'
                };
              };
              
              const statusInfo = getBookingStatusMessage();
              
              return (
                <div className="mt-6 p-6 border rounded-lg bg-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-headline text-xl font-bold">Payment Summary</h3>
                    <Badge variant={statusInfo.variant} className={statusInfo.className}>
                      {statusInfo.text}
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    {/* Total Amount */}
                    <div className="flex justify-between items-center py-2 border-b pb-3">
                      <div className="flex flex-col">
                        <span className="text-base font-medium">Total Amount:</span>
                        <span className="text-xs text-muted-foreground mt-0.5">include 13% GST</span>
                      </div>
                      <span className="font-bold text-lg">${formatPrice(selectedQuoteData.total)}</span>
                    </div>
                    
                    {/* Advance Payment Section */}
                    <div className="space-y-3 pt-2">
                      <h5 className="font-semibold text-base">Advance Payment (50%)</h5>
                      <div className="space-y-2 pl-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Amount:</span>
                          <span className="font-semibold text-green-600">${formatPrice(advanceAmount)}</span>
                        </div>
                        {quote.paymentDetails?.method && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Payment Method:</span>
                            <Badge 
                              variant={quote.paymentDetails.method === 'stripe' ? 'default' : 'outline'} 
                              className={quote.paymentDetails.method === 'stripe' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'capitalize'}
                            >
                              {quote.paymentDetails.method === 'stripe' ? 'Stripe (Card Payment)' : 'Interac e-Transfer'}
                            </Badge>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-sm font-medium">Status:</span>
                          <Badge 
                            variant="default"
                            className="bg-green-500 hover:bg-green-600 text-white"
                          >
                            {quote.paymentDetails?.status === 'deposit-paid' ? 'Paid' : 
                             quote.paymentDetails?.status === 'payment-approved' ? 'Payment Approved' :
                             'Approved'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Final Payment Section */}
                    {quote.paymentDetails?.finalPayment ? (
                      <div className="space-y-3 pt-3 border-t">
                        <h5 className="font-semibold text-base">Final Payment (50%)</h5>
                        <div className="space-y-2 pl-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Amount:</span>
                            <span className={`font-semibold ${(quote.paymentDetails.finalPayment.status === 'payment-approved' || quote.paymentDetails.finalPayment.status === 'deposit-paid') ? 'text-green-600' : ''}`}>
                              ${quote.paymentDetails.finalPayment.amount ? formatPrice(quote.paymentDetails.finalPayment.amount) : formatPrice(remainingAmount)}
                            </span>
                          </div>
                          {quote.paymentDetails.finalPayment.method && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Payment Method:</span>
                              <Badge 
                                variant={quote.paymentDetails.finalPayment.method === 'stripe' ? 'default' : 'outline'} 
                                className={quote.paymentDetails.finalPayment.method === 'stripe' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'capitalize'}
                              >
                                {quote.paymentDetails.finalPayment.method === 'stripe' ? 'Stripe (Card Payment)' : 'Interac e-Transfer'}
                              </Badge>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-sm font-medium">Status:</span>
                            <Badge 
                              variant={quote.paymentDetails.finalPayment.status === 'payment-approved' || quote.paymentDetails.finalPayment.status === 'deposit-paid' ? 'default' : 'destructive'}
                              className={quote.paymentDetails.finalPayment.status === 'payment-approved' || quote.paymentDetails.finalPayment.status === 'deposit-paid' 
                                ? 'bg-green-500 hover:bg-green-600 text-white' 
                                : quote.paymentDetails.finalPayment.status === 'screenshot-rejected'
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-yellow-500 hover:bg-yellow-600 text-white'}
                            >
                              {quote.paymentDetails.finalPayment.status === 'payment-approved' || quote.paymentDetails.finalPayment.status === 'deposit-paid' 
                                ? 'Paid' 
                                : quote.paymentDetails.finalPayment.status === 'screenshot-rejected'
                                ? 'Screenshot Rejected'
                                : 'Pending Approval'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-3 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">50% Remaining Balance:</span>
                          <span className="font-semibold">${formatPrice(remainingAmount)}</span>
                        </div>
                        {!showFinalPayment && finalPaymentPending && (
                          <div className="pt-3">
                            <Button
                              onClick={() => setShowFinalPayment(true)}
                              size="lg"
                              className="w-full"
                            >
                              <Banknote className="mr-2 h-5 w-5" />
                              Pay Remaining Balance (${formatPrice(remainingAmount)})
                            </Button>
                            <p className="text-xs text-muted-foreground text-center mt-2">
                              The remaining 50% balance is due on or before the day of your service.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })()}

        </CardContent>

        {(!bookingConfirmed || quote.paymentDetails?.status === 'screenshot-rejected') && (
          <CardFooter className="bg-secondary/50 p-3 sm:p-4 md:p-6 rounded-b-lg">
              {getFooterButtons()}
          </CardFooter>
        )}
      </Card>
      
      {/* Winter Offer Popup */}
      {showWinterOfferPopup && !bookingConfirmed && (
        <Dialog open={showWinterOfferPopup} onOpenChange={setShowWinterOfferPopup}>
          <DialogContent className="sm:max-w-md w-[92vw] rounded-3xl border border-white/40 bg-gradient-to-b from-white/95 via-white/85 to-white/75 shadow-2xl p-5 sm:p-7 space-y-5">
            <DialogHeader className="space-y-3 text-left sm:text-center">
              <DialogTitle className="text-xl sm:text-2xl font-headline tracking-tight leading-snug">
                Hi {quote.contact.name.split(' ')[0] || 'there'}, your winter offer has arrived! ❄️
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Book any appointment in <span className="font-semibold">December</span> and enjoy an exclusive{' '}
                <span className="font-semibold">10% off</span>—even if your event is scheduled for{' '}
                <span className="font-semibold">2026</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-black text-white border border-white/15 shadow-sm">
                <p className="text-center text-sm sm:text-base space-y-1">
                  <span className="block text-[10px] sm:text-xs font-medium tracking-[0.25em] uppercase text-white/70 mb-1">
                    Limited-Time Winter Offer
                  </span>
                  <span className="block text-3xl sm:text-4xl font-bold tracking-tight">
                    10% OFF
                  </span>
                  <span className="block text-[11px] sm:text-sm text-white/80">
                    Use code <span className="font-mono font-semibold tracking-[0.25em]">WINTER10</span> at checkout or when confirming your booking to claim this offer.
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => {
                    setShowWinterOfferPopup(false);
                    trackEvent('WinterOfferCTA', {
                      booking_id: quote.id,
                      action: 'continue_booking',
                    });
                  }}
                  className="w-full h-11 sm:h-12 font-semibold text-sm sm:text-base bg-black text-white hover:bg-black/90 rounded-full shadow-md hover:shadow-lg transition-all"
                  size="lg"
                >
                  Continue Booking & Save 10%
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowWinterOfferPopup(false);
                    trackEvent('WinterOfferCTA', {
                      booking_id: quote.id,
                      action: 'maybe_later',
                    });
                  }}
                  className="w-full h-11 sm:h-12 rounded-full text-sm sm:text-base border-muted-foreground/20 hover:bg-muted/60"
                >
                  Maybe Later
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
