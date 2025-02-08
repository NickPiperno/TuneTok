import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Storage
export const storage = getStorage(app);

// Initialize Firestore with the specific database
export const db = getFirestore(app, 'tunetok-correct-db');

// Initialize Functions with region
export const functions = getFunctions(app, 'us-central1');

// Log initialization status
console.log('🔥 Firebase initialized:', {
  auth: !!auth,
  storage: !!storage,
  db: !!db,
  functions: !!functions,
  config: {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    region: 'us-central1'
  }
}); 