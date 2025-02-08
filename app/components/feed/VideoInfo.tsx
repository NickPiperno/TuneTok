import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video } from '../../services/video';

type TagIndicator = {
  type: 'trending' | 'recommended' | 'popular' | 'new';
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  backgroundColor: string;
};

const TAG_INDICATORS: Record<string, TagIndicator> = {
  trending: { 
    type: 'trending', 
    icon: 'trending-up', 
    color: '#FF2B4E',
    backgroundColor: 'rgba(255, 43, 78, 0.15)'
  },
  recommended: { 
    type: 'recommended', 
    icon: 'star', 
    color: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.15)'
  },
  popular: { 
    type: 'popular', 
    icon: 'fire', 
    color: '#FF4500',
    backgroundColor: 'rgba(255, 69, 0, 0.15)'
  },
  new: { 
    type: 'new', 
    icon: 'new-box', 
    color: '#00FF7F',
    backgroundColor: 'rgba(0, 255, 127, 0.15)'
  }
};

interface VideoInfoProps {
  video: Video;
}

export const VideoInfo: React.FC<VideoInfoProps> = ({ video }) => {
  const renderTag = (tag: string, index: number) => {
    const indicator = TAG_INDICATORS[tag.toLowerCase()];
    
    return (
      <TouchableOpacity 
        key={index} 
        style={[
          styles.tagContainer,
          indicator && { backgroundColor: indicator.backgroundColor }
        ]}
        activeOpacity={0.7}
      >
        {indicator && (
          <MaterialCommunityIcons
            name={indicator.icon}
            size={14}
            color={indicator.color}
            style={styles.tagIcon}
          />
        )}
        <Text style={[
          styles.tag,
          indicator && { color: indicator.color }
        ]}>
          #{tag}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.8)']}
      style={styles.container}
    >
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={1}>
          {video.title}
        </Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {video.artist}
        </Text>
        
        {video.description && (
          <Text style={styles.description} numberOfLines={2}>
            {video.description}
          </Text>
        )}
        
        <View style={styles.tagsContainer}>
          {video.tags?.map((tag, index) => renderTag(tag, index))}
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10, // Reduced bottom padding to move content lower
    paddingHorizontal: 16,
    paddingTop: 100, // Keep gradient padding
  },
  videoInfo: {
    marginBottom: 0,
  },
  videoTitle: {
    fontSize: 18, // Slightly reduced font size
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  artistName: {
    fontSize: 14, // Slightly reduced font size
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  description: {
    color: '#CCCCCC',
    fontSize: 13, // Slightly reduced font size
    marginBottom: 6, // Reduced margin
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tagIcon: {
    marginRight: 4,
  },
  tag: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
}); 