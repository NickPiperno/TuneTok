import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VideoControlsProps {
  visible: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onFollow: () => void;
  likes: number;
  comments: number;
  shares: number;
  isLiked?: boolean;
  isFollowed?: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  visible,
  onLike,
  onComment,
  onShare,
  onFollow,
  likes,
  comments,
  shares,
  isLiked = false,
  isFollowed = false,
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
    <>
      <TouchableOpacity 
        style={[styles.controlButton, { bottom: 240 }]}
        onPress={onFollow}
        activeOpacity={0.5}
      >
        <Animated.View>
          <Ionicons 
            name={isFollowed ? "person-circle" : "person-circle-outline"} 
            size={32} 
            color={isFollowed ? "#FF2B4E" : "#FFFFFF"} 
          />
        </Animated.View>
        <Text style={[styles.controlText, isFollowed && styles.controlTextHighlight]}>
          Follow
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.controlButton, { bottom: 160 }]}
        onPress={handleLikePress}
        activeOpacity={0.5}
      >
        <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
          <Ionicons 
            name={isLiked ? "heart" : "heart-outline"} 
            size={32} 
            color={isLiked ? "#FF2B4E" : "#FFFFFF"} 
          />
        </Animated.View>
        <Text style={[styles.controlText, isLiked && styles.controlTextHighlight]}>
          {likes}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.controlButton, { bottom: 80 }]}
        onPress={onComment}
        activeOpacity={0.5}
      >
        <Ionicons name="chatbubble-outline" size={32} color="#FFFFFF" />
        <Text style={styles.controlText}>{comments}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.controlButton, { bottom: 0 }]}
        onPress={onShare}
        activeOpacity={0.5}
      >
        <Ionicons name="arrow-redo-outline" size={32} color="#FFFFFF" />
        <Text style={styles.controlText}>{shares}</Text>
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  controlButton: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    minWidth: 50,
    minHeight: 50,
    zIndex: 10,
  },
  controlText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 4,
    zIndex: 10,
  },
  controlTextHighlight: {
    color: "#FF2B4E",
  },
}); 