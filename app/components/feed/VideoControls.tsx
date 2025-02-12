import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { usePlaylist } from '../../hooks/usePlaylist';

interface VideoControlsProps {
  visible: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onFollow: () => void;
  onSave: () => void;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isFollowed: boolean;
  isSaved: boolean;
  videoId: string;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  visible,
  onLike,
  onComment,
  onShare,
  onFollow,
  onSave,
  likes,
  comments,
  shares,
  isLiked,
  isFollowed,
  isSaved,
  videoId
}) => {
  const { playlists, loadPlaylists } = usePlaylist();
  const [isVideoSaved, setIsVideoSaved] = useState(isSaved);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Load playlists when component mounts and periodically check for updates
  useEffect(() => {
    loadPlaylists();
    
    // Set up an interval to refresh playlists
    const intervalId = setInterval(() => {
      loadPlaylists();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(intervalId);
  }, [loadPlaylists]);

  // Update isVideoSaved whenever a save action occurs or playlists change
  const handleSavePress = useCallback(async () => {
    onSave();
    setShowSaveModal(true);
  }, [onSave]);

  // Add this handler for when save is complete
  const handleSaveComplete = useCallback(async () => {
    await loadPlaylists();
  }, [loadPlaylists]);

  // Update isVideoSaved whenever playlists change
  useEffect(() => {
    const videoExistsInPlaylists = playlists.some(playlist => 
      playlist.videos.includes(videoId)
    );
    console.log('💾 VideoControls: Checking save status:', {
      videoId,
      playlists: playlists.map(p => ({ id: p.id, videos: p.videos })),
      isVideoSaved: videoExistsInPlaylists
    });
    setIsVideoSaved(videoExistsInPlaylists);
  }, [playlists, videoId]);

  // Add debug log for render
  console.log('🎮 VideoControls: Rendering with state:', {
    videoId,
    playlists: playlists.length,
    isVideoSaved,
    isSaved
  });
  
  const [scaleAnim] = useState(new Animated.Value(1));
  
  const handleLikePress = () => {
    console.log('👆 VideoControls: Like button pressed');
    console.log('💡 VideoControls: Current like status:', { isLiked, likes });
    
    // Trigger like animation
    console.log('🎭 VideoControls: Starting like animation');
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      console.log('✅ VideoControls: Like animation completed');
      console.log('🔄 VideoControls: New like status will be:', { willBeLiked: !isLiked });
    });
    
    console.log('📤 VideoControls: Calling onLike callback');
    onLike();
  };

  if (!visible) return null;

  return (
    <>
      <Animated.View style={[styles.container, { opacity: visible ? 1 : 0 }]}>
        <TouchableOpacity style={styles.button} onPress={onLike}>
          <MaterialCommunityIcons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={35}
            color={isLiked ? '#ff4545' : 'white'}
          />
          <Text style={styles.buttonText}>{likes}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={onComment}>
          <MaterialCommunityIcons name="comment-outline" size={35} color="white" />
          <Text style={styles.buttonText}>{comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={onShare}>
          <MaterialCommunityIcons name="share" size={35} color="white" />
          <Text style={styles.buttonText}>{shares}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={onFollow}>
          <MaterialCommunityIcons
            name={isFollowed ? 'account-check' : 'account-plus'}
            size={35}
            color={isFollowed ? '#45ff75' : 'white'}
          />
          <Text style={styles.buttonText}>Follow</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleSavePress}>
          <MaterialCommunityIcons
            name={isVideoSaved ? 'playlist-check' : 'playlist-plus'}
            size={35}
            color={isVideoSaved ? '#45ff75' : 'white'}
          />
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 8,
    bottom: 150,
    alignItems: 'center',
    zIndex: 999,
    elevation: 999,
  },
  button: {
    alignItems: 'center',
    marginVertical: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
}); 