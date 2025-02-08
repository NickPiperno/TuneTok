import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video } from '../../types/video';
import { FollowButton } from './FollowButton';
import { isFollowingCreator } from '../../services/userProfile';
import { useAuth } from '../../contexts/AuthContext';

interface SearchResultItemProps {
  video: Video;
  onPress: (video: Video) => void;
  isTablet?: boolean;
}

export const SearchResultItem: React.FC<SearchResultItemProps> = ({
  video,
  onPress,
  isTablet = false,
}) => {
  const { user } = useAuth();
  const [isFollowed, setIsFollowed] = useState(false);

  // Check if the user is following the creator when the component mounts
  React.useEffect(() => {
    const checkFollowStatus = async () => {
      if (user && video.artist) {
        const result = await isFollowingCreator(user.uid, video.artist);
        if (typeof result === 'boolean') {
          setIsFollowed(result);
        }
      }
    };
    checkFollowStatus();
  }, [user, video.artist]);

  const handlePress = useCallback(() => {
    onPress(video);
  }, [onPress, video]);

  return (
    <TouchableOpacity
      style={[styles.container, isTablet && styles.containerTablet]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Thumbnail */}
      <View style={[styles.thumbnailContainer, isTablet && styles.thumbnailContainerTablet]}>
        <Image
          source={{ uri: video.url }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={styles.durationContainer}>
          <Text style={styles.durationText}>0:30</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, isTablet && styles.titleTablet]} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={[styles.artist, isTablet && styles.artistTablet]} numberOfLines={1}>
          {video.artist}
        </Text>
        
        <View style={styles.metadataContainer}>
          {video.genre && (
            <View style={styles.badge}>
              <MaterialCommunityIcons
                name="music-note"
                size={isTablet ? 14 : 12}
                color="#666"
              />
              <Text style={[styles.badgeText, isTablet && styles.badgeTextTablet]}>
                {video.genre}
              </Text>
            </View>
          )}
          
          {video.mood && (
            <View style={styles.badge}>
              <MaterialCommunityIcons
                name="emoticon-outline"
                size={isTablet ? 14 : 12}
                color="#666"
              />
              <Text style={[styles.badgeText, isTablet && styles.badgeTextTablet]}>
                {video.mood}
              </Text>
            </View>
          )}
        </View>
        {video.artist && (
          <View style={styles.followButtonContainer}>
            <FollowButton
              artist={video.artist}
              isFollowed={isFollowed}
              onFollowChange={setIsFollowed}
              size={isTablet ? 'medium' : 'small'}
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  containerTablet: {
    padding: 16,
    marginBottom: 12,
  },
  thumbnailContainer: {
    width: 120,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailContainerTablet: {
    width: 160,
    height: 160,
    borderRadius: 12,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
  },
  durationContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#121212',
    marginBottom: 4,
  },
  titleTablet: {
    fontSize: 18,
    marginBottom: 6,
  },
  artist: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  artistTablet: {
    fontSize: 16,
    marginBottom: 12,
  },
  metadataContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#666',
  },
  badgeTextTablet: {
    fontSize: 14,
  },
  followButtonContainer: {
    marginTop: 8,
  },
}); 