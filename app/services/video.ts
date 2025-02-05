import { ref, getDownloadURL, StorageReference } from 'firebase/storage';
import { storage } from '../config/firebase';
import { fetchVideoMetadata } from './videoMetadata';
import { auth, functions } from '../config/firebase';
import { Platform, Dimensions } from 'react-native';
import * as Network from 'expo-network';
import { httpsCallable } from 'firebase/functions';

const { width, height } = Dimensions.get('window');

// Video quality settings
export type VideoQuality = 'low' | 'medium' | 'high';

// Instead of transcoding, we'll select the appropriate video version
const getVideoPath = (storageId: string, quality: VideoQuality): string => {
  // Remove the file extension
  const basePath = storageId.replace(/\.[^/.]+$/, '');
  
  // Add quality suffix
  switch (quality) {
    case 'low':
      return `${basePath}_360p.mp4`;
    case 'medium':
      return `${basePath}_720p.mp4`;
    case 'high':
      return `${basePath}_1080p.mp4`;
    default:
      return `${basePath}_360p.mp4`; // Default to low quality
  }
};

// Choose appropriate quality based on network conditions and screen size
const getOptimalQuality = async (): Promise<VideoQuality> => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    
    // Default to low quality for poor network conditions
    if (!networkState.isInternetReachable || !networkState.isConnected) {
      console.log('🌐 Poor network conditions, using low quality');
      return 'low';
    }

    // On WiFi with good connection, consider screen size
    if (networkState.type === Network.NetworkStateType.WIFI) {
      if (width >= 1920 || height >= 1080) {
        return 'high';
      } else if (width >= 1280 || height >= 720) {
        return 'medium';
      }
    }

    // On cellular or unknown connection types, use low or medium
    if (width >= 1280 || height >= 720) {
      return 'medium';
    }

    return 'low';
  } catch (error) {
    console.warn('Failed to determine network state:', error);
    return 'low'; // Default to low quality on error
  }
};

// Get video URL with fallback mechanism
const getVideoUrlWithQuality = async (storageId: string, preferredQuality: VideoQuality): Promise<string> => {
  const qualities: VideoQuality[] = ['low', 'medium', 'high'];
  const startIndex = qualities.indexOf(preferredQuality);
  
  // Try preferred quality first, then try lower qualities
  for (let i = startIndex; i >= 0; i--) {
    try {
      const quality = qualities[i];
      const qualityPath = getVideoPath(storageId, quality);
      const videoRef = ref(storage, qualityPath);
      
      console.log('🎥 Attempting to get video URL:', {
        quality,
        originalPath: storageId,
        qualityPath
      });
      
      const url = await getDownloadURL(videoRef);
      console.log(`✅ Successfully got ${quality} quality video`);
      return url;
    } catch (error: any) {
      if (i > 0) {
        console.log(`⚠️ Failed to get ${qualities[i]} quality, trying lower quality`);
        continue;
      }
      // If we're at the lowest quality and still failing, try the original
      console.log('⚠️ All quality versions failed, falling back to original');
      const originalRef = ref(storage, storageId);
      return await getDownloadURL(originalRef);
    }
  }
  
  throw new Error('Failed to get video URL at any quality');
};

export type VideoError = {
  code: string;
  message: string;
  retry?: boolean;
  details?: string;
};

export type Video = {
  id: string;
  url: string;
  title: string;
  artist: string;
  creatorId: string;
  description?: string;
  tags: string[];
  genre?: string;
  mood?: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
};

// Cloud Function calls with auth context and proper configuration
const searchVideosFunction = httpsCallable(functions, 'search', {
  timeout: 60000, // 60 second timeout
});

const getSearchSuggestionsFunction = httpsCallable(functions, 'suggestions', {
  timeout: 30000,
});

const trackRecentSearchFunction = httpsCallable(functions, 'trackSearch', {
  timeout: 30000,
});

// Helper function to ensure auth token is fresh
const ensureFreshToken = async () => {
  console.log('🔐 Checking auth state:', {
    isAuthenticated: !!auth.currentUser,
    userId: auth.currentUser?.uid,
    emailVerified: auth.currentUser?.emailVerified,
    providerId: auth.currentUser?.providerId
  });

  if (!auth.currentUser) {
    console.error('❌ No authenticated user found in ensureFreshToken');
    throw new Error('No authenticated user');
  }

  try {
    const token = await auth.currentUser.getIdToken(true);
    console.log('✅ Token refreshed successfully:', {
      tokenLength: token.length,
      userId: auth.currentUser.uid,
      timestamp: new Date().toISOString()
    });
    return token;
  } catch (error) {
    console.error('❌ Failed to refresh token:', error);
    throw error;
  }
};

export const searchVideos = async (
  query?: string,
  filters?: {
    genre?: string;
    mood?: string;
    artist?: string;
  },
  limit: number = 20
): Promise<Video[] | VideoError> => {
  try {
    console.log('🔍 Search Service: Initial state', {
      hasAuth: !!auth,
      currentUser: auth.currentUser ? {
        uid: auth.currentUser.uid,
        emailVerified: auth.currentUser.emailVerified,
        providerId: auth.currentUser.providerId,
        metadata: auth.currentUser.metadata
      } : null,
      query,
      filters,
      limit
    });

    if (!auth.currentUser) {
      console.error('❌ Search Service: No authenticated user');
      return {
        code: 'search/unauthenticated',
        message: 'User must be authenticated to search videos'
      };
    }

    await ensureFreshToken();

    console.log('🔍 Search Service: Calling Cloud Function', {
      functionName: searchVideosFunction.name,
      projectId: functions.app.options.projectId,
      region: functions.region,
      payload: { query, filters, limit }
    });

    try {
      const result = await searchVideosFunction({ query, filters, limit });
      
      console.log('✅ Search Service: Cloud Function response', {
        success: true,
        hasData: !!result.data,
        resultCount: result.data ? (result.data as any).videos?.length : 0,
        firstVideo: result.data ? (result.data as any).videos?.[0]?.id : null
      });

      return (result.data as { videos: Video[] }).videos;
    } catch (functionError: any) {
      console.error('❌ Search Service: Cloud Function error', {
        name: functionError.name,
        code: functionError.code,
        message: functionError.message,
        details: functionError.details,
        stack: functionError.stack,
        type: functionError.constructor.name,
        rawError: JSON.stringify(functionError)
      });

      // Handle specific auth errors
      if (functionError.code === 'functions/unauthenticated' || functionError.code === 'functions/permission-denied') {
        return {
          code: 'search/auth-failed',
          message: 'Authentication failed. Please try logging in again.',
          retry: true
        };
      }

      throw functionError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    console.error('❌ Search Service: Unexpected error', {
      name: error.name,
      code: error.code,
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      rawError: JSON.stringify(error)
    });

    return {
      code: error.code || 'search/unknown',
      message: error.message || 'Failed to search videos',
      details: `Error type: ${error.constructor.name}`
    };
  }
};

export const getSearchSuggestions = async (
  query: string
): Promise<{ type: 'artist' | 'genre' | 'mood' | 'recent'; text: string; }[] | VideoError> => {
  try {
    console.log('🔍 Suggestions Service: Initial auth check', {
      hasAuth: !!auth,
      currentUser: !!auth.currentUser,
      userId: auth.currentUser?.uid
    });

    if (!auth.currentUser) {
      console.error('❌ Suggestions Service: No authenticated user');
      return {
        code: 'suggestions/unauthenticated',
        message: 'User must be authenticated to get suggestions'
      };
    }

    await ensureFreshToken(); // Just refresh token, don't pass it explicitly

    console.log('🔍 Suggestions Service: Getting suggestions', {
      query,
      userId: auth.currentUser.uid,
      isAuthenticated: true,
      functionConfig: {
        name: getSearchSuggestionsFunction.name,
        url: functions.app.options.projectId
      }
    });

    const result = await getSearchSuggestionsFunction({ query });

    console.log('✅ Suggestions Service: Suggestions retrieved', {
      resultCount: result.data ? (result.data as any).suggestions?.length : 0,
      hasData: !!result.data
    });

    return (result.data as { suggestions: { type: 'artist' | 'genre' | 'mood' | 'recent'; text: string; }[] }).suggestions;
  } catch (error: any) {
    console.error('❌ Suggestions Service: Error details:', {
      code: error.code,
      message: error.message,
      name: error.name,
      stack: error.stack,
      details: error.details,
      functionName: 'getSearchSuggestions'
    });

    // Handle specific auth errors
    if (error.code === 'functions/unauthenticated' || error.code === 'functions/permission-denied') {
      return {
        code: 'suggestions/auth-failed',
        message: 'Authentication failed. Please try logging in again.',
        retry: true
      };
    }

    return {
      code: error.code || 'suggestions/unknown',
      message: error.message || 'Failed to get search suggestions'
    };
  }
};

export const trackRecentSearch = async (
  query: string
): Promise<void | VideoError> => {
  try {
    if (!auth.currentUser) {
      console.error('❌ Search Service: No authenticated user');
      return {
        code: 'track-search/unauthenticated',
        message: 'User must be authenticated to track searches'
      };
    }

    await ensureFreshToken(); // Just refresh token, don't pass it explicitly

    console.log('🔍 Search Service: Tracking search', {
      query,
      userId: auth.currentUser.uid,
      isAuthenticated: true
    });

    await trackRecentSearchFunction({ query });
  } catch (error: any) {
    console.error('Track search error:', error);

    // Handle specific auth errors
    if (error.code === 'functions/unauthenticated' || error.code === 'functions/permission-denied') {
      return {
        code: 'track-search/auth-failed',
        message: 'Authentication failed. Please try logging in again.',
        retry: true
      };
    }

    return {
      code: error.code || 'track-search/unknown',
      message: error.message || 'Failed to track search'
    };
  }
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const handleError = (error: any, context: string): VideoError => {
  // Network errors
  if (error.code === 'storage/network-failure') {
    return {
      code: error.code,
      message: 'Network connection failed',
      details: `Failed to ${context} due to network issues`,
      retry: true
    };
  }

  // Authentication errors
  if (error.code === 'storage/unauthorized') {
    return {
      code: error.code,
      message: 'Access denied',
      details: `Not authorized to ${context}`,
      retry: false
    };
  }

  // Not found errors
  if (error.code === 'storage/object-not-found') {
    return {
      code: error.code,
      message: 'Video not found',
      details: `The requested video does not exist`,
      retry: false
    };
  }

  // Generic error
  return {
    code: error.code || 'video/unknown',
    message: error.message || `An error occurred while ${context}`,
    retry: false
  };
};

/**
 * Fetches a list of videos from Firebase Storage with metadata from Firestore
 * @param pageSize Number of videos to fetch
 * @param retryCount Current retry attempt
 * @returns Promise<Video[]> Array of video objects
 */
export const fetchVideos = async (pageSize: number = 10): Promise<Video[] | VideoError> => {
  try {
    console.log('🎥 Video Service: Starting to fetch videos', {
      pageSize,
      userId: auth.currentUser?.uid,
      isAuthenticated: !!auth.currentUser
    });

    if (!auth.currentUser) {
      console.error('❌ Video Service: No authenticated user');
      return {
        code: 'video/unauthenticated',
        message: 'User must be authenticated to fetch videos'
      };
    }

    // Get video metadata first
    const metadata = await fetchVideoMetadata(auth.currentUser.uid, pageSize);
    
    if ('code' in metadata) {
      console.error('❌ Video Service: Error fetching metadata:', metadata);
      return metadata;
    }

    // Get optimal quality based on current conditions
    const quality = await getOptimalQuality();
    console.log('🎥 Selected video quality:', quality);

    // Get download URLs for each video
    const videos = await Promise.all(
      metadata.map(async (meta): Promise<Video> => {
        try {
          const url = await getVideoUrlWithQuality(meta.storageId, quality);
          
          console.log('✅ Video Service: URL obtained for:', {
            videoId: meta.id,
            quality
          });
          
          return {
            id: meta.id,
            url,
            title: meta.title,
            artist: meta.artist,
            creatorId: meta.creatorId,
            description: meta.description,
            tags: meta.tags,
            genre: meta.genre,
            mood: meta.mood,
            likes: meta.likes,
            comments: meta.comments,
            shares: meta.shares,
            views: meta.views
          };
        } catch (error: any) {
          console.error('❌ Video Service: Error getting URL:', {
            videoId: meta.id,
            storageId: meta.storageId,
            errorCode: error.code,
            errorMessage: error.message
          });
          throw error;
        }
      })
    );

    return videos;
  } catch (error: any) {
    console.error('❌ Video Service: Unexpected error:', error);
    return handleError(error, 'fetching videos');
  }
};

/**
 * Fetches a single video by ID with metadata
 * @param videoId The ID of the video to fetch
 * @param retryCount Current retry attempt
 * @returns Promise<Video> Video object
 */
export const fetchVideoById = async (
  videoId: string,
  retryCount: number = 0
): Promise<Video | VideoError> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return {
        code: 'auth/no-user',
        message: 'User must be authenticated to fetch videos',
        retry: false
      };
    }

    // Get metadata from Firestore
    const metadataResult = await fetchVideoMetadata(user.uid, 1);
    if ('code' in metadataResult || metadataResult.length === 0) {
      throw new Error('Video metadata not found');
    }

    const metadata = metadataResult[0];
    const videoRef = ref(storage, metadata.storageId);
    
    try {
      const url = await getDownloadURL(videoRef);
      
      return {
        id: metadata.id,
        url,
        title: metadata.title,
        artist: metadata.artist,
        creatorId: metadata.creatorId,
        description: metadata.description,
        tags: metadata.tags,
        genre: metadata.genre,
        mood: metadata.mood,
        likes: metadata.likes,
        comments: metadata.comments,
        shares: metadata.shares,
        views: metadata.views,
      };
    } catch (error: any) {
      throw handleError(error, `fetch video ${videoId}`);
    }
  } catch (error: any) {
    const videoError = handleError(error, `fetching video ${videoId}`);
    
    // Implement retry logic for retryable errors
    if (videoError.retry && retryCount < MAX_RETRIES) {
      await wait(RETRY_DELAY * Math.pow(2, retryCount)); // Exponential backoff
      return fetchVideoById(videoId, retryCount + 1);
    }
    
    return videoError;
  }
}; 