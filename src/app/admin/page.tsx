
'use client';

import { useEffect, useState, useMemo } from 'react';
import type { BookingDocument } from '@/firebase/firestore/bookings';
import type { PaymentStatus, PaymentDetails } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
} from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle, Eye, Search, CalendarClock, Users, RefreshCw, FileText, CheckCircle2, Clock, XCircle, DollarSign, TrendingUp, CreditCard, Wallet, Receipt, X, Settings, Trash2, Menu, Filter, Plus } from 'lucide-react';
import { AdminSettings } from '@/components/admin-settings';
import { ManualBookingForm } from '@/components/admin/manual-booking-form';
import { formatToronto, differenceInDaysToronto, parseToronto, getTorontoToday, getTorontoNow } from '@/lib/toronto-time';
import { BookingDetails } from '@/components/booking-details';
import { Input } from '@/components/ui/input';
import type { FinalQuote } from '@/lib/types';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { formatPrice } from '@/lib/price-format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileLayout } from '@/components/admin/mobile-layout';
import { StatusChips } from '@/components/admin/status-chips';
import { BookingCard } from '@/components/admin/booking-card';
import { CalendarView } from '@/components/admin/calendar-view';
import { AdvancedFilters, applyFilters, countActiveFilters, type FilterState } from '@/components/admin/advanced-filters';
import { exportBookingsToCSV, exportBookingsToExcel, exportBookingsToPDF } from '@/lib/export-utils';
import { Calendar as CalendarIcon, Download, FileDown, FileSpreadsheet, List } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function getPaymentStatus(status: PaymentStatus | undefined, method?: 'stripe' | 'interac'): { text: string; variant: 'secondary' | 'destructive' | 'default' } {
    switch (status) {
        case 'deposit-pending':
            // Show "Pending Payment Approval" for Interac, "Deposit Pending" for Stripe
            return { text: method === 'interac' ? 'Pending Payment Approval' : 'Deposit Pending', variant: 'secondary' };
        case 'payment-approved':
            return { text: 'Payment Approved', variant: 'default' };
        case 'screenshot-rejected':
            return { text: 'Screenshot Rejected', variant: 'destructive' };
        case 'deposit-paid':
            return { text: 'Paid', variant: 'default' };
        default:
            return { text: 'Not Paid', variant: 'destructive' };
    }
}

function getFinalPaymentStatus(finalPayment: PaymentDetails['finalPayment']): { text: string; variant: 'secondary' | 'destructive' | 'default' } | null {
    if (!finalPayment || !finalPayment.status) {
        return null;
    }
    return getPaymentStatus(finalPayment.status, finalPayment.method);
}


export default function AdminDashboard() {
  const [bookings, setBookings] = useState<BookingDocument[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<BookingDocument | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [showWelcome, setShowWelcome] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(getTorontoNow()); // Track current time for real-time updates
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '3d' | '7d'>('all'); // Time filter for quotes
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list'); // View mode toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    dateRange: { from: null, to: null },
    amountRange: { min: '', max: '' },
    paymentMethod: 'all',
    serviceType: 'all',
    status: 'all',
    searchTerm: '',
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [showManualBookingDialog, setShowManualBookingDialog] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  // Update current time every minute for real-time day calculations
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(getTorontoNow());
    }, 60000); // Update every minute
    return () => clearInterval(timeInterval);
  }, []);

  // Real-time function to calculate days until event
  // This updates dynamically based on currentTime state
  const getTimeToEvent = useMemo(() => {
    return (eventDateStr: string): string => {
      try {
        const eventDate = parseToronto(eventDateStr, 'PPP');
        if (isNaN(eventDate.getTime())) {
          return "Invalid date";
        }
        // Use current time state to calculate today's date dynamically
        const todayDate = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
        const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        const days = differenceInDaysToronto(eventDateOnly, todayDate);

        if (days < 0) {
          return `Passed`;
        }
        if (days === 0) {
          return "Today";
        }
        if (days === 1) {
          return "Tomorrow";
        }
        return `${days} days`;
      } catch (e) {
        return "Invalid date";
      }
    };
  }, [currentTime]); // Recalculate when currentTime changes

  // Check if welcome message should be shown (only once after login)
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('lba_welcome_shown');
    if (!hasSeenWelcome) {
      setShowWelcome(true);
      localStorage.setItem('lba_welcome_shown', 'true');
    }
  }, []);

  // Auto-fix WhatsApp reminders for all existing bookings (runs once per session)
  useEffect(() => {
    const hasFixedWhatsAppReminders = sessionStorage.getItem('lba_whatsapp_reminders_fixed');
    if (!hasFixedWhatsAppReminders) {
      // Run the fix endpoint in the background (non-blocking)
      fetch('/api/admin/schedule-all-bookings-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            console.log('[Auto-Fix] WhatsApp reminders scheduled:', result);
            sessionStorage.setItem('lba_whatsapp_reminders_fixed', 'true');
          }
        })
        .catch(error => {
          console.error('[Auto-Fix] Failed to schedule WhatsApp reminders:', error);
          // Don't set the flag on error so it can retry
        });
    }
  }, []);

  // Fetch bookings from API
  const fetchBookings = async (showLoading = false) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const res = await fetch('/api/bookings', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to fetch bookings');
      }
      const { bookings: fetchedBookings } = await res.json();
      setBookings(fetchedBookings);
      setError(null);
      setIsLoading(false);
      
      // Update selected booking if it exists
      setSelectedBooking(current => {
        if (current && fetchedBookings) {
          const updated = fetchedBookings.find((b: BookingDocument) => b.id === current.id);
          if (updated) {
            return updated;
          }
        }
        return current;
      });
    } catch (err: any) {
      setError(err);
      setIsLoading(false);
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let intervalId: NodeJS.Timeout;

    // Initial fetch
    fetchBookings();

    // Poll for updates every 5 seconds
    intervalId = setInterval(() => {
      if (mounted) {
        fetchBookings(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update current time every 24 hours for real-time day calculations
  // This ensures days remaining updates accurately for all current bookings
  useEffect(() => {
    // Initial update to apply to all current bookings immediately
    setCurrentTime(getTorontoNow());
    
    // Update every 24 hours (86400000 milliseconds)
    const timeInterval = setInterval(() => {
      setCurrentTime(getTorontoNow());
    }, 86400000); // Update every 24 hours
    
    return () => clearInterval(timeInterval);
  }, []);

  // Auto-hide welcome message after 4 seconds
  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => {
        setShowWelcome(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  const sortedBookings = useMemo(() => {
    if (!bookings) return [];
    return [...bookings].sort((a, b) => {
        // Handle both Date objects and Firestore Timestamps
        const dateA = a.createdAt instanceof Date ? a.createdAt : (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0));
        const dateB = b.createdAt instanceof Date ? b.createdAt : (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0));
        return dateB.getTime() - dateA.getTime(); // Sort descending (newest first)
    });
  }, [bookings]);

  // Categorize bookings by status
  // Uses currentTime for real-time categorization
  const categorizedBookings = useMemo(() => {
    if (!sortedBookings) return {
      all: [],
      quoted: [],
      pendingPayment: [],
      confirmed: [],
      completed: [],
      cancelled: [],
    };

    // Use currentTime to calculate today's date dynamically
    const today = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());

    return {
      all: sortedBookings,
      quoted: sortedBookings.filter(booking => {
        const status = booking.finalQuote.status;
        const paymentStatus = booking.finalQuote.paymentDetails?.status;
        return status === 'quoted' && !paymentStatus;
      }),
      pendingPayment: sortedBookings.filter(booking => {
        const paymentStatus = booking.finalQuote.paymentDetails?.status;
        return paymentStatus === 'deposit-pending' || paymentStatus === 'screenshot-rejected';
      }),
      confirmed: sortedBookings.filter(booking => {
        const status = booking.finalQuote.status;
        const paymentStatus = booking.finalQuote.paymentDetails?.status;
        const isConfirmed = status === 'confirmed' || paymentStatus === 'payment-approved' || paymentStatus === 'deposit-paid';
        if (!isConfirmed) return false;
        
        // Check if event date has passed
        try {
          const dateStr = booking.finalQuote.booking.days[0]?.date;
          if (!dateStr) {
            return true; // No date, include in confirmed
          }
          const eventDate = parseToronto(dateStr, 'PPP');
          if (!isNaN(eventDate.getTime())) {
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= today; // Event hasn't passed yet
          }
        } catch (e) {
          // If date parsing fails, include it in confirmed
        }
        return true;
      }),
      completed: sortedBookings.filter(booking => {
        const status = booking.finalQuote.status;
        const paymentStatus = booking.finalQuote.paymentDetails?.status;
        const isConfirmed = status === 'confirmed' || paymentStatus === 'payment-approved' || paymentStatus === 'deposit-paid';
        if (!isConfirmed) return false;
        
        // Check if event date has passed
        try {
          const dateStr = booking.finalQuote.booking.days[0]?.date;
          if (!dateStr) {
            return true; // No date, include in confirmed
          }
          const eventDate = parseToronto(dateStr, 'PPP');
          if (!isNaN(eventDate.getTime())) {
            eventDate.setHours(0, 0, 0, 0);
            return eventDate < today; // Event has passed
          }
        } catch (e) {
          return false;
        }
        return false;
      }),
      cancelled: sortedBookings.filter(booking => booking.finalQuote.status === 'cancelled'),
    };
  }, [sortedBookings, currentTime]); // Recalculate when currentTime changes for real-time categorization

  // Helper function to get quote generation date from a booking
  const getQuoteDate = (booking: BookingDocument): Date | null => {
    // Try quoteGeneratedAt first, then fall back to createdAt
    if (booking.finalQuote.quoteGeneratedAt) {
      try {
        const date = new Date(booking.finalQuote.quoteGeneratedAt);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch (e) {
        // Continue to fallback
      }
    }
    
    // Fallback to booking createdAt
    if (booking.createdAt) {
      try {
        if (booking.createdAt instanceof Date) {
          return booking.createdAt;
        } else if (booking.createdAt && typeof booking.createdAt === 'object' && 'toDate' in booking.createdAt) {
          return (booking.createdAt as any).toDate();
        } else if (typeof booking.createdAt === 'string') {
          return new Date(booking.createdAt);
        }
      } catch (e) {
        // Return null if parsing fails
      }
    }
    
    return null;
  };

  const filteredBookings = useMemo(() => {
    let categoryBookings = categorizedBookings[activeTab as keyof typeof categorizedBookings] || categorizedBookings.all;
    
    // Apply time filter
    if (timeFilter !== 'all') {
      const now = currentTime; // Use currentTime state for consistency
      let cutoffDate: Date;
      
      switch (timeFilter) {
        case '24h':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '3d':
          cutoffDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0); // Show all
      }
      
      categoryBookings = categoryBookings.filter(booking => {
        const quoteDate = getQuoteDate(booking);
        if (!quoteDate) return false; // Exclude bookings without a valid date
        return quoteDate >= cutoffDate;
      });
    }
    
    // Apply basic search filter (if advanced filters not active)
    if (!showAdvancedFilters && searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      categoryBookings = categoryBookings.filter(booking => 
        booking.id.toLowerCase().includes(lowercasedTerm) || 
        booking.finalQuote.contact.name.toLowerCase().includes(lowercasedTerm)
      );
    }
    
    // Apply advanced filters if active
    if (showAdvancedFilters) {
      // Merge basic search into advanced filters
      const mergedFilters = {
        ...advancedFilters,
        searchTerm: searchTerm || advancedFilters.searchTerm,
      };
      categoryBookings = applyFilters(categoryBookings, mergedFilters);
    }
    
    return categoryBookings;
  }, [searchTerm, categorizedBookings, activeTab, timeFilter, currentTime, showAdvancedFilters, advancedFilters]);
  
  const activeFilterCount = useMemo(() => {
    if (!showAdvancedFilters) return 0;
    return countActiveFilters({
      ...advancedFilters,
      searchTerm: searchTerm || advancedFilters.searchTerm,
    });
  }, [showAdvancedFilters, advancedFilters, searchTerm]);
  
  const handleResetFilters = () => {
    setAdvancedFilters({
      dateRange: { from: null, to: null },
      amountRange: { min: '', max: '' },
      paymentMethod: 'all',
      serviceType: 'all',
      status: 'all',
      searchTerm: '',
    });
    setSearchTerm('');
    setShowAdvancedFilters(false);
  };
  
  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (filteredBookings.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data',
        description: 'No bookings to export',
      });
      return;
    }
    
    try {
      switch (format) {
        case 'csv':
          exportBookingsToCSV(filteredBookings, 'bookings');
          toast({
            title: 'Export Successful',
            description: 'Bookings exported to CSV',
          });
          break;
        case 'excel':
          await exportBookingsToExcel(filteredBookings, 'bookings');
          toast({
            title: 'Export Successful',
            description: 'Bookings exported to Excel',
          });
          break;
        case 'pdf':
          await exportBookingsToPDF(filteredBookings, 'bookings');
          toast({
            title: 'Export Successful',
            description: 'Bookings exported to PDF',
          });
          break;
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: error.message || 'Failed to export bookings',
      });
    }
  };

  // Calculate accounting metrics
  const accountingMetrics = useMemo(() => {
    if (!sortedBookings) {
      return {
        totalRevenue: 0,
        totalAdvanceReceived: 0,
        totalFinalReceived: 0,
        totalPending: 0,
        totalQuoted: 0,
        stripeRevenue: 0,
        interacRevenue: 0,
        stripeAdvance: 0,
        interacAdvance: 0,
        stripeFinal: 0,
        interacFinal: 0,
        confirmedRevenue: 0,
        completedRevenue: 0,
        transactions: [],
      };
    }

    let totalRevenue = 0;
    let totalAdvanceReceived = 0;
    let totalFinalReceived = 0;
    let totalPending = 0;
    let totalQuoted = 0;
    let stripeRevenue = 0;
    let interacRevenue = 0;
    let stripeAdvance = 0;
    let interacAdvance = 0;
    let stripeFinal = 0;
    let interacFinal = 0;
    let confirmedRevenue = 0;
    let completedRevenue = 0;
    const transactions: Array<{
      id: string;
      customer: string;
      date: string;
      type: 'advance' | 'final';
      amount: number;
      method: 'stripe' | 'interac' | 'pending';
      status: string;
      transactionId?: string;
    }> = [];

    sortedBookings.forEach(booking => {
      const quote = booking.finalQuote;
      const totalAmount = quote.selectedQuote ? quote.quotes[quote.selectedQuote].total : 0;
      const advanceAmount = totalAmount * 0.5;
      const finalAmount = totalAmount * 0.5;

      // Calculate quoted amount (not paid yet)
      if (quote.status === 'quoted' && !quote.paymentDetails?.status) {
        totalQuoted += totalAmount;
      }

      // Advance payment calculations
      if (quote.paymentDetails?.status === 'payment-approved' || quote.paymentDetails?.status === 'deposit-paid') {
        totalAdvanceReceived += advanceAmount;
        totalRevenue += advanceAmount;
        
        if (quote.paymentDetails.method === 'stripe') {
          stripeAdvance += advanceAmount;
          stripeRevenue += advanceAmount;
        } else if (quote.paymentDetails.method === 'interac') {
          interacAdvance += advanceAmount;
          interacRevenue += advanceAmount;
        }

        transactions.push({
          id: quote.id,
          customer: quote.contact.name,
          date: booking.createdAt instanceof Date 
            ? formatToronto(booking.createdAt, 'PPP') 
            : booking.createdAt?.toDate 
            ? formatToronto(booking.createdAt.toDate(), 'PPP') 
            : 'N/A',
          type: 'advance',
          amount: advanceAmount,
          method: quote.paymentDetails.method || 'pending',
          status: 'Paid',
          transactionId: quote.paymentDetails.transactionId,
        });

        if (quote.status === 'confirmed') {
          confirmedRevenue += advanceAmount;
        }
      } else if (quote.paymentDetails?.status === 'deposit-pending' || quote.paymentDetails?.status === 'screenshot-rejected') {
        totalPending += advanceAmount;
      }

      // Final payment calculations
      if (quote.paymentDetails?.finalPayment) {
        const finalPayment = quote.paymentDetails.finalPayment;
        if (finalPayment.status === 'payment-approved' || finalPayment.status === 'deposit-paid') {
          totalFinalReceived += finalAmount;
          totalRevenue += finalAmount;
          
          if (finalPayment.method === 'stripe') {
            stripeFinal += finalAmount;
            stripeRevenue += finalAmount;
          } else if (finalPayment.method === 'interac') {
            interacFinal += finalAmount;
            interacRevenue += finalAmount;
          }

          transactions.push({
            id: quote.id,
            customer: quote.contact.name,
            date: booking.createdAt instanceof Date 
              ? formatToronto(booking.createdAt, 'PPP') 
              : booking.createdAt?.toDate 
              ? formatToronto(booking.createdAt.toDate(), 'PPP') 
              : 'N/A',
            type: 'final',
            amount: finalAmount,
            method: finalPayment.method || 'pending',
            status: 'Paid',
            transactionId: finalPayment.transactionId,
          });

          if (quote.status === 'confirmed') {
            confirmedRevenue += finalAmount;
          }
        } else if (finalPayment.status === 'deposit-pending' || finalPayment.status === 'screenshot-rejected') {
          totalPending += finalAmount;
        }
      }

      // Check if booking is completed (event date passed)
      try {
        const dateStr = quote.booking.days[0]?.date;
        if (!dateStr) {
          return "Invalid date";
        }
        const eventDate = parseToronto(dateStr, 'PPP');
        if (!isNaN(eventDate.getTime())) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          eventDate.setHours(0, 0, 0, 0);
          if (eventDate < today && (quote.paymentDetails?.status === 'payment-approved' || quote.paymentDetails?.status === 'deposit-paid')) {
            completedRevenue += advanceAmount;
            if (quote.paymentDetails?.finalPayment?.status === 'payment-approved' || quote.paymentDetails?.finalPayment?.status === 'deposit-paid') {
              completedRevenue += finalAmount;
            }
          }
        }
      } catch (e) {
        // Ignore date parsing errors
      }
    });

    // Sort transactions by date (newest first)
    // Be defensive: some rows may have "N/A" or other non-date strings
    transactions.sort((a, b) => {
      const safeParse = (value: string) => {
        try {
          return parseToronto(value, 'PPP');
        } catch {
          // Put invalid/unknown dates at the beginning (oldest)
          return new Date(0);
        }
      };
      const dateA = safeParse(a.date);
      const dateB = safeParse(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    return {
      totalRevenue,
      totalAdvanceReceived,
      totalFinalReceived,
      totalPending,
      totalQuoted,
      stripeRevenue,
      interacRevenue,
      stripeAdvance,
      interacAdvance,
      stripeFinal,
      interacFinal,
      confirmedRevenue,
      completedRevenue,
      transactions,
    };
  }, [sortedBookings, formatToronto]);


  const getStatusVariant = (status: BookingDocument['finalQuote']['status']): 'default' | 'destructive' | 'secondary' => {
    switch (status) {
      case 'confirmed':
        return 'default';
      case 'cancelled':
        return 'destructive';
      case 'quoted':
      default:
        return 'secondary';
    }
  };
  
  const handleUpdateBooking = (updatedQuote: FinalQuote) => {
       setSelectedBooking(currentBooking => 
          currentBooking && currentBooking.id === updatedQuote.id ? { ...currentBooking, finalQuote: updatedQuote } : currentBooking
      );
      // Refresh the bookings list to show updated data
      fetchBookings(false);
  }

  const handleBookingDeleted = (bookingId: string) => {
    // Close the dialog and refresh the list
    setSelectedBooking(null);
    // Remove from selected bookings if it was selected
    setSelectedBookings(prev => {
      const newSet = new Set(prev);
      newSet.delete(bookingId);
      return newSet;
    });
    fetchBookings(false);
  };

  // Handle individual booking selection
  const handleBookingSelect = (bookingId: string, checked: boolean) => {
    setSelectedBookings(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(bookingId);
      } else {
        newSet.delete(bookingId);
      }
      return newSet;
    });
  };

  // Handle select all bookings
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredBookings.map(b => b.id));
      setSelectedBookings(allIds);
    } else {
      setSelectedBookings(new Set());
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedBookings.size === 0) return;

    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedBookings).map(bookingId =>
        fetch(`/api/bookings/${bookingId}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.allSettled(deletePromises);
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
      const failed = results.length - successful;

      if (failed === 0) {
        toast({
          title: 'Success',
          description: `Successfully deleted ${successful} booking(s).`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Partial Success',
          description: `Deleted ${successful} booking(s), but ${failed} failed.`,
        });
      }

      // Clear selection and refresh
      setSelectedBookings(new Set());
      setShowDeleteDialog(false);
      fetchBookings(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete bookings',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-muted/40">
        <Loader2 className="h-12 w-12 animate-spin text-black" />
        <p className="mt-4 text-muted-foreground">Loading Bookings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-muted/40 p-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="mt-4 text-xl font-semibold">An Error Occurred</h2>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
        <p className="mt-2 text-xs text-muted-foreground">Please check your connection and try refreshing the page.</p>
      </div>
    );
  }
  

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
  };

  // Handle manual booking success
  const handleManualBookingSuccess = () => {
    setShowManualBookingDialog(false);
    fetchBookings(true);
    toast({ title: 'Success', description: 'Manual booking created successfully' });
  };

  // Header actions
  const headerActions = (
    <>
      <Dialog open={showManualBookingDialog} onOpenChange={setShowManualBookingDialog}>
        <DialogTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
          >
            <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Manual Booking</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[95vw] max-w-[95vw] md:max-w-6xl max-h-[95vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6 pb-3">
            <DialogTitle className="text-base md:text-lg">Create Manual Booking</DialogTitle>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Create a booking manually. No automated emails or messages will be sent.
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 px-4 md:px-6 pb-4 md:pb-6">
            <ManualBookingForm onSuccess={handleManualBookingSuccess} onCancel={() => setShowManualBookingDialog(false)} />
          </div>
        </DialogContent>
      </Dialog>
      {selectedBookings.size > 0 && (
        <>
          <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
            {selectedBookings.size} selected
          </span>
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    <span className="hidden sm:inline">Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Delete ({selectedBookings.size})</span>
                    <span className="sm:hidden">{selectedBookings.size}</span>
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {selectedBookings.size} booking(s). This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel disabled={isDeleting} className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
      {/* Export Dropdown */}
      {filteredBookings.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 sm:h-9 sm:w-9"
              title="Export bookings"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs md:text-sm">
              <FileText className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs md:text-sm">
              <FileSpreadsheet className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              Export Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs md:text-sm">
              <FileDown className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button
        variant="outline"
        size="icon"
        onClick={() => fetchBookings(true)}
        disabled={isRefreshing}
        title="Refresh bookings"
        className="h-8 w-8 sm:h-10 sm:w-10"
      >
        <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </Button>
      <AdminSettings />
    </>
  );

  return (
    <>
      {/* Animated Welcome Message */}
      {showWelcome && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowWelcome(false)}
        >
          <div 
            className="bg-background/95 backdrop-blur-xl border border-gray-300 rounded-2xl shadow-xl p-10 max-w-lg mx-4 animate-slideUp relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowWelcome(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close welcome message"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-white to-gray-50 p-3 shadow-md border border-gray-200 mb-2 animate-zoomIn" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
                <div className="relative w-16 h-16">
                  <Image
                    src="/LBA.png"
                    alt="Looks by Anum Logo"
                    fill
                    className="object-contain"
                    priority
                    sizes="64px"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <h1 className="text-2xl font-headline font-semibold text-foreground tracking-tight animate-fadeInSlideDown" style={{ animationDelay: '0.25s', animationFillMode: 'both' }}>
                  Welcome to Looks by Anum Portal
                </h1>
                <p className="text-sm text-muted-foreground font-light animate-fadeIn" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
                  Managing your bookings and payments
                </p>
              </div>
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground/60 animate-fadeIn" style={{ animationDelay: '0.55s', animationFillMode: 'both' }}>
                  Made by{' '}
                  <a 
                    href="https://www.instagram.com/sellayadigital" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-gray-700 hover:text-black transition-colors font-medium"
                  >
                    Sellaya
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <MobileLayout
        title="Bookings Management"
        headerActions={headerActions}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      >
        <div className="flex flex-col gap-4 p-4 md:p-6">
          {/* View Toggle & Filters Section */}
          <div className="flex flex-col gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 md:h-9 text-xs md:text-sm"
                >
                  <List className="mr-1.5 h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">List</span>
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className="h-8 md:h-9 text-xs md:text-sm"
                >
                  <CalendarIcon className="mr-1.5 h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Calendar</span>
                </Button>
              </div>
              <Button
                variant={showAdvancedFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="h-8 md:h-9 text-xs md:text-sm"
              >
                <Filter className="mr-1.5 h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Basic Filters (when advanced filters not shown) */}
            {!showAdvancedFilters && (
              <Card className="rounded-xl border border-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base md:text-lg">Bookings Management</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Organize and manage all your bookings by status. Sorted by newest first.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={timeFilter} onValueChange={(value: 'all' | '24h' | '3d' | '7d') => setTimeFilter(value)}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="24h">Last 24 Hours</SelectItem>
                        <SelectItem value="3d">Last 3 Days</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search by name or ID..."
                        className="w-full rounded-lg bg-background pl-9 md:pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <AdvancedFilters
                filters={advancedFilters}
                onFiltersChange={setAdvancedFilters}
                onReset={handleResetFilters}
                activeFilterCount={activeFilterCount}
              />
            )}
          </div>

          {/* Status Chips - Mobile First */}
          {viewMode === 'list' && (
            <StatusChips
              activeTab={activeTab}
              onTabChange={setActiveTab}
              counts={{
                all: categorizedBookings.all.length,
                quoted: categorizedBookings.quoted.length,
                pendingPayment: categorizedBookings.pendingPayment.length,
                confirmed: categorizedBookings.confirmed.length,
                completed: categorizedBookings.completed.length,
                cancelled: categorizedBookings.cancelled.length,
              }}
            />
          )}

          {/* Content Area - List or Calendar */}
          {viewMode === 'list' ? (
            <BookingsTable 
              bookings={filteredBookings}
              selectedBooking={selectedBooking}
              setSelectedBooking={setSelectedBooking}
              handleUpdateBooking={handleUpdateBooking}
              handleBookingDeleted={handleBookingDeleted}
              getPaymentStatus={getPaymentStatus}
              getFinalPaymentStatus={getFinalPaymentStatus}
              getStatusVariant={getStatusVariant}
              getTimeToEvent={getTimeToEvent}
              format={formatToronto}
              selectedBookings={selectedBookings}
              handleBookingSelect={handleBookingSelect}
              handleSelectAll={handleSelectAll}
            />
          ) : (
            <CalendarView
              bookings={filteredBookings}
              selectedDate={selectedCalendarDate}
              onDateSelect={(date) => {
                setSelectedCalendarDate(date);
                // Find booking for this date and open it
                const dateKey = formatToronto(date, 'yyyy-MM-dd');
                const bookingForDate = filteredBookings.find(booking => {
                  const dateStr = booking.finalQuote.booking.days[0]?.date;
                  if (!dateStr) return false;
                  try {
                    const eventDate = parseToronto(dateStr, 'PPP');
                    return formatToronto(eventDate, 'yyyy-MM-dd') === dateKey;
                  } catch {
                    return false;
                  }
                });
                if (bookingForDate) {
                  setSelectedBooking(bookingForDate);
                }
              }}
              onBookingClick={(bookingId) => {
                try {
                  if (!bookingId) {
                    console.error('onBookingClick called with no bookingId');
                    return;
                  }
                  const booking = filteredBookings.find(b => b.id === bookingId);
                  if (booking) {
                    setSelectedBooking(booking);
                  } else {
                    console.warn(`Booking with ID ${bookingId} not found in filteredBookings`);
                  }
                } catch (error) {
                  console.error('Error in onBookingClick:', error);
                  toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Failed to open booking details. Please try again.',
                  });
                }
              }}
            />
          )}
        </div>
      </MobileLayout>

      {/* Global Booking Details Dialog - Works for both List and Calendar views */}
      {selectedBooking && (
        <Dialog 
          open={!!selectedBooking} 
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setSelectedBooking(null);
            }
          }}
        >
          <DialogContent className="w-[95vw] max-w-[95vw] md:max-w-5xl lg:max-w-6xl max-h-[95vh] flex flex-col p-4 md:p-6">
            <DialogHeader className="flex-shrink-0 pb-3">
              <DialogTitle className="text-base md:text-lg lg:text-xl">
                Booking Details (ID: {selectedBooking.id})
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4 md:px-1 md:py-2">
              <BookingDetails 
                quote={selectedBooking.finalQuote} 
                onUpdate={handleUpdateBooking} 
                bookingDoc={selectedBooking} 
                onBookingDeleted={handleBookingDeleted} 
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// Extract bookings table into a separate component for reusability
// Mobile: Cards, Desktop: Table
function BookingsTable({
  bookings,
  selectedBooking,
  setSelectedBooking,
  handleUpdateBooking,
  handleBookingDeleted,
  getPaymentStatus,
  getFinalPaymentStatus,
  getStatusVariant,
  getTimeToEvent,
  format,
  selectedBookings,
  handleBookingSelect,
  handleSelectAll,
}: {
  bookings: BookingDocument[];
  selectedBooking: BookingDocument | null;
  setSelectedBooking: (booking: BookingDocument | null) => void;
  handleUpdateBooking: (updatedQuote: FinalQuote) => void;
  handleBookingDeleted: (bookingId: string) => void;
  getPaymentStatus: (status: PaymentStatus | undefined, method?: 'stripe' | 'interac') => { text: string; variant: 'secondary' | 'destructive' | 'default' };
  getFinalPaymentStatus: (finalPayment: PaymentDetails['finalPayment']) => { text: string; variant: 'secondary' | 'destructive' | 'default' } | null;
  getStatusVariant: (status: BookingDocument['finalQuote']['status']) => 'default' | 'destructive' | 'secondary';
  getTimeToEvent: (eventDateStr: string) => string;
  format: (date: Date | number, formatStr: string) => string;
  selectedBookings: Set<string>;
  handleBookingSelect: (bookingId: string, checked: boolean) => void;
  handleSelectAll: (checked: boolean) => void;
}) {
  const allSelected = bookings.length > 0 && bookings.every(b => selectedBookings.has(b.id));
  
  if (bookings.length === 0) {
    return (
      <div className="py-12 md:py-20 text-center text-muted-foreground rounded-xl bg-white border border-border p-8">
        <p className="text-sm md:text-base">No bookings found in this category.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Card Layout */}
      <div className="md:hidden space-y-3">
        {bookings.map((booking, index) => (
          <Dialog 
            key={booking.id} 
            open={selectedBooking?.id === booking.id} 
            onOpenChange={(isOpen) => setSelectedBooking(isOpen ? booking : null)}
          >
            <BookingCard
              booking={booking}
              index={index}
              isSelected={selectedBookings.has(booking.id)}
              onSelect={(checked) => handleBookingSelect(booking.id, checked)}
              onViewDetails={() => setSelectedBooking(booking)}
              getPaymentStatus={getPaymentStatus}
              getFinalPaymentStatus={getFinalPaymentStatus}
              getStatusVariant={getStatusVariant}
              getTimeToEvent={getTimeToEvent}
            />
            <DialogContent className="w-[95vw] max-w-[95vw] max-h-[95vh] flex flex-col p-4">
              <DialogHeader className="flex-shrink-0 pb-3">
                <DialogTitle className="text-lg">Booking Details (ID: {booking.id})</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4">
                {selectedBooking && (
                  <BookingDetails 
                    quote={selectedBooking.finalQuote} 
                    onUpdate={handleUpdateBooking} 
                    bookingDoc={selectedBooking} 
                    onBookingDeleted={handleBookingDeleted} 
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        ))}
      </div>

      {/* Desktop: Table Layout */}
      <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden rounded-lg border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => handleSelectAll(checked === true)}
                      aria-label="Select all bookings"
                    />
                  </TableHead>
                  <TableHead className="w-[60px] text-sm">Sr. No.</TableHead>
                  <TableHead className="min-w-[120px] text-sm">Customer</TableHead>
                  <TableHead className="min-w-[100px] text-sm">Advance Payment</TableHead>
                  <TableHead className="min-w-[100px] text-sm">Final Payment</TableHead>
                  <TableHead className="min-w-[80px] text-sm">Status</TableHead>
                  <TableHead className="text-sm">Booking Date</TableHead>
                  <TableHead className="text-sm">Event</TableHead>
                  <TableHead className="text-right min-w-[80px] text-sm">Total</TableHead>
                  <TableHead className="w-[50px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking, index) => {
                  const advancePaymentStatus = getPaymentStatus(booking.finalQuote.paymentDetails?.status, booking.finalQuote.paymentDetails?.method);
                  const advancePaymentMethod = booking.finalQuote.paymentDetails?.method;
                  const finalPaymentStatus = getFinalPaymentStatus(booking.finalQuote.paymentDetails?.finalPayment);
                  const finalPaymentMethod = booking.finalQuote.paymentDetails?.finalPayment?.method;
                  const hasPromoCode = booking.finalQuote.paymentDetails?.promotionalCode || booking.finalQuote.paymentDetails?.finalPayment?.promotionalCode;
                  const promoCode = booking.finalQuote.paymentDetails?.promotionalCode || booking.finalQuote.paymentDetails?.finalPayment?.promotionalCode;
                  const discountAmount = (booking.finalQuote.paymentDetails?.discountAmount || 0) + (booking.finalQuote.paymentDetails?.finalPayment?.discountAmount || 0);
                  const hasConsultationRequest = !!booking.finalQuote.consultationRequest;
                  const isManualBooking = !!booking.finalQuote.isManualBooking;
                  return (
                    <TableRow key={booking.id} className={selectedBookings.has(booking.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedBookings.has(booking.id)}
                          onCheckedChange={(checked) => handleBookingSelect(booking.id, checked === true)}
                          aria-label={`Select booking ${booking.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{index + 1}</TableCell>
                      <TableCell className="min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-sm flex items-center gap-1 flex-wrap">
                              {booking.finalQuote.contact.name}
                              {isManualBooking && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700 text-[10px] px-2 py-0.5 font-medium shrink-0" title="Manually created booking">
                                  ✏️ Manual
                                </Badge>
                              )}
                              {hasConsultationRequest && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0.5" title="Consultation request submitted">
                                  📞 Call Request
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{booking.id}</div>
                          </div>
                          {hasPromoCode && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0.5" title={`Promo: ${promoCode}${discountAmount > 0 ? ` (-$${discountAmount.toFixed(2)})` : ''}`}>
                              🎟️ {promoCode}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant={advancePaymentStatus.variant} 
                            className={`capitalize whitespace-nowrap w-fit ${
                              advancePaymentStatus.variant === 'default' ? 'bg-green-500 hover:bg-green-600 text-white' : ''
                            }`}
                          >
                            {advancePaymentStatus.text}
                          </Badge>
                          {advancePaymentMethod && (
                            <Badge 
                              variant={advancePaymentMethod === 'stripe' ? 'default' : 'outline'} 
                              className={`text-xs w-fit ${advancePaymentMethod === 'stripe' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                            >
                              {advancePaymentMethod === 'stripe' ? 'Stripe' : 'Interac'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {finalPaymentStatus ? (
                          <div className="flex flex-col gap-1">
                            <Badge 
                              variant={finalPaymentStatus.variant} 
                              className={`capitalize whitespace-nowrap w-fit ${
                                finalPaymentStatus.variant === 'default' ? 'bg-green-500 hover:bg-green-600 text-white' : ''
                              }`}
                            >
                              {finalPaymentStatus.text}
                            </Badge>
                            {finalPaymentMethod && (
                              <Badge 
                                variant={finalPaymentMethod === 'stripe' ? 'default' : 'outline'} 
                                className={`text-xs w-fit ${finalPaymentMethod === 'stripe' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                              >
                                {finalPaymentMethod === 'stripe' ? 'Stripe' : 'Interac'}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Not Started
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusVariant(booking.finalQuote.status)} 
                          className={`capitalize whitespace-nowrap ${
                            booking.finalQuote.status === 'confirmed' ? 'bg-green-500 hover:bg-green-600 text-white' : ''
                          }`}
                        >
                          {booking.finalQuote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {booking.createdAt instanceof Date 
                          ? format(booking.createdAt, 'PPp') 
                          : booking.createdAt?.toDate 
                          ? format(booking.createdAt.toDate(), 'PPp') 
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarClock className="w-4 h-4 text-muted-foreground"/>
                          <span>{getTimeToEvent(booking.finalQuote.booking.days[0]?.date || '')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        ${booking.finalQuote.selectedQuote 
                          ? formatPrice(booking.finalQuote.quotes[booking.finalQuote.selectedQuote].total)
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog open={selectedBooking?.id === booking.id} onOpenChange={(isOpen) => setSelectedBooking(isOpen ? booking : null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View Details</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[95vw] max-w-5xl lg:max-w-6xl max-h-[90vh] flex flex-col p-6">
                            <DialogHeader className="flex-shrink-0">
                              <DialogTitle className="text-xl">Booking Details (ID: {booking.id})</DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto px-1 py-2 min-h-0">
                              {selectedBooking && <BookingDetails quote={selectedBooking.finalQuote} onUpdate={handleUpdateBooking} bookingDoc={selectedBooking} onBookingDeleted={handleBookingDeleted} />}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}

// Accounting Dashboard Component
function AccountingDashboard({
  metrics,
  formatCurrency,
  accountingTab,
  setAccountingTab,
}: {
  metrics: {
    totalRevenue: number;
    totalAdvanceReceived: number;
    totalFinalReceived: number;
    totalPending: number;
    totalQuoted: number;
    stripeRevenue: number;
    interacRevenue: number;
    stripeAdvance: number;
    interacAdvance: number;
    stripeFinal: number;
    interacFinal: number;
    confirmedRevenue: number;
    completedRevenue: number;
    transactions: Array<{
      id: string;
      customer: string;
      date: string;
      type: 'advance' | 'final';
      amount: number;
      method: 'stripe' | 'interac' | 'pending';
      status: string;
      transactionId?: string;
    }>;
  };
  formatCurrency: (amount: number) => string;
  accountingTab: string;
  setAccountingTab: (tab: string) => void;
}) {
  return (
    <>
      <div className="space-y-6">
      {/* Accounting Sub-tabs */}
      <Tabs value={accountingTab} onValueChange={setAccountingTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">All Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(metrics.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  All received payments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(metrics.totalPending)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Awaiting approval
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quoted Amount</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(metrics.totalQuoted)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Not yet paid
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Revenue</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{formatCurrency(metrics.completedRevenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Past events paid
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Breakdown */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Breakdown</CardTitle>
                <CardDescription>Revenue by payment type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Advance Payments</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(metrics.totalAdvanceReceived)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Final Payments</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(metrics.totalFinalReceived)}</span>
                  </div>
                </div>
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Total Received</span>
                    <span className="text-lg font-bold text-green-600">{formatCurrency(metrics.totalAdvanceReceived + metrics.totalFinalReceived)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Revenue by payment method</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Stripe</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(metrics.stripeRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Interac</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(metrics.interacRevenue)}</span>
                  </div>
                </div>
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-lg font-bold">{formatCurrency(metrics.stripeRevenue + metrics.interacRevenue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Payment Breakdown</CardTitle>
              <CardDescription>Advance and final payments by method</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Advance Payments</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <CreditCard className="h-3 w-3 text-blue-600" />
                        Stripe
                      </span>
                      <span className="font-medium">{formatCurrency(metrics.stripeAdvance)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Wallet className="h-3 w-3 text-green-600" />
                        Interac
                      </span>
                      <span className="font-medium">{formatCurrency(metrics.interacAdvance)}</span>
                    </div>
                    <div className="pt-2 border-t flex items-center justify-between">
                      <span className="font-semibold">Total Advance</span>
                      <span className="font-bold">{formatCurrency(metrics.totalAdvanceReceived)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Final Payments</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <CreditCard className="h-3 w-3 text-blue-600" />
                        Stripe
                      </span>
                      <span className="font-medium">{formatCurrency(metrics.stripeFinal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Wallet className="h-3 w-3 text-green-600" />
                        Interac
                      </span>
                      <span className="font-medium">{formatCurrency(metrics.interacFinal)}</span>
                    </div>
                    <div className="pt-2 border-t flex items-center justify-between">
                      <span className="font-semibold">Total Final</span>
                      <span className="font-bold">{formatCurrency(metrics.totalFinalReceived)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>Complete list of all payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Transaction ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      metrics.transactions.map((transaction, index) => (
                        <TableRow key={`${transaction.id}-${transaction.type}-${index}`}>
                          <TableCell className="text-sm">{transaction.date}</TableCell>
                          <TableCell className="font-medium">{transaction.customer}</TableCell>
                          <TableCell>
                            <Badge variant={transaction.type === 'advance' ? 'default' : 'secondary'}>
                              {transaction.type === 'advance' ? 'Advance' : 'Final'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={transaction.method === 'stripe' ? 'default' : 'outline'}
                              className={transaction.method === 'stripe' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                            >
                              {transaction.method === 'stripe' ? 'Stripe' : transaction.method === 'interac' ? 'Interac' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(transaction.amount)}</TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">
                              {transaction.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell font-mono text-xs">
                            {transaction.transactionId || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {metrics.transactions.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="text-sm font-medium">Total Transactions: {metrics.transactions.length}</span>
                  <span className="text-lg font-bold">Total: {formatCurrency(metrics.transactions.reduce((sum, t) => sum + t.amount, 0))}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </>
  );
}
