import React, { useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CommentList, Comment } from './CommentList';
import { CommentInput } from './CommentInput';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

export type { Comment };  // Export the Comment type

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;

interface CommentsSheetProps {
  isVisible: boolean;
  onClose: () => void;
  comments: Comment[];
  onSubmitComment: (text: string) => void;
  onLikeComment: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onLoadMore?: () => void;
  isLoading?: boolean;
  hasMore?: boolean;
  commentsCount: number;
  currentUserId?: string;
}

export const CommentsSheet: React.FC<CommentsSheetProps> = ({
  isVisible,
  onClose,
  comments,
  onSubmitComment,
  onLikeComment,
  onDeleteComment,
  onLoadMore,
  isLoading = false,
  hasMore = false,
  commentsCount,
  currentUserId,
}) => {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isVisible) {
      // Show sheet
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          mass: 0.8,
          stiffness: 100,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide sheet
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: SHEET_HEIGHT,
          useNativeDriver: true,
          damping: 20,
          mass: 0.8,
          stiffness: 100,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => onClose());
    }
  }, [isVisible]);

  const handleDragGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.setValue(event.translationY);
        backdropOpacity.setValue(1 - event.translationY / SHEET_HEIGHT);
        headerScale.setValue(1 - event.translationY / SHEET_HEIGHT * 0.1);
      }
    })
    .onEnd((event) => {
      if (event.translationY > SHEET_HEIGHT * 0.3 || event.velocityY > 500) {
        // Close sheet
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: SHEET_HEIGHT,
            useNativeDriver: true,
            damping: 20,
            mass: 0.8,
            stiffness: 100,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => onClose());
      } else {
        // Reset position
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            mass: 0.8,
            stiffness: 100,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(headerScale, {
            toValue: 1,
            useNativeDriver: true,
            damping: 20,
          }),
        ]).start();
      }
    });

  if (!isVisible) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View 
        style={[
          styles.backdrop,
          {
            opacity: backdropOpacity,
            display: isVisible ? 'flex' : 'none',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backdropTouchable}
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>
      
      <GestureDetector gesture={handleDragGesture}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY }],
              display: isVisible ? 'flex' : 'none',
            },
          ]}
        >
          <Animated.View
            style={[
              styles.header,
              {
                transform: [{ scale: headerScale }],
              },
            ]}
          >
            <View style={styles.headerContent}>
              <View style={styles.handle} />
              <Text style={styles.title}>Comments ({commentsCount})</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={styles.content}>
            <CommentList
              comments={comments}
              onLikeComment={onLikeComment}
              onDeleteComment={onDeleteComment}
              onLoadMore={onLoadMore}
              isLoading={isLoading}
              hasMore={hasMore}
              currentUserId={currentUserId}
            />
          </View>

          <CommentInput onSubmit={onSubmitComment} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  container: {
    height: SHEET_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 1001,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 16,
    position: 'relative',
  },
  headerHandle: {
    position: 'absolute',
    top: 8,
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#121212',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 3,
    zIndex: 2,
  },
  content: {
    flex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  handle: {
    position: 'absolute',
    top: 8,
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#121212',
  },
  backdropTouchable: {
    flex: 1,
  },
}); 