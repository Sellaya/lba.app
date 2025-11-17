'use client';

import { useContext } from 'react';
import { FirebaseContext, FirebaseContextValue } from './provider';

export const useFirebase = (): FirebaseContextValue => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useFirebase must be used within a FirebaseProvider');
    }
    return context;
};

export function useFirebaseApp() {
  const { firebaseApp } = useFirebase();
  if (!firebaseApp) {
    throw new Error(
      'Firebase app is not initialized. Make sure you have a FirebaseProvider component in your app.'
    );
  }
  return firebaseApp;
}

export function useFirestore() {
  const { firestore } = useFirebase();
  if (!firestore) {
    throw new Error(
      'Firestore is not initialized. Make sure you have a FirebaseProvider component in your app.'
    );
  }
  return firestore;
}

export function useAuth() {
  const { auth } = useFirebase();
  if (!auth) {
    throw new Error(
      'Firebase Auth is not initialized. Make sure you have a FirebaseProvider component in your app.'
    );
  }
  return auth;
}

export function useUser() {
    const { user, isUserLoading } = useFirebase();
    return { user, isUserLoading };
}
