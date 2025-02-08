import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

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
}) => {
  console.log('🎮 VideoControls: Rendering with props:', {
    visible,
    likes,
    comments,
    shares,
    isLiked,
    isFollowed
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
        <Text style={styles.buttonText}>{isFollowed ? 'Following' : 'Follow'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={onSave}>
        <MaterialCommunityIcons
          name={isSaved ? 'playlist-check' : 'playlist-plus'}
          size={35}
          color={isSaved ? '#45ff75' : 'white'}
        />
        <Text style={styles.buttonText}>Save</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 8,
    bottom: 150,
    alignItems: 'center',
    zIndex: 1,
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