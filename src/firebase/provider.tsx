'use client';

import React, { createContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';

export interface FirebaseContextValue {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isUserLoading: boolean;
}

export const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

export function FirebaseProvider({ children, firebaseApp, firestore, auth }: FirebaseProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    // Only run auth logic on the client
    if (typeof window !== 'undefined') {
      initiateAnonymousSignIn(auth); // Initiate sign-in on mount
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setIsUserLoading(false);
      });
      return () => unsubscribe();
    } else {
        setIsUserLoading(false);
    }
  }, [auth]);

  const contextValue = useMemo(() => ({
    firebaseApp,
    firestore,
    auth,
    user,
    isUserLoading,
  }), [firebaseApp, firestore, auth, user, isUserLoading]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
}
