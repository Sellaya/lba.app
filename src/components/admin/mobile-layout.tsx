'use client';

import { ReactNode } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, Users, TrendingUp, DollarSign } from 'lucide-react';

interface MobileLayoutProps {
  children: ReactNode;
  title: string;
  headerActions?: ReactNode;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

const navItems = [
  { href: '/admin', label: 'Bookings', icon: FileText },
  { href: '/admin/artists', label: 'Artists', icon: Users },
  { href: '/admin/accounting', label: 'Accounting', icon: TrendingUp },
  { href: '/admin/pricing', label: 'Pricing', icon: DollarSign },
];

export function MobileLayout({ 
  children, 
  title, 
  headerActions,
  isMobileMenuOpen,
  setIsMobileMenuOpen 
}: MobileLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {/* Desktop Sidebar - Hidden on mobile */}
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
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            if (item.href === '/admin/pricing') {
              return (
                <button
                  key={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(item.href);
                  }}
                  type="button"
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-black text-white'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Sticky Mobile Header */}
        <header className="sticky top-0 z-40 flex h-14 md:h-16 items-center gap-2 sm:gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
          {/* Mobile Menu Button */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9 -ml-1"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b px-6 py-5">
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
              <nav className="flex-1 space-y-1 p-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  
                  if (item.href === '/admin/pricing') {
                    return (
                      <button
                        key={item.href}
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(item.href);
                          setIsMobileMenuOpen(false);
                        }}
                        type="button"
                        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-black text-white'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Page Title */}
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-foreground truncate flex-1 min-w-0">
            {title}
          </h2>

          {/* Header Actions */}
          {headerActions && (
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              {headerActions}
            </div>
          )}
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}







