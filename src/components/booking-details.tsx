
'use client';

import type { FinalQuote, PriceTier, PaymentDetails } from '@/lib/types';
import { STUDIO_ADDRESS } from '@/lib/services';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Users, MapPin, CalendarClock, Link as LinkIcon, MessageSquare, Loader2, Mail, Trash2, CheckCircle2, XCircle, Send, Calendar, Download, FileText } from 'lucide-react';
import { differenceInDaysToronto, parseToronto, formatToronto, formatDistanceToNowToronto, isPastToronto, isFutureToronto, getTorontoToday, getTorontoNow } from '@/lib/toronto-time';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { BookingDocument } from '@/firebase/firestore/bookings';
import { sendConfirmationEmailAction, approvePaymentAction, rejectScreenshotAction, approveFinalPaymentAction, rejectFinalPaymentAction } from '@/app/admin/actions';
import { trackPaymentComplete } from '@/lib/facebook-pixel';
import { Label } from '@/components/ui/label';
import { ContractDisplay } from '@/components/contract-display';
import { generateContractPDFFromElement, generateContractPDFFromData } from '@/lib/pdf-generator';
import { formatPrice } from '@/lib/price-format';
import { SectionCard } from '@/components/admin/section-card';
import { InvoiceGenerator } from '@/components/admin/invoice-generator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

function getTimeToEvent(eventDateStr: string): { text: string; isPast: boolean } {
    try {
        if (!eventDateStr) {
            return { text: "Invalid date", isPast: false };
        }
        const eventDate = parseToronto(eventDateStr, 'PPP');
        const today = getTorontoToday();
        const days = differenceInDaysToronto(eventDate, today);

        if (days < 0) {
            return { text: `${Math.abs(days)} days ago`, isPast: true };
        }
        if (days === 0) {
            return { text: "Today", isPast: false };
        }
        if (days === 1) {
            return { text: "Tomorrow", isPast: false };
        }
        return { text: `in ${days} days`, isPast: false };
    } catch (error) {
        console.error('Error parsing event date:', eventDateStr, error);
        return { text: "Invalid date", isPast: false };
    }
}

function generateWhatsAppLink(phone: string | undefined): string | null {
    if (!phone) return null;
    // Remove all non-digit characters and add Canadian country code if missing
    let cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length === 10) { // Assumes Canadian/US number without country code
        cleanedPhone = `1${cleanedPhone}`;
    }
    return `https://wa.me/${cleanedPhone}`;
}


interface EmailStatus {
  sent: boolean;
  sentAt: string | null;
  scheduledFor: string | null;
}

interface EmailStatusData {
  'initial': EmailStatus;
  'followup-3h': EmailStatus;
  'followup-6h': EmailStatus;
  'followup-24h': EmailStatus;
  'followup-3d': EmailStatus;
  'followup-6d': EmailStatus;
  'followup-30d': EmailStatus;
  'event-reminder-24h': EmailStatus;
  'appointment-day-reminder': EmailStatus;
  'post-appointment-followup': EmailStatus;
}

export function BookingDetails({ quote, onUpdate, bookingDoc, onBookingDeleted }: { quote: FinalQuote; onUpdate: (updatedQuote: FinalQuote) => void; bookingDoc: BookingDocument | undefined; onBookingDeleted: (bookingId: string) => void; }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingConfirmation, setIsSendingConfirmation] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isApprovingFinal, setIsApprovingFinal] = useState(false);
  const [isRejectingFinal, setIsRejectingFinal] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatusData | null>(null);
  const [isLoadingEmailStatus, setIsLoadingEmailStatus] = useState(true);
  const [artists, setArtists] = useState<Array<{ id: string; name: string; email: string; whatsapp: string }>>([]);
  const [isSendingToArtist, setIsSendingToArtist] = useState<string | null>(null);
  const [showSendToArtistDialog, setShowSendToArtistDialog] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { toast } = useToast();

  // Determine selected quote data - use quote.selectedQuote or infer from payment details
  const getSelectedQuoteData = () => {
    // First, try to use explicit selectedQuote
    if (quote.selectedQuote && quote.quotes && quote.quotes[quote.selectedQuote]) {
      return { data: quote.quotes[quote.selectedQuote], tier: quote.selectedQuote };
    }
    // If no selectedQuote but paymentDetails exists, try to infer from available quotes
    if (quote.paymentDetails && quote.quotes) {
      // Check if we can infer from depositAmount - compare with quote totals
      if (quote.paymentDetails.depositAmount) {
        const leadTotal = quote.quotes.lead?.total || 0;
        const teamTotal = quote.quotes.team?.total || 0;
        const expectedLeadDeposit = leadTotal * 0.5;
        const expectedTeamDeposit = teamTotal * 0.5;
        
        // Check which deposit amount matches (with small tolerance for rounding)
        if (Math.abs(quote.paymentDetails.depositAmount - expectedLeadDeposit) < 0.01 && quote.quotes.lead) {
          return { data: quote.quotes.lead, tier: 'lead' };
        }
        if (Math.abs(quote.paymentDetails.depositAmount - expectedTeamDeposit) < 0.01 && quote.quotes.team) {
          return { data: quote.quotes.team, tier: 'team' };
        }
      }
      // Fallback: Default to 'lead' if available
      if (quote.quotes.lead) {
        return { data: quote.quotes.lead, tier: 'lead' };
      } else if (quote.quotes.team) {
        return { data: quote.quotes.team, tier: 'team' };
      }
    }
    return null;
  };
  const selectedQuoteResult = getSelectedQuoteData();
  const selectedQuoteData = selectedQuoteResult?.data || null;
  const inferredSelectedQuote = quote.selectedQuote || selectedQuoteResult?.tier || null;
  
  const eventTimeInfo = quote.booking.days && quote.booking.days.length > 0 && quote.booking.days[0]?.date 
    ? getTimeToEvent(quote.booking.days[0].date) 
    : { text: 'Invalid date', isPast: false };
  const whatsappLink = generateWhatsAppLink(quote.contact.phone);
  const hasMobileService = quote.booking.days && quote.booking.days.length > 0 
    ? quote.booking.days.some(d => d.serviceType === 'mobile') 
    : false;
  const [currentTime, setCurrentTime] = useState(getTorontoNow());

  // Update current time every 10 seconds for real-time countdown
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(getTorontoNow());
    }, 10000); // Update every 10 seconds for real-time countdown
    return () => clearInterval(timeInterval);
  }, []);

  // Fetch artists on component mount
  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const res = await fetch('/api/artists', { cache: 'no-store' });
        if (res.ok) {
          const { artists: fetchedArtists } = await res.json();
          setArtists(fetchedArtists || []);
        }
      } catch (error) {
        console.error('Failed to fetch artists:', error);
      }
    };
    fetchArtists();
  }, []);

  // Helper function to check if any emails are scheduled
  const hasAnyScheduledEmails = () => {
    if (!emailStatus) return false;
    return !!(
      emailStatus['followup-3h']?.scheduledFor ||
      emailStatus['followup-6h']?.scheduledFor ||
      emailStatus['followup-24h']?.scheduledFor ||
      emailStatus['followup-3d']?.scheduledFor ||
      emailStatus['followup-6d']?.scheduledFor ||
      emailStatus['followup-30d']?.scheduledFor ||
      emailStatus['event-reminder-24h']?.scheduledFor ||
      emailStatus['appointment-day-reminder']?.scheduledFor ||
      emailStatus['post-appointment-followup']?.scheduledFor
    );
  };

  // Helper function to get next email to be sent
  const getNextEmail = () => {
    if (!emailStatus) return null;
    
    const hasAdvancePayment = quote.paymentDetails && 
      (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
    const isConfirmed = quote.status === 'confirmed';
    
    const emails = [
      { type: 'followup-3h', scheduledFor: emailStatus['followup-3h']?.scheduledFor, sent: emailStatus['followup-3h']?.sent },
      { type: 'followup-6h', scheduledFor: emailStatus['followup-6h']?.scheduledFor, sent: emailStatus['followup-6h']?.sent },
      { type: 'followup-24h', scheduledFor: emailStatus['followup-24h']?.scheduledFor, sent: emailStatus['followup-24h']?.sent },
      { type: 'followup-3d', scheduledFor: emailStatus['followup-3d']?.scheduledFor, sent: emailStatus['followup-3d']?.sent },
      { type: 'followup-6d', scheduledFor: emailStatus['followup-6d']?.scheduledFor, sent: emailStatus['followup-6d']?.sent },
      { type: 'followup-30d', scheduledFor: emailStatus['followup-30d']?.scheduledFor, sent: emailStatus['followup-30d']?.sent },
      // Event reminder only shows if booking is confirmed and payment is made
      ...(isConfirmed && hasAdvancePayment && emailStatus['event-reminder-24h'] ? [{ type: 'event-reminder-24h', scheduledFor: emailStatus['event-reminder-24h'].scheduledFor, sent: emailStatus['event-reminder-24h'].sent }] : []),
      // Appointment day reminder only shows if booking is confirmed and payment is made
      ...(isConfirmed && hasAdvancePayment && emailStatus['appointment-day-reminder'] ? [{ type: 'appointment-day-reminder', scheduledFor: emailStatus['appointment-day-reminder'].scheduledFor, sent: emailStatus['appointment-day-reminder'].sent }] : []),
      // Post-appointment followup only shows if booking is confirmed and payment is made
      ...(isConfirmed && hasAdvancePayment && emailStatus['post-appointment-followup'] ? [{ type: 'post-appointment-followup', scheduledFor: emailStatus['post-appointment-followup'].scheduledFor, sent: emailStatus['post-appointment-followup'].sent }] : []),
    ].filter(e => e.scheduledFor && !e.sent && isFutureToronto(new Date(e.scheduledFor)));
    
    if (emails.length === 0) return null;
    
    // Sort by scheduled time and return the earliest
    emails.sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime());
    return emails[0];
  };

  const nextEmail = getNextEmail();

  // Fetch email status
  useEffect(() => {
    const fetchEmailStatus = async () => {
      try {
        setIsLoadingEmailStatus(true);
        const res = await fetch(`/api/bookings/${quote.id}/email-status`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.emailStatus) {
            setEmailStatus(data.emailStatus);
          } else {
            console.error('No emailStatus in response:', data);
            setEmailStatus(null);
          }
        } else {
          // Try to get error message, but don't fail completely
          try {
            const errorData = await res.json().catch(() => ({}));
            console.warn('Error fetching email status (non-fatal):', errorData);
            // Set default status instead of null to show something
            setEmailStatus({
              'initial': { sent: true, sentAt: null, scheduledFor: null },
              'followup-3h': { sent: false, sentAt: null, scheduledFor: null },
              'followup-6h': { sent: false, sentAt: null, scheduledFor: null },
              'followup-24h': { sent: false, sentAt: null, scheduledFor: null },
              'followup-3d': { sent: false, sentAt: null, scheduledFor: null },
              'followup-6d': { sent: false, sentAt: null, scheduledFor: null },
              'followup-30d': { sent: false, sentAt: null, scheduledFor: null },
              'event-reminder-24h': { sent: false, sentAt: null, scheduledFor: null },
              'appointment-day-reminder': { sent: false, sentAt: null, scheduledFor: null },
              'post-appointment-followup': { sent: false, sentAt: null, scheduledFor: null },
            });
          } catch (e) {
            // If we can't parse error, still set default status
            setEmailStatus({
              'initial': { sent: true, sentAt: null, scheduledFor: null },
              'followup-3h': { sent: false, sentAt: null, scheduledFor: null },
              'followup-6h': { sent: false, sentAt: null, scheduledFor: null },
              'followup-24h': { sent: false, sentAt: null, scheduledFor: null },
              'followup-3d': { sent: false, sentAt: null, scheduledFor: null },
              'followup-6d': { sent: false, sentAt: null, scheduledFor: null },
              'followup-30d': { sent: false, sentAt: null, scheduledFor: null },
              'event-reminder-24h': { sent: false, sentAt: null, scheduledFor: null },
              'appointment-day-reminder': { sent: false, sentAt: null, scheduledFor: null },
              'post-appointment-followup': { sent: false, sentAt: null, scheduledFor: null },
            });
          }
        }
      } catch (error) {
        console.error('Error fetching email status:', error);
        // Set default status on error instead of null
        setEmailStatus({
          'initial': { sent: true, sentAt: null, scheduledFor: null },
          'followup-3h': { sent: false, sentAt: null, scheduledFor: null },
          'followup-6h': { sent: false, sentAt: null, scheduledFor: null },
          'followup-24h': { sent: false, sentAt: null, scheduledFor: null },
          'followup-3d': { sent: false, sentAt: null, scheduledFor: null },
          'followup-6d': { sent: false, sentAt: null, scheduledFor: null },
          'followup-30d': { sent: false, sentAt: null, scheduledFor: null },
          'event-reminder-24h': { sent: false, sentAt: null, scheduledFor: null },
          'appointment-day-reminder': { sent: false, sentAt: null, scheduledFor: null },
          'post-appointment-followup': { sent: false, sentAt: null, scheduledFor: null },
        });
      } finally {
        setIsLoadingEmailStatus(false);
      }
    };
    fetchEmailStatus();
    
    // After email-status is fetched (which triggers WhatsApp reminder scheduling),
    // refresh the booking data to get updated WhatsApp reminder statuses
    // Wait a bit to allow the scheduling to complete
    const refreshTimer = setTimeout(async () => {
      try {
        const bookingRes = await fetch(`/api/bookings/${quote.id}`, { cache: 'no-store' });
        if (bookingRes.ok) {
          const bookingData = await bookingRes.json();
          if (bookingData.booking?.final_quote || bookingData.finalQuote) {
            const updatedQuote = bookingData.booking?.final_quote || bookingData.finalQuote;
            // Only update if WhatsApp messages have changed
            const currentWhatsApp = quote.whatsappMessages;
            const updatedWhatsApp = updatedQuote.whatsappMessages;
            if (JSON.stringify(currentWhatsApp) !== JSON.stringify(updatedWhatsApp)) {
              onUpdate(updatedQuote);
            }
          }
        }
      } catch (refreshError) {
        console.error('Failed to refresh booking after WhatsApp scheduling:', refreshError);
        // Don't fail the whole operation if refresh fails
      }
    }, 1500); // Wait 1.5 seconds for scheduling to complete
    
    // Add automatic polling every 10 minutes to check for status updates
    const pollInterval = setInterval(() => {
      fetchEmailStatus();
    }, 600000); // Poll every 10 minutes (600000 ms)

    // Cleanup intervals on unmount
    return () => {
      clearTimeout(refreshTimer);
      clearInterval(pollInterval);
    };
  }, [quote.id, quote.whatsappMessages, onUpdate]); // Fetch when booking ID changes, WhatsApp messages change, or onUpdate changes

  // Helper function to refresh email status
  const refreshEmailStatus = async () => {
    try {
      const statusRes = await fetch(`/api/bookings/${quote.id}/email-status`, { cache: 'no-store' });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.emailStatus) {
          setEmailStatus(statusData.emailStatus);
        }
      }
    } catch (error) {
      console.error('Error refreshing email status:', error);
    }
  };


  // Handler to download contract PDF
  const handleDownloadContractPDF = async () => {
    if (!quote.selectedQuote || !quote.contractSignedDate) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Contract information is not available. Contract must be signed to download PDF.',
      });
      return;
    }

    setIsGeneratingPDF(true);
    try {
      // Try to generate from element first (better quality)
      const contractElementId = `contract-display-${quote.id}`;
      const contractElement = document.getElementById(contractElementId);
      
      if (contractElement) {
        await generateContractPDFFromElement(contractElementId, `Service-Agreement-${quote.id}.pdf`);
      } else {
        // Fallback to data-based generation
        await generateContractPDFFromData(
          quote,
          quote.selectedQuote,
          quote.contractSignedDate,
          `Service-Agreement-${quote.id}.pdf`
        );
      }
      
      toast({
        title: 'Success',
        description: 'Contract PDF downloaded successfully.',
      });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to generate PDF. Please try again.',
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleStatusChange = async (newStatus: FinalQuote['status']) => {
      if (!bookingDoc) {
          toast({ variant: "destructive", title: "Error", description: "Booking data not available." });
          return;
      }
      setIsUpdating(true);
      
      const updatedQuote = { ...quote, status: newStatus };

      try {
          const response = await fetch(`/api/bookings/${quote.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ finalQuote: updatedQuote }),
          });

          if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to update booking');
          }

          onUpdate(updatedQuote);
          toast({
              title: "Status Updated",
              description: `Booking moved to '${newStatus}'.`,
          });
      } catch (error: any) {
          toast({
              variant: "destructive",
              title: "Update Failed",
              description: error.message || 'An unknown error occurred.',
          });
      } finally {
          setIsUpdating(false);
      }
  };

  const handlePaymentStatusChange = async (newPaymentStatus: PaymentDetails['status']) => {
    if (!bookingDoc || !quote.paymentDetails) {
        toast({ variant: "destructive", title: "Error", description: "Booking or payment data not available." });
        return;
    }
    setIsUpdating(true);

    const updatedQuote: FinalQuote = {
        ...quote,
        paymentDetails: {
            ...quote.paymentDetails,
            status: newPaymentStatus,
        },
    };

    try {
        const response = await fetch(`/api/bookings/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ finalQuote: updatedQuote }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update booking');
        }

        onUpdate(updatedQuote);
        toast({
            title: "Payment Status Updated",
            description: `Payment status set to '${newPaymentStatus}'.`,
        });
        
        // If payment is approved, send confirmation email
        if (newPaymentStatus === 'deposit-paid') {
            await handleSendConfirmation();
        }

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: error.message || 'An unknown error occurred.',
        });
    } finally {
        setIsUpdating(false);
    }
  };

  const handleFinalPaymentStatusChange = async (newPaymentStatus: PaymentDetails['status']) => {
    if (!bookingDoc || !quote.paymentDetails?.finalPayment) {
        toast({ variant: "destructive", title: "Error", description: "Booking or payment data not available." });
        return;
    }
    setIsUpdating(true);

    const updatedQuote: FinalQuote = {
        ...quote,
        paymentDetails: {
            ...quote.paymentDetails,
            finalPayment: {
                ...quote.paymentDetails.finalPayment,
                status: newPaymentStatus,
            },
        },
    };

    try {
        const response = await fetch(`/api/bookings/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ finalQuote: updatedQuote }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update booking');
        }

        onUpdate(updatedQuote);
        toast({
            title: "Final Payment Status Updated",
            description: `Final payment status set to '${newPaymentStatus}'.`,
        });
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: error.message || 'An unknown error occurred.',
        });
    } finally {
        setIsUpdating(false);
    }
  };

  const handleSendConfirmation = async () => {
    setIsSendingConfirmation(true);
    const result = await sendConfirmationEmailAction(quote.id);
    if (result.success) {
        toast({ title: "Confirmation Sent!", description: result.message });
    } else {
        toast({ variant: "destructive", title: "Failed to Send", description: result.message });
    }
    setIsSendingConfirmation(false);
  };

  const handleDelete = async () => {
    if (!bookingDoc) {
        toast({ variant: "destructive", title: "Error", description: "Booking data not available." });
        return;
    }
    setIsUpdating(true);
    try {
        const response = await fetch(`/api/bookings/${bookingDoc.id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete booking');
        }

        toast({
            title: "Booking Deleted",
            description: `Booking ID ${bookingDoc.id} has been permanently removed.`,
        });
        onBookingDeleted(bookingDoc.id);
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: error.message || 'An unknown error occurred.',
        });
    } finally {
        setIsUpdating(false);
    }
  };

  const isActionPending = isUpdating || isSendingConfirmation;


  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8 relative pb-4">
      {isActionPending && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-black" />
            <p className="text-sm text-muted-foreground font-medium">Processing...</p>
          </div>
        </div>
      )}
      
      {/* Top Section: Client Info & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Client Information Card */}
        <SectionCard 
          title="Client Information" 
          className="lg:col-span-2"
        >
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <User className="h-5 w-5 text-black" />
              Client Information
            </CardTitle>
          </CardHeader>
          <div className="pt-4 md:pt-6 space-y-4 md:space-y-6">
            {/* Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</p>
                <p className="text-base font-semibold">{quote.contact.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</p>
                <p className="text-base">{quote.contact.phone || 'N/A'}</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</p>
                <a href={`mailto:${quote.contact.email}`} className='text-base text-black hover:underline font-medium break-all'>
                  {quote.contact.email}
                </a>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
                <a href={`mailto:${quote.contact.email}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </a>
              </Button>
              {whatsappLink && (
                <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
              )}
            </div>

            {/* Quote Generation Date & Time */}
            {(() => {
              // Use quoteGeneratedAt if available, otherwise fall back to booking createdAt
              let quoteDate: Date | null = null;
              
              // First, try to use quoteGeneratedAt from the quote
              if (quote.quoteGeneratedAt) {
                try {
                  quoteDate = new Date(quote.quoteGeneratedAt);
                  if (isNaN(quoteDate.getTime())) {
                    quoteDate = null;
                  }
                } catch (e) {
                  quoteDate = null;
                }
              }
              
              // Fallback to bookingDoc.createdAt if quoteGeneratedAt is not available
              if (!quoteDate && bookingDoc?.createdAt) {
                try {
                  if (bookingDoc.createdAt instanceof Date) {
                    quoteDate = bookingDoc.createdAt;
                  } else if (bookingDoc.createdAt && typeof bookingDoc.createdAt === 'object' && 'toDate' in bookingDoc.createdAt) {
                    quoteDate = (bookingDoc.createdAt as any).toDate();
                  } else if (typeof bookingDoc.createdAt === 'string') {
                    quoteDate = new Date(bookingDoc.createdAt);
                  }
                  
                  if (quoteDate && isNaN(quoteDate.getTime())) {
                    quoteDate = null;
                  }
                } catch (e) {
                  console.error('Error parsing booking createdAt:', e);
                  quoteDate = null;
                }
              }
              
              // If still no date, don't show the section
              if (!quoteDate) {
                return null;
              }
              
              return (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quote Generated</p>
                  </div>
                  <p className="text-sm text-foreground font-medium">
                    {formatToronto(quoteDate, 'PPP p')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Date and time when the client took/generated this quote
                  </p>
                </div>
              );
            })()}

            {/* Consultation Request */}
            {quote.consultationRequest && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Consultation Request</p>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 ml-auto">
                    Submitted
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground min-w-[100px]">WhatsApp:</span>
                    <a 
                      href={`https://wa.me/${quote.consultationRequest.whatsappNumber.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-black hover:underline font-medium"
                    >
                      {quote.consultationRequest.whatsappNumber}
                    </a>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground min-w-[100px]">Preferred Date:</span>
                    <span className="text-black">{quote.consultationRequest.preferredDate}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground min-w-[100px]">Preferred Time:</span>
                    <span className="text-black">{quote.consultationRequest.preferredTime}</span>
                  </div>
                  {quote.consultationRequest.message && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground mb-1">Message:</p>
                      <p className="text-black whitespace-pre-wrap bg-muted/30 p-2 rounded-md text-xs">
                        {quote.consultationRequest.message}
                      </p>
                    </div>
                  )}
                  {quote.consultationRequest.submittedAt && (
                    <div className="flex items-start gap-2 pt-1">
                      <span className="text-muted-foreground min-w-[100px] text-xs">Submitted:</span>
                      <span className="text-muted-foreground text-xs">
                        {formatToronto(new Date(quote.consultationRequest.submittedAt), 'PPP p')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Service Address */}
            {quote.booking.address && (() => {
              const fullAddress = `${quote.booking.address.street}, ${quote.booking.address.city}, ${quote.booking.address.province} ${quote.booking.address.postalCode}`;
              const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
              return (
                <div className="pt-4 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Service Address</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <a 
                        href={googleMapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="font-medium hover:underline text-black flex items-center gap-1"
                      >
                        {quote.booking.address.street}
                        <MapPin className="h-3 w-3" />
                      </a>
                      <a 
                        href={googleMapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-muted-foreground hover:underline text-black block"
                      >
                        {quote.booking.address.city}, {quote.booking.address.province} {quote.booking.address.postalCode}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Client Inspirations */}
            {(() => {
              const hasImages = quote.booking.inspirations?.images && quote.booking.inspirations.images.length > 0;
              const hasLinks = quote.booking.inspirations?.links && quote.booking.inspirations.links.length > 0;
              const hasData = hasImages || hasLinks;
              
              if (!hasData) {
                return (
                  <div className="pt-3 border-t">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Inspirations</p>
                    <p className="text-xs text-muted-foreground mt-1">No inspirations provided</p>
                  </div>
                );
              }
              
              return (
                <div className="pt-4 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Client Inspirations</p>
                  {hasImages && (
                    <div className="mb-3">
                      <p className="text-xs font-medium mb-2 text-muted-foreground">Images</p>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {quote.booking.inspirations?.images?.map((imageUrl, index) => (
                          <a
                            key={index}
                            href={imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group"
                          >
                            <div className="relative aspect-square rounded-lg border-2 border-border overflow-hidden hover:border-black transition-colors">
                              <img
                                src={imageUrl}
                                alt={`Inspiration ${index + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasLinks && (
                    <div>
                      <p className="text-xs font-medium mb-2 text-muted-foreground">Links</p>
                      <div className="space-y-1.5">
                        {quote.booking.inspirations?.links?.map((link, index) => (
                          <a
                            key={index}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-black hover:underline p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                          >
                            <LinkIcon className="h-3 w-3 flex-shrink-0" />
                            <span className="break-all">{link}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* Makeup Images Section */}
            {(() => {
              const hasMakeupImages = quote.booking.makeupImages && quote.booking.makeupImages.length > 0;
              
              if (!hasMakeupImages) {
                return null;
              }
              
              return (
                <div className="pt-4 border-t mt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Makeup Photos (Client Uploaded)</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {quote.booking.makeupImages?.map((imageUrl, index) => (
                      <a
                        key={index}
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                      >
                        <div className="relative aspect-square rounded-lg border-2 border-border overflow-hidden hover:border-black transition-colors">
                          <img
                            src={imageUrl}
                            alt={`Makeup photo ${index + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </SectionCard>

        {/* Right Sidebar: Status & Quick Info */}
        <div className="space-y-6">
          {/* Booking Status Card */}
          <Card className="shadow-lg">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg font-headline">Booking Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
                <Select value={quote.status} onValueChange={(newStatus: FinalQuote['status']) => handleStatusChange(newStatus)} disabled={isActionPending}>
                  <SelectTrigger className="w-full capitalize">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quoted" className="capitalize">Quoted</SelectItem>
                    <SelectItem value="confirmed" className="capitalize">Confirmed</SelectItem>
                    <SelectItem value="cancelled" className="capitalize">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {quote.selectedQuote && (
                <div className="pt-2 border-t">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Selected Package</Label>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    {quote.selectedQuote === 'lead' ? <User className="h-5 w-5 text-black" /> : <Users className="h-5 w-5 text-black" />}
                    <p className="font-semibold text-sm">
                      {quote.selectedQuote === 'lead' ? 'Anum - Lead Artist' : 'Team'}
                    </p>
                  </div>
                </div>
              )}

              {quote.contractSignedDate && quote.selectedQuote && (
                <div className="pt-4 border-t">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Contract</Label>
                  <Button
                    onClick={handleDownloadContractPDF}
                    disabled={isGeneratingPDF}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {isGeneratingPDF ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Download Contract PDF
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Signed on {formatToronto(new Date(quote.contractSignedDate), 'PPP')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order & Payment Summary - Always show when paymentDetails exists */}
          {quote.paymentDetails && (
            <Card className="shadow-lg border-gray-300 bg-gradient-to-br from-gray-50 to-transparent w-full">
              <CardHeader className="pb-4 border-b">
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-black" />
                  Order & Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                {/* Selected Package */}
                {selectedQuoteData && (
                  <div className="space-y-6">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Selected Package</h4>
                    <div className="flex items-center justify-center gap-3 p-4 bg-background rounded-lg border-2 border-gray-300">
                      {inferredSelectedQuote === 'lead' ? <User className="h-5 w-5 text-black flex-shrink-0" /> : <Users className="h-5 w-5 text-black flex-shrink-0" />}
                      <p className="font-semibold text-base">
                        {inferredSelectedQuote === 'lead' ? 'Anum - Lead Artist' : 'Team'}
                      </p>
                    </div>
                    <div className="space-y-4 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-2 w-2 rounded-full bg-black flex-shrink-0"></div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Total Amount</p>
                          <p className="text-2xl font-bold">${formatPrice(selectedQuoteData.total)}</p>
                          <p className="text-xs text-muted-foreground mt-1">includes 13% GST</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0"></div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Advance (50%)</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            ${formatPrice((quote.paymentDetails.depositAmount && quote.paymentDetails.depositAmount > 0) 
                              ? quote.paymentDetails.depositAmount 
                              : selectedQuoteData.total * 0.5)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-2 w-2 rounded-full bg-black flex-shrink-0"></div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Remaining (50%)</p>
                          <p className="text-2xl font-bold">${formatPrice(selectedQuoteData.total * 0.5)}</p>
                        </div>
                      </div>
                    </div>
                    <Separator className="my-6" />
                  </div>
                )}

                {/* Payment Details */}
                <div className="space-y-6">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Details</h4>
                  
                  {/* Advance Payment */}
                  <div className="space-y-5 p-6 border-2 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b">
                      <span className="font-semibold text-lg">Advance Payment (50%)</span>
                      <Badge 
                        variant={
                          quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved' 
                            ? 'default' 
                            : quote.paymentDetails.status === 'screenshot-rejected'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className={
                          quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved'
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : quote.paymentDetails.status === 'screenshot-rejected'
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                        }
                      >
                        {quote.paymentDetails.status === 'deposit-paid' ? 'Paid' : 
                         quote.paymentDetails.status === 'payment-approved' ? 'Approved' :
                         quote.paymentDetails.status === 'screenshot-rejected' ? 'Rejected' :
                         'Pending'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment Mode</p>
                          <p className="text-base font-semibold capitalize">{quote.paymentDetails.method === 'stripe' ? 'Stripe (Card Payment)' : 'Interac e-Transfer'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Amount</p>
                          <p className="text-lg font-bold">
                            ${formatPrice((quote.paymentDetails.depositAmount && quote.paymentDetails.depositAmount > 0 
                              ? quote.paymentDetails.depositAmount 
                              : selectedQuoteData 
                                ? selectedQuoteData.total * 0.5 
                                : 0))}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Approval Status</p>
                          <p className="text-base font-semibold">
                            {quote.paymentDetails.status === 'payment-approved' || quote.paymentDetails.status === 'deposit-paid' 
                              ? '✓ Approved' 
                              : quote.paymentDetails.status === 'screenshot-rejected'
                              ? '✗ Rejected'
                              : '⏳ Pending Approval'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Final Payment */}
                  {quote.paymentDetails.finalPayment ? (
                    <div className="space-y-5 p-6 border-2 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b">
                        <span className="font-semibold text-lg">Final Payment (50%)</span>
                        <Badge 
                          variant={
                            quote.paymentDetails.finalPayment.status === 'deposit-paid' || quote.paymentDetails.finalPayment.status === 'payment-approved' 
                              ? 'default' 
                              : quote.paymentDetails.finalPayment.status === 'screenshot-rejected'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className={
                            quote.paymentDetails.finalPayment.status === 'deposit-paid' || quote.paymentDetails.finalPayment.status === 'payment-approved'
                              ? 'bg-green-500 hover:bg-green-600 text-white'
                              : quote.paymentDetails.finalPayment.status === 'screenshot-rejected'
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                          }
                        >
                          {quote.paymentDetails.finalPayment.status === 'deposit-paid' ? 'Paid' : 
                           quote.paymentDetails.finalPayment.status === 'payment-approved' ? 'Approved' :
                           quote.paymentDetails.finalPayment.status === 'screenshot-rejected' ? 'Rejected' :
                           'Pending'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-5">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment Mode</p>
                            <p className="text-base font-semibold capitalize">{quote.paymentDetails.finalPayment.method === 'stripe' ? 'Stripe (Card Payment)' : 'Interac e-Transfer'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Amount</p>
                            <p className="text-lg font-bold">
                              ${formatPrice((quote.paymentDetails.finalPayment.amount && quote.paymentDetails.finalPayment.amount > 0) 
                                ? quote.paymentDetails.finalPayment.amount
                                : selectedQuoteData
                                  ? selectedQuoteData.total * 0.5
                                  : 0)}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-5">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Approval Status</p>
                            <p className="text-base font-semibold">
                              {quote.paymentDetails.finalPayment.status === 'payment-approved' || quote.paymentDetails.finalPayment.status === 'deposit-paid' 
                                ? '✓ Approved' 
                                : quote.paymentDetails.finalPayment.status === 'screenshot-rejected'
                                ? '✗ Rejected'
                                : '⏳ Pending Approval'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : selectedQuoteData && (
                    <div className="p-6 border-2 border-dashed rounded-xl bg-muted/20">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b">
                        <span className="font-semibold text-base">Final Payment (50%)</span>
                        <Badge variant="outline" className="bg-muted">Not Started</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">
                        Remaining balance: <span className="font-semibold text-foreground">${formatPrice(selectedQuoteData.total * 0.5)}</span>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
             <Card>
                <CardHeader className='pb-2'>
                    <CardTitle className="text-lg flex items-center gap-2"><CalendarClock className='w-5 h-5'/>Time to Event</CardTitle>
                </CardHeader>
                <CardContent>
                     <p className={`text-xl font-bold ${eventTimeInfo.isPast ? 'text-muted-foreground' : 'text-black'}`}>{eventTimeInfo.text}</p>
                </CardContent>
            </Card>
        </div>
      </div>

      {/* Service Details Card */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-xl font-headline">Service Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {quote.booking.days && quote.booking.days.length > 0 ? quote.booking.days.map((day, index) => (
              <div key={index} className="p-4 border-2 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 pb-3 border-b">
                  <h4 className="font-semibold text-base">{day.serviceName}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{day.date} at {day.getReadyTime}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Service:</span>
                    <p className="font-medium mt-0.5">{day.serviceOption}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <p className="font-medium mt-0.5">
                      {day.location === 'Studio' ? (
                        <a href={STUDIO_ADDRESS.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline text-black">
                          <MapPin className="h-3 w-3" />
                          {STUDIO_ADDRESS.street}, {STUDIO_ADDRESS.city}
                        </a>
                      ) : (
                        day.location
                      )}
                    </p>
                  </div>
                  {day.addOns && day.addOns.length > 0 && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Add-ons:</span>
                      <ul className="mt-1.5 space-y-1">
                        {day.addOns.map((addon, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-black"></span>
                            <span className="text-sm">{addon}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No service days found.</p>
              </div>
            )}

            {quote.booking.trial && (() => {
              // Use trial's service option if available, otherwise default
              const trialServiceOption = quote.booking.trial?.serviceOption || 'makeup-hair';
              const trialServiceOptionLabel = trialServiceOption === 'makeup-hair' ? 'Makeup & Hair' : 
                                              trialServiceOption === 'makeup-only' ? 'Makeup Only' : 'Hair Only';
              return (
                <div className="p-4 border-2 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <h4 className="font-semibold text-base">Bridal Trial</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{quote.booking.trial?.date || 'N/A'} at {quote.booking.trial?.time || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Service:</span> {trialServiceOptionLabel}
                    </div>
                  </div>
                </div>
              );
            })()}

            {quote.booking.bridalParty && quote.booking.bridalParty.services && quote.booking.bridalParty.services.length > 0 && (
              <div className="p-4 border-2 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10">
                <h4 className="font-semibold text-base mb-3">Bridal Party Services</h4>
                <div className="space-y-2">
                  {quote.booking.bridalParty.services.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-background/50">
                      <span>{s.service}</span>
                      <Badge variant="outline" className="ml-2">x{s.quantity}</Badge>
                    </div>
                  ))}
                  {quote.booking.bridalParty.airbrush > 0 && (
                    <div className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-background/50">
                      <span>Airbrush Service</span>
                      <Badge variant="outline" className="ml-2">x{quote.booking.bridalParty.airbrush}</Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Payment Details Card - Admin Actions */}
      {quote.paymentDetails && selectedQuoteData && (
        <Card className="shadow-lg">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-xl font-headline">Payment Management</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            {/* Advance Payment Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-lg">Advance Payment (50%)</h4>
                <Badge 
                  variant={
                    quote.paymentDetails?.status === 'deposit-paid' || quote.paymentDetails?.status === 'payment-approved' 
                      ? 'default' 
                      : quote.paymentDetails?.status === 'screenshot-rejected'
                      ? 'destructive'
                      : 'secondary'
                  }
                  className={
                    quote.paymentDetails?.status === 'deposit-paid' || quote.paymentDetails?.status === 'payment-approved'
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : quote.paymentDetails?.status === 'screenshot-rejected'
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  }
                >
                  {quote.paymentDetails?.status === 'deposit-paid' ? 'Paid' : 
                   quote.paymentDetails?.status === 'payment-approved' ? 'Approved' :
                   quote.paymentDetails?.status === 'screenshot-rejected' ? 'Rejected' :
                   'Pending'}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Payment Method</Label>
                      <Badge 
                        variant={quote.paymentDetails?.method === 'stripe' ? 'default' : 'outline'} 
                        className={quote.paymentDetails?.method === 'stripe' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'capitalize text-base py-1.5 px-3'}
                      >
                        {quote.paymentDetails?.method === 'stripe' ? 'Stripe (Card Payment)' : 'Interac e-Transfer'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Amount</Label>
                      <p className="text-lg font-bold">
                        ${formatPrice((quote.paymentDetails?.depositAmount && quote.paymentDetails.depositAmount > 0) 
                          ? quote.paymentDetails.depositAmount 
                          : selectedQuoteData 
                            ? selectedQuoteData.total * 0.5 
                            : 0)}
                      </p>
                    </div>
                    
                    {quote.paymentDetails?.method === 'interac' && (
                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Status</Label>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <Select 
                            value={quote.paymentDetails?.status || 'deposit-pending'} 
                            onValueChange={(val: PaymentDetails['status']) => handlePaymentStatusChange(val)} 
                            disabled={isActionPending}
                          >
                            <SelectTrigger className="w-full sm:w-[220px]">
                              <SelectValue placeholder="Update status..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="deposit-pending">Pending Payment Approval</SelectItem>
                              <SelectItem value="payment-approved">Payment Approved</SelectItem>
                              <SelectItem value="screenshot-rejected">Screenshot Rejected</SelectItem>
                              <SelectItem value="deposit-paid">Deposit Received</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {quote.paymentDetails?.method === 'stripe' && (
                      <div className="pt-2 border-t">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Payment Status</Label>
                        <Badge 
                          variant={quote.paymentDetails.status === 'deposit-paid' ? 'default' : 'secondary'}
                          className={quote.paymentDetails.status === 'deposit-paid' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                        >
                          {quote.paymentDetails.status === 'deposit-paid' ? 'Paid via Stripe' : 
                           quote.paymentDetails.status === 'payment-approved' ? 'Approved' : 
                           quote.paymentDetails.status === 'deposit-pending' ? 'Pending' : 
                           'Rejected'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
                
                {quote.paymentDetails?.method === 'interac' && quote.paymentDetails.screenshotUrl && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/30 border">
                      <h4 className="font-semibold text-base mb-4">Payment Screenshot</h4>
                      <a href={quote.paymentDetails.screenshotUrl} target="_blank" rel="noopener noreferrer" className="block group">
                        <div className="relative rounded-lg border-2 border-border overflow-hidden hover:border-primary transition-colors">
                          <img 
                            src={quote.paymentDetails.screenshotUrl} 
                            alt="Payment Screenshot" 
                            className="w-full aspect-video object-cover group-hover:scale-[1.02] transition-transform duration-200" 
                          />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-primary hover:underline mt-3">
                          <LinkIcon className="w-4 h-4" />
                          View full size
                        </div>
                      </a>
                      {bookingDoc?.updatedAt && (
                        <p className="text-xs text-muted-foreground mt-3">
                          Uploaded: {bookingDoc.updatedAt && typeof bookingDoc.updatedAt === 'object' && 'toDate' in bookingDoc.updatedAt 
                            ? formatToronto(bookingDoc.updatedAt.toDate(), 'PPp') 
                            : formatToronto(new Date(bookingDoc.updatedAt as any), 'PPp')}
                        </p>
                      )}
                    </div>
                                  
                    {/* Approve/Reject buttons - only show if status is deposit-pending */}
                    {quote.paymentDetails?.status === 'deposit-pending' && (
                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="default" 
                              className="flex-1"
                              disabled={isApproving || isRejecting}
                              size="default"
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Approve Payment
                            </Button>
                          </AlertDialogTrigger>
                                              <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md">
                                                  <AlertDialogHeader>
                                                      <AlertDialogTitle className="text-lg sm:text-xl">Approve Payment</AlertDialogTitle>
                                                      <AlertDialogDescription className="text-sm sm:text-base">
                                                          Are you sure you want to approve this payment? This will confirm the booking and send a confirmation email to the customer.
                                                      </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                                      <AlertDialogCancel>No</AlertDialogCancel>
                                                      <AlertDialogAction
                                                          onClick={async () => {
                                                              setIsApproving(true);
                                                              try {
                                                                  const result = await approvePaymentAction(quote.id);
                                                                  if (result.success) {
                                                                      toast({
                                                                          title: 'Payment Approved',
                                                                          description: result.message,
                                                                      });
                                                                      // Refresh booking data
                                                                      const res = await fetch(`/api/bookings/${quote.id}`, { cache: 'no-store' });
                                                                      if (res.ok) {
                                                                          const { booking } = await res.json();
                                                                          const updatedQuote = booking.finalQuote || booking.final_quote;
                                                                          onUpdate(updatedQuote);
                                                                          
                                                                          // Track payment completion for Interac payments
                                                                          if (updatedQuote.paymentDetails?.method === 'interac') {
                                                                              const selectedQuote = updatedQuote.selectedQuote || 'lead';
                                                                              const quoteData = updatedQuote.quotes[selectedQuote];
                                                                              const advanceAmount = quoteData ? quoteData.total * 0.5 : 0;
                                                                              trackPaymentComplete({
                                                                                  bookingId: quote.id,
                                                                                  amount: advanceAmount,
                                                                                  currency: 'CAD',
                                                                                  paymentType: 'advance',
                                                                                  paymentMethod: 'interac',
                                                                              });
                                                                          }
                                                                      }
                                                                  } else {
                                                                      toast({
                                                                          variant: 'destructive',
                                                                          title: 'Approval Failed',
                                                                          description: result.message,
                                                                      });
                                                                  }
                                                              } catch (error: any) {
                                                                  toast({
                                                                      variant: 'destructive',
                                                                      title: 'Error',
                                                                      description: error.message || 'Failed to approve payment',
                                                                  });
                                                              } finally {
                                                                  setIsApproving(false);
                                                              }
                                                          }}
                                                  disabled={isApproving}
                                              >
                                                  {isApproving ? (
                                                      <>
                                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                          Approving...
                                                      </>
                                                  ) : (
                                                      'Yes, Approve'
                                                  )}
                                              </AlertDialogAction>
                                          </AlertDialogFooter>
                                      </AlertDialogContent>
                                  </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="destructive" 
                              className="flex-1"
                              disabled={isApproving || isRejecting}
                              size="default"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject Screenshot
                            </Button>
                          </AlertDialogTrigger>
                                      <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md">
                                          <AlertDialogHeader>
                                              <AlertDialogTitle className="text-lg sm:text-xl">Reject Screenshot</AlertDialogTitle>
                                              <AlertDialogDescription className="text-sm sm:text-base">
                                                  Are you sure you want to reject this screenshot? The customer will receive an email with instructions to re-upload.
                                              </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                              <AlertDialogCancel>No</AlertDialogCancel>
                                              <AlertDialogAction
                                                  onClick={async () => {
                                                      setIsRejecting(true);
                                                      try {
                                                          const result = await rejectScreenshotAction(quote.id);
                                                          if (result.success) {
                                                              toast({
                                                                  title: 'Screenshot Rejected',
                                                                  description: result.message,
                                                              });
                                                              // Refresh booking data
                                                              const res = await fetch(`/api/bookings/${quote.id}`, { cache: 'no-store' });
                                                              if (res.ok) {
                                                                  const { booking } = await res.json();
                                                                  onUpdate(booking.finalQuote || booking.final_quote);
                                                              }
                                                          } else {
                                                              toast({
                                                                  variant: 'destructive',
                                                                  title: 'Rejection Failed',
                                                                  description: result.message,
                                                              });
                                                          }
                                                      } catch (error: any) {
                                                          toast({
                                                              variant: 'destructive',
                                                              title: 'Error',
                                                              description: error.message || 'Failed to reject screenshot',
                                                          });
                                                      } finally {
                                                          setIsRejecting(false);
                                                      }
                                                  }}
                                                  disabled={isRejecting}
                                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              >
                                                  {isRejecting ? (
                                                      <>
                                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                          Rejecting...
                                                      </>
                                                  ) : (
                                                      'Yes, Reject'
                                                  )}
                                              </AlertDialogAction>
                                          </AlertDialogFooter>
                                      </AlertDialogContent>
                                  </AlertDialog>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>

            {/* Final Payment Section */}
            {(quote.paymentDetails?.status === 'payment-approved' || quote.paymentDetails?.status === 'deposit-paid') && (
              <div className="pt-8 border-t space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">Final Payment (50%)</h4>
                  {quote.paymentDetails?.finalPayment && (
                    <Badge 
                      variant={
                        quote.paymentDetails.finalPayment.status === 'deposit-paid' || quote.paymentDetails.finalPayment.status === 'payment-approved' 
                          ? 'default' 
                          : quote.paymentDetails.finalPayment.status === 'screenshot-rejected'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className={
                        quote.paymentDetails.finalPayment.status === 'deposit-paid' || quote.paymentDetails.finalPayment.status === 'payment-approved'
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : quote.paymentDetails.finalPayment.status === 'screenshot-rejected'
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      }
                    >
                      {quote.paymentDetails.finalPayment.status === 'deposit-paid' ? 'Paid' : 
                       quote.paymentDetails.finalPayment.status === 'payment-approved' ? 'Approved' :
                       quote.paymentDetails.finalPayment.status === 'screenshot-rejected' ? 'Rejected' :
                       'Pending'}
                    </Badge>
                  )}
                </div>
                
                {quote.paymentDetails?.finalPayment ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-5">
                      <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Payment Method</Label>
                          <Badge 
                            variant={quote.paymentDetails.finalPayment.method === 'stripe' ? 'default' : 'outline'} 
                            className={quote.paymentDetails.finalPayment.method === 'stripe' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'capitalize text-base py-1.5 px-3'}
                          >
                            {quote.paymentDetails.finalPayment.method === 'stripe' ? 'Stripe (Card Payment)' : 'Interac e-Transfer'}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Amount</Label>
                          <p className="text-lg font-bold">${quote.paymentDetails.finalPayment.amount ? formatPrice(quote.paymentDetails.finalPayment.amount) : formatPrice(0)}</p>
                        </div>
                        
                        {quote.paymentDetails.finalPayment.method === 'interac' && (
                          <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Status</Label>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                              <Select 
                                value={quote.paymentDetails.finalPayment.status || 'deposit-pending'} 
                                onValueChange={(val: PaymentDetails['status']) => handleFinalPaymentStatusChange(val)} 
                                disabled={isActionPending}
                              >
                                <SelectTrigger className="w-full sm:w-[220px]">
                                  <SelectValue placeholder="Update status..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="deposit-pending">Pending Payment Approval</SelectItem>
                                  <SelectItem value="payment-approved">Payment Approved</SelectItem>
                                  <SelectItem value="screenshot-rejected">Screenshot Rejected</SelectItem>
                                  <SelectItem value="deposit-paid">Payment Received</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                        {quote.paymentDetails.finalPayment.method === 'stripe' && (
                          <div className="pt-2 border-t">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Payment Status</Label>
                            <Badge 
                              variant={quote.paymentDetails.finalPayment.status === 'deposit-paid' ? 'default' : 'secondary'}
                              className={quote.paymentDetails.finalPayment.status === 'deposit-paid' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                            >
                              {quote.paymentDetails.finalPayment.status === 'deposit-paid' ? 'Paid via Stripe' : 
                               quote.paymentDetails.finalPayment.status === 'payment-approved' ? 'Approved' : 
                               quote.paymentDetails.finalPayment.status === 'deposit-pending' ? 'Pending' : 
                               'Rejected'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {quote.paymentDetails.finalPayment.method === 'interac' && quote.paymentDetails.finalPayment.screenshotUrl && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-muted/30 border">
                          <h4 className="font-semibold text-base mb-4">Final Payment Screenshot</h4>
                          <a href={quote.paymentDetails.finalPayment.screenshotUrl} target="_blank" rel="noopener noreferrer" className="block group">
                            <div className="relative rounded-lg border-2 border-border overflow-hidden hover:border-primary transition-colors">
                              <img 
                                src={quote.paymentDetails.finalPayment.screenshotUrl} 
                                alt="Final Payment Screenshot" 
                                className="w-full aspect-video object-cover group-hover:scale-[1.02] transition-transform duration-200" 
                              />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-primary hover:underline mt-3">
                              <LinkIcon className="w-4 h-4" />
                              View full size
                            </div>
                          </a>
                        </div>
                        
                        {/* Approve/Reject buttons for final payment - only show if status is deposit-pending */}
                        {quote.paymentDetails.finalPayment.status === 'deposit-pending' && (
                          <div className="flex flex-col sm:flex-row gap-3">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="default" 
                                  className="flex-1"
                                  disabled={isApprovingFinal || isRejectingFinal}
                                  size="default"
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Approve Final Payment
                                </Button>
                              </AlertDialogTrigger>
                                                      <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md">
                                                          <AlertDialogHeader>
                                                              <AlertDialogTitle className="text-lg sm:text-xl">Approve Final Payment</AlertDialogTitle>
                                                              <AlertDialogDescription className="text-sm sm:text-base">
                                                                  Are you sure you want to approve this final payment? This will mark the booking as fully paid.
                                                              </AlertDialogDescription>
                                                          </AlertDialogHeader>
                                                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                                              <AlertDialogCancel>No</AlertDialogCancel>
                                                              <AlertDialogAction
                                                                  onClick={async () => {
                                                                      setIsApprovingFinal(true);
                                                                      try {
                                                                          const result = await approveFinalPaymentAction(quote.id);
                                                                          if (result.success) {
                                                                              toast({
                                                                                  title: 'Final Payment Approved',
                                                                                  description: result.message,
                                                                              });
                                                                              // Refresh booking data
                                                                              const res = await fetch(`/api/bookings/${quote.id}`, { cache: 'no-store' });
                                                                              if (res.ok) {
                                                                                  const { booking } = await res.json();
                                                                                  const updatedQuote = booking.finalQuote || booking.final_quote;
                                                                                  onUpdate(updatedQuote);
                                                                                  
                                                                                  // Track payment completion for Interac final payments
                                                                                  if (updatedQuote.paymentDetails?.finalPayment?.method === 'interac') {
                                                                                      const finalAmount = updatedQuote.paymentDetails.finalPayment.amount || 0;
                                                                                      trackPaymentComplete({
                                                                                          bookingId: quote.id,
                                                                                          amount: finalAmount,
                                                                                          currency: 'CAD',
                                                                                          paymentType: 'final',
                                                                                          paymentMethod: 'interac',
                                                                                      });
                                                                                  }
                                                                              }
                                                                          } else {
                                                                              toast({
                                                                                  variant: 'destructive',
                                                                                  title: 'Approval Failed',
                                                                                  description: result.message,
                                                                              });
                                                                          }
                                                                      } catch (error: any) {
                                                                          toast({
                                                                              variant: 'destructive',
                                                                              title: 'Error',
                                                                              description: error.message || 'Failed to approve final payment',
                                                                          });
                                                                      } finally {
                                                                          setIsApprovingFinal(false);
                                                                      }
                                                                  }}
                                                                  disabled={isApprovingFinal}
                                                              >
                                                                  {isApprovingFinal ? (
                                                                      <>
                                                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                          Approving...
                                                                      </>
                                                                  ) : (
                                                                      'Yes, Approve'
                                                                  )}
                                                              </AlertDialogAction>
                                                          </AlertDialogFooter>
                                                      </AlertDialogContent>
                                                  </AlertDialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  className="flex-1"
                                  disabled={isApprovingFinal || isRejectingFinal}
                                  size="default"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject Final Payment
                                </Button>
                              </AlertDialogTrigger>
                                                      <AlertDialogContent>
                                                          <AlertDialogHeader>
                                                              <AlertDialogTitle>Reject Final Payment Screenshot</AlertDialogTitle>
                                                              <AlertDialogDescription>
                                                                  Are you sure you want to reject this final payment screenshot? The customer will receive an email with instructions to re-upload.
                                                              </AlertDialogDescription>
                                                          </AlertDialogHeader>
                                                          <AlertDialogFooter>
                                                              <AlertDialogCancel>No</AlertDialogCancel>
                                                              <AlertDialogAction
                                                                  onClick={async () => {
                                                                      setIsRejectingFinal(true);
                                                                      try {
                                                                          const result = await rejectFinalPaymentAction(quote.id);
                                                                          if (result.success) {
                                                                              toast({
                                                                                  title: 'Final Payment Rejected',
                                                                                  description: result.message,
                                                                              });
                                                                              // Refresh booking data
                                                                              const res = await fetch(`/api/bookings/${quote.id}`, { cache: 'no-store' });
                                                                              if (res.ok) {
                                                                                  const { booking } = await res.json();
                                                                                  onUpdate(booking.finalQuote || booking.final_quote);
                                                                              }
                                                                          } else {
                                                                              toast({
                                                                                  variant: 'destructive',
                                                                                  title: 'Rejection Failed',
                                                                                  description: result.message,
                                                                              });
                                                                          }
                                                                      } catch (error: any) {
                                                                          toast({
                                                                              variant: 'destructive',
                                                                              title: 'Error',
                                                                              description: error.message || 'Failed to reject final payment',
                                                                          });
                                                                      } finally {
                                                                          setIsRejectingFinal(false);
                                                                      }
                                                                  }}
                                                                  disabled={isRejectingFinal}
                                                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                              >
                                                                  {isRejectingFinal ? (
                                                                      <>
                                                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                          Rejecting...
                                                                      </>
                                                                  ) : (
                                                                      'Yes, Reject'
                                                                  )}
                                                              </AlertDialogAction>
                                                          </AlertDialogFooter>
                                                      </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 border-2 border-dashed rounded-xl bg-muted/20 text-center">
                    <p className="text-sm text-muted-foreground">Final payment has not been submitted yet.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Show selected quote with payment summary when payment is made and order is booked */}
      {(() => {
        const hasPayment = quote.paymentDetails && 
          (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
        const isBooked = quote.status === 'confirmed';
        
        if (hasPayment && isBooked && selectedQuoteData && quote.selectedQuote) {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {quote.selectedQuote === 'lead' ? <User className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5 text-primary" />}
                  Selected Package: {quote.selectedQuote === 'lead' ? 'Anum - Lead Artist' : 'Team Package'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Quote Breakdown */}
                <div>
                  <h4 className="font-medium text-base mb-3">Package Details</h4>
                  <ul className="space-y-1 text-sm">
                    {selectedQuoteData.lineItems?.map((item, index) => (
                      <li key={index} className="flex justify-between">
                        <span className={item.description?.startsWith('  -') ? 'pl-4 text-muted-foreground' : ''}>{item.description || 'Item'}</span>
                        <span>${formatPrice(item.price || 0)}</span>
                      </li>
                    )) || <li className="text-muted-foreground text-sm">No items</li>}
                  </ul>
                  <Separator className="my-3" />
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">${formatPrice(selectedQuoteData.subtotal || 0)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground">GST (13%):</span>
                      <span className="font-medium">${formatPrice(selectedQuoteData.tax || 0)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-base">Total Amount:</span>
                      <span className="font-bold text-primary text-lg">${formatPrice(selectedQuoteData.total || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="pt-4 border-t">
                  <h4 className="font-medium text-lg mb-4">Payment Summary</h4>
                  <div className="space-y-4">
                    {/* Total Amount */}
                    <div className="flex justify-between items-center py-2 border-b pb-3">
                      <span className="text-base font-medium">Total Amount (including 13% GST):</span>
                      <span className="font-bold text-lg">${formatPrice(selectedQuoteData.total)}</span>
                    </div>
                    
                    {/* Advance Payment Section */}
                    <div className="space-y-3 pt-2">
                      <h5 className="font-semibold text-base">Advance Payment (50%)</h5>
                      <div className="space-y-2 pl-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Amount:</span>
                          <span className="font-semibold text-green-600">${formatPrice(selectedQuoteData.total * 0.5)}</span>
                        </div>
                        {quote.paymentDetails?.method && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Payment Method:</span>
                            <Badge 
                              variant={quote.paymentDetails?.method === 'stripe' ? 'default' : 'outline'} 
                              className={quote.paymentDetails?.method === 'stripe' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'capitalize'}
                            >
                              {quote.paymentDetails?.method === 'stripe' ? 'Stripe (Card Payment)' : 'Interac e-Transfer'}
                            </Badge>
                          </div>
                        )}
                        {/* Promotional Code for Advance Payment */}
                        {quote.paymentDetails?.promotionalCode && (
                          <div className="space-y-1 pt-2 border-t">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Promotional Code:</span>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                {quote.paymentDetails.promotionalCode}
                              </Badge>
                            </div>
                            {quote.paymentDetails.discountAmount && quote.paymentDetails.discountAmount > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Discount Applied:</span>
                                <span className="font-semibold text-green-600">
                                  -${formatPrice(quote.paymentDetails.discountAmount)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        {quote.paymentDetails && (
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-sm font-medium">Status:</span>
                            <Badge 
                              variant="default"
                              className="bg-green-500 hover:bg-green-600 text-white"
                            >
                              {quote.paymentDetails.status === 'deposit-paid' ? 'Paid' : 
                               quote.paymentDetails.status === 'payment-approved' ? 'Payment Approved' :
                               quote.paymentDetails.status === 'deposit-pending' ? 'Pending Approval' :
                               'Screenshot Rejected'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Remaining Balance */}
                    <div className="flex justify-between items-center py-2 border-t pt-3">
                      <span className="text-sm text-muted-foreground">50% Remaining Balance:</span>
                      <span className="font-semibold">${formatPrice(selectedQuoteData.total * 0.5)}</span>
                    </div>

                    {/* Final Payment Section */}
                    {quote.paymentDetails?.finalPayment && (
                      <div className="space-y-3 pt-3 border-t">
                        <h5 className="font-semibold text-base">Final Payment (50%)</h5>
                        <div className="space-y-2 pl-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Amount:</span>
                            <span className={`font-semibold ${(quote.paymentDetails.finalPayment.status === 'payment-approved' || quote.paymentDetails.finalPayment.status === 'deposit-paid') ? 'text-green-600' : ''}`}>
                              ${quote.paymentDetails.finalPayment.amount ? formatPrice(quote.paymentDetails.finalPayment.amount) : formatPrice(selectedQuoteData.total * 0.5)}
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
                          {/* Promotional Code for Final Payment */}
                          {quote.paymentDetails.finalPayment.promotionalCode && (
                            <div className="space-y-1 pt-2 border-t">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Promotional Code:</span>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  {quote.paymentDetails.finalPayment.promotionalCode}
                                </Badge>
                              </div>
                              {quote.paymentDetails.finalPayment.discountAmount && quote.paymentDetails.finalPayment.discountAmount > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-muted-foreground">Discount Applied:</span>
                                  <span className="font-semibold text-green-600">
                                    -${formatPrice(quote.paymentDetails.finalPayment.discountAmount)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-sm font-medium">Status:</span>
                            <Badge 
                              variant={quote.paymentDetails.finalPayment.status === 'payment-approved' || quote.paymentDetails.finalPayment.status === 'deposit-paid' ? 'default' : 'destructive'}
                              className={quote.paymentDetails.finalPayment.status === 'payment-approved' || quote.paymentDetails.finalPayment.status === 'deposit-paid' 
                                ? 'bg-green-500 hover:bg-green-600 text-white' 
                                : 'bg-red-500 hover:bg-red-600 text-white'}
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
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      {/* Show both quotes only if no payment is made and no quote is selected */}
      {(() => {
        const hasPayment = quote.paymentDetails && 
          (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
        const isBooked = quote.status === 'confirmed';
        
        if (!selectedQuoteData && !hasPayment && !isBooked) {
          return (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              {(['lead', 'team'] as PriceTier[]).map(tier => (
                <Card key={tier}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {tier === 'lead' ? <User className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5 text-primary" />}
                      Quote: <span className='capitalize'>{tier}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm">
                      {quote.quotes[tier]?.lineItems?.map((item, index) => (
                        <li key={index} className="flex justify-between">
                          <span className={item.description?.startsWith('  -') ? 'pl-4 text-muted-foreground' : ''}>{item.description || 'Item'}</span>
                          <span>${formatPrice(item.price || 0)}</span>
                        </li>
                      )) || <li className="text-muted-foreground text-sm">No items</li>}
                    </ul>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold">Total</span>
                      <span className="font-bold text-primary">${formatPrice(quote.quotes[tier]?.total || 0)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        }
        return null;
      })()}
      
      {/* WhatsApp Messages Status Section - Always show all messages */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Messages Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Initial WhatsApp Message - Always show */}
            {(() => {
              const initial = quote.whatsappMessages?.initial;
              return (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {initial?.delivered ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : initial?.sent && !initial?.delivered ? (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      ) : initial?.error ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Initial Quote Message</p>
                      <p className="text-sm text-muted-foreground">
                        {initial?.delivered
                          ? initial.sentAt 
                            ? `Delivered on ${formatToronto(new Date(initial.sentAt), 'PPp')}`
                            : 'Delivered'
                          : initial?.sent
                            ? initial.deliveryStatus
                              ? `Sent (${initial.deliveryStatus})`
                              : initial.sentAt
                                ? `Sent on ${formatToronto(new Date(initial.sentAt), 'PPp')}`
                                : 'Sent'
                            : initial?.error
                              ? `Failed: ${initial.error}`
                              : 'Not sent'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    initial?.delivered ? 'default' : 
                    initial?.sent ? 'secondary' :
                    initial?.error ? 'destructive' : 
                    'outline'
                  }>
                    {initial?.delivered ? 'Delivered' : 
                     initial?.sent ? 'Sent' : 
                     initial?.error ? 'Failed' : 
                     'Pending'}
                  </Badge>
                </div>
              );
            })()}

            {/* 2-Week Urgency Reminder - Always show */}
            {(() => {
              const hasAdvancePayment = quote.paymentDetails && 
                (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
              const willNotSend = hasAdvancePayment || quote.status === 'confirmed' || quote.status === 'cancelled';
              const reminder2w = quote.whatsappMessages?.reminder2w;
              
              // Determine status: Scheduled, Sent, Cancelled, or Not Scheduled
              // Check if it was cancelled by processor (sent: true with error containing "Skipped" or "Cancelled")
              const wasCancelledByProcessor = reminder2w?.sent && reminder2w?.error && 
                (reminder2w.error.includes('Skipped') || reminder2w.error.includes('Cancelled') || reminder2w.error.includes('advance payment'));
              
              let status: 'Scheduled' | 'Sent' | 'Cancelled' | 'Not Scheduled';
              if (!reminder2w) {
                status = 'Not Scheduled';
              } else if (wasCancelledByProcessor || (willNotSend && !reminder2w?.sent)) {
                status = 'Cancelled';
              } else if (reminder2w?.sent && !wasCancelledByProcessor) {
                status = 'Sent';
              } else {
                status = 'Scheduled';
              }
                  
              return (
                <div className={`flex items-center justify-between p-3 border rounded-lg ${status === 'Cancelled' ? 'bg-muted/50' : ''}`}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-shrink-0">
                      {status === 'Sent' ? (
                        reminder2w?.delivered ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        )
                      ) : status === 'Cancelled' ? (
                        <XCircle className="h-5 w-5 text-orange-500" />
                      ) : status === 'Scheduled' ? (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">2-Week Urgency Reminder</p>
                        {status === 'Cancelled' && (
                          <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Cancelled</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {status === 'Sent'
                          ? reminder2w?.sentAt 
                            ? `Sent on ${formatToronto(new Date(reminder2w.sentAt), 'PPp')}`
                            : 'Sent'
                          : status === 'Cancelled'
                            ? wasCancelledByProcessor
                              ? reminder2w?.error || 'Cancelled'
                              : hasAdvancePayment 
                                ? 'Cancelled - Advance payment made'
                                : quote.status === 'confirmed'
                                  ? 'Cancelled - Booking confirmed'
                                  : 'Cancelled - Booking cancelled'
                            : status === 'Scheduled'
                              ? reminder2w?.scheduledFor
                                ? (() => {
                                    const scheduledDate = new Date(reminder2w.scheduledFor);
                                    const isInFuture = isFutureToronto(scheduledDate);
                                    return isInFuture
                                      ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                      : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                  })()
                                : 'Scheduled'
                              : 'Not Scheduled'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    status === 'Sent' ? 'default' : 
                    status === 'Cancelled' ? 'destructive' :
                    status === 'Scheduled' ? 'secondary' :
                    'outline'
                  }>
                    {status}
                  </Badge>
                </div>
              );
            })()}

            {/* 1-Week Urgency Reminder - Always show */}
            {(() => {
              const hasAdvancePayment = quote.paymentDetails && 
                (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
              const willNotSend = hasAdvancePayment || quote.status === 'confirmed' || quote.status === 'cancelled';
              const reminder1w = quote.whatsappMessages?.reminder1w;
              
              // Determine status: Scheduled, Sent, Cancelled, or Not Scheduled
              // Check if it was cancelled by processor (sent: true with error containing "Skipped" or "Cancelled")
              const wasCancelledByProcessor = reminder1w?.sent && reminder1w?.error && 
                (reminder1w.error.includes('Skipped') || reminder1w.error.includes('Cancelled') || reminder1w.error.includes('advance payment'));
              
              let status: 'Scheduled' | 'Sent' | 'Cancelled' | 'Not Scheduled';
              if (!reminder1w) {
                status = 'Not Scheduled';
              } else if (wasCancelledByProcessor || (willNotSend && !reminder1w?.sent)) {
                status = 'Cancelled';
              } else if (reminder1w?.sent && !wasCancelledByProcessor) {
                status = 'Sent';
              } else {
                status = 'Scheduled';
              }
                  
              return (
                <div className={`flex items-center justify-between p-3 border rounded-lg ${status === 'Cancelled' ? 'bg-muted/50' : ''}`}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-shrink-0">
                      {status === 'Sent' ? (
                        reminder1w?.delivered ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        )
                      ) : status === 'Cancelled' ? (
                        <XCircle className="h-5 w-5 text-orange-500" />
                      ) : status === 'Scheduled' ? (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">1-Week Urgency Reminder</p>
                        {status === 'Cancelled' && (
                          <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Cancelled</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {status === 'Sent'
                          ? reminder1w?.sentAt 
                            ? `Sent on ${formatToronto(new Date(reminder1w.sentAt), 'PPp')}`
                            : 'Sent'
                          : status === 'Cancelled'
                            ? wasCancelledByProcessor
                              ? reminder1w?.error || 'Cancelled'
                              : hasAdvancePayment 
                                ? 'Cancelled - Advance payment made'
                                : quote.status === 'confirmed'
                                  ? 'Cancelled - Booking confirmed'
                                  : 'Cancelled - Booking cancelled'
                            : status === 'Scheduled'
                              ? reminder1w?.scheduledFor
                                ? (() => {
                                    const scheduledDate = new Date(reminder1w.scheduledFor);
                                    const isInFuture = isFutureToronto(scheduledDate);
                                    return isInFuture
                                      ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                      : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                  })()
                                : 'Scheduled'
                              : 'Not Scheduled'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    status === 'Sent' ? 'default' : 
                    status === 'Cancelled' ? 'destructive' :
                    status === 'Scheduled' ? 'secondary' :
                    'outline'
                  }>
                    {status}
                  </Badge>
                </div>
              );
            })()}

                {/* 7-Day Follow-up WhatsApp Message */}
                {(() => {
                  const hasAdvancePayment = quote.paymentDetails && 
                    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                  const willNotSend = hasAdvancePayment || quote.status === 'confirmed' || quote.status === 'cancelled';
                  const followup = quote.whatsappMessages?.followup7d;
                  const hasFollowup = followup?.sent || followup?.delivered;
                  
                  // Only show if follow-up was sent/delivered or scheduled
                  if (!hasFollowup && !followup?.scheduledFor) {
                    return null;
                  }
                  
                  return (
                    <div className={`flex items-center justify-between p-3 border rounded-lg ${willNotSend ? 'bg-muted/50' : ''}`}>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-shrink-0">
                          {followup?.delivered ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : followup?.sent && !followup?.delivered ? (
                            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                          ) : willNotSend ? (
                            <XCircle className="h-5 w-5 text-orange-500" />
                          ) : followup?.scheduledFor && isFutureToronto(new Date(followup.scheduledFor)) ? (
                            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                          ) : followup?.error ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">7-Day Follow-up Message</p>
                            {willNotSend && (
                              <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Cancelled</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {followup?.delivered
                              ? followup.sentAt 
                                ? `Delivered on ${formatToronto(new Date(followup.sentAt), 'PPp')}`
                                : 'Delivered'
                              : followup?.sent
                                ? followup.deliveryStatus
                                  ? `Sent (${followup.deliveryStatus})`
                                  : followup.sentAt
                                    ? `Sent on ${formatToronto(new Date(followup.sentAt), 'PPp')}`
                                    : 'Sent'
                                : willNotSend
                                  ? hasAdvancePayment 
                                    ? 'Cancelled - Advance payment made'
                                    : quote.status === 'confirmed'
                                      ? 'Cancelled - Booking confirmed'
                                      : 'Cancelled - Booking cancelled'
                                  : followup?.error
                                    ? `Failed: ${followup.error}`
                                    : followup?.scheduledFor
                                      ? (() => {
                                          const scheduledDate = new Date(followup.scheduledFor);
                                          const isInFuture = isFutureToronto(scheduledDate);
                                          return isInFuture
                                            ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                      : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                  })()
                                : 'Not scheduled'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        followup?.delivered ? 'default' : 
                        followup?.sent ? 'secondary' :
                        willNotSend ? 'destructive' :
                        followup?.error ? 'destructive' :
                        followup?.scheduledFor ? 'secondary' : 
                        'outline'
                      }>
                        {followup?.delivered ? 'Delivered' : 
                         followup?.sent ? 'Sent' : 
                         willNotSend ? 'Cancelled' :
                         followup?.error ? 'Failed' :
                         followup?.scheduledFor ? 'Scheduled' : 
                         'Not Scheduled'}
                      </Badge>
                    </div>
                  );
                })()}
          </div>
        </CardContent>
      </Card>

      {/* Follow-up Emails Status Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Follow-up Emails Status
          </CardTitle>
          {(() => {
            // Check if advance payment has been made
            const hasAdvancePayment = quote.paymentDetails && 
              (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
            
            if (hasAdvancePayment) {
              return (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Follow-up emails are not sent for bookings with advance payment. Since payment has been made, no follow-up emails will be sent.
                  </p>
                </div>
              );
            }
            
            if (quote.status === 'confirmed') {
              return (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Follow-up emails are not sent for confirmed bookings.
                  </p>
                </div>
              );
            }
            
            if (nextEmail) {
              return (
                <p className="text-sm text-muted-foreground mt-2">
                  Next email will be sent in: <strong className="text-primary">{formatDistanceToNowToronto(new Date(nextEmail.scheduledFor!))}</strong>
                </p>
              );
            }
            
            return null;
          })()}
        </CardHeader>
        <CardContent>
          {isLoadingEmailStatus ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : emailStatus ? (
            <div className="space-y-3">
              {/* Email 1 - Initial Quote Email */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {emailStatus.initial?.sent ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Email 1 - Initial Quote</p>
                    <p className="text-sm text-muted-foreground">
                      {emailStatus.initial?.sent 
                        ? emailStatus.initial?.sentAt 
                          ? `Sent on ${formatToronto(new Date(emailStatus.initial.sentAt), 'PPp')}`
                          : 'Sent'
                        : 'Not sent'}
                    </p>
                  </div>
                </div>
                <Badge variant={emailStatus.initial?.sent ? 'default' : 'secondary'}>
                  {emailStatus.initial?.sent ? 'Sent' : 'Pending'}
                </Badge>
              </div>

              {/* Email 2 - 3H Follow-up */}
              {(() => {
                const hasAdvancePayment = quote.paymentDetails && 
                  (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                const willNotSend = hasAdvancePayment || quote.status === 'confirmed';
                
                return (
                  <div className={`flex items-center justify-between p-3 border rounded-lg ${nextEmail?.type === 'followup-3h' ? 'border-black bg-gray-50' : willNotSend ? 'bg-muted/50' : ''}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0">
                        {emailStatus['followup-3h']?.sent ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : willNotSend ? (
                          <XCircle className="h-5 w-5 text-orange-500" />
                        ) : emailStatus['followup-3h']?.scheduledFor && isFutureToronto(new Date(emailStatus['followup-3h'].scheduledFor)) ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Email 2 - 3 Hour Follow-up</p>
                          {nextEmail?.type === 'followup-3h' && !willNotSend && (
                            <Badge variant="outline" className="text-xs">Next</Badge>
                          )}
                          {willNotSend && (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Cancelled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {emailStatus['followup-3h']?.sent 
                            ? emailStatus['followup-3h']?.sentAt 
                              ? `Sent on ${formatToronto(new Date(emailStatus['followup-3h'].sentAt), 'PPp')}`
                              : 'Sent'
                            : willNotSend
                              ? hasAdvancePayment 
                                ? 'Cancelled - Advance payment made'
                                : 'Cancelled - Booking confirmed'
                              : emailStatus['followup-3h']?.scheduledFor
                                ? (() => {
                                    const scheduledDate = new Date(emailStatus['followup-3h'].scheduledFor);
                                    const isInFuture = isFutureToronto(scheduledDate);
                                    return isInFuture
                                      ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                      : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                  })()
                                : 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        emailStatus['followup-3h']?.sent ? 'default' : 
                        willNotSend ? 'destructive' :
                        emailStatus['followup-3h']?.scheduledFor ? 'secondary' : 
                        'outline'
                      }>
                        {emailStatus['followup-3h']?.sent ? 'Sent' : 
                         willNotSend ? 'Cancelled' :
                         emailStatus['followup-3h']?.scheduledFor ? 'Scheduled' : 
                         'Not Scheduled'}
                      </Badge>
                    </div>
                  </div>
                );
              })()}

              {/* Email 3 - 6H Follow-up */}
              {(() => {
                const hasAdvancePayment = quote.paymentDetails && 
                  (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                const willNotSend = hasAdvancePayment || quote.status === 'confirmed';
                
                return (
                  <div className={`flex items-center justify-between p-3 border rounded-lg ${nextEmail?.type === 'followup-6h' ? 'border-black bg-gray-50' : willNotSend ? 'bg-muted/50' : ''}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0">
                        {emailStatus['followup-6h']?.sent ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : willNotSend ? (
                          <XCircle className="h-5 w-5 text-orange-500" />
                        ) : emailStatus['followup-6h']?.scheduledFor && isFutureToronto(new Date(emailStatus['followup-6h'].scheduledFor)) ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Email 3 - 6 Hour Follow-up</p>
                          {nextEmail?.type === 'followup-6h' && !willNotSend && (
                            <Badge variant="outline" className="text-xs">Next</Badge>
                          )}
                          {willNotSend && (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Cancelled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {emailStatus['followup-6h']?.sent 
                            ? emailStatus['followup-6h']?.sentAt 
                              ? `Sent on ${formatToronto(new Date(emailStatus['followup-6h'].sentAt), 'PPp')}`
                              : 'Sent'
                            : willNotSend
                              ? hasAdvancePayment 
                                ? 'Cancelled - Advance payment made'
                                : 'Cancelled - Booking confirmed'
                              : emailStatus['followup-6h']?.scheduledFor
                                ? (() => {
                                    const scheduledDate = new Date(emailStatus['followup-6h'].scheduledFor);
                                    const isInFuture = isFutureToronto(scheduledDate);
                                    return isInFuture
                                      ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                      : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                  })()
                                : 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        emailStatus['followup-6h']?.sent ? 'default' : 
                        willNotSend ? 'destructive' :
                        emailStatus['followup-6h']?.scheduledFor ? 'secondary' : 
                        'outline'
                      }>
                        {emailStatus['followup-6h']?.sent ? 'Sent' : 
                         willNotSend ? 'Cancelled' :
                         emailStatus['followup-6h']?.scheduledFor ? 'Scheduled' : 
                         'Not Scheduled'}
                      </Badge>
                    </div>
                  </div>
                );
              })()}

              {/* Email 4 - 24H Follow-up */}
              {(() => {
                const hasAdvancePayment = quote.paymentDetails && 
                  (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                const willNotSend = hasAdvancePayment || quote.status === 'confirmed';
                
                return (
                  <div className={`flex items-center justify-between p-3 border rounded-lg ${nextEmail?.type === 'followup-24h' ? 'border-black bg-gray-50' : willNotSend ? 'bg-muted/50' : ''}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0">
                        {emailStatus['followup-24h']?.sent ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : willNotSend ? (
                          <XCircle className="h-5 w-5 text-orange-500" />
                        ) : emailStatus['followup-24h']?.scheduledFor && isFutureToronto(new Date(emailStatus['followup-24h'].scheduledFor)) ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : emailStatus['followup-24h']?.scheduledFor && !isFutureToronto(new Date(emailStatus['followup-24h'].scheduledFor)) && !emailStatus['followup-24h']?.sent ? (
                          <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Email 4 - 24 Hour Follow-up</p>
                          {nextEmail?.type === 'followup-24h' && !willNotSend && (
                            <Badge variant="outline" className="text-xs">Next</Badge>
                          )}
                          {willNotSend && (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Cancelled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {emailStatus['followup-24h']?.sent 
                            ? emailStatus['followup-24h']?.sentAt 
                              ? `Sent on ${formatToronto(new Date(emailStatus['followup-24h'].sentAt), 'PPp')}`
                              : 'Sent'
                            : willNotSend
                              ? hasAdvancePayment 
                                ? 'Cancelled - Advance payment made'
                                : 'Cancelled - Booking confirmed'
                              : emailStatus['followup-24h']?.scheduledFor
                                ? (() => {
                                    const scheduledDate = new Date(emailStatus['followup-24h'].scheduledFor);
                                    const isInFuture = isFutureToronto(scheduledDate);
                                    return isInFuture
                                      ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                      : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                  })()
                                : 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        emailStatus['followup-24h']?.sent ? 'default' : 
                        willNotSend ? 'destructive' :
                        emailStatus['followup-24h']?.scheduledFor ? 'secondary' : 
                        'outline'
                      }>
                        {emailStatus['followup-24h']?.sent ? 'Sent' : 
                         willNotSend ? 'Cancelled' :
                         emailStatus['followup-24h']?.scheduledFor ? 'Scheduled' : 
                         'Not Scheduled'}
                      </Badge>
                    </div>
                  </div>
                );
              })()}

              {/* Email 3 - 3D Follow-up */}
              {(() => {
                const hasAdvancePayment = quote.paymentDetails && 
                  (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                const willNotSend = hasAdvancePayment || quote.status === 'confirmed';
                
                return (
                  <div className={`flex items-center justify-between p-3 border rounded-lg ${nextEmail?.type === 'followup-3d' ? 'border-black bg-gray-50' : willNotSend ? 'bg-muted/50' : ''}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0">
                        {emailStatus['followup-3d']?.sent ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : willNotSend ? (
                          <XCircle className="h-5 w-5 text-orange-500" />
                        ) : emailStatus['followup-3d']?.scheduledFor && isFutureToronto(new Date(emailStatus['followup-3d'].scheduledFor)) ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : emailStatus['followup-3d']?.scheduledFor && !isFutureToronto(new Date(emailStatus['followup-3d'].scheduledFor)) && !emailStatus['followup-3d']?.sent ? (
                          <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Email 5 - 3 Day Follow-up</p>
                          {nextEmail?.type === 'followup-3d' && !willNotSend && (
                            <Badge variant="outline" className="text-xs">Next</Badge>
                          )}
                          {willNotSend && (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Cancelled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {emailStatus['followup-3d']?.sent 
                            ? emailStatus['followup-3d']?.sentAt 
                              ? `Sent on ${formatToronto(new Date(emailStatus['followup-3d'].sentAt), 'PPp')}`
                              : 'Sent'
                            : willNotSend
                              ? hasAdvancePayment 
                                ? 'Cancelled - Advance payment made'
                                : 'Cancelled - Booking confirmed'
                              : emailStatus['followup-3d']?.scheduledFor
                                ? (() => {
                                    const scheduledDate = new Date(emailStatus['followup-3d'].scheduledFor);
                                    const isInFuture = isFutureToronto(scheduledDate);
                                    return isInFuture
                                      ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                      : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                  })()
                                : 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        emailStatus['followup-3d']?.sent ? 'default' : 
                        willNotSend ? 'destructive' :
                        emailStatus['followup-3d']?.scheduledFor ? 'secondary' : 
                        'outline'
                      }>
                        {emailStatus['followup-3d']?.sent ? 'Sent' : 
                         willNotSend ? 'Cancelled' :
                         emailStatus['followup-3d']?.scheduledFor ? 'Scheduled' : 
                         'Not Scheduled'}
                      </Badge>
                    </div>
                  </div>
                );
              })()}

              {/* Email 4 - 6D Follow-up */}
              {(() => {
                const hasAdvancePayment = quote.paymentDetails && 
                  (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                const willNotSend = hasAdvancePayment || quote.status === 'confirmed';
                
                return (
                  <div className={`flex items-center justify-between p-3 border rounded-lg ${nextEmail?.type === 'followup-6d' ? 'border-black bg-gray-50' : willNotSend ? 'bg-muted/50' : ''}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0">
                        {emailStatus['followup-6d']?.sent ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : willNotSend ? (
                          <XCircle className="h-5 w-5 text-orange-500" />
                        ) : emailStatus['followup-6d']?.scheduledFor && isFutureToronto(new Date(emailStatus['followup-6d'].scheduledFor)) ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : emailStatus['followup-6d']?.scheduledFor && !isFutureToronto(new Date(emailStatus['followup-6d'].scheduledFor)) && !emailStatus['followup-6d']?.sent ? (
                          <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Email 6 - 6 Day Follow-up (5% Discount)</p>
                          {nextEmail?.type === 'followup-6d' && !willNotSend && (
                            <Badge variant="outline" className="text-xs">Next</Badge>
                          )}
                          {willNotSend && (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Cancelled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {emailStatus['followup-6d']?.sent 
                            ? emailStatus['followup-6d']?.sentAt 
                              ? `Sent on ${formatToronto(new Date(emailStatus['followup-6d'].sentAt), 'PPp')}`
                              : 'Sent'
                            : willNotSend
                              ? hasAdvancePayment 
                                ? 'Cancelled - Advance payment made'
                                : 'Cancelled - Booking confirmed'
                              : emailStatus['followup-6d']?.scheduledFor
                                ? (() => {
                                    const scheduledDate = new Date(emailStatus['followup-6d'].scheduledFor);
                                    const isInFuture = isFutureToronto(scheduledDate);
                                    return isInFuture
                                      ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                      : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                  })()
                                : 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        emailStatus['followup-6d']?.sent ? 'default' : 
                        willNotSend ? 'destructive' :
                        emailStatus['followup-6d']?.scheduledFor ? 'secondary' : 
                        'outline'
                      }>
                        {emailStatus['followup-6d']?.sent ? 'Sent' : 
                         willNotSend ? 'Cancelled' :
                         emailStatus['followup-6d']?.scheduledFor ? 'Scheduled' : 
                         'Not Scheduled'}
                      </Badge>
                    </div>
                  </div>
                );
              })()}

              {/* Email 7 - 30D Follow-up */}
              {(() => {
                const hasAdvancePayment = quote.paymentDetails && 
                  (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                const willNotSend = hasAdvancePayment || quote.status === 'confirmed';
                
                return (
                  <div className={`flex items-center justify-between p-3 border rounded-lg ${nextEmail?.type === 'followup-30d' ? 'border-black bg-gray-50' : willNotSend ? 'bg-muted/50' : ''}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0">
                        {emailStatus['followup-30d']?.sent ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : willNotSend ? (
                          <XCircle className="h-5 w-5 text-orange-500" />
                        ) : emailStatus['followup-30d']?.scheduledFor && isFutureToronto(new Date(emailStatus['followup-30d'].scheduledFor)) ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : emailStatus['followup-30d']?.scheduledFor && !isFutureToronto(new Date(emailStatus['followup-30d'].scheduledFor)) && !emailStatus['followup-30d']?.sent ? (
                          <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Email 7 - 30 Day Follow-up</p>
                          {nextEmail?.type === 'followup-30d' && !willNotSend && (
                            <Badge variant="outline" className="text-xs">Next</Badge>
                          )}
                          {willNotSend && (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Cancelled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {emailStatus['followup-30d']?.sent 
                            ? emailStatus['followup-30d']?.sentAt 
                              ? `Sent on ${formatToronto(new Date(emailStatus['followup-30d'].sentAt), 'PPp')}`
                              : 'Sent'
                            : willNotSend
                              ? hasAdvancePayment 
                                ? 'Cancelled - Advance payment made'
                                : 'Cancelled - Booking confirmed'
                              : emailStatus['followup-30d']?.scheduledFor
                                ? (() => {
                                    const scheduledDate = new Date(emailStatus['followup-30d'].scheduledFor);
                                    const isInFuture = isFutureToronto(scheduledDate);
                                    return isInFuture
                                      ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                      : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                  })()
                                : 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        emailStatus['followup-30d']?.sent ? 'default' : 
                        willNotSend ? 'destructive' :
                        emailStatus['followup-30d']?.scheduledFor ? 'secondary' : 
                        'outline'
                      }>
                        {emailStatus['followup-30d']?.sent ? 'Sent' : 
                         willNotSend ? 'Cancelled' :
                         emailStatus['followup-30d']?.scheduledFor ? 'Scheduled' : 
                         'Not Scheduled'}
                      </Badge>
                    </div>
                  </div>
                );
              })()}

              {/* Email 8 - Event Reminder 24H (only for confirmed bookings with payment) */}
              {(() => {
                const hasAdvancePayment = quote.paymentDetails && 
                  (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                const isConfirmed = quote.status === 'confirmed';
                const shouldShow = isConfirmed && hasAdvancePayment;
                
                if (!shouldShow) return null;
                
                return (
                  <div className={`flex items-center justify-between p-3 border rounded-lg ${nextEmail?.type === 'event-reminder-24h' ? 'border-black bg-gray-50' : ''}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0">
                        {emailStatus['event-reminder-24h']?.sent ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : emailStatus['event-reminder-24h']?.scheduledFor && isFutureToronto(new Date(emailStatus['event-reminder-24h'].scheduledFor)) ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Email 5 - Event Reminder (24 Hours Before Event)</p>
                          {nextEmail?.type === 'event-reminder-24h' && (
                            <Badge variant="outline" className="text-xs">Next</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {emailStatus['event-reminder-24h']?.sent 
                            ? emailStatus['event-reminder-24h']?.sentAt 
                              ? `Sent on ${formatToronto(new Date(emailStatus['event-reminder-24h'].sentAt), 'PPp')}`
                              : 'Sent'
                            : emailStatus['event-reminder-24h']?.scheduledFor
                              ? (() => {
                                  const scheduledDate = new Date(emailStatus['event-reminder-24h'].scheduledFor);
                                  const isInFuture = isFutureToronto(scheduledDate);
                                  return isInFuture
                                    ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                    : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                })()
                              : 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        emailStatus['event-reminder-24h']?.sent ? 'default' : 
                        emailStatus['event-reminder-24h']?.scheduledFor ? 'secondary' : 
                        'outline'
                      }>
                        {emailStatus['event-reminder-24h']?.sent ? 'Sent' : 
                         emailStatus['event-reminder-24h']?.scheduledFor ? 'Scheduled' : 
                         'Not Scheduled'}
                      </Badge>
                    </div>
                  </div>
                );
              })()}
              
              {/* Appointment Day Reminder Email - Only show if booking is confirmed and has advance payment */}
              {(() => {
                const hasAdvancePayment = quote.paymentDetails && 
                  (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                const isConfirmed = quote.status === 'confirmed';
                
                if (!isConfirmed || !hasAdvancePayment || !emailStatus) return null;
                
                return (
                  <div className={`flex items-center justify-between p-3 border rounded-lg ${nextEmail?.type === 'appointment-day-reminder' ? 'border-black bg-gray-50' : ''}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0">
                        {emailStatus['appointment-day-reminder']?.sent ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : emailStatus['appointment-day-reminder']?.scheduledFor && isFutureToronto(new Date(emailStatus['appointment-day-reminder'].scheduledFor)) ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Email 6 - Appointment Day Reminder (2.5 Hours Before Appointment)</p>
                          {nextEmail?.type === 'appointment-day-reminder' && (
                            <Badge variant="outline" className="text-xs">Next</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {emailStatus['appointment-day-reminder']?.sent 
                            ? emailStatus['appointment-day-reminder']?.sentAt 
                              ? `Sent on ${formatToronto(new Date(emailStatus['appointment-day-reminder'].sentAt), 'PPp')}`
                              : 'Sent'
                            : emailStatus['appointment-day-reminder']?.scheduledFor
                              ? (() => {
                                  const scheduledDate = new Date(emailStatus['appointment-day-reminder'].scheduledFor);
                                  const isInFuture = isFutureToronto(scheduledDate);
                                  return isInFuture
                                    ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                    : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                })()
                              : 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        emailStatus['appointment-day-reminder']?.sent ? 'default' : 
                        emailStatus['appointment-day-reminder']?.scheduledFor ? 'secondary' : 
                        'outline'
                      }>
                        {emailStatus['appointment-day-reminder']?.sent ? 'Sent' : 
                         emailStatus['appointment-day-reminder']?.scheduledFor ? 'Scheduled' : 
                         'Not Scheduled'}
                      </Badge>
                    </div>
                  </div>
                );
              })()}
              
              {/* Post-Appointment Follow-up Email - Only show if booking is confirmed and has advance payment */}
              {(() => {
                const hasAdvancePayment = quote.paymentDetails && 
                  (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                const isConfirmed = quote.status === 'confirmed';
                
                if (!isConfirmed || !hasAdvancePayment || !emailStatus) return null;
                
                return (
                  <div className={`flex items-center justify-between p-3 border rounded-lg ${nextEmail?.type === 'post-appointment-followup' ? 'border-black bg-gray-50' : ''}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0">
                        {emailStatus['post-appointment-followup']?.sent ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : emailStatus['post-appointment-followup']?.scheduledFor && isFutureToronto(new Date(emailStatus['post-appointment-followup'].scheduledFor)) ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Email 7 - Post-Appointment Follow-up (6 Hours After Appointment)</p>
                          {nextEmail?.type === 'post-appointment-followup' && (
                            <Badge variant="outline" className="text-xs">Next</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {emailStatus['post-appointment-followup']?.sent 
                            ? emailStatus['post-appointment-followup']?.sentAt 
                              ? `Sent on ${formatToronto(new Date(emailStatus['post-appointment-followup'].sentAt), 'PPp')}`
                              : 'Sent'
                            : emailStatus['post-appointment-followup']?.scheduledFor
                              ? (() => {
                                  const scheduledDate = new Date(emailStatus['post-appointment-followup'].scheduledFor);
                                  const isInFuture = isFutureToronto(scheduledDate);
                                  return isInFuture
                                    ? `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (in ${formatDistanceToNowToronto(scheduledDate)})`
                                    : `Scheduled for ${formatToronto(scheduledDate, 'PPp')} (overdue)`;
                                })()
                              : 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        emailStatus['post-appointment-followup']?.sent ? 'default' : 
                        emailStatus['post-appointment-followup']?.scheduledFor ? 'secondary' : 
                        'outline'
                      }>
                        {emailStatus['post-appointment-followup']?.sent ? 'Sent' : 
                         emailStatus['post-appointment-followup']?.scheduledFor ? 'Scheduled' : 
                         'Not Scheduled'}
                      </Badge>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load email status</p>
          )}
        </CardContent>
      </Card>

       {/* Invoice Generator */}
       {bookingDoc && quote.selectedQuote && (
         <InvoiceGenerator booking={bookingDoc} />
       )}

       <div className="pt-6 border-t mt-6 flex flex-wrap gap-4 items-center">
            {/* Send to Artist Section */}
            {artists.length > 0 && (
              <Dialog open={showSendToArtistDialog} onOpenChange={setShowSendToArtistDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto" disabled={isActionPending}>
                    <Send className="mr-2 h-4 w-4" />
                    Send to Artist
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Send Booking Details to Artist</DialogTitle>
                    <DialogDescription>
                      Select an artist and choose how to send the booking details (without pricing information).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {artists.map((artist) => (
                      <div key={artist.id} className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{artist.name}</p>
                            <p className="text-sm text-muted-foreground">{artist.email}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={async () => {
                              if (!artist.id) return;
                              setIsSendingToArtist(artist.id);
                              try {
                                const res = await fetch('/api/artists/send-booking', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    artistId: artist.id,
                                    bookingId: quote.id,
                                    method: 'email',
                                  }),
                                });

                                const data = await res.json();
                                if (!res.ok) {
                                  throw new Error(data.error || 'Failed to send email');
                                }

                                toast({
                                  title: 'Email Sent!',
                                  description: `Booking details sent to ${artist.name} via email.`,
                                });
                                setShowSendToArtistDialog(false);
                              } catch (error: any) {
                                toast({
                                  variant: 'destructive',
                                  title: 'Error',
                                  description: error.message || 'Failed to send email.',
                                });
                              } finally {
                                setIsSendingToArtist(null);
                              }
                            }}
                            disabled={isSendingToArtist === artist.id}
                          >
                            {isSendingToArtist === artist.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Mail className="mr-2 h-4 w-4" />
                                Email
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={async () => {
                              if (!artist.id) return;
                              setIsSendingToArtist(artist.id);
                              try {
                                const res = await fetch('/api/artists/send-booking', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    artistId: artist.id,
                                    bookingId: quote.id,
                                    method: 'whatsapp',
                                  }),
                                });

                                const data = await res.json();
                                if (!res.ok) {
                                  throw new Error(data.error || 'Failed to generate WhatsApp link');
                                }

                                // Open WhatsApp link in new tab
                                if (data.whatsappLink) {
                                  window.open(data.whatsappLink, '_blank');
                                  toast({
                                    title: 'WhatsApp Opened!',
                                    description: `WhatsApp link opened for ${artist.name}.`,
                                  });
                                }
                                setShowSendToArtistDialog(false);
                              } catch (error: any) {
                                toast({
                                  variant: 'destructive',
                                  title: 'Error',
                                  description: error.message || 'Failed to generate WhatsApp link.',
                                });
                              } finally {
                                setIsSendingToArtist(null);
                              }
                            }}
                            disabled={isSendingToArtist === artist.id}
                          >
                            {isSendingToArtist === artist.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                WhatsApp
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={async () => {
                              if (!artist.id) return;
                              setIsSendingToArtist(artist.id);
                              try {
                                const res = await fetch('/api/artists/send-booking', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    artistId: artist.id,
                                    bookingId: quote.id,
                                    method: 'calendar',
                                  }),
                                });

                                const data = await res.json();
                                if (!res.ok) {
                                  throw new Error(data.error || 'Failed to generate calendar event');
                                }

                                // Download ICS file
                                if (data.icsContent) {
                                  const blob = new Blob([data.icsContent], { type: 'text/calendar' });
                                  const url = window.URL.createObjectURL(blob);
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = data.filename || `booking-${quote.id}.ics`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  window.URL.revokeObjectURL(url);

                                  toast({
                                    title: 'Calendar Event Downloaded!',
                                    description: `Calendar event file downloaded. You can send it to ${artist.name} or add it to your calendar.`,
                                  });
                                }
                                setShowSendToArtistDialog(false);
                              } catch (error: any) {
                                toast({
                                  variant: 'destructive',
                                  title: 'Error',
                                  description: error.message || 'Failed to generate calendar event.',
                                });
                              } finally {
                                setIsSendingToArtist(null);
                              }
                            }}
                            disabled={isSendingToArtist === artist.id}
                          >
                            {isSendingToArtist === artist.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <Calendar className="mr-2 h-4 w-4" />
                                Calendar
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowSendToArtistDialog(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full md:w-auto" disabled={isActionPending}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Booking
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the booking
                            for <strong>{quote.contact.name}</strong> (ID: {quote.id}).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                             {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Yes, delete booking
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>

        {/* Hidden contract display for PDF generation */}
        {quote.contractSignedDate && quote.selectedQuote && (
          <div id={`contract-display-${quote.id}`} className="hidden">
            <ContractDisplay 
              quote={quote} 
              selectedTier={quote.selectedQuote} 
              signedDate={quote.contractSignedDate}
            />
          </div>
        )}
    </div>
  );
}
