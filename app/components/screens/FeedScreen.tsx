import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VideoPlayer } from '../VideoPlayer';
import { signOut } from '../../services/auth';
import { CommentsSheet } from '../common/CommentsSheet';
import { useAuth } from '../../contexts/AuthContext';
import { recordInteraction, updateUserPreferences } from '../../services/videoMetadata';
import { Video } from '../../types/video';
import {
  VideoControls as FeedVideoControls,
  NavigationButtons,
  LoadingStates,
  VideoInfo,
} from '../feed';
import { useComments } from '../../hooks/useComments';
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FollowButton } from '../common/FollowButton';
import { SaveToPlaylistModal } from '../common/SaveToPlaylistModal';
import { fetchVideos } from '../../services/video';
import NetInfo from '@react-native-community/netinfo';
import { VideoView, useVideoPlayer } from 'expo-video';

type RootStackParamList = {
  Feed: {
    initialVideo?: Video;
    initialIndex?: number;
  };
  Search: undefined;
  Landing: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Feed'>;

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 30;

export const FeedScreen = () => {
  // Navigation and Auth
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  // Replace useVideoFeed hook with direct state management
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const loadingRef = useRef(false);

  // Constants
  const PAGE_SIZE = 10;
  const PRELOAD_THRESHOLD = 2;

  // Add video validation helper
  const validateVideo = useCallback((video: Video): boolean => {
    if (!video.url || !video.id) {
      console.error('❌ Invalid video object:', video);
      return false;
    }
    return true;
  }, []);

  // Improve load videos function
  const loadVideos = useCallback(async (pageSize: number = PAGE_SIZE, isLoadingMore: boolean = false) => {
    if (loadingRef.current || !user) return;

    try {
      loadingRef.current = true;
      isLoadingMore ? setIsLoadingMore(true) : setIsLoading(true);

      // Check network connectivity first
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        throw new Error('No internet connection');
      }

      const result = await fetchVideos(pageSize);
      if ('code' in result) {
        throw new Error(result.message);
      }

      // Validate videos before setting
      const validVideos = result.filter(validateVideo);
      
      if (validVideos.length === 0) {
        throw new Error('No valid videos available');
      }

      console.log('Fetched videos:', validVideos.map(v => ({
        id: v.id,
        url: v.url,
        isValidUrl: Boolean(v.url && v.url.startsWith('http'))
      })));

      setVideos(prev => {
        if (isLoadingMore) {
          const existingIds = new Set(prev.map(v => v.id));
          const newVideos = validVideos.filter(v => !existingIds.has(v.id));
          return [...prev, ...newVideos];
        }
        return validVideos;
      });
      
      setError(null);
    } catch (error: any) {
      setError(error.message || 'Failed to load videos');
      Alert.alert('Error', error.message || 'Failed to load videos');
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [user, validateVideo]);

  // Handle video errors
  const handleVideoError = useCallback((error: string) => {
    console.error('Video playback error:', error);
    Alert.alert(
      'Video Error',
      error,
      [
        {
          text: 'Retry',
          onPress: () => loadVideos(PAGE_SIZE, false)
        },
        {
          text: 'Skip',
          onPress: () => {
            if (currentVideoIndex < videos.length - 1) {
              setCurrentVideoIndex(currentVideoIndex + 1);
            } else {
              loadVideos(PAGE_SIZE, true);
            }
          }
        }
      ]
    );
  }, [currentVideoIndex, videos.length]);

  // Check if we should load more
  const shouldLoadMore = useCallback(() => 
    videos.length - currentVideoIndex <= PRELOAD_THRESHOLD + 1,
    [videos.length, currentVideoIndex]
  );

  // Derived State
  const currentVideo = videos[currentVideoIndex];
  const nextVideo = videos[(currentVideoIndex + 1) % videos.length];
  const nextNextVideo = videos[(currentVideoIndex + 2) % videos.length];

  const {
    showComments,
    comments,
    isLoadingComments,
    hasMoreComments,
    handleOpenComments,
    handleCloseComments,
    handleSubmitComment,
    handleLikeComment,
    handleDeleteComment,
    loadMoreComments,
  } = useComments(currentVideo?.id || '', useCallback((change: number) => {
    // Update the video's comment count in the local state
    if (currentVideo?.id) {
      setVideos(prev => prev.map(video => 
        video.id === currentVideo.id
          ? { ...video, comments: (video.comments || 0) + change }
          : video
      ));
    }
  }, [currentVideo?.id, setVideos]));

  // Local State
  const [showControls, setShowControls] = useState(true);
  const [followedArtists, setFollowedArtists] = useState<Set<string>>(new Set());
  const [showSaveToPlaylist, setShowSaveToPlaylist] = useState(false);

  // Load followed artists on mount
  useEffect(() => {
    const loadFollowedArtists = async () => {
      if (!user) return;
      
      try {
        console.log('🎯 Loading followed artists for user:', user.uid);
        const userPrefsRef = doc(db, 'userPreferences', user.uid);
        const userPrefsDoc = await getDoc(userPrefsRef);
        
        if (userPrefsDoc.exists()) {
          const prefs = userPrefsDoc.data();
          console.log('📋 User preferences loaded:', { following: prefs.following });
          if (prefs.following) {
            setFollowedArtists(new Set(prefs.following));
          }
        }
      } catch (error) {
        console.error('❌ Failed to load followed artists:', error);
      }
    };

    loadFollowedArtists();
  }, [user]);

  // Handle initial video from search
  useEffect(() => {
    const params = navigation.getState().routes.find(r => r.name === 'Feed')?.params;
    if (params?.initialVideo) {
      console.log('🎯 FeedScreen: Handling initial video from search', {
        videoId: params.initialVideo.id,
        videoUrl: params.initialVideo.url,
        currentVideos: videos.length
      });

      // Validate video URL
      if (!params.initialVideo.url) {
        console.error('❌ FeedScreen: Invalid video URL');
        Alert.alert('Error', 'Invalid video URL');
        return;
      }

      // Ensure the video object is complete
      const validatedVideo = {
        ...params.initialVideo,
        url: params.initialVideo.url.trim(), // Ensure no whitespace
        likes: params.initialVideo.likes || 0,
        comments: params.initialVideo.comments || 0,
        shares: params.initialVideo.shares || 0,
        views: params.initialVideo.views || 0,
        tags: params.initialVideo.tags || [],
      };

      // Always add the video at the beginning and show it
      setVideos(prev => {
        // Remove any existing instance of this video
        const filteredVideos = prev.filter(v => v.id !== validatedVideo.id);
        // Add the video at the beginning
        return [validatedVideo, ...filteredVideos];
      });
      setCurrentVideoIndex(0);
    }
  }, [navigation]);

  // Load initial videos only once when the component mounts
  useEffect(() => {
    if (user) {
      loadVideos(10, false);
    }
  }, [user?.uid]); // Only reload when user changes

  useEffect(() => {
    console.log('📺 Feed Video State:', {
      currentIndex: currentVideoIndex,
      totalVideos: videos.length,
      currentId: currentVideo?.id,
      nextId: nextVideo?.id,
      nextNextId: nextNextVideo?.id,
      currentUri: currentVideo?.url,
      nextUri: nextVideo?.url,
      nextNextUri: nextNextVideo?.url,
      wrappedNextIndex: (currentVideoIndex + 1) % videos.length,
      wrappedNextNextIndex: (currentVideoIndex + 2) % videos.length
    });
  }, [currentVideoIndex, videos, currentVideo, nextVideo, nextNextVideo]);

  const handleFollowChange = async (isFollowed: boolean) => {
    console.log('👆 FeedScreen: Follow change triggered', { 
      isFollowed, 
      artist: currentVideo?.artist,
      userId: user?.uid 
    });

    if (!user || !currentVideo?.artist) {
      console.log('❌ FeedScreen: Missing user or artist', { 
        hasUser: !!user, 
        artist: currentVideo?.artist 
      });
      return;
    }

    try {
      const userPrefsRef = doc(db, 'userPreferences', user.uid);
      const updatedFollowedArtists = new Set(followedArtists);

      console.log('🔄 FeedScreen: Updating follow status', {
        artist: currentVideo.artist,
        action: isFollowed ? 'follow' : 'unfollow'
      });

      if (isFollowed) {
        updatedFollowedArtists.add(currentVideo.artist);
        await updateDoc(userPrefsRef, {
          following: arrayUnion(currentVideo.artist)
        });
      } else {
        updatedFollowedArtists.delete(currentVideo.artist);
        await updateDoc(userPrefsRef, {
          following: arrayRemove(currentVideo.artist)
        });
      }

      console.log('✅ FeedScreen: Follow status updated successfully');
      setFollowedArtists(updatedFollowedArtists);
    } catch (error) {
      console.error('❌ FeedScreen: Failed to update follow status:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  // Event Handlers
  const handleLike = async () => {
    if (!user || !currentVideo) return;

    const isCurrentlyLiked = likedVideos.has(currentVideo.id);
    
    // 1. Immediately update UI (optimistic update)
    const updatedLikedVideos = new Set(likedVideos);
    if (isCurrentlyLiked) {
        updatedLikedVideos.delete(currentVideo.id);
    } else {
        updatedLikedVideos.add(currentVideo.id);
    }
    
    // Update local state immediately
    setLikedVideos(updatedLikedVideos);
    setVideos(prevVideos => 
        prevVideos.map(video => 
            video.id === currentVideo.id 
                ? { ...video, likes: isCurrentlyLiked ? (video.likes || 1) - 1 : (video.likes || 0) + 1 }
                : video
        )
    );

    // 2. Update Firebase in background
    try {
        const videoRef = doc(db, 'videoMetadata', currentVideo.id);
        const userPrefsRef = doc(db, 'userPreferences', user.uid);

        // Run Firebase operations in background
        Promise.all([
            updateDoc(videoRef, {
                likes: (currentVideo.likes || (isCurrentlyLiked ? 1 : 0)) + (isCurrentlyLiked ? -1 : 1)
            }),
            updateDoc(userPrefsRef, {
                likedVideos: isCurrentlyLiked ? arrayRemove(currentVideo.id) : arrayUnion(currentVideo.id)
            }),
            recordInteraction({
                userId: user.uid,
                videoId: currentVideo.id,
                watchDuration: 0,
                watchPercentage: 0,
                interactionType: isCurrentlyLiked ? 'view' : 'like',
                timestamp: new Date(),
                genre: currentVideo.genre,
                mood: currentVideo.mood
            })
        ]).catch(error => {
            console.error('❌ FeedScreen: Error updating likes:', error);
            // Optionally revert UI if update fails
        });
    } catch (error) {
        console.error('❌ FeedScreen: Error updating likes:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const error = await signOut();
      if (error) {
        Alert.alert('Error', 'Failed to log out. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const toggleControls = () => {
    console.log('🔄 FeedScreen: Toggling controls visibility', { 
      currentVisibility: showControls, 
      newVisibility: !showControls 
    });
    setShowControls(!showControls);
  };

  // Remove gesture-related code and animations
  const renderItem = ({ item, index }: { item: Video; index: number }) => {
    const isFocused = currentVideoIndex === index;
    
    console.log('Rendering video item:', {
      index,
      videoId: item.id,
      videoUrl: item.url,
      isFocused,
      currentVideoIndex
    });

    return (
      <View style={styles.videoContainer}>
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.videoWrapper}
          onPress={toggleControls}
        >
          <VideoPlayer
            key={item.id}
            uri={item.url}
            isFocused={isFocused}
            onError={(error) => {
              console.error('Video error for index', index, error);
              handleVideoError(error);
            }}
            onLoad={() => {
              console.log('Video loaded successfully:', {
                index,
                videoId: item.id
              });
            }}
          />
          {isFocused && <VideoInfo video={item} />}
        </TouchableOpacity>
      </View>
    );
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index;
      console.log('Viewable items changed:', {
        newIndex: index,
        videoId: videos[index]?.id,
        totalVideos: videos.length,
        isFullyVisible: viewableItems[0].isViewable
      });
      
      if (typeof index === 'number') {
        setCurrentVideoIndex(index);
      }
    }
  }, [videos]);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 80, // Increased from 50
    minimumViewTime: 250, // Increased from 100
  }), []);

  // Loading States
  if (isLoading || error || videos.length === 0) {
    return (
      <LoadingStates
        isLoading={isLoading}
        error={error}
        isEmpty={videos.length === 0}
      />
    );
  }

  // Render
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <NavigationButtons />
      
      <FlatList
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        removeClippedSubviews={true}
        getItemLayout={(_, index) => ({
          length: WINDOW_HEIGHT,
          offset: WINDOW_HEIGHT * index,
          index,
        })}
        decelerationRate="fast"
        bounces={false}
        scrollEventThrottle={16}
        snapToInterval={WINDOW_HEIGHT}
        snapToAlignment="start"
        style={styles.list}
        onEndReached={() => {
          if (shouldLoadMore() && !isLoadingMore) {
            loadVideos(PAGE_SIZE, true);
          }
        }}
        onEndReachedThreshold={0.5}
      />

      <FeedVideoControls
        visible={showControls}
        onLike={() => {
          if (currentVideo?.id) {
            handleLike();
          }
        }}
        onComment={handleOpenComments}
        onShare={() => console.log('Share pressed')}
        onFollow={() => {
          if (currentVideo?.artist) {
            handleFollowChange(!followedArtists.has(currentVideo.artist));
          }
        }}
        onSave={() => setShowSaveToPlaylist(true)}
        isSaved={false}
        likes={currentVideo?.likes || 0}
        comments={currentVideo?.comments || 0}
        shares={currentVideo?.shares || 0}
        isLiked={!!currentVideo?.id && likedVideos.has(currentVideo.id)}
        isFollowed={!!currentVideo?.artist && followedArtists.has(currentVideo.artist)}
      />

      <CommentsSheet
        isVisible={showComments}
        onClose={handleCloseComments}
        comments={comments}
        onSubmitComment={handleSubmitComment}
        onLikeComment={handleLikeComment}
        onDeleteComment={handleDeleteComment}
        onLoadMore={loadMoreComments}
        isLoading={isLoadingComments}
        hasMore={hasMoreComments}
        commentsCount={currentVideo?.comments || 0}
        currentUserId={user?.uid}
      />

      <SaveToPlaylistModal
        isVisible={showSaveToPlaylist}
        onClose={() => setShowSaveToPlaylist(false)}
        videoId={currentVideo?.id || ''}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  list: {
    flex: 1,
  },
  videoContainer: {
    height: WINDOW_HEIGHT,
    backgroundColor: '#000',
  },
  videoWrapper: {
    flex: 1,
  },
  loadingMoreContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  nextVideo: {
    opacity: 0,
  }
}); 