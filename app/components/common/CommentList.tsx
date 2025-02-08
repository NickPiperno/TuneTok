import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface Comment {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  text: string;
  timestamp: Date;
  commentLikes: number;
  isLiked?: boolean;
}

interface CommentListProps {
  comments: Comment[];
  onLikeComment: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onLoadMore?: () => void;
  isLoading?: boolean;
  hasMore?: boolean;
  currentUserId?: string;
}

export const CommentList: React.FC<CommentListProps> = ({
  comments,
  onLikeComment,
  onDeleteComment,
  onLoadMore,
  isLoading = false,
  hasMore = false,
  currentUserId,
}) => {
  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString();
    } else if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const renderComment = ({ item: comment }: { item: Comment }) => (
    <View style={styles.commentContainer}>
      <Image
        source={{ uri: comment.avatarUrl || 'https://via.placeholder.com/40' }}
        style={styles.avatar}
      />
      
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.username}>{comment.username}</Text>
          <View style={styles.headerRight}>
            <Text style={styles.timestamp}>
              {formatTimestamp(comment.timestamp)}
            </Text>
            {currentUserId === comment.userId && onDeleteComment && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  Alert.alert(
                    'Delete Comment',
                    'Are you sure you want to delete this comment?',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel'
                      },
                      {
                        text: 'Delete',
                        onPress: () => onDeleteComment(comment.id),
                        style: 'destructive'
                      }
                    ]
                  );
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <Text style={styles.commentText}>{comment.text}</Text>
        
        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => onLikeComment(comment.id)}
        >
          <Ionicons
            name={comment.isLiked ? "heart" : "heart-outline"}
            size={16}
            color={comment.isLiked ? "#FF2B4E" : "#666"}
          />
          {comment.commentLikes > 0 && (
            <Text style={[
              styles.likeCount,
              comment.isLiked && styles.likeCountHighlight
            ]}>
              {comment.commentLikes}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!isLoading) return null;
    
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#FF2B4E" />
      </View>
    );
  };

  return (
    <FlatList
      data={comments}
      renderItem={renderComment}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContainer}
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  commentContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#121212',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  commentText: {
    fontSize: 14,
    color: '#121212',
    lineHeight: 20,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  likeCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  likeCountHighlight: {
    color: '#FF2B4E',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    marginLeft: 8,
    padding: 4,
  },
}); 