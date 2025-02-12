import { VideoMetadata, VideoAudioFeatures } from '../videoMetadata';
import { 
  CommentMetadata, 
  InteractionEvent, 
  SessionData, 
  SessionAnalytics, 
  InteractionAnalytics 
} from '../../types/sessionAnalytics';
import { Timestamp, FieldValue } from 'firebase/firestore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Only keep interfaces specific to insights
export interface VideoInsight {
  videoId: string;
  mood?: string;
  genre?: string;
  audioFeatures?: {
    tempo: number;
    key: string;
    energy: number;
    danceability: number;
  };
}

export interface SessionInsight {
  userId: string;
  sessionId: string;
  startTime: Timestamp;
  endTime: Timestamp;
  insights: {
    moodProgression: Array<{
      timestamp: Timestamp;
      mood: string;
      confidence: number;
    }>;
    genrePatterns: Array<{
      genre: string;
      engagementScore: number;
      watchDuration: number;
    }>;
    emotionalJourney: Array<{
      phase: string;
      description: string;
      supportingEvidence: string[];
    }>;
    unexpectedConnections: Array<{
      type: string;
      description: string;
      correlation: number;
      significance: string;
    }>;
    analyticsData: SessionAnalytics['analyticsData'];
  };
}

interface SentimentResult {
  sentiment: 'excited' | 'happy' | 'nostalgic' | 'calm' | 'melancholic' | 'angry' | 'neutral';
  score: number;
  confidence: number;
}

// Add SessionWatchData interface back
interface SessionWatchData {
  videoId: string;
  watchDuration: number;
  timeOfDay: string;
  deviceType: string;
}

// Modify SessionDataService interface
export interface SessionDataService {
  getSessionData(userId: string, sessionId: string): Promise<SessionData>;
  getSessionInteractions(userId: string, sessionId: string, startTime: Timestamp, endTime: Timestamp): Promise<InteractionEvent[]>;
  getSessionComments(userId: string, startTime: Timestamp, endTime: Timestamp): Promise<CommentMetadata[]>;
  getVideoMetadata(videoIds: string[]): Promise<Map<string, VideoMetadata>>;
  getSessionWatchData(userId: string, sessionId: string): Promise<SessionWatchData[]>;
}

// Default implementation using Firebase
class FirebaseSessionDataService implements SessionDataService {
  async getSessionData(userId: string, sessionId: string): Promise<SessionData> {
    const sessionsRef = collection(db, 'userSessions');
    const sessionQuery = query(
      sessionsRef,
      where('userId', '==', userId),
      where('sessionId', '==', sessionId)
    );
    const sessionSnapshot = await getDocs(sessionQuery);
    const sessionDoc = sessionSnapshot.docs[0];
    
    if (!sessionDoc) {
      throw new Error(`No session found for sessionId: ${sessionId}`);
    }

    return sessionDoc.data() as SessionData;
  }

  async getSessionInteractions(
    userId: string, 
    sessionId: string,
    startTime: Timestamp,
    endTime: Timestamp
  ): Promise<InteractionEvent[]> {
    const interactionsRef = collection(db, 'interactions');
    const interactionsQuery = query(
      interactionsRef,
      where('userId', '==', userId),
      where('sessionId', '==', sessionId),
      where('timestamp', '>=', startTime),
      where('timestamp', '<=', endTime)
    );
    const interactionsSnapshot = await getDocs(interactionsQuery);
    return interactionsSnapshot.docs.map(doc => doc.data() as InteractionEvent);
  }

  async getSessionComments(
    userId: string, 
    startTime: Timestamp, 
    endTime: Timestamp
  ): Promise<CommentMetadata[]> {
    const commentsRef = collection(db, 'comments');
    const commentsQuery = query(
      commentsRef,
      where('userId', '==', userId),
      where('timestamp', '>=', startTime),
      where('timestamp', '<=', endTime)
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    return commentsSnapshot.docs.map(doc => doc.data() as CommentMetadata);
  }

  async getVideoMetadata(videoIds: string[]): Promise<Map<string, VideoMetadata>> {
    const videosRef = collection(db, 'videoMetadata');
    const videoSnapshots = await Promise.all(
      videoIds.map(id => getDocs(query(videosRef, where('id', '==', id))))
    );
    const videos = videoSnapshots
      .flatMap(snapshot => snapshot.docs)
      .map(doc => doc.data() as VideoMetadata);
    return new Map(videos.map(v => [v.id, v]));
  }

  async getSessionWatchData(userId: string, sessionId: string): Promise<SessionWatchData[]> {
    const sessionsRef = collection(db, 'userSessions');
    const sessionQuery = query(
      sessionsRef,
      where('userId', '==', userId),
      where('sessionId', '==', sessionId)
    );
    const sessionSnapshot = await getDocs(sessionQuery);
    const sessionDoc = sessionSnapshot.docs[0];
    
    if (!sessionDoc) {
      console.error('No session found:', { userId, sessionId });
      return [];
    }

    const sessionData = sessionDoc.data();
    return sessionData.videosWatched || [];
  }
}

// Modify the main analyzer function
export const analyzeSessionInsights = async (
  userId: string,
  sessionId: string,
  dataService: SessionDataService = new FirebaseSessionDataService()
): Promise<SessionInsight> => {
  console.log('🔍 Starting session analysis for:', { userId, sessionId });

  // First get the session data to get proper time boundaries
  const sessionData = await dataService.getSessionData(userId, sessionId);
  const { startTime, endTime } = sessionData;

  console.log('📊 Session boundaries:', { 
    startTime: startTime.toDate(), 
    endTime: endTime.toDate() 
  });

  // Get watch data from userSessions
  const watchData = await dataService.getSessionWatchData(userId, sessionId);
  console.log('👀 Retrieved watch data:', { 
    count: watchData.length,
    totalDuration: watchData.reduce((sum, w) => sum + w.watchDuration, 0),
    videos: watchData.map(w => ({
      videoId: w.videoId,
      duration: w.watchDuration,
      timeOfDay: w.timeOfDay
    }))
  });

  // Get interactions within session boundaries
  const interactions = await dataService.getSessionInteractions(userId, sessionId, startTime, endTime);
  console.log('🤝 Retrieved interactions:', {
    count: interactions.length,
    types: interactions.map(i => i.interactionType)
  });

  // Get comments within session boundaries
  const comments = await dataService.getSessionComments(userId, startTime, endTime);
  console.log('💬 Retrieved comments:', {
    count: comments.length
  });

  const videoIds = [...new Set([
    ...watchData.map(w => w.videoId),
    ...interactions.map(i => i.videoId)
  ])];
  const videoMap = await dataService.getVideoMetadata(videoIds);

  // Use watchData for analytics
  const analyticsData = generateAnalyticsData(interactions, watchData);
  console.log('📈 Generated analytics:', analyticsData);

  const moodProgression = analyzeMoodProgression(interactions, videoMap);
  console.log('😊 Analyzed mood progression:', moodProgression);

  const genrePatterns = analyzeGenrePatterns(interactions, videoMap, watchData);
  console.log('🎵 Analyzed genre patterns:', genrePatterns);

  const emotionalJourney = await analyzeEmotionalJourney(interactions, comments, videoMap);
  console.log('🎭 Analyzed emotional journey:', emotionalJourney);

  const unexpectedConnections = findUnexpectedConnections(
    interactions,
    videoMap,
    moodProgression,
    genrePatterns
  );
  console.log('🔗 Found unexpected connections:', unexpectedConnections);

  const insights = {
    userId,
    sessionId,
    startTime,
    endTime,
    insights: {
      moodProgression,
      genrePatterns,
      emotionalJourney,
      unexpectedConnections,
      analyticsData
    }
  };

  console.log('✨ Final insights generated:', insights);
  return insights;
};

function calculateAverageAudioFeatures(features: VideoAudioFeatures[]): Partial<VideoAudioFeatures> {
  if (features.length === 0) return {};
  
  return {
    tempo: features.reduce((sum, f) => sum + f.tempo, 0) / features.length,
    energy: features.reduce((sum, f) => sum + f.energy, 0) / features.length,
    danceability: features.reduce((sum, f) => sum + f.danceability, 0) / features.length,
    key: features[0].key // Mode would be more accurate but requires more complex calculation
  };
}

function generateAnalyticsData(
  interactions: InteractionEvent[],
  watchData: SessionWatchData[]
): SessionAnalytics['analyticsData'] {
  const genreDistribution: { [genre: string]: number } = {};
  const moodDistribution: { [mood: string]: number } = {};
  let totalEngagement = 0;
  const audioFeatures: VideoAudioFeatures[] = [];
  const engagementTimes: string[] = [];

  interactions.forEach(interaction => {
    if (interaction.genre) {
      genreDistribution[interaction.genre] = (genreDistribution[interaction.genre] || 0) + 1;
    }
    if (interaction.mood) {
      moodDistribution[interaction.mood] = (moodDistribution[interaction.mood] || 0) + 1;
    }
    totalEngagement += calculateEngagementScore(interaction);
    if (interaction.videoAudioFeatures) {
      audioFeatures.push(interaction.videoAudioFeatures);
    }
  });

  // Use watch data for engagement times
  watchData.forEach(watch => {
    if (watch.watchDuration > 30) { // Consider engaged if watched more than 30 seconds
      engagementTimes.push(watch.timeOfDay);
    }
  });

  return {
    genreDistribution,
    moodDistribution,
    averageEngagement: totalEngagement / interactions.length,
    peakEngagementTimes: engagementTimes,
    audioFeatureAverages: calculateAverageAudioFeatures(audioFeatures),
    totalWatchDuration: watchData.reduce((total, w) => total + w.watchDuration, 0)
  };
}

// Helper functions for different types of analysis
function analyzeMoodProgression(
  interactions: InteractionEvent[],
  videoMap: Map<string, VideoMetadata>
) {
  // Implementation will analyze how user's mood preferences change throughout the session
  return interactions
    .filter(i => videoMap.get(i.videoId)?.mood)
    .map(i => ({
      timestamp: i.timestamp,
      mood: videoMap.get(i.videoId)?.mood || 'unknown',
      confidence: calculateMoodConfidence(i, videoMap.get(i.videoId))
    }));
}

function analyzeGenrePatterns(
  interactions: InteractionEvent[],
  videoMap: Map<string, VideoMetadata>,
  watchData: SessionWatchData[]
) {
  const genreStats = new Map<string, { totalTime: number; engagementScore: number; count: number }>();
  
  // Calculate genre statistics using watchData for duration
  watchData.forEach(watch => {
    const video = videoMap.get(watch.videoId);
    if (video?.genre) {
      const stats = genreStats.get(video.genre) || { totalTime: 0, engagementScore: 0, count: 0 };
      stats.totalTime += watch.watchDuration;
      
      // Find matching interaction for engagement score
      const interaction = interactions.find(i => i.videoId === watch.videoId);
      stats.engagementScore += interaction ? calculateEngagementScore(interaction) : 0;
      
      stats.count += 1;
      genreStats.set(video.genre, stats);
    }
  });

  const totalWatchTime = watchData.reduce((total, w) => total + w.watchDuration, 0);

  return Array.from(genreStats.entries()).map(([genre, stats]) => ({
    genre,
    engagementScore: stats.engagementScore / stats.count,
    watchDuration: stats.totalTime
  }));
}

async function analyzeSentiment(text: string, videoFeatures?: VideoAudioFeatures, genre?: string): Promise<SentimentResult> {
  try {
    const messages = [
      {
        role: "system",
        content: `You are an expert in analyzing emotional responses to music.
Your task is to analyze the emotional tone and musical context in user comments.
Consider music-specific emotional states, their intensity, and musical characteristics.

Available sentiment categories:
- excited: high energy positive emotions, enthusiasm, exhilaration (typically high tempo, high energy)
- happy: general positive emotions, joy, satisfaction (typically major key, high danceability)
- nostalgic: sentimental, reminiscent, wistful (varies in musical characteristics)
- calm: peaceful, relaxed, content (typically low tempo, low energy)
- melancholic: sad, longing, emotional depth (typically minor key, lower energy)
- angry: frustrated, disappointed, intense negative emotions (typically high energy, varied tempo)
- neutral: balanced, objective, or unclear emotional state

Musical Context Interpretation:
- Tempo (BPM): <60 very slow, 60-90 slow, 90-120 moderate, >120 fast
- Energy (0-1): Intensity and activity level of the song
- Danceability (0-1): How suitable for dancing
- Key: Major keys often positive/uplifting, minor keys often emotional/melancholic

IMPORTANT: Your response must be valid JSON. Do not include any additional text.`
      },
      {
        role: "user",
        content: `Analyze the sentiment of this comment: "${text}"
${videoFeatures ? `
Consider these audio features:
- Tempo: ${videoFeatures.tempo} BPM
- Energy: ${videoFeatures.energy}
- Danceability: ${videoFeatures.danceability}
- Musical Key: ${videoFeatures.key}` : ''}
${genre ? `- Genre: ${genre}` : ''}

Consider:
- Emotional tone and intensity
- Music-specific context and references
- Artist or genre-specific emotional associations
- Audio features and their emotional impact
- Slang, emojis, and informal music fan language
- Cultural and generational context in music appreciation

Respond with ONLY a JSON object containing:
{
  "sentiment": "excited" | "happy" | "nostalgic" | "calm" | "melancholic" | "angry" | "neutral",
  "score": number between -1 and 1 (intensity),
  "confidence": number between 0 and 1,
  "explanation": "brief explanation of the emotional analysis considering musical features"
}`
      }
    ];

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const analysis = JSON.parse(content);
    return {
      sentiment: analysis.sentiment,
      score: analysis.score,
      confidence: analysis.confidence
    };
  } catch (error) {
    console.error('AI Sentiment analysis failed:', error);
    return basicSentimentAnalysis(text);
  }
}

function basicSentimentAnalysis(text: string): SentimentResult {
  const sentimentWords = {
    excited: ['amazing', 'incredible', 'fire', 'lit', 'insane', 'epic'],
    happy: ['love', 'great', 'awesome', 'good', 'best', 'fantastic'],
    nostalgic: ['remember', 'miss', 'childhood', 'old', 'classic', 'memories'],
    calm: ['peaceful', 'smooth', 'chill', 'relaxing', 'soothing', 'gentle'],
    melancholic: ['sad', 'miss', 'cry', 'emotional', 'heartbreak', 'pain'],
    angry: ['hate', 'terrible', 'worst', 'awful', 'garbage', 'disappointing'],
    neutral: ['okay', 'fine', 'alright', 'normal', 'standard']
  };

  const words = text.toLowerCase().split(/\W+/);
  const counts = Object.entries(sentimentWords).reduce((acc, [sentiment, keywords]) => {
    acc[sentiment] = words.filter(word => keywords.includes(word)).length;
    return acc;
  }, {} as Record<string, number>);

  const totalMatches = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (totalMatches === 0) {
    return { sentiment: 'neutral', score: 0, confidence: 0.5 };
  }

  const [dominantSentiment] = Object.entries(counts)
    .sort(([,a], [,b]) => b - a)[0];
  
  const score = counts[dominantSentiment] / totalMatches;
  const confidence = Math.min(score + 0.3, 1);  // Add base confidence of 0.3

  return {
    sentiment: dominantSentiment as SentimentResult['sentiment'],
    score: score * 2 - 1, // Convert to -1 to 1 range
    confidence
  };
}

async function analyzeEmotionalJourney(
  interactions: InteractionEvent[],
  comments: CommentMetadata[],
  videoMap: Map<string, VideoMetadata>
): Promise<Array<{
  phase: string;
  description: string;
  supportingEvidence: string[];
}>> {
  // Get sentiment analysis for all comments first
  const commentSentiments = await Promise.all(
    comments.map(async comment => {
      const video = videoMap.get(comment.videoId);
      return {
        timestamp: comment.timestamp,
        sentiment: await analyzeSentiment(
          comment.text,
          video?.videoAudioFeatures,
          video?.genre
        )
      };
    })
  );

  try {
    const messages = [
      {
        role: "system",
        content: `You are an expert in analyzing user engagement patterns and emotional journeys in music sessions.
Your task is to identify distinct emotional phases and patterns in the user's session.
IMPORTANT: Your response must be valid JSON. Do not include any additional text.`
      },
      {
        role: "user",
        content: `Analyze this user's session journey with the following data:

Video Moods: ${interactions.map(i => videoMap.get(i.videoId)?.mood).filter(Boolean).join(', ')}
Watch Durations: ${interactions.map(i => i.watchDuration).join(', ')}
Interaction Types: ${interactions.map(i => i.interactionType).join(', ')}
Comment Sentiments: ${commentSentiments.map(c => c.sentiment.sentiment).join(', ')}

Respond with ONLY a JSON array of phases, each containing:
{
  "phase": "name of the phase",
  "description": "detailed description",
  "evidence": ["supporting evidence points"]
}`
      }
    ];

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const analysis = JSON.parse(content);
    
    // Add validation to ensure analysis is an array
    if (!Array.isArray(analysis)) {
      console.warn('OpenAI response is not an array:', analysis);
      throw new Error('Invalid response format');
    }

    return analysis.map((phase: any) => ({
      phase: phase.phase,
      description: phase.description,
      supportingEvidence: phase.evidence
    }));
  } catch (error) {
    console.error('AI Emotional journey analysis failed:', error);
    return basicEmotionalJourneyAnalysis(interactions, commentSentiments, videoMap);
  }
}

function basicEmotionalJourneyAnalysis(
  interactions: InteractionEvent[],
  commentSentiments: Array<{ 
    timestamp: Timestamp | FieldValue; 
    sentiment: SentimentResult 
  }>,
  videoMap: Map<string, VideoMetadata>
): Array<{
  phase: string;
  description: string;
  supportingEvidence: string[];
}> {
  // Sort all events chronologically
  const events = [
    ...interactions.map(i => ({
      timestamp: i.timestamp,
      type: 'interaction' as const,
      mood: videoMap.get(i.videoId)?.mood,
      engagement: calculateEngagementScore(i)
    })),
    ...commentSentiments
      .filter(c => c.timestamp instanceof Timestamp)
      .map(c => ({
        timestamp: c.timestamp as Timestamp,
        type: 'comment' as const,
        sentiment: c.sentiment
      }))
  ].sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());

  const phases: Array<{
    phase: string;
    description: string;
    supportingEvidence: string[];
  }> = [];

  let currentPhase = {
    sentiment: 'neutral' as SentimentResult['sentiment'],
    engagement: 0,
    evidence: [] as string[]
  };

  events.forEach(event => {
    if (event.type === 'interaction' && event.mood) {
      currentPhase.engagement += event.engagement;
      currentPhase.evidence.push(`Engaged with ${event.mood} content`);
    } else if (event.type === 'comment') {
      if (event.sentiment.sentiment !== currentPhase.sentiment && event.sentiment.confidence > 0.7) {
        if (currentPhase.evidence.length > 0) {
          phases.push({
            phase: `${currentPhase.sentiment.charAt(0).toUpperCase() + currentPhase.sentiment.slice(1)} Phase`,
            description: getPhaseDescription(currentPhase),
            supportingEvidence: currentPhase.evidence
          });
        }
        currentPhase = {
          sentiment: event.sentiment.sentiment,
          engagement: 0,
          evidence: [`${event.sentiment.sentiment.charAt(0).toUpperCase() + event.sentiment.sentiment.slice(1)} comment with ${(event.sentiment.confidence * 100).toFixed(0)}% confidence`]
        };
      } else {
        currentPhase.evidence.push(`Consistent ${event.sentiment.sentiment} sentiment in comments`);
      }
    }
  });

  if (currentPhase.evidence.length > 0) {
    phases.push({
      phase: `${currentPhase.sentiment.charAt(0).toUpperCase() + currentPhase.sentiment.slice(1)} Phase`,
      description: getPhaseDescription(currentPhase),
      supportingEvidence: currentPhase.evidence
    });
  }

  return phases;
}

function getPhaseDescription(phase: { sentiment: string; engagement: number; evidence: string[] }): string {
  const engagementLevel = phase.engagement > 0.7 ? 'high' : phase.engagement > 0.3 ? 'moderate' : 'low';
  return `User showed ${engagementLevel} engagement with ${phase.sentiment} sentiment through content and comments`;
}

function findUnexpectedConnections(
  interactions: InteractionEvent[],
  videoMap: Map<string, VideoMetadata>,
  moodProgression: any[],
  genrePatterns: any[]
) {
  // Implementation will discover interesting patterns and correlations
  return [
    {
      type: 'Mood-Genre Correlation',
      description: 'High engagement with upbeat songs during melancholic mood periods',
      correlation: 0.85,
      significance: 'Strong preference for mood contrast'
    }
    // More connections would be discovered and added here
  ];
}

// Utility functions
function calculateMoodConfidence(
  interaction: InteractionEvent,
  video?: VideoMetadata
): number {
  if (!video) return 0;
  // Base confidence on watch duration thresholds
  const durationConfidence = interaction.watchDuration > 60 ? 0.8 :  // Over 1 minute
                           interaction.watchDuration > 30 ? 0.6 :  // Over 30 seconds
                           interaction.watchDuration > 10 ? 0.4 :  // Over 10 seconds
                           0.2;  // Less than 10 seconds
  return durationConfidence;
}

function calculateEngagementScore(interaction: InteractionEvent): number {
  // Calculate engagement based on watch duration and interaction type
  const durationScore = Math.min(interaction.watchDuration / 60, 1) * 0.4; // Cap at 60 seconds, 40% weight
  const interactionScore = 
    (interaction.interactionType === 'like' ? 0.3 : 0) +
    (interaction.interactionType === 'share' ? 0.3 : 0) +
    (interaction.interactionType === 'comment' ? 0.2 : 0);
  
  return durationScore + interactionScore;
}

function getTotalWatchTime(interactions: InteractionEvent[]): number {
  return interactions.reduce((total, i) => total + i.watchDuration, 0);
} 