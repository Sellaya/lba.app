import admin from 'firebase-admin';

// This function ensures that the Firebase Admin SDK is initialized only once.
if (!admin.apps.length) {
  try {
    // When running in a Google Cloud environment, the SDK can automatically
    // detect the project credentials.
    admin.initializeApp();
  } catch (error: any) {
    console.error('Firebase server initialization error', error.stack);
    throw new Error('Failed to initialize Firebase Admin SDK.');
  }
}

// Get the Firestore instance from the initialized app.
const firestore = admin.firestore();

/**
 * A server-only function that returns the initialized Firestore instance.
 * Other server-side modules can call this to get a ready-to-use Firestore object.
 */
export function getServerFirestore() {
  // The function now simply returns the already-initialized instance.
  return { firestore };
}
