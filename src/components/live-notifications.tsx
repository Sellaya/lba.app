'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const CLIENT_NAMES = [
  'Sarah M.',
  'Ayesha K.',
  'Emily R.',
  'Nadia S.',
  'Jessica L.',
  'Mariam A.',
  'Priya D.',
  'Hannah B.',
  'Fatima Z.',
  'Olivia T.',
];

const LOCATIONS = [
  'Toronto',
  'Mississauga',
  'Brampton',
  'Caledon',
  'Vaughan',
  'Markham',
  'Richmond Hill',
  'Aurora',
  'Newmarket',
  'East Gwillimbury',
  'Georgina',
  'Whitchurch-Stouffville',
  'King',
  'Ajax',
  'Pickering',
  'Whitby',
  'Oshawa',
  'Clarington',
  'Uxbridge',
  'Scugog',
  'Brock',
  'Oakville',
  'Milton',
  'Halton Hills',
  'Burlington',
];

const MESSAGE_TEMPLATES = [
  { template: 'Just finished a bridal glam in {location}.', needsClient: false, needsDate: false },
  { template: '{client} just booked her party makeup appointment.', needsClient: true, needsDate: false },
  { template: 'Bridal trial completed for {client} today.', needsClient: true, needsDate: false },
  { template: 'Makeup session wrapped up in {location}.', needsClient: false, needsDate: false },
  { template: 'Aisha confirmed her bridal makeup booking.', needsClient: false, needsDate: false },
  { template: 'Completed bridesmaid glam in {location}.', needsClient: false, needsDate: false },
  { template: 'New booking received for full glam.', needsClient: false, needsDate: false },
  { template: 'Just finished an engagement makeup look.', needsClient: false, needsDate: false },
  { template: 'Mariam booked her photoshoot makeup slot.', needsClient: false, needsDate: false },
  { template: 'Party glam completed in {location}.', needsClient: false, needsDate: false },
  { template: 'Fresh bridal appointment confirmed for {date}.', needsClient: false, needsDate: true },
  { template: 'Zara just booked her bridal trial.', needsClient: false, needsDate: false },
  { template: 'Finished a soft glam in {location}.', needsClient: false, needsDate: false },
  { template: 'New makeup & hair booking received.', needsClient: false, needsDate: false },
  { template: 'Aleena reserved her wedding day makeup today.', needsClient: false, needsDate: false },
];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateMessage(): string {
  const template = getRandomItem(MESSAGE_TEMPLATES);
  let message = template.template;

  if (template.needsClient) {
    message = message.replace('{client}', getRandomItem(CLIENT_NAMES));
  }

  // Replace location if it exists in the template
  if (message.includes('{location}')) {
    message = message.replace(/{location}/g, getRandomItem(LOCATIONS));
  }

  // Replace date if needed
  if (template.needsDate) {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 7) + 1);
    const dateStr = futureDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    message = message.replace('{date}', dateStr);
  }

  return message;
}

export function LiveNotifications() {
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Generate initial message
    setCurrentMessage(generateMessage());
    setIsVisible(true);

    // Show new message every 8-12 seconds
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentMessage(generateMessage());
        setIsVisible(true);
      }, 300); // Fade out, then fade in with new message
    }, 8000 + Math.random() * 4000); // Random between 8-12 seconds

    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-40',
        'w-auto max-w-[280px] sm:max-w-[340px]',
        'transition-all duration-700 ease-in-out',
        isVisible ? 'opacity-75 hover:opacity-95 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      )}
    >
      <div
        className={cn(
          'bg-background/85 backdrop-blur-md border border-border/60 rounded-lg shadow-md',
          'px-3 py-2 sm:px-3.5 sm:py-2.5',
          'flex items-center gap-2 sm:gap-2.5',
          'text-[11px] sm:text-xs',
          'transition-all duration-300 hover:bg-background/95 hover:border-border/80 hover:shadow-lg'
        )}
      >
        {/* Bell Icon with subtle animation */}
        <div className="flex-shrink-0 relative">
          <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary/80 animate-pulse" />
          <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-primary/60 rounded-full animate-ping" />
        </div>

        {/* Message - More visible */}
        <div className="flex-1 min-w-0">
          <p className="text-foreground/90 leading-tight">
            <span className="text-primary/90 font-medium">Live:</span>{' '}
            <span className="text-muted-foreground/85">{currentMessage}</span>
          </p>
        </div>

        {/* Dismiss Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 opacity-50 hover:opacity-80 -mr-1"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </Button>
      </div>
    </div>
  );
}

