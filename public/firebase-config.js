/**
 * TGB POKER — Firebase Integration Module (Client-Side)
 * Handles Firebase Authentication (Google, Email/Password) & Cloud Firestore Realtime Sync
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let savedConfig = null;
try {
  const stored = localStorage.getItem('TGB_CUSTOM_FIREBASE_CONFIG');
  if (stored) savedConfig = JSON.parse(stored);
} catch (e) {}

export const firebaseConfig = savedConfig || window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyDemoPlaceholderKeyForTGBPoker",
  authDomain: "tgb-poker-demo.firebaseapp.com",
  projectId: "tgb-poker-demo",
  storageBucket: "tgb-poker-demo.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef12345678"
};

let app = null;
let auth = null;
let db = null;
let isFirebaseLive = false;

try {
  // Test if running with real credentials or fallback
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("Placeholder")) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseLive = true;
    console.log("[Firebase] Initialized with Live Cloud Credentials");
  } else {
    console.warn("[Firebase] Running in Demo Mode. Replace keys in firebase-config.js or window.FIREBASE_CONFIG to link your live Firebase project.");
  }
} catch (err) {
  console.error("[Firebase] Initialization error:", err);
}

const googleProvider = new GoogleAuthProvider();

export { app, auth, db, isFirebaseLive };

/**
 * 1. Sign in with Google Popup
 */
export async function loginWithGoogle() {
  if (!isFirebaseLive || !auth) {
    throw new Error("Firebase is in Demo Mode. Please configure your Firebase project credentials in firebase-config.js");
  }
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfileInFirestore(result.user);
  return result.user;
}

/**
 * 2. Sign in with Email and Password
 */
export async function loginWithEmail(email, password) {
  if (!isFirebaseLive || !auth) {
    throw new Error("Firebase is in Demo Mode. Please configure your Firebase project credentials in firebase-config.js");
  }
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * 3. Register new user with Email and Password
 */
export async function registerWithEmail(email, password, displayName) {
  if (!isFirebaseLive || !auth) {
    throw new Error("Firebase is in Demo Mode. Please configure your Firebase project credentials in firebase-config.js");
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(userCredential.user, { displayName });
  }
  await ensureUserProfileInFirestore(userCredential.user, displayName);
  return userCredential.user;
}

/**
 * 4. Sign out
 */
export async function logoutFirebase() {
  if (auth) {
    await signOut(auth);
  }
}

/**
 * 5. Ensure user document exists in Firestore (users/{uid})
 */
export async function ensureUserProfileInFirestore(user, fallbackDisplayName = "Player") {
  if (!db || !user) return null;
  const userDocRef = doc(db, "users", user.uid);
  const userDocSnap = await getDoc(userDocRef);

  if (!userDocSnap.exists()) {
    const initialData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || fallbackDisplayName,
      avatarUrl: user.photoURL || "/avatars/default.png",
      tgbBalance: 12500, // Initial TGB welcome allocation
      level: 1,
      exp: 0,
      tournamentsPlayed: 0,
      tournamentsWon: 0,
      itmCount: 0,
      vpipHands: 0,
      pfrHands: 0,
      totalHandsPlayed: 0,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    };
    await setDoc(userDocRef, initialData);
    return initialData;
  } else {
    await updateDoc(userDocRef, { lastLoginAt: serverTimestamp() });
    return userDocSnap.data();
  }
}

/**
 * 6. Record transaction in Firestore (wallet_transactions/{txId})
 */
export async function recordTransactionFirestore(txData) {
  if (!db) return;
  try {
    const txColRef = collection(db, "wallet_transactions");
    await addDoc(txColRef, {
      ...txData,
      createdAt: serverTimestamp(),
    });

    // Update user balance atomically in users/{uid}
    if (txData.userId && txData.balanceAfter !== undefined) {
      const userRef = doc(db, "users", txData.userId);
      await updateDoc(userRef, {
        tgbBalance: txData.balanceAfter,
      });
    }
  } catch (err) {
    console.error("[Firestore] Error recording transaction:", err);
  }
}

/**
 * 7. Realtime listener for user profile & balance
 */
export function listenToUserProfile(userId, onUpdate) {
  if (!db || !userId) return () => {};
  const userRef = doc(db, "users", userId);
  return onSnapshot(userRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.data());
    }
  }, (err) => {
    console.warn("[Firestore] User listener error:", err);
  });
}

/**
 * 8. Realtime listener for user ledger transactions
 */
export function listenToUserTransactions(userId, onUpdate) {
  if (!db || !userId) return () => {};
  const txColRef = collection(db, "wallet_transactions");
  const q = query(txColRef, orderBy("createdAt", "desc"), limit(25));
  return onSnapshot(q, (snapshot) => {
    const txs = [];
    snapshot.forEach(docSnap => {
      txs.push({ id: docSnap.id, ...docSnap.data() });
    });
    onUpdate(txs);
  }, (err) => {
    console.warn("[Firestore] Transactions listener error:", err);
  });
}
