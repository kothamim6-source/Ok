/// <reference types="vite/client" />
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export interface BuyerFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const STORAGE_KEY = 'buyer_firebase_config';

function getStoredFirebaseConfig(): Partial<BuyerFirebaseConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

const stored = getStoredFirebaseConfig();

const firebaseConfig: BuyerFirebaseConfig = {
  apiKey: (stored.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: (stored.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (stored.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (stored.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (stored.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (stored.appId || import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
  measurementId: (stored.measurementId || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '').trim()
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== 'your_api_key_here' &&
    firebaseConfig.projectId
  );
}

export function getFirebaseConfigInfo(): { config: BuyerFirebaseConfig; source: 'local' | 'env' | 'unset' } {
  const hasStored = Boolean(stored.apiKey && stored.projectId);
  const hasEnv = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);
  return {
    config: firebaseConfig,
    source: hasStored ? 'local' : hasEnv ? 'env' : 'unset'
  };
}

export function saveBuyerFirebaseConfig(cfg: BuyerFirebaseConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function clearBuyerFirebaseConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.error("Firebase initialization error. Please check your configuration.", error);
  }
} else {
  console.warn("Firebase configuration is not set yet. Configure via .env or /setup in Admin Panel.");
}

export { app, auth, db, storage };
