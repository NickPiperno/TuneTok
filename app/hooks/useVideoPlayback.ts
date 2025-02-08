import { useState, useRef, useCallback, useEffect } from 'react';
import { Video as ExpoVideo, AVPlaybackStatus, ResizeMode } from 'expo-av';
import { Platform } from 'react-native';

// Constants for timing
const CLEANUP_TIMEOUT = 500;
const TRANSITION_DELAY = 100;

interface PlayerState {
  isLoading: boolean;
  isBuffering: boolean;
  isReady: boolean;
  progress: number;
  isPlaying: boolean;
  lastPlaybackAttempt: number;
  isLooping: boolean;
}

interface UseVideoPlaybackProps {
  uri: string;
  isFocused: boolean;
  onError?: (error: string) => void;
  onLoad?: () => void;
}

export const useVideoPlayback = ({ uri, isFocused, onError, onLoad }: UseVideoPlaybackProps) => {
  const videoRef = useRef<ExpoVideo | null>(null);
  const isInitializing = useRef(false);
  const isUnmounting = useRef(false);
  
  const [playerState, setPlayerState] = useState<PlayerState>({
    isLoading: true,
    isBuffering: false,
    isReady: false,
    progress: 0,
    isPlaying: false,
    lastPlaybackAttempt: 0,
    isLooping: true
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ('error' in status) {
        console.error('❌ Playback error:', {
          error: status.error,
          uri
        });
        onError?.(status.error);
      }
      return;
    }

    setPlayerState(prev => {
      const updates: Partial<PlayerState> = {};
      
      if (prev.isLoading && status.isLoaded) {
        console.log('✅ Video loaded:', {
          uri,
          duration: status.durationMillis,
          position: status.positionMillis
        });
        updates.isLoading = false;
        updates.isReady = true;
      }
      
      if (status.durationMillis) {
        updates.progress = status.positionMillis / status.durationMillis;
      }

      if (status.isBuffering !== prev.isBuffering) {
        console.log(status.isBuffering ? '⏳ Buffering started' : '▶️ Buffering ended', {
          uri,
          position: status.positionMillis,
          duration: status.durationMillis
        });
        updates.isBuffering = status.isBuffering;
      }

      if (status.isPlaying !== prev.isPlaying) {
        console.log(status.isPlaying ? '▶️ Playing' : '⏸️ Paused', {
          uri,
          position: status.positionMillis,
          duration: status.durationMillis
        });
        updates.isPlaying = status.isPlaying;
      }

      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
  }, [onError, uri]);

  const handleVideoLoad = useCallback(async (status: AVPlaybackStatus) => {
    console.log('🎬 Video load handler called:', {
      uri,
      isLoaded: status.isLoaded,
      isFocused
    });

    if (!status.isLoaded || !videoRef.current) {
      console.warn('⚠️ Load handler called but video not ready:', {
        uri,
        hasRef: !!videoRef.current,
        status: status.isLoaded ? 'loaded' : 'not loaded'
      });
      return;
    }

    try {
      setPlayerState(prev => ({
        ...prev,
        isLoading: false,
        isReady: true,
        isPlaying: false,
        progress: 0
      }));

      if (isFocused && videoRef.current) {
        console.log('▶️ Auto-playing focused video:', uri);
        await videoRef.current.playAsync();
      }

      onLoad?.();
    } catch (error) {
      console.error('❌ Error in load handler:', {
        uri,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      onError?.('Failed to load video');
    }
  }, [isFocused, onLoad, onError, uri]);

  useEffect(() => {
    let isMounted = true;
    isUnmounting.current = false;
    
    const initializeVideo = async () => {
      if (!uri || !videoRef.current || isInitializing.current) {
        console.warn('⚠️ Skipping video initialization:', {
          uri,
          hasRef: !!videoRef.current,
          isInitializing: isInitializing.current
        });
        return;
      }

      try {
        isInitializing.current = true;
        setPlayerState(prev => ({ ...prev, isLoading: true }));

        // Force cleanup of previous video before loading new one
        try {
          await videoRef.current.unloadAsync();
          // Add a small delay after unloading
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.warn('⚠️ Cleanup error:', error);
        }
        
        if (!isUnmounting.current && isMounted) {
          await videoRef.current.loadAsync(
            { uri },
            { 
              shouldPlay: isFocused,
              isLooping: true,
              progressUpdateIntervalMillis: 500,
              volume: Platform.OS === 'android' ? 0 : 1,
              isMuted: Platform.OS === 'android',
            },
            false
          );
        }
      } catch (error) {
        console.error('❌ Failed to initialize video:', {
          uri,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        if (isMounted && !isUnmounting.current) {
          setLoadError('Failed to load video');
          onError?.('Failed to load video');
        }
      } finally {
        if (isMounted) {
          isInitializing.current = false;
        }
      }
    };

    initializeVideo();

    return () => {
      isMounted = false;
      isUnmounting.current = true;
    };
  }, [uri, isFocused, onError]);

  // Simple focus effect
  useEffect(() => {
    if (!videoRef.current || !playerState.isReady) return;

    const updatePlayback = async () => {
      try {
        if (isFocused) {
          await videoRef.current?.playAsync();
        } else {
          await videoRef.current?.pauseAsync();
        }
      } catch (error) {
        // Ignore playback errors during transitions
      }
    };

    updatePlayback();
  }, [isFocused, playerState.isReady]);

  return {
    videoRef,
    playerState,
    loadError,
    retryAttempt,
    handlePlaybackStatusUpdate,
    handleVideoLoad,
  };
}; 