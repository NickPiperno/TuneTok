/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as admin from "firebase-admin";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Initialize Firebase Admin with explicit service account and project configuration
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "tunetok-75a32",
  databaseURL: "https://tunetok-75a32.firebaseio.com",
  storageBucket: "tunetok-75a32.firebasestorage.app"
});

// Log initialization with more details
console.log("🔥 Firebase Admin initialized:", {
  projectId: "tunetok-75a32",
  timestamp: new Date().toISOString(),
  isEmulator: process.env.FUNCTIONS_EMULATOR === "true"
});

// Export Cloud Functions with proper runtime options
export { search, suggestions, trackSearch } from "./search";
