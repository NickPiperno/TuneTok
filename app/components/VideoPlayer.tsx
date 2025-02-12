import React, { useEffect, memo, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text, ActivityIndicator } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

// Constants
const DIMENSIONS = {
  width: Dimensions.get('window').width,
  height: Dimensions.get('window').height,
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
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

const VideoPlayerComponent: React.FC<VideoPlayerProps> = ({
  uri,
  onError,
  onLoad,
  isFocused,
  onPlaybackStateChange,
}) => {
  // Create video player instance
  const player = useVideoPlayer(uri, player => {
    player.loop = true;
  });

  // Handle focus changes
  useEffect(() => {
    if (isFocused) {
      player.play();
      onPlaybackStateChange?.(true);
    } else {
      player.pause();
      onPlaybackStateChange?.(false);
    }
  }, [isFocused, player, onPlaybackStateChange]);

  // Handle errors and loading
  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' && error) {
        onError?.(error.message);
      } else if (status === 'readyToPlay') {
        onLoad?.();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player, onError, onLoad]);

  return (
    <VideoErrorBoundary>
      <View style={styles.container}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: '#000',
  },
}); 