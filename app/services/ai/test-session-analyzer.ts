import 'dotenv/config';  // Add this at the very top to load env variables first
import { Timestamp } from 'firebase/firestore';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../../config/firebase';
import { analyzeSessionInsights, SessionDataService } from './sessionInsightAnalyzer';
import { narrateSessionInsights } from './sessionNarrator';
import { InteractionEvent, CommentMetadata } from '../../types/sessionAnalytics';
import { VideoMetadata } from '../videoMetadata';

// Verify Firebase config is loaded
console.log('Checking Firebase configuration:', {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ? '✓ Present' : '✗ Missing',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ? '✓ Present' : '✗ Missing'
});

// Mock data service for testing
class MockSessionDataService implements SessionDataService {
  async getSessionInteractions(userId: string, sessionId: string): Promise<InteractionEvent[]> {
    const now = new Date();
    return [
      {
        userId,
        videoId: 'video1',
        watchDuration: 120,
        watchPercentage: 0.8,
        interactionType: 'view',
        timestamp: Timestamp.fromDate(new Date(now.getTime() - 1000 * 60 * 30)), // 30 mins ago
        genre: 'pop',
        mood: 'happy',
        videoAudioFeatures: {
          tempo: 120,
          key: 'C',
          energy: 0.8,
          danceability: 0.7
        }
      },
      {
        userId,
        videoId: 'video2',
        watchDuration: 180,
        watchPercentage: 0.9,
        interactionType: 'like',
        timestamp: Timestamp.fromDate(new Date(now.getTime() - 1000 * 60 * 20)), // 20 mins ago
        genre: 'rock',
        mood: 'energetic',
        videoAudioFeatures: {
          tempo: 140,
          key: 'A',
          energy: 0.9,
          danceability: 0.6
        }
      }
    ];
  }

  async getSessionComments(
    userId: string,
    startTime: Timestamp,
    endTime: Timestamp
  ): Promise<CommentMetadata[]> {
    return [
      {
        id: 'comment1',
        userId,
        username: 'testuser',
        videoId: 'video1',
        text: 'This song makes me so happy!',
        timestamp: Timestamp.fromDate(new Date(startTime.toMillis() + 1000 * 60 * 5)),
        commentLikes: 2
      },
      {
        id: 'comment2',
        userId,
        username: 'testuser',
        videoId: 'video2',
        text: 'Amazing energy in this track!',
        timestamp: Timestamp.fromDate(new Date(startTime.toMillis() + 1000 * 60 * 25)),
        commentLikes: 5
      }
    ];
  }

  async getVideoMetadata(videoIds: string[]): Promise<Map<string, VideoMetadata>> {
    const videos = [
      {
        id: 'video1',
        title: 'Happy Pop Song',
        artist: 'Test Artist 1',
        genre: 'pop',
        mood: 'happy',
        duration: 180,
        videoAudioFeatures: {
          tempo: 120,
          key: 'C',
          energy: 0.8,
          danceability: 0.7
        },
        storageId: 'storage-1',
        tags: ['pop', 'happy', 'upbeat'],
        likes: 100,
        comments: 50,
        shares: 25,
        views: 1000,
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        description: 'A happy pop song for testing',
        uploadDate: Timestamp.now(),
        uploaderId: 'uploader-1',
        averageWatchDuration: 150,
        completionRate: 0.85,
        watchTimeDistribution: [0.1, 0.1, 0.2, 0.6], // [0-25%, 25-50%, 50-75%, 75-100%]
        language: 'en',
        region: 'US'
      },
      {
        id: 'video2',
        title: 'Rock Anthem',
        artist: 'Test Artist 2',
        genre: 'rock',
        mood: 'energetic',
        duration: 240,
        videoAudioFeatures: {
          tempo: 140,
          key: 'A',
          energy: 0.9,
          danceability: 0.6
        },
        storageId: 'storage-2',
        tags: ['rock', 'energetic', 'anthem'],
        likes: 150,
        comments: 75,
        shares: 30,
        views: 1500,
        thumbnailUrl: 'https://example.com/thumb2.jpg',
        description: 'An energetic rock anthem for testing',
        uploadDate: Timestamp.now(),
        uploaderId: 'uploader-2',
        averageWatchDuration: 200,
        completionRate: 0.9,
        watchTimeDistribution: [0.05, 0.1, 0.15, 0.7], // [0-25%, 25-50%, 50-75%, 75-100%]
        language: 'en',
        region: 'US'
      }
    ];
    return new Map(videos.map(v => [v.id, v]));
  }
}

async function testSessionAnalyzer() {
  try {
    const userId = 'test-user-123';
    const sessionId = 'test-session-123';
    const mockDataService = new MockSessionDataService();

    console.log('Starting test with mock data service...');
    console.log('Analyzing session:', { userId, sessionId });

    // Run the analysis with mock data
    const insights = await analyzeSessionInsights(userId, sessionId, mockDataService);

    // Generate natural language narration
    console.log('\n=== Session Narration ===');
    const narration = await narrateSessionInsights(insights, {
      maxSentences: 3,
      style: 'casual',
      focusAreas: ['mood', 'genre', 'patterns']
    });
    console.log(narration);

    // Print detailed analysis results
    console.log('\n=== Detailed Analysis Results ===\n');
    console.log('Session Overview:');
    console.log('- User ID:', insights.userId);
    console.log('- Session ID:', insights.sessionId);
    console.log('- Duration:', formatDuration(insights.endTime.toMillis() - insights.startTime.toMillis()));
    
    console.log('\nMood Progression:');
    insights.insights.moodProgression.forEach(mp => {
      console.log(`- ${mp.mood} (${(mp.confidence * 100).toFixed(0)}% confidence) at ${mp.timestamp.toDate().toLocaleTimeString()}`);
    });

    console.log('\nGenre Patterns:');
    insights.insights.genrePatterns.forEach(gp => {
      console.log(`- ${gp.genre}: ${gp.watchTimePercentage.toFixed(1)}% watch time, ${(gp.engagementScore * 100).toFixed(0)}% engagement`);
    });

    console.log('\nEmotional Journey Phases:');
    insights.insights.emotionalJourney.forEach(ej => {
      console.log(`\n${ej.phase}:`);
      console.log(`Description: ${ej.description}`);
      console.log('Evidence:');
      ej.supportingEvidence.forEach(evidence => console.log(`- ${evidence}`));
    });

    console.log('\nUnexpected Connections:');
    insights.insights.unexpectedConnections.forEach(uc => {
      console.log(`- ${uc.type} (${(uc.correlation * 100).toFixed(0)}% correlation):`);
      console.log(`  ${uc.description}`);
      console.log(`  Significance: ${uc.significance}`);
    });

    console.log('\nAnalytics Summary:');
    const analytics = insights.insights.analyticsData;
    console.log('- Average Engagement:', (analytics.averageEngagement * 100).toFixed(1) + '%');
    console.log('- Top Genres:', Object.entries(analytics.genreDistribution)
      .sort(([,a], [,b]) => b - a)
      .map(([genre, count]) => `${genre} (${count})`)
      .join(', '));
    console.log('- Top Moods:', Object.entries(analytics.moodDistribution)
      .sort(([,a], [,b]) => b - a)
      .map(([mood, count]) => `${mood} (${count})`)
      .join(', '));
    
    if (analytics.audioFeatureAverages.tempo) {
      console.log('\nAverage Audio Features:');
      console.log('- Tempo:', analytics.audioFeatureAverages.tempo.toFixed(1), 'BPM');
      console.log('- Energy:', (analytics.audioFeatureAverages.energy || 0 * 100).toFixed(1) + '%');
      console.log('- Danceability:', (analytics.audioFeatureAverages.danceability || 0 * 100).toFixed(1) + '%');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
}

// Run the test
testSessionAnalyzer().then(() => console.log('\nTest completed')); 