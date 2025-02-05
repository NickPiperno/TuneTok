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

type RootStackParamList = {
  Feed: undefined;
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
  const nextVideo = videos[currentVideoIndex + 1];

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
  const animateVideoTransition = (direction: 'up' | 'down') => {
    const distance = direction === 'up' ? -height : height;
    
    translateY.setValue(0);
    fadeAnim.setValue(1);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: distance,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (direction === 'up') {
        setCurrentVideoIndex(prev => prev + 1);
      } else {
        setCurrentVideoIndex(prev => prev - 1);
      }
      
      translateY.setValue(-distance);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

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
    console.log('👆 FeedScreen: Like handler called');
    
    if (!user) {
      console.error('❌ FeedScreen: No authenticated user');
      return;
    }

    if (!currentVideo) {
      console.error('❌ FeedScreen: No current video to like');
      return;
    }

    try {
      const videoRef = doc(db, 'videoMetadata', currentVideo.id);
      const userPrefsRef = doc(db, 'userPreferences', user.uid);
      const isCurrentlyLiked = likedVideos.has(currentVideo.id);
      
      // Toggle like state
      const updatedLikedVideos = new Set(likedVideos);
      if (isCurrentlyLiked) {
        updatedLikedVideos.delete(currentVideo.id);
        await updateDoc(videoRef, {
          likes: (currentVideo.likes || 1) - 1
        });
        await updateDoc(userPrefsRef, {
          likedVideos: arrayRemove(currentVideo.id)
        });
      } else {
        updatedLikedVideos.add(currentVideo.id);
        await updateDoc(videoRef, {
          likes: (currentVideo.likes || 0) + 1
        });
        await updateDoc(userPrefsRef, {
          likedVideos: arrayUnion(currentVideo.id)
        });
      }

      // Update local state
      setLikedVideos(updatedLikedVideos);
      setVideos(prevVideos => 
        prevVideos.map(video => 
          video.id === currentVideo.id 
            ? { ...video, likes: isCurrentlyLiked ? (video.likes || 1) - 1 : (video.likes || 0) + 1 }
            : video
        )
      );

      // Record the interaction
      await recordInteraction({
        userId: user.uid,
        videoId: currentVideo.id,
        watchDuration: 0,
        watchPercentage: 0,
        interactionType: isCurrentlyLiked ? 'view' : 'like',
        timestamp: new Date(),
        genre: currentVideo.genre,
        mood: currentVideo.mood
      });

      // Trigger animation
      animateLike();
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
    if (currentVideoIndex < videos.length - 1) {
      if (shouldLoadMore() && !isLoadingMore) {
        loadVideos(10, true);
      }
      animateVideoTransition('up');
    }
  }, [currentVideoIndex, videos.length, isLoadingMore]);

  const handleSwipeDown = useCallback(() => {
    if (currentVideoIndex > 0) {
      animateVideoTransition('down');
    }
  }, [currentVideoIndex]);

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
              nextUri={nextVideo?.url}
              isFocused={true}
              onError={handleVideoError}
              onLoad={() => {}}
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