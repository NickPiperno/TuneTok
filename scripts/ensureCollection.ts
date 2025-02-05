import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
const serviceAccount = require('../firebase-admin-key.json');

// Make sure we're not re-initializing if the app already exists
if (!admin.apps.length) {
  // Use the project ID from the service account
  const projectId = serviceAccount.project_id;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
  });

  // Get Firestore with explicit settings
  const db = getFirestore();
  // Enable timestamps in snapshots and specify database settings
  db.settings({ 
    ignoreUndefinedProperties: true,
    timestampsInSnapshots: true,
    databaseId: 'tunetok-correct-db'  // Specify which database to use
  });

  // Add debug logging
  console.log('Firebase Admin initialized with:');
  console.log('- Project ID:', projectId);
  console.log('- Database ID: tunetok-correct-db');
  console.log('- Service Account Email:', serviceAccount.client_email);
}

const db = getFirestore();

// Collection name constant
const VIDEO_METADATA_COLLECTION = 'videoMetadata';

/**
 * Ensure the videoMetadata collection exists
 */
const ensureCollection = async () => {
  try {
    console.log(`Checking if collection '${VIDEO_METADATA_COLLECTION}' exists...`);
    
    // Try to get the collection
    const querySnapshot = await db.collection(VIDEO_METADATA_COLLECTION).get();
    
    if (querySnapshot.empty) {
      console.log(`Collection '${VIDEO_METADATA_COLLECTION}' exists but is empty`);
    } else {
      console.log(`Collection '${VIDEO_METADATA_COLLECTION}' exists with ${querySnapshot.size} documents`);
      
      // Log details of existing documents
      console.log('\nExisting documents:');
      querySnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- Document ID: ${doc.id}`);
        console.log(`  Title: ${data.title}`);
        console.log(`  Artist: ${data.artist}`);
        console.log(`  Upload Date: ${data.uploadDate}`);
        console.log('  ---');
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to ensure collection exists:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: (error as any).code
      });
    }
    return false;
  }
};

/**
 * List all collections in Firestore
 */
const listCollections = async () => {
  try {
    console.log('Listing all collections in Firestore...\n');
    
    // Get all collections
    const collections = await db.listCollections();
    
    if (collections.length === 0) {
      console.log('No collections found in the database');
    } else {
      console.log(`Found ${collections.length} collections:`);
      for (const collection of collections) {
        console.log(`- ${collection.id}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to list collections:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: (error as any).code
      });
    }
    return false;
  }
};

// Run the script
listCollections().then((success) => {
  if (success) {
    console.log('\nScript completed successfully');
    process.exit(0);
  } else {
    console.error('Script failed to list collections');
    process.exit(1);
  }
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});