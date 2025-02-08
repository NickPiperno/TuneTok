import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import { auth, db } from '../config/firebase';
import { fetchVideos } from '../services/video';
import { Video, VideoError } from '../types/video';
import NetInfo from '@react-native-community/netinfo';
import { doc, getDoc } from 'firebase/firestore';

// Constants
const FEED_CONFIG = {
  PAGE_SIZE: 10,
  INITIAL_LOAD_SIZE: 3,
  PRELOAD_THRESHOLD: 2,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000,
  MIN_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 10000,
  NETWORK_CHECK_INTERVAL: 5000,
} as const;

// Types
interface FeedState {
  isLoading: boolean;
  isLoadingMore: boolean;
  currentVideoIndex: number;
  videos: Video[];
  error: string | null;
  likedVideos: Set<string>;
  retryAttempts: number;
}

interface VideoFeedActions {
  setCurrentVideoIndex: (indexOrUpdater: number | ((prev: number) => number)) => void;
  setLikedVideos: (videos: Set<string>) => void;
  setVideos: (videos: Video[] | ((prev: Video[]) => Video[])) => void;
  loadVideos: (pageSize?: number, isLoadingMore?: boolean) => Promise<void>;
  handleVideoError: (error: string) => void;
  shouldLoadMore: () => boolean;
}

interface UseVideoFeedResult extends FeedState, VideoFeedActions {}

const initialFeedState: FeedState = {
  isLoading: true,
  isLoadingMore: false,
  currentVideoIndex: 0,
  videos: [],
  error: null,
  likedVideos: new Set(),
  retryAttempts: 0,
};

export const useVideoFeed = (): UseVideoFeedResult => {
  const [feedState, setFeedState] = useState<FeedState>(initialFeedState);
  const loadingRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const networkCheckIntervalRef = useRef<NodeJS.Timeout>();
  const maxRetryAttempts = useRef(3);
  
  const updateFeedState = useCallback((updates: Partial<FeedState>) => {
    setFeedState(prev => {
      // Only update if values have actually changed
      const hasChanges = Object.entries(updates).some(
        ([key, value]) => prev[key as keyof FeedState] !== value
      );
      return hasChanges ? { ...prev, ...updates } : prev;
    });
  }, []);

  const setVideos = useCallback((updater: Video[] | ((prev: Video[]) => Video[])) => {
    updateFeedState({
      videos: typeof updater === 'function' 
        ? updater(feedState.videos)
        : updater
    });
  }, [feedState.videos, updateFeedState]);

  const loadLikedVideos = useCallback(async () => {
    if (!auth.currentUser) {
      console.warn('⚠️ Feed: Cannot load liked videos - user not authenticated');
      return;
    }

    try {
      const userPrefsRef = doc(db, 'userPreferences', auth.currentUser.uid);
      const userPrefsDoc = await getDoc(userPrefsRef);
      
      if (userPrefsDoc.exists()) {
        const prefs = userPrefsDoc.data();
        if (prefs.likedVideos) {
          updateFeedState({ likedVideos: new Set(prefs.likedVideos) });
          console.log('✅ Feed: Liked videos loaded successfully', {
            count: prefs.likedVideos.length
          });
        }
      }
    } catch (error) {
      console.error('❌ Feed: Failed to load liked videos:', error);
    }
  }, [updateFeedState]);

  // Memoized network state check
  const checkNetworkState = useCallback(async () => {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    };
  }, []);

  // Enhanced retry logic with exponential backoff
  const getRetryDelay = useCallback((attempt: number) => {
    const delay = Math.min(
      FEED_CONFIG.MIN_RETRY_DELAY * Math.pow(2, attempt),
      FEED_CONFIG.MAX_RETRY_DELAY
    );
    return delay;
  }, []);

  const loadVideos = useCallback(async (pageSize: number = FEED_CONFIG.PAGE_SIZE, isLoadingMore: boolean = false) => {
    if (loadingRef.current) {
      console.log('⏳ Feed: Loading already in progress, skipping request');
      return;
    }

    if (!auth.currentUser) {
      console.error('❌ Feed: No authenticated user found');
      updateFeedState({ error: 'User must be authenticated to view videos' });
      return;
    }

    try {
      loadingRef.current = true;
      console.log('🎬 Feed: Starting to load videos', {
        userId: auth.currentUser.uid,
        isLoadingMore,
        pageSize,
        currentCount: feedState.videos.length
      });

      // Check network state before loading
      const networkState = await checkNetworkState();
      if (!networkState.isConnected || !networkState.isInternetReachable) {
        throw new Error('No internet connection');
      }

      updateFeedState({
        isLoading: !isLoadingMore,
        isLoadingMore,
        error: null
      });

      const result = await fetchVideos(pageSize);
      
      if ('code' in result) {
        throw new Error(result.message);
      }

      console.log('✅ Feed: Videos loaded successfully', {
        count: result.length,
        firstVideoId: result[0]?.id
      });

      setVideos(prev => {
        if (isLoadingMore) {
          // Remove duplicates when loading more
          const existingIds = new Set(prev.map(v => v.id));
          const newVideos = result.filter(v => !existingIds.has(v.id));
          return [...prev, ...newVideos];
        }
        return result;
      });
      
      updateFeedState({ retryAttempts: 0 });
    } catch (error: any) {
      console.error('❌ Feed: Error loading videos:', error);
      const errorMessage = error.message || 'Failed to load videos';
      
      if (feedState.retryAttempts < FEED_CONFIG.MAX_RETRY_ATTEMPTS) {
        console.log('🔄 Feed: Retrying load...', {
          attempt: feedState.retryAttempts + 1
        });
        
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        
        const nextAttempt = feedState.retryAttempts + 1;
        const delay = getRetryDelay(nextAttempt);
        
        retryTimeoutRef.current = setTimeout(() => {
          updateFeedState({ retryAttempts: nextAttempt });
          loadVideos(pageSize, isLoadingMore);
        }, delay);
      } else {
        updateFeedState({ error: errorMessage });
        Alert.alert('Error', errorMessage);
      }
    } finally {
      loadingRef.current = false;
      updateFeedState({
        isLoading: false,
        isLoadingMore: false
      });
    }
  }, [feedState.videos.length, feedState.retryAttempts, updateFeedState, setVideos, checkNetworkState, getRetryDelay]);

  const handleVideoError = useCallback((error: string) => {
    console.error('❌ Feed: Video playback error:', error);
    
    Alert.alert(
      'Video Error',
      error,
      [
        {
          text: 'Retry',
          onPress: () => {
            updateFeedState({ isLoading: true });
            loadVideos(FEED_CONFIG.INITIAL_LOAD_SIZE, false);
          }
        },
        {
          text: 'Skip',
          onPress: () => {
            if (feedState.currentVideoIndex < feedState.videos.length - 1) {
              updateFeedState({ currentVideoIndex: feedState.currentVideoIndex + 1 });
            } else {
              loadVideos(FEED_CONFIG.PAGE_SIZE, true);
            }
          }
        }
      ],
      { cancelable: false }
    );
  }, [feedState.currentVideoIndex, feedState.videos.length, loadVideos, updateFeedState]);

  // Initial load effect
  useEffect(() => {
    if (!auth.currentUser) return;
    
    console.log('🎬 Feed: Initial load effect triggered');
    loadVideos(FEED_CONFIG.INITIAL_LOAD_SIZE, false);
    loadLikedVideos();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [auth.currentUser?.uid]); // Only reload when user changes

  // Network monitoring with periodic checks
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (!state.isConnected) {
        Alert.alert(
          'No Internet Connection',
          'Please check your internet connection and try again.',
          [
            {
              text: 'Retry',
              onPress: () => {
                if (feedState.videos.length === 0) {
                  loadVideos(FEED_CONFIG.INITIAL_LOAD_SIZE, false);
                }
              }
            }
          ]
        );
      }
    });

    // Periodic network checks
    networkCheckIntervalRef.current = setInterval(async () => {
      const networkState = await checkNetworkState();
      if (networkState.isConnected && networkState.isInternetReachable && feedState.error) {
        // Auto-retry when network is restored
        loadVideos(FEED_CONFIG.INITIAL_LOAD_SIZE, false);
      }
    }, FEED_CONFIG.NETWORK_CHECK_INTERVAL);

    return () => {
      unsubscribe();
      if (networkCheckIntervalRef.current) {
        clearInterval(networkCheckIntervalRef.current);
      }
    };
  }, [feedState.videos.length, feedState.error, loadVideos, checkNetworkState]);

  return {
    ...feedState,
    setCurrentVideoIndex: useCallback((indexOrUpdater: number | ((prev: number) => number)) => 
      updateFeedState({ 
        currentVideoIndex: typeof indexOrUpdater === 'function' 
          ? indexOrUpdater(feedState.currentVideoIndex)
          : indexOrUpdater 
      }), [feedState.currentVideoIndex, updateFeedState]),
    setLikedVideos: useCallback((likedVideos: Set<string>) => 
      updateFeedState({ likedVideos }), [updateFeedState]),
    setVideos,
    loadVideos,
    handleVideoError,
    shouldLoadMore: useCallback(() => 
      feedState.videos.length - feedState.currentVideoIndex <= FEED_CONFIG.PRELOAD_THRESHOLD + 1,
      [feedState.videos.length, feedState.currentVideoIndex]
    ),
  };
}; 