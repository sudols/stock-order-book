import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK (runs once on import).
// Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars.
const hasCredentials =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY;

if (hasCredentials) {
  const firebaseConfig: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  initializeApp({ credential: cert(firebaseConfig) });
} else {
  console.warn('⚠️ No Firebase credentials found. Using MOCK AUTH.');
}

/**
 * Verify a Firebase ID token and return the user's UID.
 * Throws on invalid / expired tokens.
 */
export async function verifyFirebaseToken(token: string): Promise<string> {
  if (!hasCredentials) {
    // In mock mode, accept any token and return a deterministic UUID or just the token itself
    // For simplicity in development, we'll assume the token IS the userId if it starts with "mock-"
    if (token.startsWith('mock-')) return token;
    return 'mock-user-123';
  }
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}
