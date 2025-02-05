import * as admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { VideoMetadata, VideoAudioFeatures, FirestoreTimestamp } from '../app/services/videoMetadata';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
const serviceAccount = require('../firebase-admin-key.json');

let db: admin.firestore.Firestore;

// Make sure we're not re-initializing if the app already exists
if (!admin.apps.length) {
  // Use the project ID from the service account
  const projectId = serviceAccount.project_id;

  console.log('Initializing Firebase Admin with:', {
    projectId,
    serviceAccountEmail: serviceAccount.client_email,
    storageBucket: 'tunetok-75a32.firebasestorage.app'
  });

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
      storageBucket: 'tunetok-75a32.firebasestorage.app'  // Use exact bucket name
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

// Get Firestore with explicit settings
try {
  db = getFirestore();
  // Enable timestamps in snapshots and specify database settings
  db.settings({ 
    ignoreUndefinedProperties: true,
    timestampsInSnapshots: true,
    databaseId: 'tunetok-correct-db'  // Specify which database to use
  });
  console.log('✅ Firestore initialized with settings:', {
    databaseId: 'tunetok-correct-db',
    timestampsInSnapshots: true
  });
} catch (error) {
  console.error('❌ Failed to initialize Firestore:', error);
  throw error;
}

// Add debug logging
console.log('Firebase Admin configuration:', {
  projectId: serviceAccount.project_id,
  databaseId: 'tunetok-correct-db',
  storageBucket: 'tunetok-75a32.firebasestorage.app',
  serviceAccountEmail: serviceAccount.client_email,
  isInitialized: admin.apps.length > 0,
  hasFirestore: !!db
});

const bucket = getStorage().bucket();

// Collection name constant
const VIDEO_METADATA_COLLECTION = 'videoMetadata';

// Predefined options for metadata
const GENRES = ['pop', 'hip-hop', 'rock', 'electronic', 'r&b', 'jazz', 'classical', 'country'];
const MOODS = ['relaxed', 'energetic', 'chill', 'happy', 'focused', 'party', 'workout', 'study'];
const LANGUAGES = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh'];
const REGIONS = ['US', 'EU', 'AS', 'Global'];
const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Use Partial<VideoMetadata> for input since some fields will be initialized
type VideoMetadataInput = Omit<VideoMetadata, 'id' | 'likes' | 'comments' | 'shares' | 'views' | 'averageWatchDuration' | 'completionRate' | 'watchTimeDistribution' | 'uploadDate'> & {
  videoAudioFeatures: VideoAudioFeatures;
};

/**
 * Ensure the videoMetadata collection exists
 */
const ensureCollection = async () => {
  try {
    // Try to get the collection
    const collection = await db.collection(VIDEO_METADATA_COLLECTION).limit(1).get();
    console.log('Collection exists or was created successfully');
    return true;
  } catch (error) {
    console.error('Failed to ensure collection exists:', error);
    return false;
  }
};

/**
 * Add metadata for a single video
 */
const addVideoMetadata = async (
  file: any,
  metadata: VideoMetadataInput
): Promise<void> => {
  try {
    // Get the storage path as ID
    const storageId = file.name;
    // Remove 'videos/' prefix and file extension
    const videoId = file.name.replace('videos/', '').split('.')[0];

    console.log(`Adding metadata for video ID: ${videoId}`);
    console.log(`Storage ID: ${storageId}`);

    // Get file metadata
    const [fileMetadata] = await file.getMetadata();
    console.log('File metadata retrieved:', fileMetadata);

    // Create metadata document that matches VideoMetadata interface
    const videoMetadata: Omit<VideoMetadata, 'id'> = {
      storageId,
      title: metadata.title,
      artist: metadata.artist,
      description: metadata.description,
      tags: metadata.tags,
      genre: metadata.genre,
      mood: metadata.mood,
      duration: metadata.duration,
      language: metadata.language,
      region: metadata.region,
      videoAudioFeatures: metadata.videoAudioFeatures,
      
      // Initialize engagement metrics
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      
      // Initialize watch time metrics
      averageWatchDuration: 0,
      completionRate: 0,
      watchTimeDistribution: Array(10).fill(0), // 10 segments
      
      // Set upload date as Firestore timestamp
      uploadDate: admin.firestore.Timestamp.fromDate(new Date(fileMetadata.timeCreated)) as FirestoreTimestamp
    };

    console.log('Attempting to save document with data:', JSON.stringify(videoMetadata, null, 2));

    // Save to Firestore directly without checking existence
    await db.collection(VIDEO_METADATA_COLLECTION).doc(videoId).create(videoMetadata);
    console.log(`✅ Added metadata for video: ${metadata.title}`);
  } catch (error) {
    console.error(`❌ Failed to add metadata for video: ${metadata.title}`, error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      });
    }
    throw error;
  }
};

/**
 * Process all videos in storage
 */
const processVideos = async () => {
  try {
    // List all videos in storage
    const [files] = await bucket.getFiles({ prefix: 'videos/' });

    console.log(`Found ${files.length} videos in storage`);

    // Process each video
    for (const file of files) {
      // Skip if not a video file
      if (!file.name.match(/\.(mp4|mov|avi|wmv)$/i)) {
        console.log(`Skipping non-video file: ${file.name}`);
        continue;
      }
      
      // Extract filename without extension and 'videos/' prefix
      const filename = file.name.replace('videos/', '').split('.')[0];
      
      if (!filename) {
        console.log(`Skipping file with no name: ${file.name}`);
        continue;
      }
      
      console.log(`Processing video: ${filename}`);
      
      // Example metadata - customize for each video
      const metadata: VideoMetadataInput = {
        storageId: file.name,
        title: "Summer Vibes",
        artist: "DJ Smith",
        description: "A relaxing summer track",
        tags: ["summer", "chill", "new"],
        genre: "pop",
        mood: "relaxed",
        duration: 0, // You would need to get actual duration
        language: "en",
        region: "US",
        videoAudioFeatures: {
          tempo: 120,      // Example BPM
          key: "C",        // Example key
          energy: 0.6,     // Moderate energy level
          danceability: 0.7 // Good for dancing
        }
      };

      await addVideoMetadata(file, metadata);
    }

    console.log('✨ Completed processing all videos');
  } catch (error) {
    console.error('Failed to process videos:', error);
    throw error;
  }
};

// Run the script
processVideos().then(() => {
  console.log('Script completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
}); 