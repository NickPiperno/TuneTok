import { Timestamp, FieldValue } from 'firebase/firestore';
import { VideoAudioFeatures } from '../services/videoMetadata';

// Re-export the base types from videoMetadata with our analytics-specific names
export interface CommentMetadata {
  id: string;
  userId: string;
  username: string;
  videoId: string;
  text: string;
  timestamp: Timestamp | FieldValue;
  commentLikes: number;
  isLiked?: boolean;
}

export interface InteractionEvent {
  userId: string;
  videoId: string;
  watchDuration: number;
  watchPercentage: number;
  interactionType: 'view' | 'like' | 'share' | 'comment';
  timestamp: Timestamp;
  genre?: string;
  mood?: string;
  videoAudioFeatures?: VideoAudioFeatures;
}

export interface SessionData {
  userId: string;
  sessionId: string;
  startTime: Timestamp;
  endTime: Timestamp;
  videosWatched: Array<{
    videoId: string;
    watchDuration: number;
    timeOfDay: string;
    deviceType: string;
  }>;
}

export interface ContentPreferences {
  userId: string;
  likedVideos: string[];
  watchHistory: string[];
  preferredGenres: string[];
  preferredMoods: string[];
  preferredArtists: string[];
  preferredLanguage?: string;
  following: string[];
  lastSession?: SessionData;
  totalWatchTime: number;
  averageSessionDuration: number;
  preferredTimeOfDay?: string;
  preferredDeviceType?: string;
}

// Analytics-specific types for enhanced insights
export interface SessionAnalytics extends SessionData {
  analyticsData: {
    genreDistribution: { [genre: string]: number };
    moodDistribution: { [mood: string]: number };
    averageEngagement: number;
    peakEngagementTimes: string[];
    audioFeatureAverages: Partial<VideoAudioFeatures>;
    totalWatchDuration: number;
  };
}

export interface InteractionAnalytics {
  userId: string;
  sessionId: string;
  interactionSummary: {
    totalInteractions: number;
    likeRatio: number;
    shareRatio: number;
    commentRatio: number;
    averageWatchDuration: number;
    completionRate: number;
  };
  contentPreferences: {
    topGenres: string[];
    topMoods: string[];
    topArtists: string[];
    preferredAudioFeatures: Partial<VideoAudioFeatures>;
  };
} 