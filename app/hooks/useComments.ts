import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Timestamp, FieldValue } from 'firebase/firestore';
import { Comment } from '../components/common/CommentsSheet';
import { fetchComments, submitComment, likeComment, deleteComment } from '../services/videoMetadata';
import { useAuth } from '../contexts/AuthContext';

// Helper function to safely convert timestamp to Date
const convertTimestamp = (timestamp: Timestamp | FieldValue): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  return new Date(); // Return current date for server timestamps that haven't been resolved yet
};

export const useComments = (
  videoId: string,
  onCommentCountChange?: (change: number) => void  // Updated callback to handle both increment and decrement
) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [lastCommentTimestamp, setLastCommentTimestamp] = useState<Timestamp | null>(null);

  const loadComments = async () => {
    if (!videoId) return;

    try {
      setIsLoadingComments(true);
      const result = await fetchComments(videoId);
      
      if ('code' in result) {
        Alert.alert('Error', result.message);
        return;
      }

      const commentsWithDateTimestamp = result.comments.map(comment => ({
        ...comment,
        timestamp: convertTimestamp(comment.timestamp)
      }));

      setComments(commentsWithDateTimestamp);
      setHasMoreComments(result.hasMore);
      if (result.comments.length > 0) {
        // We know this is a Timestamp because it's from Firestore
        setLastCommentTimestamp(result.comments[result.comments.length - 1].timestamp as Timestamp);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleSubmitComment = useCallback(async (text: string) => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to comment on videos.');
      return false;
    }

    if (!videoId) return false;

    try {
      const result = await submitComment(videoId, text);
      
      if ('code' in result) {
        Alert.alert('Error', result.message);
        return false;
      }

      const commentWithDateTimestamp = {
        ...result,
        timestamp: convertTimestamp(result.timestamp)
      };

      setComments(prev => [commentWithDateTimestamp, ...prev]);
      onCommentCountChange?.(1);  // Increment comment count
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to submit comment');
      return false;
    }
  }, [videoId, user, onCommentCountChange]);

  const handleLikeComment = useCallback(async (commentId: string) => {
    try {
      const result = await likeComment(commentId);
      
      if ('code' in result) {
        Alert.alert('Error', result.message);
        return;
      }

      setComments(prev => prev.map(comment => 
        comment.id === commentId
          ? { 
              ...comment, 
              commentLikes: result.commentLikes,
              isLiked: result.isLiked 
            }
          : comment
      ));
    } catch (error) {
      Alert.alert('Error', 'Failed to like comment');
    }
  }, []);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      const result = await deleteComment(commentId, videoId);
      
      if (result && 'code' in result) {
        Alert.alert('Error', result.message);
        return;
      }

      // Remove the comment from the local state
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      
      // Notify parent component that a comment was deleted
      onCommentCountChange?.(-1);  // Decrement comment count
    } catch (error) {
      Alert.alert('Error', 'Failed to delete comment');
    }
  }, [videoId, onCommentCountChange]);

  const loadMoreComments = useCallback(async () => {
    if (!videoId || !hasMoreComments || isLoadingComments || !lastCommentTimestamp) return;

    try {
      setIsLoadingComments(true);
      const result = await fetchComments(videoId, lastCommentTimestamp);
      
      if ('code' in result) {
        Alert.alert('Error', result.message);
        return;
      }

      const commentsWithDateTimestamp = result.comments.map(comment => ({
        ...comment,
        timestamp: convertTimestamp(comment.timestamp)
      }));

      setComments(prev => [...prev, ...commentsWithDateTimestamp]);
      setHasMoreComments(result.hasMore);
      if (result.comments.length > 0) {
        setLastCommentTimestamp(result.comments[result.comments.length - 1].timestamp as Timestamp);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load more comments');
    } finally {
      setIsLoadingComments(false);
    }
  }, [videoId, hasMoreComments, isLoadingComments, lastCommentTimestamp]);

  const handleCloseComments = useCallback(() => {
    setShowComments(false);
    setComments([]);
    setHasMoreComments(false);
    setLastCommentTimestamp(null);
  }, []);

  const handleOpenComments = useCallback(async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to view and post comments.');
      return;
    }

    setShowComments(true);
    await loadComments();
  }, [loadComments, user]);

  return {
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
  };
}; 