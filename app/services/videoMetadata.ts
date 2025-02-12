import { 
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  DocumentData,
  QueryDocumentSnapshot,
  Query,
  Timestamp,
  increment,
  setDoc,
  QueryConstraint,
  QueryFieldFilterConstraint,
  QueryOrderByConstraint,
  QueryLimitConstraint,
  CollectionReference,
  serverTimestamp,
  FieldValue,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Video, VideoError } from '../types/video';
import { auth } from '../config/firebase';  // Add auth import
import * as admin from 'firebase-admin';

export interface VideoAudioFeatures {
  tempo: number;        // BPM
  key: string;         // Musical key (C, C#, etc.)
  energy: number;      // 0-1
  danceability: number; // 0-1
}

// Use a more generic type for Timestamp to support both SDKs
export interface FirestoreTimestamp {
  toDate(): Date;
  toMillis(): number;
  seconds: number;
  nanoseconds: number;
}

export interface VideoMetadata {
  id: string;
  storageId: string;
  title: string;
  artist: string;
  description?: string;
  tags: string[];
  genre?: string;
  mood?: string;
  duration: number;  // Duration in seconds
  
  // Engagement metrics
  likes: number;
  comments: number;
  shares: number;
  views: number;
  
  // Watch time metrics
  averageWatchDuration: number;    // In seconds
  completionRate: number;          // Percentage (0-100)
  watchTimeDistribution: number[]; // Array of completion percentages
  
  // Audio features
  videoAudioFeatures: VideoAudioFeatures;
  
  // Content features
  language: string;
  region: string;
  targetDemographic?: string[];
  relatedVideos?: string[];
  
  // Timestamps
  uploadDate: FirestoreTimestamp;  // Changed to use our generic timestamp type
}

export type UserInteraction = {
  userId: string;
  videoId: string;
  watchDuration: number;
  watchPercentage: number;
  interactionType: 'like' | 'share' | 'comment' | 'view';
  timestamp: Date;
  genre?: string;
  mood?: string;
  videoAudioFeatures?: VideoAudioFeatures;
};

export type UserSession = {
  userId: string;
  sessionId: string;
  startTime: Date;
  endTime: Date;
  videosWatched: Array<{
    videoId: string;
    watchDuration: number;
    timeOfDay: string;
    deviceType: string;
  }>;
};

export type UserPreferences = {
  userId: string;
  likedVideos: string[];
  watchHistory: string[];
  preferredGenres: string[];
  preferredMoods: string[];
  preferredArtists: string[];
  preferredLanguage?: string;
  following: string[];  // Array of user IDs that this user follows
  
  // Session data
  lastSession?: UserSession;
  totalWatchTime: number;
  averageSessionDuration: number;
  preferredTimeOfDay?: string;
  preferredDeviceType?: string;
};

export interface Comment {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: Timestamp | FieldValue;
  commentLikes: number;
  isLiked?: boolean;
  videoId: string;
}

// Add query optimization constants
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_BATCH_SIZE = 20;
const PREFETCH_THRESHOLD = 5;

// Add cache interface
interface QueryCache {
  timestamp: number;
  data: VideoMetadata[];
}

// Initialize cache
const videoCache: Map<string, QueryCache> = new Map();
const userPrefsCache: Map<string, QueryCache> = new Map();

// Add connection management
let activeQueries = new Set();
const MAX_CONCURRENT_QUERIES = 3;

// Add VideoScore interface
interface VideoScore {
  video: VideoMetadata;
  score: number;
}

// Add scoring constants
const SCORE_WEIGHTS = {
  GENRE_MATCH: 3,
  MOOD_MATCH: 2
} as const;

/**
 * Calculate simple score based on genre and mood matches
 */
const calculateSimpleScore = (
  video: VideoMetadata,
  userPrefs: UserPreferences
): number => {
  let score = 0;

  // Genre match (3 points)
  if (video.genre && userPrefs.preferredGenres?.includes(video.genre)) {
    score += SCORE_WEIGHTS.GENRE_MATCH;
  }

  // Mood match (2 points)
  if (video.mood && userPrefs.preferredMoods?.includes(video.mood)) {
    score += SCORE_WEIGHTS.MOOD_MATCH;
  }

  return score;
};

/**
 * Personalize video order based on user preferences
 */
const personalizeVideoOrder = (
  videos: VideoMetadata[],
  userPrefs: UserPreferences
): VideoMetadata[] => {
  // Calculate scores for each video
  const scoredVideos: VideoScore[] = videos.map(video => ({
    video,
    score: calculateSimpleScore(video, userPrefs)
  }));

  // Sort by score (descending) and extract just the videos
  return scoredVideos
    .sort((a, b) => b.score - a.score)
    .map(({ video }) => video);
};

/**
 * Records a user interaction with a video
 * @param interaction The interaction details to record
 */
export const recordInteraction = async (
  interaction: UserInteraction
): Promise<void | VideoError> => {
  try {
    console.log('📝 VideoMetadata: Recording interaction:', interaction);
    
    // Add to interactions collection
    const interactionsRef = collection(db, 'interactions');
    const docRef = await addDoc(interactionsRef, {
      ...interaction,
      timestamp: Timestamp.fromDate(interaction.timestamp)
    });
    
    console.log('✅ VideoMetadata: Interaction recorded with ID:', docRef.id);
  } catch (error: any) {
    console.error('❌ VideoMetadata: Failed to record interaction:', error);
    return {
      code: error.code || 'interaction/unknown',
      message: error.message || 'Failed to record interaction'
    };
  }
};

/**
 * Updates or creates a user session
 * @param session The session details to record
 */
export const updateUserSession = async (
  session: UserSession
): Promise<void | VideoError> => {
  try {
    const sessionRef = doc(db, 'userSessions', session.sessionId);
    await setDoc(sessionRef, {
      ...session,
      startTime: Timestamp.fromDate(session.startTime),
      endTime: Timestamp.fromDate(session.endTime)
    });
  } catch (error: any) {
    return {
      code: error.code || 'session/unknown',
      message: error.message || 'Failed to update session'
    };
  }
};

/**
 * Optimized video metadata fetch with caching and prefetching
 */
export const fetchVideoMetadata = async (
  userId: string,
  pageSize: number = 10,
  lastVideoTimestamp?: FirestoreTimestamp
): Promise<VideoMetadata[] | VideoError> => {
  try {
    // Log authentication state and database config
    console.log('🔐 Auth State:', {
      isAuthenticated: !!auth.currentUser,
      userId: auth.currentUser?.uid,
      requestedUserId: userId,
      currentToken: await auth.currentUser?.getIdToken(),
      emailVerified: auth.currentUser?.emailVerified,
      providerId: auth.currentUser?.providerId
    });

    console.log('📊 Database Config:', {
      projectId: db.app.options.projectId,
      databaseId: 'tunetok-correct-db',
      collection: 'videoMetadata'
    });

    // Check if we can make a new query
    if (activeQueries.size >= MAX_CONCURRENT_QUERIES) {
      console.log('⚠️ Too many active queries:', activeQueries.size);
      return {
        code: 'metadata/too-many-connections',
        message: 'Too many active queries. Please try again.',
        retry: true
      };
    }

    // Get user preferences (with caching)
    console.log('👤 Fetching user preferences for:', userId);
    try {
      const userPrefs = await getCachedUserPreferences(userId);
      if ('code' in userPrefs) {
        console.error('❌ Failed to get user preferences:', userPrefs);
        return userPrefs;
      }

      // Build optimized query with pagination
      console.log('🔧 Building query with preferences:', {
        preferredGenres: userPrefs.preferredGenres,
        preferredLanguage: userPrefs.preferredLanguage,
        pageSize,
        hasLastVideo: !!lastVideoTimestamp
      });

      const baseQuery = buildOptimizedQuery(userPrefs, pageSize, lastVideoTimestamp);
      
      // Track this query
      const queryId = Math.random().toString(36).substring(7);
      activeQueries.add(queryId);
      
      try {
        console.log('🚀 Executing query:', { 
          queryId,
          filters: baseQuery,
          path: 'videoMetadata',
          pageSize,
          hasLastVideo: !!lastVideoTimestamp
        });

        // Execute query with batching
        const videos = await executeBatchedQuery(baseQuery);

        // Apply personalization
        const personalizedVideos = personalizeVideoOrder(videos, userPrefs);

        console.log('✨ Applied personalization:', { 
          originalOrder: videos.map(v => v.id),
          personalizedOrder: personalizedVideos.map(v => v.id),
          queryId
        });

        return personalizedVideos;
      } catch (error: any) {
        console.error('❌ Query execution error:', {
          code: error.code,
          message: error.message,
          queryId,
          stack: error.stack,
          name: error.name,
          details: error.details || 'No additional details'
        });
        throw error;
      } finally {
        // Always clean up the query
        activeQueries.delete(queryId);
      }
    } catch (error: any) {
      console.error('❌ User preferences error:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        userId
      });
      throw error;
    }
  } catch (error: any) {
    console.error('❌ Fetch metadata error:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    return {
      code: error.code || 'metadata/unknown',
      message: error.message || 'An error occurred while fetching video metadata',
      retry: false
    };
  }
};

/**
 * Get cached user preferences or fetch from database
 */
const getCachedUserPreferences = async (
  userId: string
): Promise<UserPreferences | VideoError> => {
  const cachedPrefs = userPrefsCache.get(userId);
  const now = Date.now();

  if (cachedPrefs && (now - cachedPrefs.timestamp) < CACHE_DURATION) {
    return cachedPrefs.data[0] as unknown as UserPreferences;
  }

  const userPrefsDoc = await getDoc(doc(db, 'userPreferences', userId));
  const userPrefs = userPrefsDoc.data() as UserPreferences | undefined;

  if (!userPrefs) {
    return {
      code: 'preferences/not-found',
      message: 'User preferences not found',
      details: 'Please set up your preferences to get personalized content',
      retry: false
    };
  }

  userPrefsCache.set(userId, {
    timestamp: now,
    data: [userPrefs as unknown as VideoMetadata]
  });

  return userPrefs;
};

/**
 * Build optimized query based on user preferences
 */
const buildOptimizedQuery = (
  userPrefs: UserPreferences,
  pageSize: number,
  lastVideoTimestamp?: FirestoreTimestamp
) => {
  const queryRef = collection(db, 'videoMetadata');
  
  // Build query constraints
  const queryConstraints: QueryConstraint[] = [
    orderBy('uploadDate', 'desc'),
    limit(pageSize)
  ];

  // Add pagination if we have a last video
  if (lastVideoTimestamp) {
    queryConstraints.push(where('uploadDate', '<', lastVideoTimestamp));
  }

  console.log('📊 Building query:', {
    pageSize,
    hasLastVideo: !!lastVideoTimestamp,
    preferredGenres: userPrefs.preferredGenres,
    preferredLanguage: userPrefs.preferredLanguage
  });

  return query(queryRef, ...queryConstraints);
};

/**
 * Execute query with batching for better performance
 */
const executeBatchedQuery = async (
  baseQuery: Query<DocumentData>
): Promise<VideoMetadata[]> => {
  const querySnapshot = await getDocs(baseQuery);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    uploadDate: doc.data().uploadDate // No need to call toDate() since we're keeping it as Timestamp
  })) as VideoMetadata[];
};

/**
 * Prefetch next batch of videos
 */
const prefetchNextBatch = async (
  userId: string,
  pageSize: number,
  lastVideo: VideoMetadata
) => {
  // Don't prefetch if we're at capacity
  if (activeQueries.size >= MAX_CONCURRENT_QUERIES) {
    return;
  }

  try {
    const userPrefs = await getCachedUserPreferences(userId);
    if ('code' in userPrefs) return;

    const queryId = Math.random().toString(36).substring(7);
    activeQueries.add(queryId);

    try {
      const nextQuery = query(
        collection(db, 'videoMetadata'),
        where('uploadDate', '<', lastVideo.uploadDate),
        limit(pageSize)
      );

      const snapshot = await getDocs(nextQuery);
      const videos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadDate: doc.data().uploadDate // No need to call toDate() since we're keeping it as Timestamp
      })) as VideoMetadata[];

      // Cache prefetched results
      const cacheKey = `${userId}_${pageSize}_next`;
      videoCache.set(cacheKey, {
        timestamp: Date.now(),
        data: videos
      });
    } finally {
      // Always clean up the query
      activeQueries.delete(queryId);
    }
  } catch (error) {
    console.error('Prefetch error:', error);
  }
};

/**
 * Content similarity weights
 */
const SIMILARITY_WEIGHTS = {
  genre: 0.35,
  mood: 0.3,
  audioFeatures: 0.35
};

/**
 * Engagement weights
 */
const ENGAGEMENT_WEIGHTS = {
  completionRate: 0.4,
  likes: 0.2,
  comments: 0.2,
  shares: 0.2,
};

/**
 * Calculates content preferences based on user interactions
 */
const calculateContentPreferences = async (
  interactions: UserInteraction[]
): Promise<ContentPreferences> => {
  const preferences: ContentPreferences = {
    dominantGenre: findDominantFeature(interactions, 'genre'),
    dominantMood: findDominantFeature(interactions, 'mood'),
    averageAudioFeatures: calculateAverageAudioFeatures(interactions)
  };

  return preferences;
};

// Helper types
type ContentPreferences = {
  dominantGenre: string;
  dominantMood: string;
  averageAudioFeatures?: VideoAudioFeatures;
};

/**
 * Maps hour to time category
 */
const getTimeCategory = (hour: number): string => {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
};

/**
 * Maps time of day to typical mood preferences
 */
const getMoodForTimeOfDay = (timeOfDay: string): string => {
  switch (timeOfDay) {
    case 'morning':
      return 'energetic';
    case 'afternoon':
      return 'focused';
    case 'evening':
      return 'relaxed';
    case 'night':
      return 'chill';
    default:
      return 'balanced';
  }
};

/**
 * Updates user preferences in Firestore
 * @param userId The ID of the current user
 * @param preferences The user preferences to update
 */
export const updateUserPreferences = async (
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<void | VideoError> => {
  try {
    console.log('🔄 Updating user preferences:', {
      userId,
      preferences
    });

    const userPrefsRef = doc(db, 'userPreferences', userId);
    const userPrefsDoc = await getDoc(userPrefsRef);

    if (!userPrefsDoc.exists()) {
      console.log('❌ User preferences document not found, creating new one');
      await setDoc(userPrefsRef, {
        userId,
        likedVideos: [],
        watchHistory: [],
        preferredGenres: [],
        preferredMoods: [],
        preferredArtists: [],
        totalWatchTime: 0,
        averageSessionDuration: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...preferences
      });
    } else {
      console.log('✅ Updating existing user preferences document');
      await updateDoc(userPrefsRef, {
        ...preferences,
        updatedAt: Timestamp.now()
      });
    }

    // Clear the cache since we've updated the preferences
    userPrefsCache.delete(userId);
    
    console.log('✅ Successfully updated user preferences');
  } catch (error: any) {
    console.error('❌ Failed to update user preferences:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    return {
      code: error.code || 'preferences/unknown',
      message: error.message || 'An error occurred while updating user preferences'
    };
  }
};

/**
 * Calculates similarity between two audio features
 */
const calculateAudioSimilarity = (
  a: VideoAudioFeatures,
  b: VideoAudioFeatures
): number => {
  const tempoSimilarity = 1 - Math.abs(a.tempo - b.tempo) / 200; // Assuming max tempo diff of 200
  const energySimilarity = 1 - Math.abs(a.energy - b.energy);
  const danceabilitySimilarity = 1 - Math.abs(a.danceability - b.danceability);
  
  return (tempoSimilarity + energySimilarity + danceabilitySimilarity) / 3;
};

/**
 * Finds the most frequent value for a given feature in user interactions
 */
const findDominantFeature = (
  interactions: UserInteraction[],
  feature: 'genre' | 'mood'
): string => {
  const featureCounts = new Map<string, number>();
  
  interactions.forEach(interaction => {
    const value = interaction[feature];
    if (value) {
      featureCounts.set(value, (featureCounts.get(value) || 0) + 1);
    }
  });
  
  let maxCount = 0;
  let dominantFeature = '';
  
  featureCounts.forEach((count, feature) => {
    if (count > maxCount) {
      maxCount = count;
      dominantFeature = feature;
    }
  });
  
  return dominantFeature;
};

/**
 * Calculates average audio features from user interactions
 */
const calculateAverageAudioFeatures = (
  interactions: UserInteraction[]
): VideoAudioFeatures | undefined => {
  const features = interactions
    .map(interaction => interaction.videoAudioFeatures)
    .filter((f): f is VideoAudioFeatures => !!f);
  
  if (features.length === 0) return undefined;
  
  return {
    tempo: features.reduce((sum, f) => sum + f.tempo, 0) / features.length,
    key: features[0].key, // Mode of keys would be more accurate
    energy: features.reduce((sum, f) => sum + f.energy, 0) / features.length,
    danceability: features.reduce((sum, f) => sum + f.danceability, 0) / features.length,
  };
};

/**
 * Submits a new comment for a video
 */
export const submitComment = async (
  videoId: string,
  text: string
): Promise<Comment | VideoError> => {
  try {
    console.log('🔒 Auth state:', {
      isAuthenticated: !!auth.currentUser,
      userId: auth.currentUser?.uid
    });

    if (!auth.currentUser) {
      return {
        code: 'auth/no-user',
        message: 'User must be authenticated to comment'
      };
    }

    // Input validation
    if (!text.trim()) {
      return {
        code: 'comment/invalid-input',
        message: 'Comment text cannot be empty'
      };
    }

    if (text.length > 500) {
      return {
        code: 'comment/invalid-input',
        message: 'Comment text cannot exceed 500 characters'
      };
    }

    const commentsRef = collection(db, 'comments');
    const videoRef = doc(db, 'videoMetadata', videoId);

    console.log('📝 Attempting to create comment:', {
      userId: auth.currentUser.uid,
      videoId,
      textLength: text.length
    });

    // Create the comment using the user's display name from auth
    const commentData: Omit<Comment, 'id'> = {
      userId: auth.currentUser.uid,
      username: auth.currentUser.displayName || 'Anonymous',
      text: text.trim(),
      timestamp: serverTimestamp(),
      commentLikes: 0,
      isLiked: false,
      videoId
    };

    console.log('📋 Comment data to be submitted:', {
      ...commentData,
      text: commentData.text.substring(0, 20) + '...'  // Truncate for logging
    });

    try {
      // Use a transaction to ensure both operations succeed or fail together
      const result = await runTransaction(db, async (transaction) => {
        // First check if the video exists
        const videoDoc = await transaction.get(videoRef);
        if (!videoDoc.exists()) {
          throw new Error('Video not found');
        }

        // Create the comment
        const newCommentRef = doc(commentsRef);
        transaction.set(newCommentRef, commentData);

        // Update the video's comment count
        transaction.update(videoRef, {
          comments: increment(1)
        });

        return {
          id: newCommentRef.id,
          ...commentData
        };
      });

      console.log('✅ Comment created and video updated successfully');
      return result;
    } catch (transactionError: any) {
      console.error('❌ Transaction failed:', {
        error: transactionError.message,
        code: transactionError.code,
        name: transactionError.name
      });
      return {
        code: transactionError.code || 'transaction/failed',
        message: transactionError.message || 'Failed to submit comment'
      };
    }
  } catch (error: any) {
    console.error('❌ Error submitting comment:', {
      error: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    return {
      code: error.code || 'comment/unknown',
      message: error.message || 'Failed to submit comment'
    };
  }
};

/**
 * Fetches comments for a video with pagination
 */
export const fetchComments = async (
  videoId: string,
  lastCommentTimestamp?: FirestoreTimestamp,
  pageSize: number = 20
): Promise<{ comments: Comment[]; hasMore: boolean } | VideoError> => {
  try {
    if (!auth.currentUser) {
      return {
        code: 'auth/no-user',
        message: 'User must be authenticated to view comments'
      };
    }

    const commentsRef = collection(db, 'comments');
    let queryConstraints: QueryConstraint[] = [
      where('videoId', '==', videoId),
      orderBy('timestamp', 'desc'),
      limit(pageSize + 1)
    ];

    if (lastCommentTimestamp) {
      queryConstraints.push(where('timestamp', '<', lastCommentTimestamp));
    }

    const q = query(commentsRef, ...queryConstraints);
    const snapshot = await getDocs(q);
    const comments = snapshot.docs.slice(0, pageSize).map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Comment[];

    return {
      comments,
      hasMore: snapshot.docs.length > pageSize
    };
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return {
      code: error.code || 'comments/unknown',
      message: error.message || 'Failed to fetch comments'
    };
  }
};

/**
 * Toggles like status for a comment
 */
export const likeComment = async (
  commentId: string
): Promise<{ commentLikes: number; isLiked: boolean } | VideoError> => {
  try {
    if (!auth.currentUser) {
      return {
        code: 'auth/no-user',
        message: 'User must be authenticated to like comments'
      };
    }

    const commentRef = doc(db, 'comments', commentId);
    
    // Use a transaction to ensure atomic update
    const result = await runTransaction(db, async (transaction) => {
      const commentDoc = await transaction.get(commentRef);
      
      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }

      const comment = commentDoc.data();
      const currentLikes = comment.commentLikes || 0;
      const isCurrentlyLiked = comment.isLiked || false;

      // Toggle like status and update count
      transaction.update(commentRef, {
        commentLikes: isCurrentlyLiked ? increment(-1) : increment(1),
        isLiked: !isCurrentlyLiked
      });

      return { 
        commentLikes: isCurrentlyLiked ? currentLikes - 1 : currentLikes + 1, 
        isLiked: !isCurrentlyLiked 
      };
    });

    return result;
  } catch (error: any) {
    console.error('Error toggling comment like:', error);
    return {
      code: error.code || 'comment/unknown',
      message: error.message || 'Failed to toggle comment like'
    };
  }
};

/**
 * Deletes a comment
 */
export const deleteComment = async (
  commentId: string,
  videoId: string
): Promise<void | VideoError> => {
  try {
    if (!auth.currentUser) {
      return {
        code: 'auth/no-user',
        message: 'User must be authenticated to delete comments'
      };
    }

    const commentRef = doc(db, 'comments', commentId);
    const videoRef = doc(db, 'videoMetadata', videoId);
    
    // Use a transaction to ensure both operations succeed or fail together
    await runTransaction(db, async (transaction) => {
      const commentDoc = await transaction.get(commentRef);
      
      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }

      // Check if the user is the comment author
      if (commentDoc.data().userId !== auth.currentUser?.uid) {
        throw new Error('Not authorized to delete this comment');
      }

      // Delete the comment
      transaction.delete(commentRef);

      // Decrement the video's comment count
      transaction.update(videoRef, {
        comments: increment(-1)
      });
    });
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    return {
      code: error.code || 'comment/unknown',
      message: error.message || 'Failed to delete comment'
    };
  }
}; 