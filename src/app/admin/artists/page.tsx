'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, Plus, Edit, Trash2, Mail, Phone, User, FileText, Users, TrendingUp, DollarSign, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSettings } from '@/components/admin-settings';
import { ArtistCard } from '@/components/admin/artist-card';
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
  const [searchTerm, setSearchTerm] = useState('');
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
      // Normalize address data to ensure it's always a usable object when present
      const normalizedArtists = (data.artists || []).map((artist: any) => {
        let address: any = undefined;

        if (artist.address) {
          if (typeof artist.address === 'string') {
            try {
              const parsed = JSON.parse(artist.address);
              if (parsed && typeof parsed === 'object') {
                address = parsed;
              } else {
                // Keep raw string if it's not valid JSON object
                address = artist.address;
              }
            } catch {
              // Keep raw string if JSON.parse fails
              address = artist.address;
            }
          } else if (typeof artist.address === 'object') {
            address = artist.address;
          }
        }

        return {
          ...artist,
          address,
        };
      });
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

  // Filter artists based on search term
  const filteredArtists = artists.filter((artist) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      artist.name.toLowerCase().includes(term) ||
      artist.email.toLowerCase().includes(term) ||
      artist.whatsapp.toLowerCase().includes(term) ||
      (artist.address &&
        typeof artist.address === 'object' &&
        (
          artist.address.street?.toLowerCase().includes(term) ||
          artist.address.city?.toLowerCase().includes(term) ||
          artist.address.province?.toLowerCase().includes(term) ||
          artist.address.postalCode?.toLowerCase().includes(term)
        ))
    );
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen w-full bg-muted/40">
        <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center gap-2 sm:gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-foreground truncate flex-1 min-w-0">
            Artists
          </h2>
          <div className="ml-auto flex-shrink-0">
            <AdminSettings />
          </div>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center p-4">
          <Loader2 className="h-12 w-12 animate-spin text-black" />
          <p className="mt-4 text-muted-foreground">Loading Artists...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-muted/40">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center gap-2 sm:gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-foreground truncate flex-1 min-w-0">
          Artists
        </h2>
        <div className="ml-auto flex-shrink-0">
          <AdminSettings />
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 md:gap-4 p-3 md:p-4 md:px-6">
        {/* Search and Add Section */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search artists by name, email, phone, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 md:h-10 text-sm"
            />
          </div>
          
          {/* Add Button */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenDialog()}
                className="w-full sm:w-auto h-9 md:h-10 touch-manipulation active:scale-95"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Artist
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md max-h-[95vh] overflow-y-auto p-4 md:p-6">
              <DialogHeader className="pb-3">
                <DialogTitle className="text-base md:text-lg">
                  {editingArtist ? 'Edit Artist' : 'Add New Artist'}
                </DialogTitle>
                <DialogDescription className="text-xs md:text-sm">
                  {editingArtist
                    ? 'Update artist information below.'
                    : 'Add a new makeup artist to your team.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs md:text-sm">
                      Name *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Artist name"
                      required
                      className="h-9 md:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs md:text-sm">
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="artist@example.com"
                      required
                      className="h-9 md:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp" className="text-xs md:text-sm">
                      WhatsApp Number *
                    </Label>
                    <Input
                      id="whatsapp"
                      type="tel"
                      value={formData.whatsapp}
                      onChange={handleWhatsAppChange}
                      placeholder="+1 (416) 555-1234"
                      required
                      maxLength={17}
                      className="h-9 md:h-10 text-sm"
                    />
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      Enter US/Canada number (10 digits). +1 will be added automatically. Format: +1 (416) 555-1234
                    </p>
                  </div>
                  <div className="space-y-4 pt-2 border-t">
                    <p className="text-xs md:text-sm font-medium">Address (Optional)</p>
                    <div className="space-y-2">
                      <Label htmlFor="street" className="text-xs md:text-sm">
                        Street Address
                      </Label>
                      <Input
                        id="street"
                        value={formData.address?.street || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...(formData.address || {}), street: e.target.value },
                          })
                        }
                        placeholder="123 Main Street"
                        className="h-9 md:h-10 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-xs md:text-sm">
                          City
                        </Label>
                        <Input
                          id="city"
                          value={formData.address?.city || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...(formData.address || {}), city: e.target.value },
                            })
                          }
                          placeholder="Toronto"
                          className="h-9 md:h-10 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="province" className="text-xs md:text-sm">
                          Province
                        </Label>
                        <Input
                          id="province"
                          value={formData.address?.province || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...(formData.address || {}), province: e.target.value },
                            })
                          }
                          placeholder="ON"
                          maxLength={2}
                          className="h-9 md:h-10 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode" className="text-xs md:text-sm">
                        Postal Code
                      </Label>
                      <Input
                        id="postalCode"
                        value={formData.address?.postalCode || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: {
                              ...(formData.address || {}),
                              postalCode: e.target.value.toUpperCase(),
                            },
                          })
                        }
                        placeholder="M5H 2N2"
                        maxLength={7}
                        className="h-9 md:h-10 text-sm"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    className="h-9 md:h-10"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="h-9 md:h-10">
                    {editingArtist ? 'Update' : 'Add'} Artist
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Artists List */}
        <Card className="rounded-xl border border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base md:text-lg">
                  Artists ({filteredArtists.length})
                </CardTitle>
                <CardDescription className="text-xs md:text-sm mt-1">
                  {searchTerm
                    ? `Showing ${filteredArtists.length} of ${artists.length} artists`
                    : 'Your makeup artist team members'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredArtists.length === 0 ? (
              <div className="text-center py-8 md:py-12">
                <User className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm md:text-base text-muted-foreground">
                  {searchTerm
                    ? 'No artists found matching your search.'
                    : 'No artists added yet.'}
                </p>
                {!searchTerm && (
                  <p className="text-xs md:text-sm text-muted-foreground mt-2">
                    Click "Add Artist" to get started.
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Mobile: Card Layout */}
                <div className="md:hidden space-y-3">
                  {filteredArtists.map((artist) => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      onEdit={handleOpenDialog}
                      onDelete={handleDelete}
                      isDeleting={isDeleting === artist.id}
                      formatWhatsApp={formatWhatsApp}
                    />
                  ))}
                </div>

                {/* Desktop: Table Layout */}
                <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-sm min-w-[150px]">Name</TableHead>
                            <TableHead className="text-sm min-w-[200px]">Email</TableHead>
                            <TableHead className="text-sm min-w-[160px]">WhatsApp</TableHead>
                            <TableHead className="text-sm min-w-[200px]">Address</TableHead>
                            <TableHead className="text-right text-sm w-[120px]">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredArtists.map((artist) => (
                            <TableRow key={artist.id}>
                              <TableCell className="font-medium text-sm">
                                {artist.name}
                              </TableCell>
                              <TableCell className="text-sm">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground truncate">
                                    {artist.email}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground truncate">
                                    {formatWhatsApp(artist.whatsapp)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const addr = artist.address as any;
                                  if (
                                    typeof addr === 'string' &&
                                    addr.trim().length > 0
                                  ) {
                                    return (
                                      <p className="text-sm text-muted-foreground break-words">
                                        {addr}
                                      </p>
                                    );
                                  }

                                  if (
                                    addr &&
                                    typeof addr === 'object' &&
                                    (addr.street || addr.city || addr.province || addr.postalCode)
                                  ) {
                                    return (
                                      <div className="text-sm">
                                        {addr.street && (
                                          <p className="font-medium">
                                            {addr.street}
                                          </p>
                                        )}
                                        {(addr.city || addr.province || addr.postalCode) && (
                                          <p className="text-muted-foreground">
                                            {[addr.city, addr.province, addr.postalCode]
                                              .filter(Boolean)
                                              .join(', ')}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }

                                  return (
                                    <span className="text-muted-foreground text-sm">
                                      —
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenDialog(artist)}
                                    className="h-8 w-8"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={isDeleting === artist.id}
                                        className="h-8 w-8"
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
                                          This will permanently delete {artist.name} from your
                                          team. This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() =>
                                            artist.id && handleDelete(artist.id)
                                          }
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
