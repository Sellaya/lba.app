'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, CalendarClock } from 'lucide-react';
import { formatPrice } from '@/lib/price-format';
import { formatToronto } from '@/lib/toronto-time';
import type { BookingDocument, PaymentStatus, PaymentDetails } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BookingCardProps {
  booking: BookingDocument;
  index: number;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onViewDetails: () => void;
  getPaymentStatus: (status: PaymentStatus | undefined, method?: 'stripe' | 'interac') => { text: string; variant: 'secondary' | 'destructive' | 'default' };
  getFinalPaymentStatus: (finalPayment: PaymentDetails['finalPayment']) => { text: string; variant: 'secondary' | 'destructive' | 'default' } | null;
  getStatusVariant: (status: BookingDocument['finalQuote']['status']) => 'default' | 'destructive' | 'secondary';
  getTimeToEvent: (eventDateStr: string) => string;
}

export function BookingCard({
  booking,
  index,
  isSelected,
  onSelect,
  onViewDetails,
  getPaymentStatus,
  getFinalPaymentStatus,
  getStatusVariant,
  getTimeToEvent,
}: BookingCardProps) {
  const advancePaymentStatus = getPaymentStatus(booking.finalQuote.paymentDetails?.status, booking.finalQuote.paymentDetails?.method);
  const advancePaymentMethod = booking.finalQuote.paymentDetails?.method;
  const finalPaymentStatus = getFinalPaymentStatus(booking.finalQuote.paymentDetails?.finalPayment);
  const finalPaymentMethod = booking.finalQuote.paymentDetails?.finalPayment?.method;
  const hasPromoCode = booking.finalQuote.paymentDetails?.promotionalCode || booking.finalQuote.paymentDetails?.finalPayment?.promotionalCode;
  const promoCode = booking.finalQuote.paymentDetails?.promotionalCode || booking.finalQuote.paymentDetails?.finalPayment?.promotionalCode;
  const discountAmount = (booking.finalQuote.paymentDetails?.discountAmount || 0) + (booking.finalQuote.paymentDetails?.finalPayment?.discountAmount || 0);
  const hasConsultationRequest = !!booking.finalQuote.consultationRequest;
  const totalAmount = booking.finalQuote.selectedQuote 
    ? booking.finalQuote.quotes[booking.finalQuote.selectedQuote].total
    : 0;

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-border shadow-sm p-4 md:p-5 transition-all',
        'hover:shadow-md hover:border-black/20',
        isSelected && 'ring-2 ring-black ring-offset-2 bg-muted/30'
      )}
    >
      {/* Top Row: Checkbox + Customer Name + Status */}
      <div className="flex items-start gap-3 mb-4">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="mt-1"
          aria-label={`Select booking ${booking.id}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-base md:text-lg text-foreground truncate">
              {booking.finalQuote.contact.name}
            </h3>
            {hasConsultationRequest && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0.5">
                📞 Call Request
              </Badge>
            )}
            {hasPromoCode && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0.5">
                🎟️ {promoCode}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">{booking.id}</p>
        </div>
        <Badge 
          variant={getStatusVariant(booking.finalQuote.status)} 
          className={cn(
            'capitalize whitespace-nowrap shrink-0',
            booking.finalQuote.status === 'confirmed' && 'bg-green-500 hover:bg-green-600 text-white'
          )}
        >
          {booking.finalQuote.status}
        </Badge>
      </div>

      {/* Middle: Payment Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Advance Payment */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Advance Payment</p>
          <div className="flex flex-col gap-1.5">
            <Badge 
              variant={advancePaymentStatus.variant} 
              className={cn(
                'capitalize whitespace-nowrap w-fit text-xs',
                advancePaymentStatus.variant === 'default' && 'bg-green-500 hover:bg-green-600 text-white'
              )}
            >
              {advancePaymentStatus.text}
            </Badge>
            {advancePaymentMethod && (
              <Badge 
                variant={advancePaymentMethod === 'stripe' ? 'default' : 'outline'} 
                className={cn(
                  'text-xs w-fit',
                  advancePaymentMethod === 'stripe' && 'bg-blue-600 hover:bg-blue-700 text-white'
                )}
              >
                {advancePaymentMethod === 'stripe' ? 'Stripe' : 'Interac'}
              </Badge>
            )}
          </div>
        </div>

        {/* Final Payment */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Final Payment</p>
          {finalPaymentStatus ? (
            <div className="flex flex-col gap-1.5">
              <Badge 
                variant={finalPaymentStatus.variant} 
                className={cn(
                  'capitalize whitespace-nowrap w-fit text-xs',
                  finalPaymentStatus.variant === 'default' && 'bg-green-500 hover:bg-green-600 text-white'
                )}
              >
                {finalPaymentStatus.text}
              </Badge>
              {finalPaymentMethod && (
                <Badge 
                  variant={finalPaymentMethod === 'stripe' ? 'default' : 'outline'} 
                  className={cn(
                    'text-xs w-fit',
                    finalPaymentMethod === 'stripe' && 'bg-blue-600 hover:bg-blue-700 text-white'
                  )}
                >
                  {finalPaymentMethod === 'stripe' ? 'Stripe' : 'Interac'}
                </Badge>
              )}
            </div>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Not Started
            </Badge>
          )}
        </div>
      </div>

      {/* Bottom: Event Date + Total + View Button */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">
              {getTimeToEvent(booking.finalQuote.booking.days[0]?.date || '')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground hidden md:block">
            {booking.createdAt instanceof Date 
              ? formatToronto(booking.createdAt, 'PPp') 
              : booking.createdAt?.toDate 
              ? formatToronto(booking.createdAt.toDate(), 'PPp') 
              : 'N/A'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">Total</p>
            <p className="text-base font-semibold text-foreground">
              ${formatPrice(totalAmount)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="h-9 px-3 shrink-0"
          >
            <Eye className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">View</span>
          </Button>
        </div>
      </div>
    </div>
  );
}





