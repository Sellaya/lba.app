'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { X, Filter, Calendar as CalendarIcon } from 'lucide-react';
import { formatToronto, getTorontoToday, parseToronto } from '@/lib/toronto-time';
import { cn } from '@/lib/utils';
import type { BookingDocument } from '@/firebase/firestore/bookings';

export interface FilterState {
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  amountRange: {
    min: string;
    max: string;
  };
  paymentMethod: 'all' | 'stripe' | 'interac' | 'none';
  serviceType: 'all' | 'mobile' | 'studio';
  status: 'all' | 'quoted' | 'confirmed' | 'cancelled' | 'completed';
  searchTerm: string;
}

const defaultFilters: FilterState = {
  dateRange: { from: null, to: null },
  amountRange: { min: '', max: '' },
  paymentMethod: 'all',
  serviceType: 'all',
  status: 'all',
  searchTerm: '',
};

interface AdvancedFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onReset: () => void;
  activeFilterCount: number;
}

export function AdvancedFilters({ 
  filters, 
  onFiltersChange, 
  onReset,
  activeFilterCount 
}: AdvancedFiltersProps) {
  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <Card className="rounded-xl border border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Filter className="h-4 w-4 md:h-5 md:w-5" />
            Advanced Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-8 text-xs md:text-sm"
            >
              <X className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <Label className="text-xs md:text-sm">Search</Label>
          <Input
            placeholder="Search by name, ID, email, phone..."
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="h-9 md:h-10"
          />
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <Label className="text-xs md:text-sm">Event Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal h-9 md:h-10 text-xs md:text-sm',
                    !filters.dateRange.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  {filters.dateRange.from
                    ? formatToronto(filters.dateRange.from, 'MMM d')
                    : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.from || undefined}
                  onSelect={(date) => {
                    updateFilter('dateRange', {
                      ...filters.dateRange,
                      from: date || null,
                    });
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal h-9 md:h-10 text-xs md:text-sm',
                    !filters.dateRange.to && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  {filters.dateRange.to
                    ? formatToronto(filters.dateRange.to, 'MMM d')
                    : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.to || undefined}
                  onSelect={(date) => {
                    updateFilter('dateRange', {
                      ...filters.dateRange,
                      to: date || null,
                    });
                  }}
                  disabled={(date) => {
                    if (filters.dateRange.from) {
                      return date < filters.dateRange.from;
                    }
                    return false;
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Amount Range */}
        <div className="space-y-2">
          <Label className="text-xs md:text-sm">Amount Range (CAD)</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.amountRange.min}
              onChange={(e) =>
                updateFilter('amountRange', {
                  ...filters.amountRange,
                  min: e.target.value,
                })
              }
              className="h-9 md:h-10 text-xs md:text-sm"
            />
            <Input
              type="number"
              placeholder="Max"
              value={filters.amountRange.max}
              onChange={(e) =>
                updateFilter('amountRange', {
                  ...filters.amountRange,
                  max: e.target.value,
                })
              }
              className="h-9 md:h-10 text-xs md:text-sm"
            />
          </div>
        </div>

        {/* Payment Method */}
        <div className="space-y-2">
          <Label className="text-xs md:text-sm">Payment Method</Label>
          <Select
            value={filters.paymentMethod}
            onValueChange={(value: FilterState['paymentMethod']) =>
              updateFilter('paymentMethod', value)
            }
          >
            <SelectTrigger className="h-9 md:h-10 text-xs md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="interac">Interac</SelectItem>
              <SelectItem value="none">No Payment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Service Type */}
        <div className="space-y-2">
          <Label className="text-xs md:text-sm">Service Type</Label>
          <Select
            value={filters.serviceType}
            onValueChange={(value: FilterState['serviceType']) =>
              updateFilter('serviceType', value)
            }
          >
            <SelectTrigger className="h-9 md:h-10 text-xs md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="studio">Studio</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-xs md:text-sm">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value: FilterState['status']) =>
              updateFilter('status', value)
            }
          >
            <SelectTrigger className="h-9 md:h-10 text-xs md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// Filter utility function
export function applyFilters(
  bookings: BookingDocument[],
  filters: FilterState
): BookingDocument[] {
  return bookings.filter(booking => {
    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      const matchesSearch =
        booking.id.toLowerCase().includes(term) ||
        booking.finalQuote.contact.name.toLowerCase().includes(term) ||
        booking.finalQuote.contact.email?.toLowerCase().includes(term) ||
        booking.finalQuote.contact.phone?.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    // Date range filter
    if (filters.dateRange.from || filters.dateRange.to) {
      const dateStr = booking.finalQuote.booking.days[0]?.date;
      if (!dateStr) return false;
      
      try {
        const eventDate = parseToronto(dateStr, 'PPP');
        if (isNaN(eventDate.getTime())) return false;
        
        eventDate.setHours(0, 0, 0, 0);
        
        if (filters.dateRange.from) {
          const from = new Date(filters.dateRange.from);
          from.setHours(0, 0, 0, 0);
          if (eventDate < from) return false;
        }
        
        if (filters.dateRange.to) {
          const to = new Date(filters.dateRange.to);
          to.setHours(23, 59, 59, 999);
          if (eventDate > to) return false;
        }
      } catch (e) {
        return false;
      }
    }

    // Amount range filter
    if (filters.amountRange.min || filters.amountRange.max) {
      const totalAmount = booking.finalQuote.selectedQuote
        ? booking.finalQuote.quotes[booking.finalQuote.selectedQuote].total
        : 0;
      
      if (filters.amountRange.min) {
        const min = parseFloat(filters.amountRange.min);
        if (isNaN(min) || totalAmount < min) return false;
      }
      
      if (filters.amountRange.max) {
        const max = parseFloat(filters.amountRange.max);
        if (isNaN(max) || totalAmount > max) return false;
      }
    }

    // Payment method filter
    if (filters.paymentMethod !== 'all') {
      const paymentMethod = booking.finalQuote.paymentDetails?.method;
      if (filters.paymentMethod === 'none' && paymentMethod) return false;
      if (filters.paymentMethod !== 'none' && paymentMethod !== filters.paymentMethod) return false;
    }

    // Service type filter
    if (filters.serviceType !== 'all') {
      const hasMobile = booking.finalQuote.booking.days?.some(
        d => d.serviceType === 'mobile'
      );
      if (filters.serviceType === 'mobile' && !hasMobile) return false;
      if (filters.serviceType === 'studio' && hasMobile) return false;
    }

    // Status filter
    if (filters.status !== 'all') {
      const status = booking.finalQuote.status;
      if (filters.status === 'completed') {
        // Completed = confirmed + event date passed
        const isConfirmed = status === 'confirmed' || 
          booking.finalQuote.paymentDetails?.status === 'payment-approved' ||
          booking.finalQuote.paymentDetails?.status === 'deposit-paid';
        if (!isConfirmed) return false;
        
        const dateStr = booking.finalQuote.booking.days[0]?.date;
        if (dateStr) {
          try {
            const eventDate = parseToronto(dateStr, 'PPP');
            const today = getTorontoToday();
            eventDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);
            if (eventDate >= today) return false;
          } catch (e) {
            return false;
          }
        }
      } else {
        if (status !== filters.status) return false;
      }
    }

    return true;
  });
}

// Count active filters
export function countActiveFilters(filters: FilterState): number {
  let count = 0;
  
  if (filters.searchTerm) count++;
  if (filters.dateRange.from) count++;
  if (filters.dateRange.to) count++;
  if (filters.amountRange.min) count++;
  if (filters.amountRange.max) count++;
  if (filters.paymentMethod !== 'all') count++;
  if (filters.serviceType !== 'all') count++;
  if (filters.status !== 'all') count++;
  
  return count;
}

