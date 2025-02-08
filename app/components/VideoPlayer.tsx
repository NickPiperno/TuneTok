import React, { useEffect, memo, useCallback, useMemo, useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, ActivityIndicator, Platform } from 'react-native';
import { Video as ExpoVideo, ResizeMode, Audio } from 'expo-av';
import { useVideoPlayback } from '../hooks/useVideoPlayback';
import debounce from 'lodash/debounce';

// Constants
const DIMENSIONS = {
  width: Dimensions.get('window').width,
  height: Dimensions.get('window').height,
} as const;

// Simplified playback configuration
const PLAYBACK_CONFIG = {
  shouldPlay: true,
  isLooping: true,
  isMuted: Platform.OS === 'android',
  volume: Platform.OS === 'android' ? 0 : 1,
  progressUpdateIntervalMillis: 1000,
  positionMillis: 0,
  shouldCorrectPitch: true,
  rate: 1.0,
  androidImplementation: 'MediaPlayer',
  progressThresholdMillis: 1000,
} as const;

// Error Boundary Component
class VideoErrorBoundary extends React.PureComponent<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Error boundary caught an error, but we don't need to log it
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Something went wrong with the video player.</Text>
          <Text style={styles.errorText}>Please try again later.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

interface VideoPlayerProps {
  uri: string;
  nextUri?: string;
  nextNextUri?: string;  // URI for second video ahead
  onError?: (error: string) => void;
  onLoad?: () => void;
  isFocused: boolean;
}

const VideoPlayerComponent: React.FC<VideoPlayerProps> = ({
  uri,
  nextUri,
  nextNextUri,
  onError,
  onLoad,
  isFocused,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const localVideoRef = useRef<ExpoVideo | null>(null);
  const nextVideoRef = useRef<ExpoVideo | null>(null);
  const nextNextVideoRef = useRef<ExpoVideo | null>(null);
  const isUnmounting = useRef(false);
  const [preloadedVideos, setPreloadedVideos] = useState<Set<string>>(new Set());
  const preloadTimeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const {
    videoRef,
    playerState,
    loadError,
    retryAttempt,
    handlePlaybackStatusUpdate,
    handleVideoLoad,
  } = useVideoPlayback({
    uri,
    isFocused: isMounted && isFocused,
    onError,
    onLoad: () => {
      onLoad?.();
      // Always try to preload the next two videos in sequence
      if (nextUri) {
        preloadVideo(nextUri, nextVideoRef).then(() => {
          if (nextNextUri) {
            preloadVideo(nextNextUri, nextNextVideoRef);
          }
        }).catch(() => {
          // Silently handle preload errors - preloading is optional
        });
      }
    },
  });

  // Track focus changes
  useEffect(() => {
    // Focus tracking without logging
  }, [isFocused, uri, isMounted, playerState]);

  // Basic video styles
  const videoStyles = useMemo(() => [
    styles.video,
    { width: DIMENSIONS.width, height: DIMENSIONS.height }
  ], []);

  // Enhanced cleanup effect
  useEffect(() => {
    return () => {
      isUnmounting.current = true;
      
      // Clear all timeouts first
      for (const timeoutId of preloadTimeoutRefs.current.values()) {
        clearTimeout(timeoutId);
      }
      preloadTimeoutRefs.current.clear();
      
      // Clean up videos sequentially to avoid resource conflicts
      const cleanup = async () => {
        if (nextVideoRef.current) {
          await nextVideoRef.current.unloadAsync().catch(() => {});
        }
        if (nextNextVideoRef.current) {
          await nextNextVideoRef.current.unloadAsync().catch(() => {});
        }
        if (localVideoRef.current) {
          await localVideoRef.current.unloadAsync().catch(() => {});
        }
      };

      cleanup();
    };
  }, []);

  // Preload a specific video with retry logic
  const preloadVideo = useCallback(async (videoUri: string, videoRef: React.RefObject<ExpoVideo>) => {
    if (!videoUri || !videoRef.current || isUnmounting.current) {
      return;
    }

    // Track if this specific preload operation should continue
    const preloadId = Date.now();
    const shouldContinue = { current: true };

    try {
      if (preloadTimeoutRefs.current.has(videoUri)) {
        clearTimeout(preloadTimeoutRefs.current.get(videoUri));
        preloadTimeoutRefs.current.delete(videoUri);
      }

      // Clean up before preloading
      await videoRef.current.unloadAsync().catch(() => {});
      
      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Only continue if we haven't started a new preload operation
      if (!shouldContinue.current) return;

      const preloadPromise = videoRef.current.loadAsync(
        { uri: videoUri },
        {
          ...PLAYBACK_CONFIG,
          shouldPlay: false,
          volume: 0,
          isMuted: true,
        },
        true
      );

      const timeoutPromise = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Preload timeout'));
        }, 10000);
        preloadTimeoutRefs.current.set(videoUri, timeoutId);
      });

      await Promise.race([preloadPromise, timeoutPromise]);
      
      // Only update state if this is still the current preload operation
      if (shouldContinue.current) {
        setPreloadedVideos(prev => new Set([...prev, videoUri]));
      }
    } catch (error) {
      if (shouldContinue.current) {
        setPreloadedVideos(prev => {
          const next = new Set(prev);
          next.delete(videoUri);
          return next;
        });
        
        // Retry once after delay
        const retryTimeoutId = setTimeout(() => {
          if (!isUnmounting.current) {
            preloadVideo(videoUri, videoRef);
          }
        }, 2000);
        preloadTimeoutRefs.current.set(videoUri, retryTimeoutId);
      }
    }

    return () => {
      shouldContinue.current = false;
    };
  }, []);

  // Reset preload states when main URI changes
  useEffect(() => {
    // Only remove preloaded status for videos that are no longer needed
    setPreloadedVideos(prev => {
      const next = new Set(prev);
      // Keep only next and next-next videos
      const validUris = new Set([nextUri, nextNextUri].filter(Boolean));
      for (const preloadedUri of prev) {
        if (!validUris.has(preloadedUri)) {
          next.delete(preloadedUri);
        }
      }
      return next;
    });
  }, [uri, nextUri, nextNextUri]);

  // Ref handlers
  const handleRef = useCallback((ref: ExpoVideo | null) => {
    if (ref) {
      localVideoRef.current = ref;
      videoRef.current = ref;
    }
  }, [videoRef]);

  const handleNextVideoRef = useCallback((ref: ExpoVideo | null) => {
    nextVideoRef.current = ref;
  }, []);

  const handleNextNextVideoRef = useCallback((ref: ExpoVideo | null) => {
    nextNextVideoRef.current = ref;
  }, []);

  // Mount effect
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
      isUnmounting.current = true;
    };
  }, []);

  // Error handler
  const handleVideoError = useCallback((error: string | Error) => {
    const errorMessage = error instanceof Error ? error.message : error;
    onError?.(errorMessage);
  }, [onError]);

  if (!uri) {
    return null;
  }

  return (
    <VideoErrorBoundary>
      <View style={styles.container}>
        {uri && isMounted && (
          <ExpoVideo
            ref={handleRef}
            style={videoStyles}
            source={{ uri }}
            resizeMode={ResizeMode.COVER}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            onLoad={handleVideoLoad}
            onError={handleVideoError}
            {...PLAYBACK_CONFIG}
            shouldPlay={isFocused}
          />
        )}

        {/* Hidden preload videos */}
        {nextUri && (
          <ExpoVideo
            ref={handleNextVideoRef}
            style={[videoStyles, styles.hiddenVideo]}
            source={{ uri: nextUri }}
            resizeMode={ResizeMode.COVER}
          />
        )}
        {nextNextUri && (
          <ExpoVideo
            ref={handleNextNextVideoRef}
            style={[videoStyles, styles.hiddenVideo]}
            source={{ uri: nextNextUri }}
            resizeMode={ResizeMode.COVER}
          />
        )}

        {playerState.isLoading && !loadError && (
          <View style={[styles.overlay, styles.loadingContainer]}>
            <ActivityIndicator size="large" color="#FFF" />
          </View>
        )}
        
        {loadError && (
          <View style={[styles.overlay, styles.errorContainer]}>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        )}
      </View>
    </VideoErrorBoundary>
  );
};

export const VideoPlayer = memo(VideoPlayerComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  hiddenVideo: {
    width: 0,
    height: 0,
    opacity: 0,
    position: 'absolute',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  loadingContainer: {
    backgroundColor: '#000',
  },
  errorContainer: {
    backgroundColor: '#000',
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
}); 