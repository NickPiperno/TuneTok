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
  Share,
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
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc, increment } from 'firebase/firestore';
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
  const PRELOAD_THRESHOLD = 4;

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

      // Get the last video's timestamp for pagination
      const lastVideoTimestamp = isLoadingMore && videos.length > 0 
        ? videos[videos.length - 1].uploadDate 
        : undefined;

      const result = await fetchVideos(pageSize, lastVideoTimestamp);
      if ('code' in result) {
        throw new Error(result.message);
      }

      // Validate videos before setting
      const validVideos = result.filter(validateVideo);
      
      if (validVideos.length === 0 && isLoadingMore) {
        // If we're loading more and get no videos, we've reached the end
        // Load the first batch again
        console.log('🔄 FeedScreen: Reached end of videos, wrapping to start');
        const firstBatch = await fetchVideos(pageSize);
        if ('code' in firstBatch) {
          throw new Error(firstBatch.message);
        }
        // Add wrapped flag and unique keys to wrapped videos
        const wrappedVideos = firstBatch.filter(validateVideo).map(video => ({
          ...video,
          id: `${video.id}_wrapped_${Date.now()}`, // Make the ID unique
          isWrapped: true // Add flag to identify wrapped videos
        }));
        validVideos.push(...wrappedVideos);
      } else if (validVideos.length === 0) {
        throw new Error('No valid videos available');
      }

      console.log('📼 FeedScreen: Fetched videos:', {
        newVideosCount: validVideos.length,
        isLoadingMore,
        currentCount: videos.length,
        firstNewVideoId: validVideos[0]?.id,
        lastNewVideoId: validVideos[validVideos.length - 1]?.id,
        isWrapping: validVideos.some(v => v.isWrapped)
      });

      setVideos(prev => {
        if (isLoadingMore) {
          // Create a Set of existing video IDs for O(1) lookup
          const existingIds = new Set(prev.map(v => v.id));
          // Filter out any duplicates from the new videos
          const newUniqueVideos = validVideos.filter(v => !existingIds.has(v.id));
          
          console.log('🔄 FeedScreen: Appending videos:', {
            existingCount: prev.length,
            newUniqueCount: newUniqueVideos.length,
            totalAfterMerge: prev.length + newUniqueVideos.length,
            hasWrappedVideos: newUniqueVideos.some(v => v.isWrapped)
          });
          
          // Only append if we have new unique videos
          if (newUniqueVideos.length > 0) {
            return [...prev, ...newUniqueVideos];
          }
          return prev;
        }
        return validVideos;
      });
      
      setError(null);
    } catch (error: any) {
      // Only show errors for network or auth issues, not for end of content
      if (error.message !== 'No valid videos available') {
        setError(error.message || 'Failed to load videos');
        Alert.alert('Error', error.message || 'Failed to load videos');
      }
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [user, validateVideo, videos]);

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
    videos.length - currentVideoIndex <= PRELOAD_THRESHOLD,
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
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [sharedVideos, setSharedVideos] = useState<Set<string>>(new Set());

  // Add logging for playback state changes
  const handlePlaybackStateChange = useCallback((isPlaying: boolean) => {
    console.log('🎬 Video playback state changed:', { 
      isPlaying, 
      currentVideoId: currentVideo?.id,
      currentVideoIndex 
    });
    setIsVideoPlaying(isPlaying);
  }, [currentVideo?.id, currentVideoIndex]);

  // Load user preferences on mount
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!user) return;
      
      try {
        console.log('🎯 Loading user preferences for:', user.uid);
        const userPrefsRef = doc(db, 'userPreferences', user.uid);
        const userPrefsDoc = await getDoc(userPrefsRef);
        
        if (userPrefsDoc.exists()) {
          const prefs = userPrefsDoc.data();
          // Set liked videos
          if (prefs.likedVideos) {
            setLikedVideos(new Set(prefs.likedVideos));
          }
          // Set shared videos
          if (prefs.sharedVideos) {
            setSharedVideos(new Set(prefs.sharedVideos));
          }
          // Set followed artists
          if (prefs.following) {
            setFollowedArtists(new Set(prefs.following));
          }
        }
      } catch (error) {
        console.error('❌ Failed to load user preferences:', error);
      }
    };

    loadUserPreferences();
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

  const handleShare = async () => {
    if (!user || !currentVideo) return;

    try {
      const isAlreadyShared = sharedVideos.has(currentVideo.id);
      console.log('🔄 FeedScreen: Share initiated:', { 
        videoId: currentVideo.id, 
        isAlreadyShared,
        currentShares: currentVideo.shares 
      });
      
      // Store current playback state
      const wasPlaying = isVideoPlaying;
      
      // 1. Prepare share content
      const shareUrl = `https://tunetok.app/video/${currentVideo.id}`;
      const shareOptions = {
        title: `Check out this video on TuneTok!`,
        message: `${currentVideo.title} by ${currentVideo.artist}\n\n${shareUrl}`,
      };

      // 2. Show share dialog
      console.log('🔄 FeedScreen: Opening share dialog');
      await Share.share(shareOptions);

      // Only update share count and record interaction if this is the first share
      if (!isAlreadyShared) {
        console.log('🆕 FeedScreen: First time share, updating counts');
        
        // Update UI optimistically
        setVideos(prevVideos => 
          prevVideos.map(video => 
            video.id === currentVideo.id
              ? { ...video, shares: (video.shares || 0) + 1 }
              : video
          )
        );

        // Update shared videos set
        const updatedSharedVideos = new Set(sharedVideos);
        updatedSharedVideos.add(currentVideo.id);
        setSharedVideos(updatedSharedVideos);

        // Update Firebase
        const videoRef = doc(db, 'videoMetadata', currentVideo.id);
        const userPrefsRef = doc(db, 'userPreferences', user.uid);

        Promise.all([
          updateDoc(videoRef, {
            shares: increment(1)
          }),
          updateDoc(userPrefsRef, {
            sharedVideos: arrayUnion(currentVideo.id)
          }),
          recordInteraction({
            userId: user.uid,
            videoId: currentVideo.id,
            watchDuration: 0,
            watchPercentage: 0,
            interactionType: 'share',
            timestamp: new Date(),
            genre: currentVideo.genre,
            mood: currentVideo.mood
          })
        ]).catch(error => {
          console.error('❌ FeedScreen: Error recording share:', error);
        });
      } else {
        console.log('ℹ️ FeedScreen: Video already shared, skipping count update');
      }

      // Resume playback if it was playing before
      if (wasPlaying) {
        setIsVideoPlaying(true);
      }
    } catch (error) {
      console.error('❌ FeedScreen: Error sharing video:', error);
      Alert.alert('Error', 'Failed to share video');
    }
  };

  // Add this at the component level, before renderItem
  const handleVideoPlaybackStateChange = useCallback((isPlaying: boolean, isFocused: boolean) => {
    if (isFocused) {
      handlePlaybackStateChange(isPlaying);
    }
  }, [handlePlaybackStateChange]);

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
          onPress={() => {
            if (isFocused) {
              setIsVideoPlaying(prev => !prev);
            }
          }}
        >
          <VideoPlayer
            key={item.id}
            uri={item.url}
            isFocused={isFocused && isVideoPlaying}
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
            onPlaybackStateChange={(isPlaying) => handleVideoPlaybackStateChange(isPlaying, isFocused)}
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
        // Resume playback when a new video becomes viewable
        setIsVideoPlaying(true);
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
        windowSize={5}
        maxToRenderPerBatch={4}
        initialNumToRender={3}
        removeClippedSubviews={false}
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
          console.log('📜 FeedScreen: onEndReached triggered', {
            currentIndex: currentVideoIndex,
            totalVideos: videos.length,
            isLoadingMore,
            shouldLoad: shouldLoadMore()
          });
          
          if (shouldLoadMore() && !isLoadingMore) {
            console.log('🔄 FeedScreen: Loading more videos');
            loadVideos(PAGE_SIZE, true);
          }
        }}
        onEndReachedThreshold={0.8}
        ListFooterComponent={() => isLoadingMore ? (
          <View style={styles.loadingMoreContainer}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
      />

      {/* Always render controls for current video */}
      {currentVideo && (
        <FeedVideoControls
          visible={true} // Always visible
          onLike={() => {
            if (currentVideo?.id) {
              handleLike();
            }
          }}
          onComment={handleOpenComments}
          onShare={handleShare}
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
          videoId={currentVideo?.id || ''}
        />
      )}

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
    position: 'relative',
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
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