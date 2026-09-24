import * as fs from 'fs';
import * as path from 'path';

/**
 * TGB Poker — Server-Side Firebase Admin Service
 * Handles server-authoritative token validation and Cloud Firestore administrative actions.
 */

let adminInstance: any = null;
let firestoreDb: any = null;
let authService: any = null;
let isFirebaseAdminInitialized = false;

export async function initializeFirebaseAdmin() {
  try {
    // Dynamic import to prevent crash if firebase-admin package is optional
    const admin = await import('firebase-admin');
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve('serviceAccountKey.json');

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      adminInstance = admin.default.initializeApp({
        credential: admin.default.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
      });
      firestoreDb = adminInstance.firestore();
      authService = adminInstance.auth();
      isFirebaseAdminInitialized = true;
      console.log('[Firebase Admin] Successfully initialized with service account key');
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Default Application Credentials (GCP/Firebase environment)
      adminInstance = admin.default.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
      firestoreDb = adminInstance.firestore();
      authService = adminInstance.auth();
      isFirebaseAdminInitialized = true;
      console.log('[Firebase Admin] Initialized with Application Default Credentials');
    } else {
      console.warn('[Firebase Admin] Service account file not found. Running in local/offline auth mode.');
    }
  } catch (err) {
    console.warn('[Firebase Admin] Module not loaded or configuration omitted:', err);
  }
}

/**
 * Validates Firebase ID Token from Client Request header `Authorization: Bearer <token>`
 */
export async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email?: string } | null> {
  if (!isFirebaseAdminInitialized || !authService) {
    // Mock validation fallback in development
    return { uid: 'user_default', email: 'user@tgbpoker.com' };
  }

  try {
    const decodedToken = await authService.verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('[Firebase Admin] Token verification failed:', error);
    return null;
  }
}

export function getFirestoreAdmin() {
  return firestoreDb;
}
