import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
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
import { useVideoFeed } from '../../hooks/useVideoFeed';
import { useComments } from '../../hooks/useComments';
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FollowButton } from '../common/FollowButton';
import { SaveToPlaylistModal } from '../common/SaveToPlaylistModal';

type RootStackParamList = {
  Feed: {
    initialVideo?: Video;
    initialIndex?: number;
  };
  Search: undefined;
  Landing: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Feed'>;

const { height } = Dimensions.get('window');
const SWIPE_THRESHOLD = 30;

export const FeedScreen = () => {
  // Navigation and Auth
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  // Custom Hooks
  const {
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
  } = useVideoFeed();

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

  // Animation Values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const likeScale = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

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

  // Animation Functions
  const animateVideoTransition = useCallback((direction: 'up' | 'down') => {
    const isWrappingAround = (direction === 'up' && currentVideoIndex === videos.length - 1) ||
                            (direction === 'down' && currentVideoIndex === 0);
    
    console.log('🔄 Video Transition:', {
      direction,
      fromIndex: currentVideoIndex,
      toIndex: direction === 'up' ? 
        (currentVideoIndex + 1) % videos.length : 
        (currentVideoIndex - 1 + videos.length) % videos.length,
      currentVideo: currentVideo?.id,
      nextVideo: nextVideo?.id,
      isWrappingAround
    });
    
    const distance = direction === 'up' ? -height : height;
    
    translateY.setValue(0);
    fadeAnim.setValue(1);
    
    // Add extra delay for wrap-around cases
    const animationDuration = isWrappingAround ? 400 : 300;
    const fadeOutDuration = isWrappingAround ? 300 : 200;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: fadeOutDuration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: distance,
        duration: animationDuration,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Update the index before starting the second animation
      const nextIndex = direction === 'up' ?
        (currentVideoIndex + 1) % videos.length :
        (currentVideoIndex - 1 + videos.length) % videos.length;
      
      setCurrentVideoIndex(nextIndex);
      
      // Add a small delay before starting the next animation for wrap-around cases
      const startNextAnimation = () => {
        translateY.setValue(-distance);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: fadeOutDuration,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: animationDuration,
            useNativeDriver: true,
          }),
        ]).start();
      };

      if (isWrappingAround) {
        setTimeout(startNextAnimation, 100);
      } else {
        startNextAnimation();
      }
    });
  }, [currentVideoIndex, videos.length, currentVideo, nextVideo, height, fadeAnim, translateY]);

  const animateLike = () => {
    Animated.sequence([
      Animated.timing(likeScale, {
        toValue: 1.5,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(likeScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateControlsVisibility = (visible: boolean) => {
    Animated.timing(overlayOpacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
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

    // Trigger animation immediately
    animateLike();

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
    animateControlsVisibility(!showControls);
    setShowControls(!showControls);
  };

  // Gesture Handlers
  const handleSwipeUp = useCallback(() => {
    console.log('⬆️ Swipe Up:', {
      currentIndex: currentVideoIndex,
      nextIndex: (currentVideoIndex + 1) % videos.length,
      totalVideos: videos.length,
      shouldLoadMore: shouldLoadMore(),
      isLoadingMore,
      isWrappingToStart: currentVideoIndex === videos.length - 1
    });

    if (videos.length > 0) {
      if (shouldLoadMore() && !isLoadingMore) {
        console.log('🔄 Triggering load more videos');
        loadVideos(10, true);
      }
      animateVideoTransition('up');
    }
  }, [videos.length, currentVideoIndex, isLoadingMore, shouldLoadMore]);

  const handleSwipeDown = useCallback(() => {
    console.log('⬇️ Swipe Down:', {
      currentIndex: currentVideoIndex,
      prevIndex: (currentVideoIndex - 1 + videos.length) % videos.length,
      totalVideos: videos.length,
      isWrappingToEnd: currentVideoIndex === 0
    });

    if (videos.length > 0) {
      animateVideoTransition('down');
    }
  }, [videos.length, currentVideoIndex]);

  const gesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onStart(() => {})
    .onUpdate((event) => {
      const translation = Math.abs(event.translationY);
      if (translation > SWIPE_THRESHOLD / 2) {
        translateY.setValue(event.translationY);
        fadeAnim.setValue(1 - Math.abs(event.translationY) / height);
      }
    })
    .onEnd((event) => {
      if (Math.abs(event.translationY) > height * 0.2 || Math.abs(event.velocityY) > SWIPE_THRESHOLD) {
        if (event.velocityY > 0) {
          handleSwipeDown();
        } else {
          handleSwipeUp();
        }
      } else {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });

  // Add focus monitoring
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('🎯 Screen Focused:', {
        currentIndex: currentVideoIndex,
        currentVideo: currentVideo?.id,
        isMounted: true
      });
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('⚫ Screen Blurred:', {
        currentIndex: currentVideoIndex,
        currentVideo: currentVideo?.id,
        isMounted: false
      });
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, currentVideoIndex, currentVideo]);

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

      <GestureDetector gesture={gesture}>
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.videoContainer}
          onPress={toggleControls}
        >
          <Animated.View style={[
            styles.videoWrapper,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}>
            <VideoPlayer
              uri={currentVideo.url}
              nextUri={videos[(currentVideoIndex + 1) % videos.length]?.url}
              nextNextUri={videos[(currentVideoIndex + 2) % videos.length]?.url}
              isFocused={true}
              onError={handleVideoError}
              onLoad={() => {
                console.log('🎬 VideoPlayer Props:', {
                  currentIndex: currentVideoIndex,
                  totalVideos: videos.length,
                  hasCurrentVideo: !!currentVideo?.url,
                  nextIndex: (currentVideoIndex + 1) % videos.length,
                  nextNextIndex: (currentVideoIndex + 2) % videos.length,
                  hasNextVideo: !!videos[(currentVideoIndex + 1) % videos.length]?.url,
                  hasNextNextVideo: !!videos[(currentVideoIndex + 2) % videos.length]?.url
                });
              }}
            />

            <VideoInfo video={currentVideo} />
          </Animated.View>
        </TouchableOpacity>
      </GestureDetector>

      {nextVideo && (
        <View style={[styles.videoContainer, styles.nextVideo]}>
          <VideoPlayer
            uri={nextVideo.url}
            isFocused={false}
            onError={handleVideoError}
          />
        </View>
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
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  videoWrapper: {
    flex: 1,
    backgroundColor: '#000',
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