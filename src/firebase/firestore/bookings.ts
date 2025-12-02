'use client';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { FinalQuote } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { sendQuoteEmail } from '@/lib/email';

export type BookingDocument = {
    id: string;
    uid: string; // User ID of the owner
    finalQuote: FinalQuote;
    createdAt: Timestamp | Date;
    updatedAt?: Timestamp;
}

// Client-side saveBooking for UI interactions like the admin panel or user-side updates
export async function saveBookingClient(
    firestore: Firestore,
    booking: Partial<BookingDocument> & { id: string }
) {
    const bookingRef = doc(firestore, 'bookings', booking.id);
    
    // Use JSON stringify/parse to deep-clone and remove any undefined values
    const bookingData = JSON.parse(JSON.stringify(booking));

    const dataToSave: any = {
        ...bookingData,
        updatedAt: serverTimestamp(),
    };
    
    // If the booking doesn't have a createdAt field yet, add it.
    if (!booking.createdAt) {
        dataToSave.createdAt = serverTimestamp();
    }


    try {
        await setDoc(bookingRef, dataToSave, { merge: true });
    } catch (error: any) {
        errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
                path: bookingRef.path,
                operation: 'write',
                requestResourceData: dataToSave,
            })
        );
        // We throw the error here so the calling UI can handle it (e.g., show a toast)
        throw error;
    }
}


// Function to be called from the client after the server action returns the quote
export async function saveBookingAndSendEmail(
    firestore: Firestore,
    booking: Omit<BookingDocument, 'updatedAt'>
) {
    const bookingRef = doc(firestore, 'bookings', booking.id);
    
    const dataToSave: BookingDocument = {
        ...booking,
        updatedAt: serverTimestamp() as Timestamp,
        createdAt: booking.createdAt || serverTimestamp(),
    };

    try {
        await setDoc(bookingRef, dataToSave, { merge: true });
        
        if (booking.finalQuote.status === 'quoted') {
            await sendQuoteEmail(booking.finalQuote);
        }
    } catch (error: any) {
        console.error(`[Client] Error saving booking ${booking.id}:`, error);
        errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
                path: bookingRef.path,
                operation: 'create',
                requestResourceData: dataToSave,
            })
        );
        throw new Error(`Failed to save booking data: ${error.message}`);
    }
}


export async function getBookingClient(firestore: Firestore, bookingId: string): Promise<BookingDocument | null> {
    const bookingRef = doc(firestore, 'bookings', bookingId);
    
    try {
        const docSnap = await getDoc(bookingRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (!data) return null;
            return {
                ...data,
                id: docSnap.id,
            } as BookingDocument;
        } else {
            return null;
        }
    } catch (error: any) {
         if (typeof window !== 'undefined') { // Only create contextual error on client
            const permissionError = new FirestorePermissionError({
                path: bookingRef.path,
                operation: 'get'
            });
            errorEmitter.emit('permission-error', permissionError);
            throw permissionError; // re-throw the contextual error
         }
         throw error; // On server, just throw original error
    }
}

export async function deleteBooking(firestore: Firestore, bookingId: string): Promise<void> {
    const bookingRef = doc(firestore, 'bookings', bookingId);
    try {
        await deleteDoc(bookingRef);
    } catch (error) {
        errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
                path: bookingRef.path,
                operation: 'delete',
            })
        );
        throw error;
    }
}


export async function uploadPaymentScreenshot(file: File, bookingId: string, userId: string): Promise<string> {
    if (!file) {
        throw new Error("No file provided for upload.");
    }
    const storage = getStorage();
    const filePath = `payment_screenshots/${userId}/${bookingId}/${file.name}`;
    const storageRef = ref(storage, filePath);
    
    const metadata = {
        contentType: file.type,
    };

    try {
        const snapshot = await uploadBytes(storageRef, file, metadata);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error: any) {
        console.error("Firebase Storage Upload Error:", error);
        // This will be a specific Firebase Storage error, which is useful for debugging.
        // For example, 'storage/unauthorized' for permission issues.
        throw new Error(`Upload failed: ${error.code} - ${error.message}`);
    }
}
