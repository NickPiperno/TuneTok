import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { auth } from '../config/firebase';
import { fetchVideos, Video, VideoError } from '../services/video';
import NetInfo from '@react-native-community/netinfo';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const PAGE_SIZE = 10;
const INITIAL_LOAD_SIZE = 3;
const PRELOAD_THRESHOLD = 2;

export const useVideoFeed = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());

  const loadLikedVideos = async () => {
    try {
      if (!auth.currentUser) return;

      const userPrefsRef = doc(db, 'userPreferences', auth.currentUser.uid);
      const userPrefsDoc = await getDoc(userPrefsRef);
      
      if (userPrefsDoc.exists()) {
        const prefs = userPrefsDoc.data();
        if (prefs.likedVideos) {
          setLikedVideos(new Set(prefs.likedVideos));
        }
      }
    } catch (error) {
      console.error('Failed to load liked videos:', error);
    }
  };

  const loadVideos = async (pageSize: number = PAGE_SIZE, isLoadingMore: boolean = false) => {
    try {
      if (!auth.currentUser) {
        console.error('❌ Feed: No authenticated user found');
        setError('User must be authenticated to view videos');
        return;
      }

      console.log('🎬 Feed: Starting to load videos', {
        userId: auth.currentUser.uid,
        isLoadingMore,
        pageSize,
        currentCount: videos.length
      });

      if (isLoadingMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const result = await fetchVideos(pageSize);
      
      if ('code' in result) {
        console.error('❌ Feed: Error fetching videos:', {
          code: result.code,
          message: result.message
        });
        setError(result.message);
        Alert.alert('Error', result.message);
      } else {
        console.log('✅ Feed: Videos loaded successfully', {
          count: result.length,
          firstVideoId: result[0]?.id
        });
        if (isLoadingMore) {
          setVideos(prev => [...prev, ...result]);
        } else {
          setVideos(result);
        }
      }
    } catch (error: any) {
      console.error('❌ Feed: Unexpected error:', error);
      setError(error.message || 'Failed to load videos');
      Alert.alert('Error', 'Failed to load videos');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleVideoError = (error: string) => {
    console.error('Video error:', error);
    
    Alert.alert(
      'Video Error',
      error,
      [
        {
          text: 'Retry',
          onPress: () => {
            setIsLoading(true);
            loadVideos(INITIAL_LOAD_SIZE, false);
          }
        },
        {
          text: 'Skip',
          onPress: () => {
            if (currentVideoIndex < videos.length - 1) {
              setCurrentVideoIndex(prev => prev + 1);
            } else {
              loadVideos(PAGE_SIZE, true);
            }
          }
        }
      ],
      { cancelable: false }
    );
  };

  useEffect(() => {
    console.log('🎬 VideoFeed: Initial load effect triggered');
    loadVideos(INITIAL_LOAD_SIZE, false);
    loadLikedVideos();
  }, []);

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
                if (videos.length === 0) {
                  loadVideos(INITIAL_LOAD_SIZE, false);
                }
              }
            }
          ]
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const shouldLoadMore = () => {
    return videos.length - currentVideoIndex <= PRELOAD_THRESHOLD + 1;
  };

  return {
    isLoading,
    isLoadingMore,
    currentVideoIndex,
    videos,
    error,
    likedVideos,
    setLikedVideos,
    setCurrentVideoIndex,
    loadVideos,
    handleVideoError,
    shouldLoadMore,
    setVideos,
  };
}; 