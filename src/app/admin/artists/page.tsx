'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, Plus, Edit, Trash2, Mail, Phone, User, FileText, Users, TrendingUp, DollarSign, Menu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSettings } from '@/components/admin-settings';
import Image from 'next/image';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export interface MakeupArtist {
  id?: string;
  name: string;
  email: string;
  whatsapp: string;
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export default function ArtistsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [artists, setArtists] = useState<MakeupArtist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingArtist, setEditingArtist] = useState<MakeupArtist | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    address: {
      street: '',
      city: '',
      province: '',
      postalCode: '',
    },
  });

  // Format phone number as user types (US/Canada format)
  // Always includes +1 by default
  const formatPhoneInput = (value: string): string => {
    // Remove all non-digit characters
    const cleaned = value.replace(/\D/g, '');
    
    // If empty, return empty
    if (cleaned.length === 0) {
      return '';
    }
    
    // Always treat as US/Canada number - add 1 if not present
    let digits = cleaned;
    if (!cleaned.startsWith('1')) {
      // If doesn't start with 1, prepend it (US/Canada country code)
      digits = '1' + cleaned;
    }
    
    // Limit to 11 digits (1 + 10 digits for US/Canada)
    const limited = digits.slice(0, 11);
    
    // Format based on length
    if (limited.length === 1) {
      // Just country code
      return '+1';
    } else if (limited.length <= 4) {
      // Country code + area code start
      return `+1 (${limited.slice(1)}`;
    } else if (limited.length <= 7) {
      // Country code + area code + exchange
      return `+1 (${limited.slice(1, 4)}) ${limited.slice(4)}`;
    } else {
      // Full number
      return `+1 (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7)}`;
    }
  };

  const fetchArtists = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/artists', { cache: 'no-store' });
      const data = await res.json();
      
      if (!res.ok) {
        // Check if column is missing (error 42703)
        if (data.errorCode === '42703' || data.error?.includes('42703') || data.error?.includes('Table structure is incorrect')) {
          setError('Table structure is incorrect. The table exists but is missing required columns.');
          toast({
            variant: 'destructive',
            title: 'Table Structure Error',
            description: `Error 42703: The table exists but has wrong structure. Check the error message for SQL to fix it.`,
          });
          return;
        }
        
        // Check if table doesn't exist - check multiple error codes and messages
        const isTableNotFound = 
          data.error && (
            data.error.includes('does not exist') || 
            data.error.includes('42P01') || 
            data.error.includes('PGRST116') ||
            data.error.includes('schema cache') ||
            data.error.includes('Could not find the table') ||
            data.error.includes('Table does not exist') ||
            res.status === 404
          );
        
        if (isTableNotFound) {
          setError('Database table not found. Please create the makeup_artists table first.');
          toast({
            variant: 'destructive',
            title: 'Table Not Found',
            description: `The database table does not exist. Error: ${data.errorCode || 'Unknown'}. Click "Create Dummy Artists" to get setup instructions.`,
          });
          return;
        }
        throw new Error(data.error || data.message || 'Failed to fetch artists');
      }
      
      // Success - clear any previous errors
      setError(null);
      // Normalize address data to ensure it's always an object or undefined
      const normalizedArtists = (data.artists || []).map((artist: any) => ({
        ...artist,
        address: artist.address && typeof artist.address === 'object' ? artist.address : undefined,
      }));
      setArtists(normalizedArtists);
    } catch (err: any) {
      setError(err.message);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to load artists. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArtists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDialog = (artist?: MakeupArtist) => {
    if (artist) {
      setEditingArtist(artist);
      // Format the WhatsApp number when editing - ensure it has +1 format
      const cleaned = artist.whatsapp.replace(/\D/g, '');
      let digits = cleaned;
      // If doesn't start with 1, prepend it
      if (!cleaned.startsWith('1') && cleaned.length === 10) {
        digits = '1' + cleaned;
      }
      // Format with +1
      const formattedWhatsApp = formatPhoneInput(digits);
      // Normalize address to ensure it's always an object with all fields
      const normalizedAddress = artist.address && typeof artist.address === 'object' 
        ? {
            street: artist.address.street || '',
            city: artist.address.city || '',
            province: artist.address.province || '',
            postalCode: artist.address.postalCode || '',
          }
        : {
            street: '',
            city: '',
            province: '',
            postalCode: '',
          };
      
      setFormData({
        name: artist.name,
        email: artist.email,
        whatsapp: formattedWhatsApp || '+1',
        address: normalizedAddress,
      });
    } else {
      setEditingArtist(null);
      setFormData({
        name: '',
        email: '',
        whatsapp: '',
        address: {
          street: '',
          city: '',
          province: '',
          postalCode: '',
        },
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingArtist(null);
    setFormData({
      name: '',
      email: '',
      whatsapp: '',
      address: {
        street: '',
        city: '',
        province: '',
        postalCode: '',
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.whatsapp) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all fields.',
      });
      return;
    }

    try {
      const url = editingArtist ? '/api/artists' : '/api/artists';
      const method = editingArtist ? 'PUT' : 'POST';
      
      // Clean up address - only include if at least one field has data
      const hasAddressData = formData.address && typeof formData.address === 'object' && (
        (formData.address.street && formData.address.street.trim()) ||
        (formData.address.city && formData.address.city.trim()) ||
        (formData.address.province && formData.address.province.trim()) ||
        (formData.address.postalCode && formData.address.postalCode.trim())
      );
      
      // Only include address if it has data, otherwise omit it (API will set to null)
      const cleanedFormData: any = {
        name: formData.name,
        email: formData.email,
        whatsapp: formData.whatsapp,
      };
      
      if (hasAddressData) {
        cleanedFormData.address = formData.address;
      }
      
      const body = editingArtist
        ? { id: editingArtist.id, ...cleanedFormData }
        : cleanedFormData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save artist');
      }

      toast({
        title: 'Success',
        description: editingArtist ? 'Artist updated successfully!' : 'Artist added successfully!',
      });

      handleCloseDialog();
      fetchArtists();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to save artist. Please try again.',
      });
    }
  };

  const handleDelete = async (artistId: string) => {
    setIsDeleting(artistId);
    try {
      const res = await fetch(`/api/artists?id=${artistId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete artist');
      }

      toast({
        title: 'Success',
        description: 'Artist deleted successfully!',
      });

      fetchArtists();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to delete artist. Please try again.',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const formatWhatsApp = (whatsapp: string) => {
    // Format: +1 (234) 567-8900
    const cleaned = whatsapp.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return whatsapp;
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setFormData({ ...formData, whatsapp: formatted });
  };

  const navItems = [
    { href: '/admin', label: 'Bookings', icon: FileText },
    { href: '/admin/artists', label: 'Artists', icon: Users },
    { href: '/admin/accounting', label: 'Accounting', icon: TrendingUp },
    { href: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  ];

  // Reusable Navigation Component
  const NavigationMenu = ({ onNavigate }: { onNavigate?: () => void }) => {
    return (
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const handleClick = () => {
            if (onNavigate) onNavigate();
          };
          
          if (item.href === '/admin/pricing') {
            return (
              <button
                key={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(item.href);
                  handleClick();
                }}
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
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClick}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen w-full bg-muted/40">
        <div className="flex flex-1 flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-black" />
          <p className="mt-4 text-muted-foreground">Loading Artists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {/* Sidebar - Desktop Only */}
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
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 sm:gap-4 border-b bg-background px-2 sm:px-4 md:px-6">
          {/* Mobile Menu Button */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="border-b px-6 py-4">
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

          <h2 className="text-base sm:text-xl font-semibold text-foreground truncate flex-1 min-w-0">
            Team Management
          </h2>
          <div className="ml-auto flex-shrink-0">
            <AdminSettings />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-2 sm:p-4 sm:px-6 sm:py-4 md:gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Manage your team members and their contact information</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Artist
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingArtist ? 'Edit Artist' : 'Add New Artist'}</DialogTitle>
                  <DialogDescription>
                    {editingArtist ? 'Update artist information below.' : 'Add a new makeup artist to your team.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Artist name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="artist@example.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp Number *</Label>
                      <Input
                        id="whatsapp"
                        type="tel"
                        value={formData.whatsapp}
                        onChange={handleWhatsAppChange}
                        placeholder="+1 (416) 555-1234"
                        required
                        maxLength={17} // +1 (416) 555-1234 = 17 chars
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter US/Canada number (10 digits). +1 will be added automatically. Format: +1 (416) 555-1234
                      </p>
                    </div>
                    <div className="space-y-4 pt-2 border-t">
                      <p className="text-sm font-medium">Address (Optional)</p>
                      <div className="space-y-2">
                        <Label htmlFor="street">Street Address</Label>
                        <Input
                          id="street"
                          value={formData.address?.street || ''}
                          onChange={(e) => setFormData({ ...formData, address: { ...(formData.address || {}), street: e.target.value } })}
                          placeholder="123 Main Street"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={formData.address?.city || ''}
                            onChange={(e) => setFormData({ ...formData, address: { ...(formData.address || {}), city: e.target.value } })}
                            placeholder="Toronto"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="province">Province</Label>
                          <Input
                            id="province"
                            value={formData.address?.province || ''}
                            onChange={(e) => setFormData({ ...formData, address: { ...(formData.address || {}), province: e.target.value } })}
                            placeholder="ON"
                            maxLength={2}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postal Code</Label>
                        <Input
                          id="postalCode"
                          value={formData.address?.postalCode || ''}
                          onChange={(e) => setFormData({ ...formData, address: { ...(formData.address || {}), postalCode: e.target.value.toUpperCase() } })}
                          placeholder="M5H 2N2"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingArtist ? 'Update' : 'Add'} Artist
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="font-semibold">{error}</p>
                </div>
                {(error.includes('table') || error.includes('Table') || error.includes('not found') || error.includes('structure') || error.includes('42703')) ? (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">
                      {error.includes('structure') || error.includes('42703') 
                        ? 'The table exists but has wrong structure. Drop and recreate it:' 
                        : 'To fix this:'}
                    </p>
                    {error.includes('structure') || error.includes('42703') ? (
                      <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-200">
                        ⚠️ WARNING: This will delete all existing data in the table!
                      </div>
                    ) : (
                      <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground mb-3">
                        <li>Go to your Supabase Dashboard → SQL Editor</li>
                        <li>Run the SQL script below</li>
                        <li>Wait 10-30 seconds for Supabase to refresh the schema cache</li>
                        <li>Click "Refresh / Check Again" button below</li>
                      </ol>
                    )}
                    <div className="mb-3 p-3 bg-background rounded border text-xs font-mono overflow-x-auto">
                      <p className="font-semibold mb-1">SQL Script to run:</p>
                      <code className="text-xs whitespace-pre">
                        {error.includes('structure') || error.includes('42703') 
                          ? `-- Drop the existing table (WARNING: Deletes all data!)
DROP TABLE IF EXISTS makeup_artists CASCADE;

-- Create the table with correct structure:
CREATE TABLE makeup_artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_makeup_artists_email ON makeup_artists(email);

ALTER TABLE makeup_artists DISABLE ROW LEVEL SECURITY;`
                          : `CREATE TABLE IF NOT EXISTS makeup_artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_makeup_artists_email ON makeup_artists(email);

ALTER TABLE makeup_artists DISABLE ROW LEVEL SECURITY;`}
                      </code>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          fetchArtists();
                          toast({
                            title: 'Refreshing...',
                            description: 'Checking if table exists now.',
                          });
                        }}
                      >
                        Refresh / Check Again
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const sqlScript = error.includes('structure') || error.includes('42703')
                            ? `-- Drop the existing table (WARNING: Deletes all data!)
DROP TABLE IF EXISTS makeup_artists CASCADE;

-- Create the table with correct structure:
CREATE TABLE makeup_artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  address JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_makeup_artists_email ON makeup_artists(email);

ALTER TABLE makeup_artists DISABLE ROW LEVEL SECURITY;`
                            : `CREATE TABLE IF NOT EXISTS makeup_artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  address JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_makeup_artists_email ON makeup_artists(email);

ALTER TABLE makeup_artists DISABLE ROW LEVEL SECURITY;`;
                          navigator.clipboard.writeText(sqlScript);
                          toast({
                            title: 'SQL Script Copied!',
                            description: 'Paste it in your Supabase SQL Editor and run it.',
                          });
                        }}
                      >
                        Copy SQL Script
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Artists ({artists.length})</CardTitle>
            <CardDescription>Your makeup artist team members</CardDescription>
          </CardHeader>
          <CardContent>
            {artists.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No artists added yet.</p>
                <p className="text-sm text-muted-foreground mt-2">Click "Add Artist" to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden">
                    <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm min-w-[120px]">Name</TableHead>
                    <TableHead className="text-xs sm:text-sm min-w-[180px]">Email</TableHead>
                    <TableHead className="text-xs sm:text-sm min-w-[140px]">WhatsApp</TableHead>
                    <TableHead className="text-xs sm:text-sm min-w-[150px]">Address</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {artists.map((artist) => (
                    <TableRow key={artist.id}>
                      <TableCell className="font-medium text-xs sm:text-sm">{artist.name}</TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{artist.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{formatWhatsApp(artist.whatsapp)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {artist.address && typeof artist.address === 'object' && (artist.address?.street || artist.address?.city) ? (
                          <div className="text-sm">
                            {artist.address?.street && (
                              <p className="font-medium">{artist.address.street}</p>
                            )}
                            {(artist.address?.city || artist.address?.province || artist.address?.postalCode) && (
                              <p className="text-muted-foreground">
                                {[artist.address?.city, artist.address?.province, artist.address?.postalCode].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(artist)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isDeleting === artist.id}
                              >
                                {isDeleting === artist.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete {artist.name} from your team. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => artist.id && handleDelete(artist.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </main>
      </div>
    </div>
  );
}

