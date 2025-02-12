import { SessionInsight } from './sessionInsightAnalyzer';
import { Timestamp } from 'firebase/firestore';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface NarrationOptions {
  maxSentences?: number;
  style?: 'casual' | 'formal';
  focusAreas?: ('mood' | 'genre' | 'engagement' | 'patterns')[];
}

const MOOD_EMOJIS = {
  excited: '🎉',
  happy: '😊',
  nostalgic: '🌟',
  calm: '😌',
  melancholic: '🥺',
  angry: '😤',
  neutral: '🎵'
};

export async function narrateSessionInsights(
  sessionInsight: SessionInsight,
  options: NarrationOptions = {}
): Promise<string> {
  console.log('📝 Starting narration generation for session:', {
    userId: sessionInsight.userId,
    sessionId: sessionInsight.sessionId
  });

  const {
    maxSentences = 3,
    style = 'casual',
    focusAreas = ['mood', 'genre', 'patterns']
  } = options;

  // Format session data for the prompt
  const sessionDuration = formatDuration(
    sessionInsight.endTime.toMillis() - sessionInsight.startTime.toMillis()
  );

  const dominantMood = findDominantMood(sessionInsight);
  const emoji = MOOD_EMOJIS[dominantMood] || '🎵';

  console.log('🎯 Narration parameters:', {
    sessionDuration,
    dominantMood,
    emoji,
    maxSentences,
    style,
    focusAreas
  });

  try {
    const messages = [
      {
        role: "system",
        content: `You are a friendly AI music insight narrator for TikTok users.
Your task is to convert music session analytics into engaging, casual narratives.

Style Guide:
- Write in second person ("you" instead of "the user")
- Keep it conversational and TikTok-friendly
- Focus on interesting patterns and actionable insights
- Be concise but informative
- Sound enthusiastic but natural
- Use casual language but avoid being too informal

Response Format:
- Start with the mood emoji
- Maximum ${maxSentences} sentences
- Highlight 2-3 most interesting insights
- Focus on: ${focusAreas.join(', ')}
- Style: ${style}`
      },
      {
        role: "user",
        content: `Convert this session data into a friendly, engaging paragraph:

Session Duration: ${sessionDuration}
Dominant Mood: ${dominantMood}

Mood Progression: ${formatMoodProgression(sessionInsight)}
Genre Patterns: ${formatGenrePatterns(sessionInsight)}
Emotional Journey: ${formatEmotionalJourney(sessionInsight)}
Unexpected Connections: ${formatUnexpectedConnections(sessionInsight)}
Analytics: ${formatAnalytics(sessionInsight)}

Rules:
- Start with the ${emoji} emoji
- Keep it under ${maxSentences} sentences
- Make it sound conversational and TikTok-friendly
- Focus on the most interesting insights`
      }
    ];

    console.log('🤖 Sending request to OpenAI...');

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages,
        temperature: 0.7,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const narration = data.choices[0]?.message?.content;

    if (!narration) {
      throw new Error('No content in OpenAI response');
    }

    console.log('✨ Generated narration:', narration.trim());
    return narration.trim();
  } catch (error) {
    console.error('❌ Session narration failed:', error);
    const fallbackNarration = generateFallbackNarration(sessionInsight, emoji);
    console.log('⚠️ Using fallback narration:', fallbackNarration);
    return fallbackNarration;
  }
}

// Helper functions
function findDominantMood(insight: SessionInsight): keyof typeof MOOD_EMOJIS {
  const moodCounts = insight.insights.analyticsData.moodDistribution;
  const dominantMood = Object.entries(moodCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] as keyof typeof MOOD_EMOJIS;
  return dominantMood || 'neutral';
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / (1000 * 60));
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

function formatMoodProgression(insight: SessionInsight): string {
  return insight.insights.moodProgression
    .map(mp => `${mp.mood} (${(mp.confidence * 100).toFixed(0)}% confidence)`)
    .join(' → ');
}

function formatGenrePatterns(insight: SessionInsight): string {
  const totalDuration = insight.insights.genrePatterns.reduce((sum, gp) => sum + gp.watchDuration, 0);
  return insight.insights.genrePatterns
    .map(gp => {
      const percentage = totalDuration > 0 ? (gp.watchDuration / totalDuration * 100) : 0;
      return `${gp.genre}: ${percentage.toFixed(1)}% watch time, ${(gp.engagementScore * 100).toFixed(0)}% engagement`;
    })
    .join('; ');
}

function formatEmotionalJourney(insight: SessionInsight): string {
  return insight.insights.emotionalJourney
    .map(ej => ej.phase)
    .join(' → ');
}

function formatUnexpectedConnections(insight: SessionInsight): string {
  return insight.insights.unexpectedConnections
    .map(uc => `${uc.type} (${(uc.correlation * 100).toFixed(0)}% correlation): ${uc.description}`)
    .join('; ');
}

function formatAnalytics(insight: SessionInsight): string {
  const analytics = insight.insights.analyticsData;
  return `Average Engagement: ${(analytics.averageEngagement * 100).toFixed(1)}%, ` +
    `Top Genres: ${Object.entries(analytics.genreDistribution)
      .sort(([,a], [,b]) => b - a)
      .map(([genre, count]) => `${genre} (${count})`)
      .join(', ')}`;
}

function generateFallbackNarration(insight: SessionInsight, emoji: string): string {
  const duration = formatDuration(insight.endTime.toMillis() - insight.startTime.toMillis());
  const topGenre = Object.entries(insight.insights.analyticsData.genreDistribution)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'music';
  const engagement = (insight.insights.analyticsData.averageEngagement * 100).toFixed(0);

  return `${emoji} In your ${duration} session, you vibed with some ${topGenre} tracks with ${engagement}% engagement. Keep the music flowing!`;
} 