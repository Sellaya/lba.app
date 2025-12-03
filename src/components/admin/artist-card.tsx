'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Mail, Phone, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { MakeupArtist } from '@/app/api/artists/route';

interface ArtistCardProps {
  artist: MakeupArtist;
  onEdit: (artist: MakeupArtist) => void;
  onDelete: (artistId: string) => void;
  isDeleting: boolean;
  formatWhatsApp: (whatsapp: string) => string;
}

export function ArtistCard({ artist, onEdit, onDelete, isDeleting, formatWhatsApp }: ArtistCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <Card className="rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200">
        <CardContent className="p-4 md:p-5">
          <div className="space-y-3 md:space-y-4">
            {/* Header: Name */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base md:text-lg font-semibold text-foreground truncate flex-1">
                {artist.name}
              </h3>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(artist)}
                  className="h-8 w-8 md:h-9 md:w-9 touch-manipulation active:scale-95"
                  aria-label="Edit artist"
                >
                  <Edit className="h-4 w-4 md:h-4 md:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                  className="h-8 w-8 md:h-9 md:w-9 touch-manipulation active:scale-95 text-destructive hover:text-destructive"
                  aria-label="Delete artist"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 md:h-4 md:w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 md:h-4 md:w-4" />
                  )}
                </Button>
              </div>
            </div>

          {/* Contact Information */}
          <div className="space-y-2">
            {/* Email */}
            <div className="flex items-center gap-2 text-sm md:text-base">
              <Mail className="h-4 w-4 md:h-4 md:w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate flex-1 min-w-0">
                {artist.email}
              </span>
            </div>

            {/* WhatsApp */}
            <div className="flex items-center gap-2 text-sm md:text-base">
              <Phone className="h-4 w-4 md:h-4 md:w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate flex-1 min-w-0">
                {formatWhatsApp(artist.whatsapp)}
              </span>
            </div>

            {/* Address */}
            {(() => {
              const addr = artist.address as any;
              if (
                typeof addr === 'string' &&
                addr.trim().length > 0
              ) {
                return (
                  <div className="flex items-start gap-2 text-sm md:text-base">
                    <MapPin className="h-4 w-4 md:h-4 md:w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-muted-foreground flex-1 min-w-0">
                      <p className="text-sm break-words">{addr}</p>
                    </div>
                  </div>
                );
              }

              if (
                addr &&
                typeof addr === 'object' &&
                (addr.street || addr.city || addr.province || addr.postalCode)
              ) {
                return (
                  <div className="flex items-start gap-2 text-sm md:text-base">
                    <MapPin className="h-4 w-4 md:h-4 md:w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-muted-foreground flex-1 min-w-0">
                      {addr.street && (
                        <p className="font-medium text-foreground">{addr.street}</p>
                      )}
                      {(addr.city || addr.province || addr.postalCode) && (
                        <p className="text-sm">
                          {[addr.city, addr.province, addr.postalCode]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 opacity-50" />
                  <span>No address provided</span>
                </div>
              );
            })()}
          </div>
        </div>
      </CardContent>
    </Card>

    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent className="w-[90vw] max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Artist?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {artist.name} from your team. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-9" onClick={() => setShowDeleteDialog(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (artist.id) {
                onDelete(artist.id);
                setShowDeleteDialog(false);
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

