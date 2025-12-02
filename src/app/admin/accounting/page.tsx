'use client';

import { useEffect, useState, useMemo } from 'react';
import type { BookingDocument } from '@/firebase/firestore/bookings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Clock, FileText, CheckCircle2, CreditCard, Wallet, Receipt, Users, DollarSign } from 'lucide-react';
import { formatToronto, parseToronto, getTorontoToday } from '@/lib/toronto-time';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSettings } from '@/components/admin-settings';
import Image from 'next/image';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

export default function AccountingPage() {
  const [bookings, setBookings] = useState<BookingDocument[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [accountingTab, setAccountingTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: '/admin', label: 'Bookings', icon: FileText },
    { href: '/admin/artists', label: 'Artists', icon: Users },
    { href: '/admin/accounting', label: 'Accounting', icon: TrendingUp },
    { href: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  ];

  // Fetch bookings from API
  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/bookings', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to fetch bookings');
      }
      const { bookings: fetchedBookings } = await res.json();
      setBookings(fetchedBookings);
      setError(null);
      setIsLoading(false);
    } catch (err: any) {
      setError(err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const sortedBookings = useMemo(() => {
    if (!bookings) return [];
    return [...bookings].sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0));
      const dateB = b.createdAt instanceof Date ? b.createdAt : (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0));
      return dateB.getTime() - dateA.getTime();
    });
  }, [bookings]);

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
          return false; // No date, can't determine if completed
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
    transactions.sort((a, b) => {
      try {
        const dateA = parseToronto(a.date, 'PPP');
        const dateB = parseToronto(b.date, 'PPP');
        return dateB.getTime() - dateA.getTime();
      } catch (error) {
        console.error('Error parsing transaction dates for sorting:', error);
        return 0; // Keep original order if parsing fails
      }
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
  }, [sortedBookings]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
  };

  // Navigation menu component
  const NavigationMenu = ({ onNavigate }: { onNavigate?: () => void }) => {
    return (
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const handleClick = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            router.push(item.href);
            if (onNavigate) onNavigate();
          };
          // Use button for pricing to avoid prefetch errors, Link for others
          if (item.href === '/admin/pricing') {
            return (
              <button
                key={item.href}
                onClick={handleClick}
                type="button"
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-black text-white'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate ? () => onNavigate() : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full bg-muted/40">
        <aside className="hidden md:flex w-64 flex-col border-r bg-background">
          <div className="flex h-16 items-center justify-center gap-3 border-b px-6">
            <div className="relative w-10 h-10 flex-shrink-0">
              <Image
                src="/LBA.png"
                alt="Looks by Anum Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <h1 className="font-headline text-lg font-bold text-black tracking-wider">Looks by Anum</h1>
          </div>
          <NavigationMenu />
        </aside>
        <div className="flex flex-1 flex-col w-full md:w-auto">
          <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b bg-background px-3 sm:px-4 md:px-6">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="p-6 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <Image
                        src="/LBA.png"
                        alt="Looks by Anum Logo"
                        fill
                        className="object-contain"
                        priority
                      />
                    </div>
                    <SheetTitle className="font-headline text-lg font-bold text-black tracking-wider">
                      Looks by Anum
                    </SheetTitle>
                  </div>
                </SheetHeader>
                <NavigationMenu onNavigate={() => setIsMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">Accounting</h2>
            <div className="ml-auto">
              <AdminSettings />
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                <p className="mt-4 text-muted-foreground text-sm sm:text-base">Loading accounting data...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full bg-muted/40">
        <aside className="hidden md:flex w-64 flex-col border-r bg-background">
          <div className="flex h-16 items-center justify-center gap-3 border-b px-6">
            <div className="relative w-10 h-10 flex-shrink-0">
              <Image
                src="/LBA.png"
                alt="Looks by Anum Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <h1 className="font-headline text-lg font-bold text-black tracking-wider">Looks by Anum</h1>
          </div>
          <NavigationMenu />
        </aside>
        <div className="flex flex-1 flex-col w-full md:w-auto">
          <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b bg-background px-3 sm:px-4 md:px-6">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="p-6 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <Image
                        src="/LBA.png"
                        alt="Looks by Anum Logo"
                        fill
                        className="object-contain"
                        priority
                      />
                    </div>
                    <SheetTitle className="font-headline text-lg font-bold text-black tracking-wider">
                      Looks by Anum
                    </SheetTitle>
                  </div>
                </SheetHeader>
                <NavigationMenu onNavigate={() => setIsMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">Accounting</h2>
            <div className="ml-auto">
              <AdminSettings />
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">
            <Card>
              <CardHeader>
                <CardTitle>Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-destructive text-sm sm:text-base">{error.message}</p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-background">
        <div className="flex h-16 items-center justify-center gap-3 border-b px-6">
          <div className="relative w-10 h-10 flex-shrink-0">
            <Image
              src="/LBA.png"
              alt="Looks by Anum Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="font-headline text-lg font-bold text-black tracking-wider">Looks by Anum</h1>
        </div>
        <NavigationMenu />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col w-full md:w-auto">
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b bg-background px-3 sm:px-4 md:px-6">
          {/* Mobile Menu Button */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <Image
                      src="/LBA.png"
                      alt="Looks by Anum Logo"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                  <SheetTitle className="font-headline text-lg font-bold text-black tracking-wider">
                    Looks by Anum
                  </SheetTitle>
                </div>
              </SheetHeader>
              <NavigationMenu onNavigate={() => setIsMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">Accounting</h2>
          <div className="ml-auto">
            <AdminSettings />
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-4 md:p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl">Accounting Dashboard</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Complete financial overview of all bookings and payments</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <AccountingDashboard 
              metrics={accountingMetrics}
              formatCurrency={formatCurrency}
              accountingTab={accountingTab}
              setAccountingTab={setAccountingTab}
            />
          </CardContent>
        </Card>
        </main>
      </div>
    </div>
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
      <div className="space-y-4 sm:space-y-6">
      {/* Accounting Sub-tabs */}
      <Tabs value={accountingTab} onValueChange={setAccountingTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm py-2 sm:py-1.5">Overview</TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs sm:text-sm py-2 sm:py-1.5">All Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-4 sm:space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(metrics.totalRevenue)}</div>
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
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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
            <CardContent className="p-3 sm:p-6">
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Date</TableHead>
                      <TableHead className="text-xs sm:text-sm">Customer</TableHead>
                      <TableHead className="text-xs sm:text-sm">Type</TableHead>
                      <TableHead className="text-xs sm:text-sm">Method</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Amount</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                      <TableHead className="hidden md:table-cell text-xs sm:text-sm">Transaction ID</TableHead>
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
                          <TableCell className="text-xs sm:text-sm">{transaction.date}</TableCell>
                          <TableCell className="font-medium text-xs sm:text-sm">{transaction.customer}</TableCell>
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

