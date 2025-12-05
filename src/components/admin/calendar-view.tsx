'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Home,
  MapPin,
  DollarSign,
  Users,
  TrendingUp,
  Info,
  Mail,
  MessageCircle,
  Eye,
  CalendarDays,
  List,
  LayoutGrid
} from 'lucide-react';
import { formatToronto, parseToronto, getTorontoToday, getTorontoNow } from '@/lib/toronto-time';
import type { BookingDocument } from '@/firebase/firestore/bookings';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/price-format';
import { buttonVariants } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ViewMode = 'month' | 'list';

interface CalendarViewProps {
  bookings: BookingDocument[];
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date | null;
  onBookingClick?: (bookingId: string) => void;
}

export function CalendarView({ bookings, onDateSelect, selectedDate, onBookingClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const today = getTorontoToday();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const today = getTorontoToday();
  const now = getTorontoNow();

  // Calculate quick stats
  const stats = useMemo(() => {
    const bookedAppointments = bookings.filter(booking => {
      const paymentStatus = booking.finalQuote.paymentDetails?.status;
      return paymentStatus === 'deposit-paid' || paymentStatus === 'payment-approved';
    });

    const upcomingAppointments = bookedAppointments.filter(booking => {
      const dateStr = booking.finalQuote.booking.days[0]?.date;
      if (!dateStr) return false;
      try {
        const eventDate = parseToronto(dateStr, 'PPP');
        if (isNaN(eventDate.getTime())) return false;
        eventDate.setHours(0, 0, 0, 0);
        const todayDate = new Date(today);
        todayDate.setHours(0, 0, 0, 0);
        return eventDate >= todayDate;
      } catch {
        return false;
      }
    });

    const next7Days = bookedAppointments.filter(booking => {
      const dateStr = booking.finalQuote.booking.days[0]?.date;
      if (!dateStr) return false;
      try {
        const eventDate = parseToronto(dateStr, 'PPP');
        if (isNaN(eventDate.getTime())) return false;
        const daysDiff = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= 0 && daysDiff <= 7;
      } catch {
        return false;
      }
    });

    const thisMonthRevenue = bookedAppointments.reduce((total, booking) => {
      const dateStr = booking.finalQuote.booking.days[0]?.date;
      if (!dateStr) return total;
      try {
        const eventDate = parseToronto(dateStr, 'PPP');
        if (isNaN(eventDate.getTime())) return total;
        const eventMonth = eventDate.getMonth();
        const eventYear = eventDate.getFullYear();
        const currentMonthNum = today.getMonth();
        const currentYear = today.getFullYear();
        
        if (eventMonth === currentMonthNum && eventYear === currentYear) {
          const totalAmount = booking.finalQuote.selectedQuote 
            ? booking.finalQuote.quotes[booking.finalQuote.selectedQuote].total
            : 0;
          return total + totalAmount;
        }
      } catch {
        // Skip invalid dates
      }
      return total;
    }, 0);

    const pendingPayments = bookings.filter(booking => {
      const paymentStatus = booking.finalQuote.paymentDetails?.status;
      return paymentStatus === 'deposit-pending' || paymentStatus === 'screenshot-rejected';
    }).length;

    return {
      totalBooked: bookedAppointments.length,
      upcoming: upcomingAppointments.length,
      next7Days: next7Days.length,
      thisMonthRevenue,
      pendingPayments,
    };
  }, [bookings, today]);

  // Group bookings by date and check payment status
  const bookingsByDate = useMemo(() => {
    const grouped: Record<string, BookingDocument[]> = {};
    const hasAdvancePayment: Record<string, boolean> = {};
    
    bookings.forEach(booking => {
      const days = booking.finalQuote.booking.days;
      days.forEach(day => {
        const dateStr = day.date;
        if (!dateStr) return;
        
        try {
          const eventDate = parseToronto(dateStr, 'PPP');
          if (isNaN(eventDate.getTime())) return;
          
          const key = formatToronto(eventDate, 'yyyy-MM-dd');
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(booking);
          
          // Check if this booking has advance payment
          const paymentStatus = booking.finalQuote.paymentDetails?.status;
          const hasPayment = paymentStatus === 'deposit-paid' || paymentStatus === 'payment-approved';
          if (hasPayment) {
            hasAdvancePayment[key] = true;
          }
        } catch (e) {
          // Skip invalid dates
        }
      });
    });
    
    return { grouped, hasAdvancePayment };
  }, [bookings]);

  // Get bookings for a specific date
  const getBookingsForDate = (date: Date): BookingDocument[] => {
    const key = formatToronto(date, 'yyyy-MM-dd');
    return bookingsByDate.grouped[key] || [];
  };

  // Check if date has advance payment
  const dateHasAdvancePayment = (date: Date): boolean => {
    const key = formatToronto(date, 'yyyy-MM-dd');
    return bookingsByDate.hasAdvancePayment[key] || false;
  };

  // Get count of bookings for a date
  const getBookingCount = (date: Date): number => {
    return getBookingsForDate(date).length;
  };


  // Get all booked appointments (with advance payment) - sorted by date and time
  const allBookedAppointments = useMemo(() => {
    return bookings
      .filter(booking => {
        const paymentStatus = booking.finalQuote.paymentDetails?.status;
        return paymentStatus === 'deposit-paid' || paymentStatus === 'payment-approved';
      })
      .map(booking => {
        const days = booking.finalQuote.booking.days;
        return days.map(day => {
          const dateStr = day.date;
          let eventDate: Date | null = null;
          if (dateStr) {
            try {
              eventDate = parseToronto(dateStr, 'PPP');
              if (isNaN(eventDate.getTime())) eventDate = null;
            } catch {
              eventDate = null;
            }
          }
          return { booking, eventDate, day };
        });
      })
      .flat()
      .filter(item => item.eventDate !== null)
      .sort((a, b) => {
        // Sort by date first
        if (a.eventDate && b.eventDate) {
          const dateDiff = a.eventDate.getTime() - b.eventDate.getTime();
          if (dateDiff !== 0) return dateDiff;
        }
        // Then sort by time if same date
        const timeA = a.day.getReadyTime || '';
        const timeB = b.day.getReadyTime || '';
        if (timeA && timeB) {
          return timeA.localeCompare(timeB);
        }
        return a.booking.id.localeCompare(b.booking.id);
      });
  }, [bookings]);

  // Get upcoming appointments (next 7 days)
  const upcomingAppointments = useMemo(() => {
    return allBookedAppointments
      .filter(item => {
        if (!item.eventDate) return false;
        const daysDiff = Math.ceil((item.eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= 0 && daysDiff <= 7;
      })
      .slice(0, 5); // Show top 5
  }, [allBookedAppointments, today]);

  // Calculate days until event
  const getDaysUntilEvent = (eventDate: Date): number => {
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);
    const eventDateOnly = new Date(eventDate);
    eventDateOnly.setHours(0, 0, 0, 0);
    const diffTime = eventDateOnly.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get service type indicator
  const getServiceType = (booking: BookingDocument): 'studio' | 'mobile' | 'mixed' => {
    const days = booking.finalQuote.booking.days;
    const types = new Set(days.map(day => day.serviceType));
    if (types.size > 1) return 'mixed';
    return days[0]?.serviceType || 'studio';
  };

  // Get payment status
  const getPaymentStatus = (booking: BookingDocument): 'fully-paid' | 'deposit-only' | 'pending' => {
    const paymentDetails = booking.finalQuote.paymentDetails;
    if (!paymentDetails) return 'pending';
    
    const advanceStatus = paymentDetails.status;
    const finalPayment = paymentDetails.finalPayment;
    
    if (finalPayment && (finalPayment.status === 'payment-approved' || finalPayment.status === 'deposit-paid')) {
      return 'fully-paid';
    }
    if (advanceStatus === 'deposit-paid' || advanceStatus === 'payment-approved') {
      return 'deposit-only';
    }
    return 'pending';
  };

  // Get reminder status
  const getReminderStatus = (booking: BookingDocument) => {
    const whatsapp = booking.finalQuote.whatsappMessages;
    return {
      whatsapp2w: whatsapp?.reminder2w?.sent || false,
      whatsapp1w: whatsapp?.reminder1w?.sent || false,
      whatsappInitial: whatsapp?.initial?.sent || false,
    };
  };

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        // Swipe left - next month
        goToNextMonth();
      } else {
        // Swipe right - previous month
        goToPreviousMonth();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };


  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Custom day modifiers
  const dayModifiers = useMemo(() => {
    const modifiers: Record<string, (date: Date) => boolean> = {};
    
    Object.keys(bookingsByDate.grouped).forEach(key => {
      modifiers[`has-booking-${key}`] = (date: Date) => {
        return formatToronto(date, 'yyyy-MM-dd') === key;
      };
    });
    
    return modifiers;
  }, [bookingsByDate]);

  const modifiersClassNames = useMemo(() => {
    const classNames: Record<string, string> = {};
    
    Object.keys(bookingsByDate.grouped).forEach(key => {
      const hasPayment = bookingsByDate.hasAdvancePayment[key];
      classNames[`has-booking-${key}`] = hasPayment 
        ? 'relative bg-green-50 dark:bg-green-950/20' 
        : 'relative bg-muted/30';
    });
    
    return classNames;
  }, [bookingsByDate]);

  return (
    <TooltipProvider>
      <div className="space-y-3 md:space-y-4 lg:space-y-6 w-full">
        {/* Quick Stats Dashboard - Mobile First */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3 lg:gap-4">
        <Card className="rounded-lg md:rounded-xl border border-border shadow-sm p-2 md:p-3 lg:p-4">
          <div className="flex items-center gap-2 mb-1 md:mb-2">
            <CalendarDays className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            <p className="text-[10px] md:text-xs text-muted-foreground">Total Booked</p>
          </div>
          <p className="text-base md:text-lg lg:text-xl font-bold">{stats.totalBooked}</p>
        </Card>
        
        <Card className="rounded-lg md:rounded-xl border border-border shadow-sm p-2 md:p-3 lg:p-4">
          <div className="flex items-center gap-2 mb-1 md:mb-2">
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            <p className="text-[10px] md:text-xs text-muted-foreground">Upcoming</p>
          </div>
          <p className="text-base md:text-lg lg:text-xl font-bold text-green-600">{stats.upcoming}</p>
        </Card>
        
        <Card className="rounded-lg md:rounded-xl border border-border shadow-sm p-2 md:p-3 lg:p-4">
          <div className="flex items-center gap-2 mb-1 md:mb-2">
            <Clock className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            <p className="text-[10px] md:text-xs text-muted-foreground">Next 7 Days</p>
          </div>
          <p className="text-base md:text-lg lg:text-xl font-bold text-blue-600">{stats.next7Days}</p>
        </Card>
        
        <Card className="rounded-lg md:rounded-xl border border-border shadow-sm p-2 md:p-3 lg:p-4">
          <div className="flex items-center gap-2 mb-1 md:mb-2">
            <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            <p className="text-[10px] md:text-xs text-muted-foreground">This Month</p>
          </div>
          <p className="text-base md:text-lg lg:text-xl font-bold text-green-600">${formatPrice(stats.thisMonthRevenue)}</p>
        </Card>
        
        <Card className="rounded-lg md:rounded-xl border border-border shadow-sm p-2 md:p-3 lg:p-4 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-1 md:mb-2">
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            <p className="text-[10px] md:text-xs text-muted-foreground">Pending</p>
          </div>
          <p className="text-base md:text-lg lg:text-xl font-bold text-orange-600">{stats.pendingPayments}</p>
        </Card>
      </div>

      {/* View Mode Toggle & Legend - Mobile First */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start md:items-center justify-between">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full md:w-auto">
          <TabsList className="grid w-full md:w-auto grid-cols-2 h-9 md:h-10">
            <TabsTrigger value="month" className="text-[10px] md:text-xs px-2 md:px-3">
              <LayoutGrid className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              Month
            </TabsTrigger>
            <TabsTrigger value="list" className="text-[10px] md:text-xs px-2 md:px-3">
              <List className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              List
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Legend/Key */}
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs">
                <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700" />
                <span className="text-muted-foreground">Paid</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Bookings with advance payment</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs">
                <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-muted/50 border border-border" />
                <span className="text-muted-foreground">Unpaid</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Bookings without payment</p>
            </TooltipContent>
          </Tooltip>
          
        </div>
      </div>

      {/* Upcoming Appointments Highlight - Next 7 Days */}
      {upcomingAppointments.length > 0 && (
        <Card className="rounded-xl md:rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm">
          <CardHeader className="pb-2 md:pb-3 px-3 md:px-4 lg:px-6 pt-3 md:pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm md:text-base lg:text-lg font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                Upcoming Appointments (Next 7 Days)
              </CardTitle>
              <Badge variant="secondary" className="text-[9px] md:text-[10px]">
                {upcomingAppointments.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-3 md:px-4 lg:px-6 pb-3 md:pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
              {upcomingAppointments.map((item, idx) => {
                const booking = item.booking;
                const day = item.day;
                const eventDate = item.eventDate!;
                const daysUntil = getDaysUntilEvent(eventDate);
                const serviceType = getServiceType(booking);
                const paymentStatus = getPaymentStatus(booking);
                const reminders = getReminderStatus(booking);
                const totalAmount = booking.finalQuote.selectedQuote 
                  ? booking.finalQuote.quotes[booking.finalQuote.selectedQuote].total
                  : 0;

                return (
                  <div
                    key={`${booking.id}-${idx}`}
                    onClick={() => {
                      try {
                        if (onBookingClick && booking?.id) {
                          onBookingClick(booking.id);
                        } else if (onDateSelect && eventDate) {
                          onDateSelect(eventDate);
                        }
                      } catch (error) {
                        console.error('Error in upcoming appointment card click:', error);
                      }
                    }}
                    className="flex flex-col gap-2 p-2.5 md:p-3 rounded-lg md:rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:shadow-md transition-all duration-200 touch-manipulation cursor-pointer active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 flex-wrap">
                          <p className="font-semibold text-xs md:text-sm lg:text-base text-foreground truncate">
                            {booking.finalQuote.contact.name}
                          </p>
                          {booking.finalQuote.isManualBooking && (
                            <Badge 
                              variant="outline"
                              className="text-[8px] md:text-[9px] bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700 shrink-0 font-medium"
                            >
                              ✏️ Manual
                            </Badge>
                          )}
                          <Badge 
                            variant="outline"
                            className={cn(
                              "text-[8px] md:text-[9px] shrink-0",
                              serviceType === 'studio' && "border-blue-500 text-blue-700 dark:text-blue-400",
                              serviceType === 'mobile' && "border-purple-500 text-purple-700 dark:text-purple-400",
                              serviceType === 'mixed' && "border-orange-500 text-orange-700 dark:text-orange-400"
                            )}
                          >
                            {serviceType === 'studio' ? <Home className="h-2 w-2 mr-0.5" /> : <MapPin className="h-2 w-2 mr-0.5" />}
                            {serviceType === 'mixed' ? 'Mixed' : serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}
                          </Badge>
                          {paymentStatus === 'fully-paid' && (
                            <Badge className="text-[8px] md:text-[9px] bg-green-600 hover:bg-green-700 text-white shrink-0">
                              <CheckCircle2 className="h-2 w-2 mr-0.5" />
                              Paid
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground mb-1">
                          <CalendarIcon className="h-2.5 w-2.5 md:h-3 md:w-3 shrink-0" />
                          <span className="font-medium">
                            {formatToronto(eventDate, 'MMM d, yyyy')}
                          </span>
                          {day.getReadyTime && (
                            <>
                              <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 shrink-0 ml-1" />
                              <span>{day.getReadyTime}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[8px] md:text-[9px]",
                              daysUntil === 0 && "border-red-500 text-red-700 dark:text-red-400",
                              daysUntil > 0 && daysUntil <= 3 && "border-orange-500 text-orange-700 dark:text-orange-400",
                              daysUntil > 3 && "border-blue-500 text-blue-700 dark:text-blue-400"
                            )}
                          >
                            {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                          </Badge>
                          <div className="flex items-center gap-1">
                            {reminders.whatsapp2w && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <MessageCircle className="h-3 w-3 text-green-600" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>2-week reminder sent</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {reminders.whatsapp1w && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <MessageCircle className="h-3 w-3 text-blue-600" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>1-week reminder sent</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
                      <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono truncate">
                        {booking.id}
                      </p>
                      <p className="text-xs md:text-sm font-bold text-green-700 dark:text-green-400">
                        ${formatPrice(totalAmount)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar View - Mobile First Layout */}
      {viewMode === 'month' && (
        <div 
          className="grid gap-3 md:gap-4 lg:gap-6 w-full grid-cols-1 lg:grid-cols-3"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Calendar Card */}
          <Card className="rounded-xl md:rounded-2xl border border-border shadow-sm w-full overflow-hidden lg:col-span-2">
            <CardContent className="p-2 md:p-3 lg:p-4 xl:p-6">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <div className="flex items-center gap-1.5 md:gap-2 flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousMonth}
                    className="h-8 w-8 md:h-9 md:w-9 lg:h-10 lg:w-10 p-0 hover:bg-accent active:scale-95 transition-all touch-manipulation"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5" />
                  </Button>
                  <h3 className="text-sm md:text-base lg:text-xl xl:text-2xl font-semibold flex-1 text-center min-w-0">
                    {formatToronto(currentMonth, 'MMMM yyyy')}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextMonth}
                    className="h-8 w-8 md:h-9 md:w-9 lg:h-10 lg:w-10 p-0 hover:bg-accent active:scale-95 transition-all touch-manipulation"
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5" />
                  </Button>
                </div>
              </div>
              <Calendar
                mode="single"
                selected={selectedDate || undefined}
                onSelect={(date) => {
                  if (date && onDateSelect) {
                    onDateSelect(date);
                  }
                }}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="w-full"
                modifiers={dayModifiers}
                modifiersClassNames={modifiersClassNames}
                classNames={{
                  months: "flex flex-col space-y-2 md:space-y-3",
                  month: "space-y-2 md:space-y-3",
                  caption: "flex justify-center pt-0 relative items-center mb-2 md:mb-3",
                  caption_label: "text-xs md:text-sm lg:text-base font-semibold",
                  nav: "space-x-1 flex items-center",
                  table: "w-full border-collapse",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground w-[calc(100%/7)] flex items-center justify-center font-normal text-[0.65rem] md:text-[0.75rem] lg:text-sm py-1 md:py-2",
                  row: "flex w-full",
                  cell: "w-[calc(100%/7)] flex items-center justify-center p-0 relative",
                  day: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 lg:h-10 lg:w-10 xl:h-12 xl:w-12 p-0 font-normal aria-selected:opacity-100 text-xs md:text-sm lg:text-base touch-manipulation m-auto"
                  ),
                  day_selected: "bg-black text-white hover:bg-black hover:text-white focus:bg-black focus:text-white shadow-md",
                  day_today: "bg-accent text-accent-foreground font-semibold",
                  day_outside: "day-outside text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                  day_hidden: "invisible",
                }}
                components={{
                  Day: ({ date, displayMonth, selected, ...props }) => {
                    const count = getBookingCount(date);
                    const hasBookings = count > 0;
                    const hasAdvancePayment = dateHasAdvancePayment(date);
                    const isToday = formatToronto(date, 'yyyy-MM-dd') === formatToronto(today, 'yyyy-MM-dd');
                    
                    // Get time slots for this date
                    const dateBookings = getBookingsForDate(date);
                    const timeSlots = dateBookings
                      .map(b => b.finalQuote.booking.days.find(d => {
                        try {
                          const dDate = parseToronto(d.date, 'PPP');
                          return formatToronto(dDate, 'yyyy-MM-dd') === formatToronto(date, 'yyyy-MM-dd');
                        } catch {
                          return false;
                        }
                      })?.getReadyTime)
                      .filter(Boolean)
                      .sort();
                    
                    return (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <button
                          type="button"
                          {...props}
                          className={cn(
                            'relative h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 lg:h-10 lg:w-10 xl:h-12 xl:w-12 flex items-center justify-center rounded-md text-xs md:text-sm lg:text-base font-medium transition-all duration-200 active:scale-95 touch-manipulation m-auto',
                            selected && 'bg-black text-white shadow-md scale-105 z-10',
                            !selected && hasAdvancePayment && hasBookings && 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 hover:scale-105 border border-green-300 dark:border-green-700',
                            !selected && hasBookings && !hasAdvancePayment && 'bg-muted/50 hover:bg-muted/80 hover:scale-105',
                            !selected && !hasBookings && 'hover:bg-accent hover:scale-105',
                            isToday && !selected && 'ring-2 ring-black ring-offset-1 font-semibold'
                          )}
                        >
                          <span className={cn(
                            "relative z-0",
                            hasAdvancePayment && hasBookings && "text-green-700 dark:text-green-300 font-semibold",
                            !hasAdvancePayment && hasBookings && "text-foreground",
                            !hasBookings && "text-foreground"
                          )}>
                            {date.getDate()}
                          </span>
                          {hasBookings && (
                            <span className={cn(
                              "absolute -bottom-0.5 sm:-bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full z-10",
                              hasAdvancePayment ? "bg-green-600 dark:bg-green-400" : "bg-black dark:bg-white"
                            )} />
                          )}
                        </button>
                        {/* Time slots indicator */}
                        {timeSlots.length > 0 && (
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                            {timeSlots.slice(0, 3).map((time, idx) => (
                              <div
                                key={idx}
                                className="w-0.5 h-0.5 md:w-1 md:h-1 rounded-full bg-blue-500"
                                title={time}
                              />
                            ))}
                            {timeSlots.length > 3 && (
                              <div className="w-0.5 h-0.5 md:w-1 md:h-1 rounded-full bg-blue-500 opacity-50" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  },
                }}
              />
            </CardContent>
          </Card>

          {/* All Booked Appointments - Mobile First Sidebar */}
          <Card className="rounded-xl md:rounded-2xl border border-border shadow-sm lg:col-span-1 w-full">
            <CardHeader className="pb-2 md:pb-3 lg:pb-4 px-3 md:px-4 lg:px-6 pt-3 md:pt-4 lg:pt-6">
              <CardTitle className="text-sm md:text-base lg:text-lg xl:text-xl font-semibold mb-2 md:mb-3">
                Booked Appointments
              </CardTitle>
              {allBookedAppointments.length > 0 && (
                <p className="text-xs md:text-sm text-muted-foreground">
                  {allBookedAppointments.length} {allBookedAppointments.length === 1 ? 'appointment' : 'appointments'}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-2 md:space-y-3 lg:space-y-4 max-h-[400px] md:max-h-[500px] lg:max-h-[600px] overflow-y-auto px-3 md:px-4 lg:px-6 pb-3 md:pb-4 lg:pb-6 scrollbar-hide">
              {allBookedAppointments.length > 0 ? (
                allBookedAppointments.map((item, idx) => {
                  const booking = item.booking;
                  const day = item.day;
                  const eventDate = item.eventDate!;
                  const totalAmount = booking.finalQuote.selectedQuote 
                    ? booking.finalQuote.quotes[booking.finalQuote.selectedQuote].total
                    : 0;
                  const paymentStatus = getPaymentStatus(booking);
                  const serviceType = getServiceType(booking);
                  const reminders = getReminderStatus(booking);
                  const daysUntil = getDaysUntilEvent(eventDate);
                  const eventDateStr = formatToronto(eventDate, 'MMM d, yyyy');
                  
                  return (
                    <div
                      key={`${booking.id}-${idx}`}
                      onClick={() => {
                        try {
                          if (onBookingClick && booking?.id) {
                            onBookingClick(booking.id);
                          } else if (onDateSelect && eventDate) {
                            onDateSelect(eventDate);
                          }
                        } catch (error) {
                          console.error('Error in booked appointment card click:', error);
                        }
                      }}
                      className={cn(
                        "flex flex-col gap-2 p-2.5 md:p-3 lg:p-4 rounded-lg md:rounded-xl border transition-all duration-200 touch-manipulation cursor-pointer",
                        "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30 hover:shadow-md hover:border-green-400 dark:hover:border-green-600",
                        "active:scale-[0.98]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2 flex-wrap">
                            <p className="font-semibold text-xs md:text-sm lg:text-base xl:text-lg text-foreground truncate">
                              {booking.finalQuote.contact.name}
                            </p>
                            {booking.finalQuote.isManualBooking && (
                              <Badge 
                                variant="outline"
                                className="text-[8px] md:text-[9px] bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700 shrink-0 font-medium"
                              >
                                ✏️ Manual
                              </Badge>
                            )}
                            <Badge 
                              variant="outline"
                              className={cn(
                                "text-[8px] md:text-[9px] shrink-0",
                                serviceType === 'studio' && "border-blue-500 text-blue-700 dark:text-blue-400",
                                serviceType === 'mobile' && "border-purple-500 text-purple-700 dark:text-purple-400",
                                serviceType === 'mixed' && "border-orange-500 text-orange-700 dark:text-orange-400"
                              )}
                            >
                              {serviceType === 'studio' ? <Home className="h-2 w-2 mr-0.5" /> : <MapPin className="h-2 w-2 mr-0.5" />}
                              {serviceType === 'mixed' ? 'Mixed' : serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}
                            </Badge>
                            {paymentStatus === 'fully-paid' && (
                              <Badge 
                                variant="default"
                                className="text-[9px] md:text-[10px] bg-green-600 hover:bg-green-700 text-white shrink-0"
                              >
                                <CheckCircle2 className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5" />
                                Paid
                              </Badge>
                            )}
                            {paymentStatus === 'deposit-only' && (
                              <Badge 
                                variant="secondary"
                                className="text-[9px] md:text-[10px] shrink-0"
                              >
                                Deposit
                              </Badge>
                            )}
                            <Badge 
                              variant={booking.finalQuote.status === 'confirmed' ? 'default' : 'secondary'}
                              className="text-[9px] md:text-[10px] shrink-0"
                            >
                              {booking.finalQuote.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs lg:text-sm text-muted-foreground mb-1 md:mb-1.5">
                            <CalendarIcon className="h-2.5 w-2.5 md:h-3 md:w-3 lg:h-4 lg:w-4 shrink-0" />
                            <span className="font-medium">{eventDateStr}</span>
                            {daysUntil >= 0 && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[8px] md:text-[9px] ml-1",
                                  daysUntil === 0 && "border-red-500 text-red-700 dark:text-red-400",
                                  daysUntil > 0 && daysUntil <= 3 && "border-orange-500 text-orange-700 dark:text-orange-400",
                                  daysUntil > 3 && "border-blue-500 text-blue-700 dark:text-blue-400"
                                )}
                              >
                                {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil}d`}
                              </Badge>
                            )}
                          </div>
                          {day.getReadyTime && (
                            <div className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs lg:text-sm text-muted-foreground mb-1 md:mb-1.5">
                              <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 lg:h-4 lg:w-4 shrink-0" />
                              <span>{day.getReadyTime}</span>
                            </div>
                          )}
                          {day.location && (
                            <p className="text-[10px] md:text-xs lg:text-sm text-muted-foreground line-clamp-2 mb-1">
                              {day.location}
                            </p>
                          )}
                          {/* Reminder Status */}
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              {reminders.whatsapp2w ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <MessageCircle className="h-3 w-3 text-green-600" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>2-week WhatsApp reminder sent</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <MessageCircle className="h-3 w-3 text-muted-foreground opacity-50" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>2-week reminder pending</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {reminders.whatsapp1w ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <MessageCircle className="h-3 w-3 text-blue-600" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>1-week WhatsApp reminder sent</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <MessageCircle className="h-3 w-3 text-muted-foreground opacity-50" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>1-week reminder pending</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            {onBookingClick && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  try {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (onBookingClick && booking?.id) {
                                      onBookingClick(booking.id);
                                    }
                                  } catch (error) {
                                    console.error('Error opening booking details:', error);
                                  }
                                }}
                                className="h-7 md:h-8 px-2 md:px-3 text-[9px] md:text-[10px] ml-auto touch-manipulation active:scale-95 transition-all"
                                type="button"
                              >
                                <Eye className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />
                                <span className="hidden sm:inline">View</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 md:pt-2 border-t border-border/50">
                        <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono truncate max-w-[100px] md:max-w-none">
                          {booking.id}
                        </p>
                        <p className="text-xs md:text-sm lg:text-base xl:text-lg font-bold shrink-0 text-green-700 dark:text-green-400">
                          ${formatPrice(totalAmount)}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center p-6 md:p-8 lg:p-10 text-center">
                  <div className="text-4xl md:text-5xl lg:text-6xl mb-3 md:mb-4">
                    📅
                  </div>
                  <p className="text-sm md:text-base lg:text-lg font-semibold text-foreground mb-2 md:mb-3">
                    I'm eagerly waiting to show you bookings here!
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    No booked appointments yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card className="rounded-xl md:rounded-2xl border border-border shadow-sm">
          <CardHeader className="pb-2 md:pb-3 px-3 md:px-4 lg:px-6 pt-3 md:pt-4">
            <CardTitle className="text-sm md:text-base lg:text-lg font-semibold">
              All Appointments (List View)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-4 lg:px-6 pb-3 md:pb-4">
            <div className="space-y-2 md:space-y-3">
              {allBookedAppointments.length > 0 ? (
                allBookedAppointments.map((item, idx) => {
                  const booking = item.booking;
                  const day = item.day;
                  const eventDate = item.eventDate!;
                  const totalAmount = booking.finalQuote.selectedQuote 
                    ? booking.finalQuote.quotes[booking.finalQuote.selectedQuote].total
                    : 0;
                  const paymentStatus = getPaymentStatus(booking);
                  const serviceType = getServiceType(booking);
                  const daysUntil = getDaysUntilEvent(eventDate);
                  const eventDateStr = formatToronto(eventDate, 'MMM d, yyyy');

                  return (
                    <div
                      key={`${booking.id}-${idx}`}
                      onClick={() => {
                        try {
                          if (onBookingClick && booking?.id) {
                            onBookingClick(booking.id);
                          } else if (onDateSelect && eventDate) {
                            onDateSelect(eventDate);
                          }
                        } catch (error) {
                          console.error('Error in list view card click:', error);
                        }
                      }}
                      className="flex items-center justify-between p-2.5 md:p-3 rounded-lg border border-border hover:bg-accent/50 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs md:text-sm truncate">{booking.finalQuote.contact.name}</p>
                          <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground mt-1">
                            <CalendarIcon className="h-3 w-3 shrink-0" />
                            <span>{eventDateStr}</span>
                            {day.getReadyTime && (
                              <>
                                <Clock className="h-3 w-3 shrink-0 ml-1" />
                                <span>{day.getReadyTime}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge 
                            variant="outline"
                            className={cn(
                              "text-[8px] md:text-[9px]",
                              serviceType === 'studio' && "border-blue-500",
                              serviceType === 'mobile' && "border-purple-500"
                            )}
                          >
                            {serviceType === 'studio' ? <Home className="h-2 w-2 mr-0.5" /> : <MapPin className="h-2 w-2 mr-0.5" />}
                            {serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}
                          </Badge>
                          {daysUntil >= 0 && (
                            <Badge variant="outline" className="text-[8px] md:text-[9px]">
                              {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil}d`}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3">
                        <p className="text-xs md:text-sm font-bold text-green-700 dark:text-green-400">
                          ${formatPrice(totalAmount)}
                        </p>
                        {onBookingClick && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              try {
                                e.preventDefault();
                                e.stopPropagation();
                                if (onBookingClick && booking?.id) {
                                  onBookingClick(booking.id);
                                }
                              } catch (error) {
                                console.error('Error in list view View button:', error);
                              }
                            }}
                            className="h-7 px-2 text-[9px] md:text-[10px]"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground py-8">No appointments found</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </TooltipProvider>
  );
}
