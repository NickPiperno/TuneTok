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

// Expanded predefined options for metadata
const GENRES = ['pop', 'hip-hop', 'rock', 'electronic', 'r&b', 'jazz', 'classical', 'country', 'indie', 'folk'];
const MOODS = ['relaxed', 'energetic', 'chill', 'happy', 'focused', 'party', 'workout', 'study', 'romantic', 'melancholic'];
const LANGUAGES = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'hi', 'pt', 'ru'];
const REGIONS = ['US', 'EU', 'AS', 'Global', 'UK', 'JP', 'KR', 'BR', 'IN'];
const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Sample artist names and title templates for variety
const ARTISTS = [
  'Luna Wave', 'Digital Pulse', 'Urban Echo', 'Crystal Harmony', 
  'Neon Dreams', 'Future Beats', 'Sonic Wave', 'Electric Soul',
  'Midnight Groove', 'Solar Rhythm'
];

const TITLE_TEMPLATES = [
  'Journey Through {mood}',
  '{genre} Vibes',
  'Late Night {genre}',
  '{mood} Sessions',
  'Urban {genre} Mix',
  '{mood} Beats',
  'Deep {genre} Experience',
  '{mood} Waves',
  'Pure {genre} Energy',
  'Modern {genre} Flow'
];

// Helper function to get random item from array
const getRandomItem = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

// Generate unique metadata for each video
const generateUniqueMetadata = (filename: string): VideoMetadataInput => {
  const genre = getRandomItem(GENRES);
  const mood = getRandomItem(MOODS);
  const artist = getRandomItem(ARTISTS);
  
  // Generate title by replacing placeholders in template
  const titleTemplate = getRandomItem(TITLE_TEMPLATES);
  const title = titleTemplate
    .replace('{genre}', genre.charAt(0).toUpperCase() + genre.slice(1))
    .replace('{mood}', mood.charAt(0).toUpperCase() + mood.slice(1));

  // Generate random but reasonable values for audio features
  const tempo = Math.floor(Math.random() * (180 - 70) + 70); // Between 70-180 BPM
  const energy = Number((Math.random() * 0.6 + 0.2).toFixed(2)); // Between 0.2-0.8
  const danceability = Number((Math.random() * 0.6 + 0.2).toFixed(2)); // Between 0.2-0.8

  return {
    storageId: `videos/${filename}`,
    title,
    artist,
    description: `A ${mood} ${genre} track by ${artist}`,
    tags: [genre, mood, artist.toLowerCase().split(' ')[0], 'new'],
    genre,
    mood,
    duration: 0, // Will be updated with actual duration
    language: getRandomItem(LANGUAGES),
    region: getRandomItem(REGIONS),
    videoAudioFeatures: {
      tempo,
      key: getRandomItem(MUSICAL_KEYS),
      energy,
      danceability
    }
  };
};

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

    console.log(`Processing video ID: ${videoId}`);
    
    // Check if metadata already exists
    const docRef = db.collection(VIDEO_METADATA_COLLECTION).doc(videoId);
    const doc = await docRef.get();
    
    if (doc.exists) {
      console.log(`⏭️ Skipping ${videoId} - metadata already exists`);
      return;
    }

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

    console.log('Saving document with data:', JSON.stringify(videoMetadata, null, 2));

    // Save to Firestore
    await docRef.create(videoMetadata);
    console.log(`✅ Added metadata for video: ${metadata.title}`);
  } catch (error) {
    console.error(`❌ Error processing video: ${metadata.title}`, error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      });
    }
    // Don't throw error to allow processing to continue for other videos
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
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each video
    for (const file of files) {
      // Skip if not a video file
      if (!file.name.match(/\.(mp4|mov|avi|wmv)$/i)) {
        console.log(`Skipping non-video file: ${file.name}`);
        skippedCount++;
        continue;
      }
      
      // Extract filename without extension and 'videos/' prefix
      const filename = file.name.replace('videos/', '');
      
      if (!filename) {
        console.log(`Skipping file with no name: ${file.name}`);
        skippedCount++;
        continue;
      }
      
      console.log(`\nProcessing video: ${filename}`);
      
      try {
        // Generate unique metadata for this video
        const metadata = generateUniqueMetadata(filename);
        await addVideoMetadata(file, metadata);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process ${filename}:`, error);
        errorCount++;
      }
    }

    console.log('\n✨ Processing completed:');
    console.log(`- Successfully processed: ${processedCount} videos`);
    console.log(`- Skipped: ${skippedCount} files`);
    console.log(`- Errors: ${errorCount} videos`);
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