'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BookingFlow from '@/components/booking-flow';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Image from 'next/image';
import { GoogleReviews } from '@/components/google-reviews';
import { LiveNotifications } from '@/components/live-notifications';

export default function Home() {
  const [bookingId, setBookingId] = useState('');
  const [email, setEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!bookingId || bookingId.trim() === '') {
      toast({
        variant: 'destructive',
        title: 'Booking ID Required',
        description: 'Please enter your Booking ID.',
      });
      return;
    }

    if (!email || email.trim() === '') {
      toast({
        variant: 'destructive',
        title: 'Email Required',
        description: 'Please enter your email address.',
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        variant: 'destructive',
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
      });
      return;
    }

    setIsSearching(true);

    try {
      // Verify booking ID and email match
      const res = await fetch('/api/bookings/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingId.trim(),
          email: email.trim(),
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        toast({
          variant: 'destructive',
          title: 'Booking Not Found',
          description: error || 'Booking not found with these details.',
        });
        return;
      }

      // If verification successful, redirect to quote page
      setIsDialogOpen(false);
      router.push(`/book/${bookingId.trim()}`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An error occurred while searching. Please try again.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Live Notifications */}
      <LiveNotifications />
      
      <header className="py-1 sm:py-1.5 px-4 md:px-8">
        <div className="flex flex-col items-center justify-center space-y-1 sm:space-y-1.5 animate-in fade-in slide-in-from-top-4 duration-1000">
          <a href="https://looksbyanum.com" target="_blank" rel="noopener noreferrer" className="relative w-48 h-48 sm:w-52 sm:h-52 md:w-56 md:h-56 hover:opacity-80 transition-opacity cursor-pointer">
            <Image
              src="/LBA.png"
              alt="Looks by Anum Logo"
              fill
              sizes="(max-width: 640px) 192px, (max-width: 768px) 208px, 224px"
              className="object-contain"
              priority
            />
          </a>
          <div className="text-center">
            <h1 className="font-headline text-4xl md:text-5xl font-bold text-black tracking-wider">Looks by Anum</h1>
            <p className="text-center text-lg text-muted-foreground mt-1.5 sm:mt-2 font-body animate-in fade-in slide-in-from-top-4 duration-1000 delay-200">Your personal makeup artist for every occasion.</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 pb-8 sm:pb-12 md:pb-16">
        <div className="max-w-2xl mx-auto my-4 sm:my-5 md:my-6 animate-in fade-in slide-in-from-top-4 duration-1000 delay-300">
            <div className="text-center">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="lg" className="h-12 px-8">
                            <Search className="mr-2 h-5 w-5" />
                            Find Your Quote
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="font-headline text-xl sm:text-2xl">Find Your Quote</DialogTitle>
                            <DialogDescription className="text-sm sm:text-base">
                                Already have a quote? Enter your Booking ID and email to view it.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label htmlFor="booking-id" className="text-sm font-medium">
                                    Booking ID
                                </label>
                                <Input
                                    id="booking-id"
                                    type="text"
                                    placeholder="Enter Booking ID"
                                    value={bookingId}
                                    onChange={(e) => setBookingId(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="h-11 text-base"
                                    disabled={isSearching}
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="Enter your email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className="h-11 text-base pl-10"
                                        disabled={isSearching}
                                    />
                                </div>
                            </div>
                            <Button 
                                type="button" 
                                onClick={handleSearch} 
                                className="w-full h-11"
                                disabled={isSearching}
                            >
                                {isSearching ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Searching...
                                    </>
                                ) : (
                                    <>
                                        <Search className="mr-2 h-4 w-4" />
                                        Search
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>

        <div className="text-center mb-4 sm:mb-5 md:mb-6 animate-in fade-in slide-in-from-top-4 duration-1000 delay-400">
            <h2 className="font-headline text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">Book Your Session</h2>
            <p className="text-base sm:text-lg text-muted-foreground mt-1.5 sm:mt-2 max-w-2xl mx-auto font-body px-3 sm:px-0">
              Select your services, choose your dates, and get an instant quote for a flawless makeup experience.
            </p>
        </div>
        
        <BookingFlow />

        {/* Google Reviews Section */}
        <GoogleReviews />
      </main>
    </div>
  );
}
