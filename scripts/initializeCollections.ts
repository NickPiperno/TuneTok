import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { UserPreferences, UserInteraction, UserSession } from '../app/services/videoMetadata';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
const serviceAccount = require('../firebase-admin-key.json');

let db: admin.firestore.Firestore;

// Make sure we're not re-initializing if the app already exists
if (!admin.apps.length) {
  // Use the project ID from the service account
  const projectId = serviceAccount.project_id;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
  });
}

// Get Firestore with explicit settings
db = getFirestore();
// Enable timestamps in snapshots and specify database settings
db.settings({ 
  ignoreUndefinedProperties: true,
  timestampsInSnapshots: true,
  databaseId: 'tunetok-correct-db'
});

// Add debug logging
console.log('Firebase Admin initialized with:');
console.log('- Project ID:', serviceAccount.project_id);
console.log('- Database ID: tunetok-correct-db');
console.log('- Service Account Email:', serviceAccount.client_email);

// Mock data for collections
const mockUsers = [
  {
    id: 'user1',
    email: 'user1@example.com',
    username: 'MusicLover123'
  },
  {
    id: 'user2',
    email: 'user2@example.com',
    username: 'RhythmMaster'
  }
];

const mockUserPreferences: UserPreferences[] = [
  {
    userId: 'user1',
    likedVideos: ['video1', 'video2'],
    watchHistory: ['video1', 'video2', 'video3'],
    preferredGenres: ['pop', 'electronic'],
    preferredMoods: ['energetic', 'happy'],
    preferredArtists: ['DJ Smith', 'Artist2'],
    preferredLanguage: 'en',
    totalWatchTime: 3600, // 1 hour
    averageSessionDuration: 300, // 5 minutes
    preferredTimeOfDay: 'evening',
    preferredDeviceType: 'mobile',
    following: []
  },
  {
    userId: 'user2',
    likedVideos: ['video3', 'video4'],
    watchHistory: ['video3', 'video4', 'video5'],
    preferredGenres: ['rock', 'indie'],
    preferredMoods: ['chill', 'focused'],
    preferredArtists: ['Band1', 'Artist3'],
    preferredLanguage: 'en',
    totalWatchTime: 7200, // 2 hours
    averageSessionDuration: 600, // 10 minutes
    preferredTimeOfDay: 'morning',
    preferredDeviceType: 'tablet',
    following: []
  }
];

const mockInteractions: UserInteraction[] = [
  {
    userId: 'user1',
    videoId: 'video1',
    watchDuration: 180,
    watchPercentage: 90,
    interactionType: 'like',
    timestamp: new Date(),
    genre: 'pop',
    mood: 'energetic',
    videoAudioFeatures: {
      tempo: 128,
      key: 'C',
      energy: 0.8,
      danceability: 0.9
    }
  },
  {
    userId: 'user2',
    videoId: 'video3',
    watchDuration: 240,
    watchPercentage: 100,
    interactionType: 'share',
    timestamp: new Date(),
    genre: 'rock',
    mood: 'chill',
    videoAudioFeatures: {
      tempo: 98,
      key: 'Am',
      energy: 0.6,
      danceability: 0.5
    }
  }
];

const mockSessions: UserSession[] = [
  {
    userId: 'user1',
    sessionId: 'session1',
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    endTime: new Date(),
    videosWatched: [
      {
        videoId: 'video1',
        watchDuration: 180,
        timeOfDay: 'evening',
        deviceType: 'mobile'
      },
      {
        videoId: 'video2',
        watchDuration: 120,
        timeOfDay: 'evening',
        deviceType: 'mobile'
      }
    ]
  },
  {
    userId: 'user2',
    sessionId: 'session2',
    startTime: new Date(Date.now() - 7200000), // 2 hours ago
    endTime: new Date(Date.now() - 3600000), // 1 hour ago
    videosWatched: [
      {
        videoId: 'video3',
        watchDuration: 300,
        timeOfDay: 'night',
        deviceType: 'desktop'
      }
    ]
  }
];

/**
 * Initialize collections with mock data
 */
const initializeCollections = async () => {
  try {
    // Initialize UserPreferences
    console.log('\nInitializing UserPreferences collection...');
    for (const pref of mockUserPreferences) {
      await db.collection('userPreferences').doc(pref.userId).set({
        ...pref,
        updatedAt: admin.firestore.Timestamp.now()
      });
      console.log(`✅ Added preferences for user: ${pref.userId}`);
    }

    // Initialize Interactions
    console.log('\nInitializing Interactions collection...');
    for (const interaction of mockInteractions) {
      await db.collection('interactions').add({
        ...interaction,
        timestamp: admin.firestore.Timestamp.fromDate(interaction.timestamp)
      });
      console.log(`✅ Added interaction for user: ${interaction.userId} on video: ${interaction.videoId}`);
    }

    // Initialize UserSessions
    console.log('\nInitializing UserSessions collection...');
    for (const session of mockSessions) {
      await db.collection('userSessions').doc(session.sessionId).set({
        ...session,
        startTime: admin.firestore.Timestamp.fromDate(session.startTime),
        endTime: admin.firestore.Timestamp.fromDate(session.endTime)
      });
      console.log(`✅ Added session: ${session.sessionId} for user: ${session.userId}`);
    }

    console.log('\n✨ Successfully initialized all collections');
    return true;
  } catch (error) {
    console.error('Failed to initialize collections:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      });
    }
    return false;
  }
};

// Run the script
initializeCollections().then((success) => {
  if (success) {
    console.log('Script completed successfully');
    process.exit(0);
  } else {
    console.error('Script failed to initialize collections');
    process.exit(1);
  }
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
}); 