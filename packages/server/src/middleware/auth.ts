import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK (runs once on import).
// Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars.
const firebaseConfig: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

initializeApp({ credential: cert(firebaseConfig) });

/**
 * Verify a Firebase ID token and return the user's UID.
 * Throws on invalid / expired tokens.
 */
export async function verifyFirebaseToken(token: string): Promise<string> {
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}
