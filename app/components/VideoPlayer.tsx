import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, Pressable, ActivityIndicator, AppState, Platform } from 'react-native';
import { Video as ExpoVideo, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';

const { width, height } = Dimensions.get('window');

interface VideoPlayerProps {
  uri: string;
  nextUri?: string;
  onError?: (error: string) => void;
  onLoad?: () => void;
  isFocused: boolean; // Whether this video is currently visible
}

const VideoPlayerComponent: React.FC<VideoPlayerProps> = ({
  uri,
  nextUri,
  onError,
  onLoad,
  isFocused,
}) => {
  const videoRef = useRef<ExpoVideo>(null);
  const nextVideoRef = useRef<ExpoVideo>(null);
  const [playerState, setPlayerState] = useState({
    isLoading: true,
    isBuffering: false,
    isReady: false,
    progress: 0
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const maxRetryAttempts = useRef(3);
  const lastPlayAttemptRef = useRef<number>(0);

  useEffect(() => {
    const checkNetworkAndLoad = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        
        if (!networkState.isInternetReachable) {
          setLoadError('No internet connection');
          onError?.('No internet connection');
          return;
        }

        setPlayerState(prev => ({ ...prev, isLoading: true }));
        setLoadError(null);
      } catch (error) {
        setLoadError('Failed to check network status');
        onError?.('Failed to check network status');
      }
    };

    checkNetworkAndLoad();
  }, [uri]);

  const handleError = (error: string | Error) => {
    console.error('Video loading error:', error);
    
    if (retryAttempt < maxRetryAttempts.current) {
      setRetryAttempt(prev => prev + 1);
      setPlayerState(prev => ({ ...prev, isLoading: true }));
      setLoadError(null);
    } else {
      const errorMessage = error instanceof Error ? error.message : error;
      setLoadError(`Failed to load video: ${errorMessage}`);
      onError?.(errorMessage);
    }
  };

  useEffect(() => {
    setPlayerState(prev => ({
      ...prev,
      isLoading: true,
      isReady: false,
      progress: 0
    }));
    setRetryAttempt(0);
  }, [uri]);

  useEffect(() => {
    if (nextUri && playerState.progress >= 0.8) {
      nextVideoRef.current?.loadAsync({ uri: nextUri }, {}, false);
    }
  }, [nextUri, playerState.progress]);

  const attemptPlayback = useCallback(async (attempt = 0) => {
    if (!videoRef.current || !isFocused || !playerState.isReady) return;
    
    const now = Date.now();
    if (now - lastPlayAttemptRef.current < 500) return;
    lastPlayAttemptRef.current = now;

    try {
      const status = await videoRef.current.getStatusAsync();
      if (!status.isLoaded || !status.isPlaying) {
        await videoRef.current.playAsync();
      }
      setRetryAttempt(0);
    } catch (error) {
      if (error.message?.includes('AudioFocusNotAcquiredException')) {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }

        if (attempt < maxRetryAttempts.current) {
          const nextAttempt = attempt + 1;
          const delay = Math.min(1000 * Math.pow(1.5, attempt), 5000);
          
          setRetryAttempt(nextAttempt);
          retryTimeoutRef.current = setTimeout(() => {
            attemptPlayback(nextAttempt);
          }, delay);
        }
      } else {
        console.error('❌ VideoPlayer: Playback error:', error);
        onError?.(error.message);
      }
    }
  }, [isFocused, playerState.isReady, onError]);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ('error' in status) {
        onError?.(status.error);
      }
      return;
    }

    setPlayerState(prev => {
      const updates: Partial<typeof prev> = {};
      
      if (prev.isLoading && status.isLoaded) {
        updates.isLoading = false;
      }
      
      if (status.durationMillis) {
        updates.progress = status.positionMillis / status.durationMillis;
      }
      
      if (status.isBuffering !== prev.isBuffering) {
        updates.isBuffering = status.isBuffering;
      }

      const isReadyToPlay = status.isLoaded && 
                           !status.isBuffering && 
                           status.playableDurationMillis !== undefined &&
                           status.durationMillis !== undefined &&
                           (status.playableDurationMillis / status.durationMillis) >= 0.05;

      if (isReadyToPlay && !prev.isReady) {
        updates.isReady = true;
      }

      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });

    if (status.isLoaded && !status.isPlaying && isFocused && playerState.isReady) {
      attemptPlayback();
    }
  }, [isFocused, playerState.isReady, attemptPlayback]);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.log('Failed to setup audio mode:', error);
      }
    };
    
    setupAudio();
  }, []);

  useEffect(() => {
    if (isFocused && playerState.isReady) {
      attemptPlayback();
    } else {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      videoRef.current?.pauseAsync().catch(console.log);
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [isFocused, playerState.isReady, attemptPlayback]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        videoRef.current?.pauseAsync().catch(console.log);
      } else if (nextAppState === 'active') {
        if (isFocused && playerState.isReady) {
          attemptPlayback();
        }
      }
    });

    return () => {
      subscription.remove();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [isFocused, playerState.isReady, attemptPlayback]);

  useEffect(() => {
    return () => {
      videoRef.current?.unloadAsync();
      nextVideoRef.current?.unloadAsync();
    };
  }, []);

  if (!uri) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No video URL provided</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoVideo
        ref={videoRef}
        style={styles.video}
        source={{ uri }}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={false}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onLoad={() => {
          setPlayerState(prev => ({ ...prev, isLoading: false }));
          onLoad?.();
        }}
        onError={(error) => onError?.(error)}
        progressUpdateIntervalMillis={500}
      />

      {nextUri && playerState.progress >= 0.8 && (
        <ExpoVideo
          ref={nextVideoRef}
          source={{ uri: nextUri }}
          style={{ width: 0, height: 0 }}
          shouldPlay={false}
        />
      )}

      {playerState.isLoading && !loadError && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF2B4E" />
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      )}
      
      {loadError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      )}

      {retryAttempt > 0 && (
        <View style={styles.retryIndicator}>
          <Text style={styles.retryText}>
            Retrying playback ({retryAttempt}/{maxRetryAttempts.current})...
          </Text>
        </View>
      )}
    </View>
  );
};

export const VideoPlayer = memo(VideoPlayerComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width,
    height,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF2B4E',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
}); 