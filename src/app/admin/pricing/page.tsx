'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, RefreshCw, DollarSign, AlertCircle, CheckCircle2, History, FileText, Users, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { formatToronto } from '@/lib/toronto-time';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSettings } from '@/components/admin-settings';
import Image from 'next/image';
import { formatPrice } from '@/lib/price-format';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

interface PricingItem {
  id: string;
  category: string;
  item_id: string;
  item_name: string;
  price_lead: number;
  price_team: number;
  metadata?: any;
}

interface PricingConfig {
  [category: string]: PricingItem[];
}

interface PriceHistory {
  id: string;
  category: string;
  item_id: string;
  price_lead: number;
  price_team: number;
  created_at: string;
}

interface ItemHistory {
  [key: string]: PriceHistory[];
}

export default function PricingManagementPage() {
  const { toast } = useToast();
  const [pricingData, setPricingData] = useState<PricingConfig>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalData, setOriginalData] = useState<PricingConfig>({});
  const [priceHistory, setPriceHistory] = useState<ItemHistory>({});
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: '/admin', label: 'Bookings', icon: FileText },
    { href: '/admin/artists', label: 'Artists', icon: Users },
    { href: '/admin/accounting', label: 'Accounting', icon: TrendingUp },
    { href: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  ];

  // Fetch pricing data
  const fetchPricing = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/pricing');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch pricing data');
      }
      const result = await res.json();
      const data = result.data || [];

      // Group by category
      const grouped: PricingConfig = {};
      data.forEach((item: PricingItem) => {
        if (!grouped[item.category]) {
          grouped[item.category] = [];
        }
        grouped[item.category].push(item);
      });

      delete grouped['service_option'];

      setPricingData(grouped);
      setOriginalData(JSON.parse(JSON.stringify(grouped))); // Deep copy
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error fetching pricing:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load pricing data: ' + (error.message || 'Unknown error'),
      });
      // Set empty data on error so the page can still render
      setPricingData({});
      setOriginalData({});
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch price history for a specific item
  const fetchItemHistory = async (category: string, itemId: string) => {
    try {
      const res = await fetch(`/api/pricing/history?category=${encodeURIComponent(category)}&item_id=${encodeURIComponent(itemId)}&limit=3`);
      if (res.ok) {
        const result = await res.json();
        const data = result.data || [];
        const key = `${category}-${itemId}`;
        setPriceHistory((prev) => ({
          ...prev,
          [key]: data,
        }));
      } else {
        console.error('Failed to fetch history:', await res.text());
      }
    } catch (error) {
      console.error('Error fetching price history:', error);
    }
  };

  // Toggle history visibility
  const toggleHistory = async (category: string, itemId: string) => {
    const key = `${category}-${itemId}`;
    const isCurrentlyExpanded = expandedItems.has(key);
    
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (isCurrentlyExpanded) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
    
    // Always fetch fresh history when expanding
    if (!isCurrentlyExpanded) {
      await fetchItemHistory(category, itemId);
    }
  };

  useEffect(() => {
    fetchPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update price
  const updatePrice = (category: string, itemId: string, tier: 'lead' | 'team', value: number) => {
    setPricingData((prev) => {
      const newData = { ...prev };
      const item = newData[category]?.find((i) => i.item_id === itemId);
      if (item) {
        item[`price_${tier}`] = value;
      }
      return newData;
    });
    setHasChanges(true);
  };

  // Save individual item instantly
  const handleSaveItem = async (category: string, itemId: string) => {
    const item = pricingData[category]?.find((i) => i.item_id === itemId);
    if (!item) return;

    const key = `${category}-${itemId}`;
    setSavingItems((prev) => new Set(prev).add(key));

    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{
            category: item.category,
            item_id: item.item_id,
            item_name: item.item_name,
            price_lead: item.price_lead,
            price_team: item.price_team,
            metadata: item.metadata,
          }],
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save');
      }

      toast({
        title: 'Saved',
        description: `${item.item_name} price updated successfully.`,
      });

      // Update original data
      setOriginalData((prev) => {
        const newData = { ...prev };
        if (!newData[category]) newData[category] = [];
        const index = newData[category].findIndex((i) => i.item_id === itemId);
        if (index >= 0) {
          newData[category][index] = { ...item };
        }
        return newData;
      });

      // Refresh history after a short delay to ensure it's saved
      setTimeout(() => {
        fetchItemHistory(category, itemId);
      }, 500);

      // Check if there are any other changes
      const hasOtherChanges = Object.entries(pricingData).some(([cat, items]) =>
        items.some((i) => {
          const orig = originalData[cat]?.find((o) => o.item_id === i.item_id);
          if (!orig) return false;
          return i.price_lead !== orig.price_lead || i.price_team !== orig.price_team;
        })
      );
      setHasChanges(hasOtherChanges);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save: ' + error.message,
      });
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: any[] = [];
      Object.values(pricingData).forEach((items) => {
        items.forEach((item) => {
          updates.push({
            category: item.category,
            item_id: item.item_id,
            item_name: item.item_name,
            price_lead: item.price_lead,
            price_team: item.price_team,
            metadata: item.metadata,
          });
        });
      });

      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save pricing');
      }

      const { results } = await res.json();
      const errors = results.filter((r: any) => r.error);
      if (errors.length > 0) {
        throw new Error(`Some updates failed: ${errors.map((e: any) => e.error).join(', ')}`);
      }

      toast({
        title: 'Success',
        description: 'Pricing updated successfully!',
      });
      setOriginalData(JSON.parse(JSON.stringify(pricingData)));
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving pricing:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save pricing: ' + error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset changes
  const handleReset = () => {
    setPricingData(JSON.parse(JSON.stringify(originalData)));
    setHasChanges(false);
    toast({
      title: 'Changes Reset',
      description: 'All unsaved changes have been reset.',
    });
  };

  // Initialize database (one-time setup)
  const handleInitialize = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/pricing/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await res.json();

      if (!res.ok) {
        // Check if table doesn't exist
        if (result.error === 'Table does not exist' && result.sqlScript) {
          toast({
            variant: 'destructive',
            title: 'Table Not Found',
            description: 'The pricing_config table does not exist. Please create it first using the SQL script in the console.',
          });
          console.error('SQL Script to create pricing_config table:\n\n', result.sqlScript);
          alert(
            'The pricing_config table does not exist.\n\n' +
            'Please:\n' +
            '1. Go to your Supabase Dashboard\n' +
            '2. Navigate to SQL Editor\n' +
            '3. Copy and run the SQL script shown in the browser console (F12)\n\n' +
            'Then click "Initialize Database" again.'
          );
          return;
        }
        throw new Error(result.error || result.message || 'Failed to initialize pricing');
      }

      toast({
        title: 'Success',
        description: 'Pricing database initialized successfully!',
      });
      await fetchPricing();
    } catch (error: any) {
      console.error('Error initializing pricing:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to initialize pricing: ' + error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const categoryLabels: Record<string, string> = {
    service: 'Services',
    addon: 'Add-ons',
    mobile_location: 'Travel Surcharges',
    bridal_party: 'Bridal Party Services',
  };

  const categoryDescriptions: Record<string, string> = {
    service: 'Base prices for main services',
    addon: 'Additional services and add-ons',
    mobile_location: 'Travel surcharges for mobile services',
    bridal_party: 'Services for bridal party members',
  };

  const isEmpty = Object.keys(pricingData).length === 0;

  const categoryDisplayOrder = ['service', 'addon', 'mobile_location', 'bridal_party'];
  const serviceItemOrder = ['bridal', 'semi-bridal', 'party', 'photoshoot'];

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
          return (
            <button
              key={item.href}
              onClick={handleClick}
              type="button"
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-black text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    );
  };

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
          
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">Pricing Management</h2>
          <div className="ml-auto flex items-center gap-2">
            <AdminSettings />
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-4 md:px-6 md:py-4">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-black" />
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-4">
              {/* Header Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Manage all service pricing for Lead Artist and Team</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isEmpty && (
                    <Button onClick={handleInitialize} disabled={isSaving} variant="outline" size="sm" className="h-9 sm:h-10 text-xs sm:text-sm">
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" />
                          <span className="hidden sm:inline">Initializing...</span>
                          <span className="sm:hidden">Init...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                          <span className="hidden sm:inline">Initialize Database</span>
                          <span className="sm:hidden">Init DB</span>
                        </>
                      )}
                    </Button>
                  )}
                  <Button onClick={fetchPricing} disabled={isLoading || isSaving} variant="outline" size="sm" className="h-9 sm:h-10 text-xs sm:text-sm">
                    <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                  {hasChanges && (
                    <>
                      <Button onClick={handleReset} disabled={isSaving} variant="outline" size="sm" className="h-9 sm:h-10 text-xs sm:text-sm">
                        Reset
                      </Button>
                      <Button onClick={handleSave} disabled={isSaving} size="sm" className="h-9 sm:h-10 text-xs sm:text-sm">
                        {isSaving ? (
                          <>
                            <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" />
                            <span className="hidden sm:inline">Saving...</span>
                            <span className="sm:hidden">Save...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                            <span className="hidden sm:inline">Save Changes</span>
                            <span className="sm:hidden">Save</span>
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Content */}
              {isEmpty ? (
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center py-8">
                      <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                      <h3 className="text-base font-semibold mb-1.5">No Pricing Found</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Click "Initialize Database" to sync the latest pricing into the dashboard.
                      </p>
                      <Button onClick={handleInitialize} disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Initializing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Initialize Database
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                  <Tabs defaultValue="lead" className="space-y-3">
                  <TabsList className="grid w-full max-w-md grid-cols-2 h-9">
                    <TabsTrigger value="lead" className="flex items-center gap-1.5 text-sm">
                      <DollarSign className="w-3.5 h-3.5" />
                      Lead Artist
                    </TabsTrigger>
                    <TabsTrigger value="team" className="flex items-center gap-1.5 text-sm">
                      <DollarSign className="w-3.5 h-3.5" />
                      Team
                    </TabsTrigger>
                  </TabsList>

                  {['lead', 'team'].map((tier) => (
                    <TabsContent key={tier} value={tier} className="space-y-3">
                      {Object.entries(pricingData)
                        .sort((a, b) => {
                          const indexA = categoryDisplayOrder.indexOf(a[0]);
                          const indexB = categoryDisplayOrder.indexOf(b[0]);
                          return indexA - indexB;
                        })
                        .map(([category, items]) => {
                          const orderedItems =
                            category === 'service'
                              ? [...items].sort((a, b) => {
                                  const indexA = serviceItemOrder.indexOf(a.item_id);
                                  const indexB = serviceItemOrder.indexOf(b.item_id);
                                  const safeIndexA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
                                  const safeIndexB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
                                  return safeIndexA - safeIndexB;
                                })
                              : items;
                          return (
                            <Card key={category}>
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      {categoryLabels[category] || category}
                                      <Badge variant="secondary" className="text-xs">{items.length} items</Badge>
                                    </CardTitle>
                                    <CardDescription className="text-xs mt-0.5">
                                      {categoryDescriptions[category] || 'Pricing configuration'}
                                    </CardDescription>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="space-y-2">
                                  {orderedItems.map((item) => {
                                const priceKey = `price_${tier}` as 'price_lead' | 'price_team';
                                const isModifier = item.metadata?.isModifier;
                                const itemKey = `${category}-${item.item_id}`;
                                const isSavingItem = savingItems.has(itemKey);
                                const isExpanded = expandedItems.has(itemKey);
                                const history = priceHistory[itemKey] || [];
                                const originalItem = originalData[category]?.find((o) => o.item_id === item.item_id);
                                const hasItemChanges = originalItem && (
                                  item.price_lead !== originalItem.price_lead ||
                                  item.price_team !== originalItem.price_team
                                );

                                return (
                                  <Collapsible
                                    key={item.item_id}
                                    open={isExpanded}
                                    onOpenChange={() => toggleHistory(category, item.item_id)}
                                  >
                                    <div className="border rounded-md">
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2.5">
                                        <div className="flex-1 min-w-0">
                                          <Label htmlFor={`${category}-${item.item_id}-${tier}`} className="text-xs sm:text-sm font-medium">
                                            {item.item_name}
                                          </Label>
                                          {item.metadata?.description && (
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.metadata.description}</p>
                                          )}
                                          {isModifier && (
                                            <Badge variant="outline" className="mt-1 text-xs h-4 px-1.5">
                                              Multiplier
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 sm:flex-shrink-0">
                                          <span className="text-xs text-muted-foreground">$</span>
                                          <Input
                                            id={`${category}-${item.item_id}-${tier}`}
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={item[priceKey] || ''}
                                            onChange={(e) => {
                                              const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                              updatePrice(category, item.item_id, tier as 'lead' | 'team', val);
                                            }}
                                            onBlur={() => {
                                              // Auto-save on blur if there are changes
                                              if (hasItemChanges) {
                                                handleSaveItem(category, item.item_id);
                                              }
                                            }}
                                            onKeyDown={(e) => {
                                              // Auto-save on Enter key
                                              if (e.key === 'Enter' && hasItemChanges) {
                                                e.preventDefault();
                                                handleSaveItem(category, item.item_id);
                                              }
                                            }}
                                            placeholder="0.00"
                                            className="w-full sm:w-28 h-9 sm:h-8 text-sm"
                                          />
                                        </div>
                                        <div className="flex items-center gap-1.5 sm:flex-shrink-0">
                                          {hasItemChanges && (
                                            <Button
                                              size="sm"
                                              onClick={() => handleSaveItem(category, item.item_id)}
                                              disabled={isSavingItem}
                                              className="h-9 sm:h-7 text-xs px-2 sm:px-2 min-w-[36px] sm:min-w-0"
                                            >
                                              {isSavingItem ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <Save className="w-3 h-3" />
                                              )}
                                            </Button>
                                          )}
                                          <CollapsibleTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-9 w-9 sm:h-7 sm:w-7 p-0"
                                            >
                                              <History className="w-3.5 h-3.5" />
                                            </Button>
                                          </CollapsibleTrigger>
                                        </div>
                                      </div>
                                      <CollapsibleContent>
                                        <div className="px-2.5 pb-2.5 border-t bg-muted/30">
                                          {history && history.length > 0 ? (
                                            <div className="pt-2 space-y-1.5">
                                              <p className="text-xs font-medium text-muted-foreground mb-1">Last 3 Changes:</p>
                                              {history.map((h) => (
                                                <div key={h.id} className="flex items-center justify-between text-xs bg-background p-1.5 rounded border">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">
                                                      {formatToronto(new Date(h.created_at), 'MMM d, yyyy h:mm a')}
                                                    </span>
                                                  </div>
                                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                                    {h.price_lead > 0 && (
                                                      <span className="text-muted-foreground text-xs">Lead: <span className="font-medium text-foreground">${formatPrice(h.price_lead)}</span></span>
                                                    )}
                                                    {h.price_team > 0 && (
                                                      <span className="text-muted-foreground text-xs">Team: <span className="font-medium text-foreground">${formatPrice(h.price_team)}</span></span>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-xs text-muted-foreground pt-2">No history available</p>
                                          )}
                                        </div>
                                      </CollapsibleContent>
                                    </div>
                                  </Collapsible>
                                );
                              })}
                            </div>
                          </CardContent>
                            </Card>
                          );
                        })}
                    </TabsContent>
                  ))}
                </Tabs>
              )}

              {/* Unsaved Changes Notification */}
              {hasChanges && (
                <div className="fixed bottom-3 right-3 bg-background border rounded-md shadow-lg p-2.5 flex items-center gap-2.5 z-50">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium">You have unsaved changes</span>
                  <div className="flex gap-1.5">
                    <Button onClick={handleReset} size="sm" variant="outline" className="h-7 text-xs px-2">
                      Reset
                    </Button>
                    <Button onClick={handleSave} size="sm" disabled={isSaving} className="h-7 text-xs px-2">
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
