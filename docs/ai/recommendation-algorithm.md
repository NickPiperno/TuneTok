# TuneTok Recommendation Algorithm Documentation

## Overview
The TuneTok recommendation system is a multi-faceted algorithm designed to provide personalized video recommendations based on user preferences, behavior patterns, content features, and contextual factors. The system employs a weighted scoring approach that combines multiple signals to rank and serve content.

## Algorithm Components

### 1. Scoring System (100%)
The final score for each video is calculated using four main components:
- Basic Preference Matching (30%)
- Content-Based Similarity (30%)
- Engagement and Watch Patterns (20%)
- Temporal and Contextual Factors (20%)

### 2. Data Models

#### VideoMetadata
```typescript
{
  // Basic Info
  id: string
  title: string
  artist: string
  description?: string
  tags: string[]
  genre?: string
  mood?: string
  duration: number  // in seconds

  // Engagement Metrics
  likes: number
  comments: number
  shares: number
  views: number
  
  // Watch Metrics
  averageWatchDuration: number    // in seconds
  completionRate: number          // 0-100
  watchTimeDistribution: number[] // completion percentages
  
  // Audio Features
  videoAudioFeatures: {
    tempo: number        // BPM
    key: string         // Musical key (C, C#, etc.)
    energy: number      // 0-1
    danceability: number // 0-1
  }
  
  // Context
  language: string
  region: string
  targetDemographic?: string[]
  relatedVideos?: string[]

  // Timestamps
  uploadDate: Date
}
```

#### UserPreferences
```typescript
{
  userId: string
  likedVideos: string[]
  watchHistory: string[]
  preferredGenres: string[]
  preferredMoods: string[]
  preferredArtists: string[]
  preferredLanguage?: string
  preferredTimeOfDay?: string
  preferredDeviceType?: string
  
  // Session Data
  totalWatchTime: number
  averageSessionDuration: number
}
```

### 3. Scoring Components

#### A. Basic Preference Matching (30%)
- Genre matching (0-3 points)
- Mood matching (0-2 points)
- Artist matching (0-4 points)
- Normalized to 0-1 range

```typescript
score = (genreScore + moodScore + artistScore) / 9
finalComponent = score * 0.3
```

#### B. Content-Based Similarity (30%)
Weights:
- Genre similarity: 25%
- Mood similarity: 25%
- Audio features: 50%

Audio similarity factors:
- Tempo difference (normalized)
- Key compatibility
- Energy level match
- Danceability match

#### C. Engagement and Watch Patterns (20%)
- Completion rate weight: 40%
- Likes weight: 20%
- Comments weight: 20%
- Shares weight: 20%

#### D. Temporal and Contextual Factors (20%)
- Time of day relevance (0-0.3)
- Content freshness (0-0.3)
  - Higher score for content uploaded within last 24 hours
  - Linear decay based on upload date
- Language/Region match (0-0.2)
- Device optimization (0-0.2)

### 4. Query Optimization

1. **Primary Sort Order**
   - Videos are initially sorted by upload date (descending)
   - This ensures content freshness and discovery of new content

2. **Filtering**
   - Genre preferences
   - Language preferences
   - Mood based on time of day

3. **Personalization**
   - Applied after initial query
   - Reranks content based on user preferences and behavior

### 5. Fallback Strategy

1. If personalization fails:
   - Sort by upload date (descending)
   - Maintain basic genre and language filters

2. If no preferences set:
   - Show trending content
   - Mix of different genres and moods

3. If no user history:
   - Rely on explicit preferences from onboarding
   - Use general popularity metrics

4. If interaction history empty:
   - Rely on explicit preferences

### 6. Performance Considerations

1. **Query Optimization**
   - Fetch more videos than needed (2x pageSize)
   - Apply filters at database level when possible
   - Limit recent interactions to last 50

2. **Caching Opportunities**
   - User preferences
   - Content features
   - Engagement metrics
   - Time-based scores (update hourly)

3. **Batch Processing**
   - Content feature extraction
   - User preference updates
   - Engagement metric calculations

### 7. Future Enhancements

1. **Content Analysis**
   - Deep learning for audio feature extraction
   - Audio fingerprinting
   - Semantic tag analysis
   - Trend detection

2. **User Modeling**
   - Session-based recommendations
   - Long-term interest modeling
   - Cross-device behavior analysis
   - Social graph integration

3. **Performance Optimization**
   - Precomputed recommendations
   - Real-time scoring adjustments
   - A/B testing framework
   - Personalization strength controls

## Usage Examples

### Basic Implementation
```typescript
const recommendations = await fetchVideoMetadata(userId, 10);
```

### With Error Handling
```typescript
const result = await fetchVideoMetadata(userId, 10);
if ('code' in result) {
  // Handle error
  console.error(result.message);
} else {
  // Process recommendations
  displayVideos(result);
}
```

### Recording Interactions
```typescript
await recordInteraction({
  userId,
  videoId,
  watchDuration,
  watchPercentage,
  interactionType: 'view'
});
```

## Monitoring and Maintenance

### Key Metrics to Monitor
1. Average recommendation relevance score
2. User engagement rates
3. Algorithm performance (response time)
4. Cache hit rates
5. Error rates and types

### Regular Maintenance Tasks
1. Update content feature extractors
2. Tune scoring weights
3. Analyze user feedback
4. Optimize database queries
5. Update fallback mechanisms

## Security Considerations

1. **Data Privacy**
   - User preferences are encrypted
   - Watch history is anonymized
   - Content features are public
   - Interaction data is protected

2. **Access Control**
   - User-specific recommendations
   - Rate limiting
   - Authentication required
   - Audit logging

## Conclusion

The TuneTok recommendation algorithm provides a robust foundation for personalized content delivery while maintaining flexibility for future enhancements. Its modular design allows for easy updates and optimization of individual components without affecting the overall system. 