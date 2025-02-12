import { ref, getDownloadURL, StorageReference } from 'firebase/storage';
import { storage } from '../config/firebase';
import { fetchVideoMetadata } from './videoMetadata';
import { auth } from '../config/firebase';
import { Platform, Dimensions } from 'react-native';
import * as Network from 'expo-network';
import { Video, VideoError } from '../types/video';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Timestamp } from 'firebase/firestore';
import { FirestoreTimestamp } from './videoMetadata';

const { width, height } = Dimensions.get('window');

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

// Get video URL directly without quality transformation
const getVideoUrl = async (storageId: string): Promise<string> => {
  try {
    const videoRef = ref(storage, storageId);
    return await getDownloadURL(videoRef);
  } catch (error: any) {
    console.error('Error getting video URL:', error);
    throw error;
  }
};

export const fetchVideos = async (
  pageSize: number = 10,
  lastVideoTimestamp?: FirestoreTimestamp
): Promise<Video[] | VideoError> => {
  try {
    console.log('🎥 Video Service: Starting to fetch videos', {
      pageSize,
      userId: auth.currentUser?.uid,
      isAuthenticated: !!auth.currentUser,
      hasLastVideo: !!lastVideoTimestamp
    });

    if (!auth.currentUser) {
      console.error('❌ Video Service: No authenticated user');
      return {
        code: 'video/unauthenticated',
        message: 'User must be authenticated to fetch videos'
      };
    }

    // Get video metadata first with pagination
    const metadata = await fetchVideoMetadata(auth.currentUser.uid, pageSize, lastVideoTimestamp);
    
    if ('code' in metadata) {
      console.error('❌ Video Service: Error fetching metadata:', metadata);
      return metadata;
    }

    // Get download URLs for each video
    const videos = await Promise.all(
      metadata.map(async (meta): Promise<Video> => {
        try {
          const url = await getVideoUrl(meta.storageId);
          
          console.log('✅ Video Service: URL obtained for:', {
            videoId: meta.id
          });
          
          return {
            id: meta.id,
            url,
            title: meta.title,
            artist: meta.artist,
            description: meta.description || '',
            tags: meta.tags || [],
            genre: meta.genre || '',
            mood: meta.mood || '',
            likes: meta.likes || 0,
            comments: meta.comments || 0,
            shares: meta.shares || 0,
            views: meta.views || 0,
            uploadDate: meta.uploadDate || new Timestamp(Date.now() / 1000, 0),
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
    console.error('❌ Video Service: Error fetching videos:', error);
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
        description: metadata.description || '',
        tags: metadata.tags || [],
        genre: metadata.genre || '',
        mood: metadata.mood || '',
        likes: metadata.likes || 0,
        comments: metadata.comments || 0,
        shares: metadata.shares || 0,
        views: metadata.views || 0,
        uploadDate: metadata.uploadDate || new Timestamp(Date.now() / 1000, 0),
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

/**
 * Fetches minimal video metadata needed for playlist display
 */
export const fetchVideoMetadataForPlaylist = async (
    videoId: string
): Promise<Pick<Video, 'id' | 'title' | 'artist'> | VideoError> => {
    try {
        const docRef = doc(db, 'videoMetadata', videoId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return {
                code: 'not-found',
                message: 'Video not found',
                retry: false
            };
        }

        const data = docSnap.data();
        return {
            id: docSnap.id,
            title: data.title,
            artist: data.artist
        };
    } catch (error) {
        return handleError(error, `fetching video metadata ${videoId}`);
    }
}; 

export { Video };
