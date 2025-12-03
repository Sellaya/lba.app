'use client';

import { Badge } from '@/components/ui/badge';
import { FileText, Clock, DollarSign, CheckCircle2, CalendarClock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusChipsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts: {
    all: number;
    quoted: number;
    pendingPayment: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
}

export function StatusChips({ activeTab, onTabChange, counts }: StatusChipsProps) {
  const tabs = [
    { value: 'all', label: 'All', icon: FileText, count: counts.all },
    { value: 'quoted', label: 'Quoted', icon: Clock, count: counts.quoted },
    { value: 'pendingPayment', label: 'Pending', icon: DollarSign, count: counts.pendingPayment },
    { value: 'confirmed', label: 'Confirmed', icon: CheckCircle2, count: counts.confirmed },
    { value: 'completed', label: 'Completed', icon: CalendarClock, count: counts.completed },
    { value: 'cancelled', label: 'Cancelled', icon: XCircle, count: counts.cancelled },
  ];

  return (
    <div className="sticky top-14 md:top-16 z-30 bg-background border-b px-3 md:px-4 py-1.5 md:py-2 shadow-sm">
      {/* Mobile: Horizontal Scrollable Chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 md:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                'border shadow-sm touch-manipulation active:scale-95',
                isActive
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-3 w-3 flex-shrink-0" />
              <span>{tab.label}</span>
              <Badge 
                variant="secondary" 
                className={cn(
                  'h-4 px-1 text-[10px] font-semibold min-w-[1.25rem] flex items-center justify-center',
                  isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                {tab.count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Desktop: Grid Layout */}
      <div className="hidden md:grid md:grid-cols-6 gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={cn(
                'flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                'border shadow-sm hover:shadow-md',
                isActive
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <Badge 
                variant="secondary" 
                className={cn(
                  'h-4 px-1 text-[10px] font-semibold min-w-[1.25rem] flex items-center justify-center',
                  isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                {tab.count}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

