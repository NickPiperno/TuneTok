import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { followCreator, unfollowCreator } from '../../services/userProfile';

interface FollowButtonProps {
  artist: string;
  isFollowed: boolean;
  onFollowChange?: (isFollowed: boolean) => void;
  size?: 'small' | 'medium' | 'large';
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  artist,
  isFollowed,
  onFollowChange,
  size = 'medium',
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [followStatus, setFollowStatus] = useState(isFollowed);
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const backgroundColorAnim = useRef(new Animated.Value(followStatus ? 0 : 1)).current;

  // Animate button press
  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Animate follow state change
  const animateFollowState = (following: boolean) => {
    Animated.timing(backgroundColorAnim, {
      toValue: following ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handlePress = useCallback(async () => {
    console.log('👆 FollowButton: Button pressed', {
      artist,
      currentStatus: followStatus,
      hasUser: !!user
    });

    if (!user) {
      console.log('❌ FollowButton: No user found');
      Alert.alert('Error', 'Please sign in to follow artists');
      return;
    }

    animatePress();
    setIsLoading(true);
    
    try {
      console.log('🔄 FollowButton: Calling service', {
        action: followStatus ? 'unfollow' : 'follow',
        artist,
        userId: user.uid
      });

      const result = followStatus
        ? await unfollowCreator(user.uid, artist)
        : await followCreator(user.uid, artist);

      if (result === true) {
        const newStatus = !followStatus;
        console.log('✅ FollowButton: Status updated', { newStatus });
        setFollowStatus(newStatus);
        onFollowChange?.(newStatus);
        animateFollowState(newStatus);
      } else {
        console.error('❌ FollowButton: Service error', result);
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('❌ FollowButton: Unexpected error', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setIsLoading(false);
    }
  }, [user, artist, followStatus, onFollowChange]);

  const backgroundColor = backgroundColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#F5F5F5', '#FF2B4E']
  });

  const textColor = backgroundColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#666666', '#FFFFFF']
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={isLoading}
        activeOpacity={0.9}
      >
        <Animated.View style={[
          styles.button,
          styles[`button${size.charAt(0).toUpperCase() + size.slice(1)}`],
          { backgroundColor },
          followStatus && styles.buttonFollowing,
        ]}>
          {isLoading ? (
            <ActivityIndicator size="small" color={followStatus ? '#666' : '#FFF'} />
          ) : (
            <Animated.Text style={[
              styles.text,
              styles[`text${size.charAt(0).toUpperCase() + size.slice(1)}`],
              { color: textColor },
            ]}>
              {followStatus ? 'Following' : 'Follow'}
            </Animated.Text>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  buttonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 80,
  },
  buttonMedium: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 100,
  },
  buttonLarge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 120,
  },
  buttonFollowing: {
    borderWidth: 1,
    borderColor: '#DDD',
  },
  text: {
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 12,
  },
  textMedium: {
    fontSize: 14,
  },
  textLarge: {
    fontSize: 16,
  },
}); 