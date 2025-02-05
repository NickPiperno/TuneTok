# TuneTok Metadata Schema Documentation

This document outlines all metadata collected in TuneTok and its intended use for AI/ML features.

## Video Metadata

### Basic Information
| Field | Type | Description | AI Applications |
|-------|------|-------------|-----------------|
| `id` | string | Unique identifier | Primary key for model training |
| `storageId` | string | Firebase Storage reference | Content retrieval |
| `title` | string | Video title | Text analysis, search relevance |
| `artist` | string | Creator name | Creator similarity, recommendations |
| `description` | string? | Detailed description | Content understanding, keyword extraction |
| `tags` | string[] | Associated tags | Content categorization, trend analysis |
| `genre` | string? | Music genre | Content categorization, user preferences |
| `mood` | string? | Emotional category | Mood-based recommendations |

### Audio Features
| Field | Type | Description | AI Applications |
|-------|------|-------------|-----------------|
| `videoAudioFeatures.tempo` | number | Beats per minute | Music style clustering |
| `videoAudioFeatures.key` | string | Musical key (C, C#, etc.) | Music theory analysis |
| `videoAudioFeatures.energy` | number | Energy level (0-1) | Mood correlation |
| `videoAudioFeatures.danceability` | number | Dance score (0-1) | Content categorization |

### Engagement Metrics
| Field | Type | Description | AI Applications |
|-------|------|-------------|-----------------|
| `likes` | number | Like count | Popularity scoring, trend prediction |
| `comments` | number | Comment count | Engagement analysis, virality prediction |
| `shares` | number | Share count | Viral potential assessment |
| `views` | number | View count | Content performance analysis |

### Watch Time Analytics
| Field | Type | Description | AI Applications |
|-------|------|-------------|-----------------|
| `averageWatchDuration` | number | Average seconds watched | Content quality assessment |
| `completionRate` | number | Percentage who finish (0-100) | Content engagement scoring |
| `watchTimeDistribution` | number[] | Watch time breakpoints | Drop-off point analysis |

### Content Features
| Field | Type | Description | AI Applications |
|-------|------|-------------|-----------------|
| `language` | string | Content language | Language-based filtering |
| `region` | string | Content region | Geographic recommendations |
| `targetDemographic` | string[]? | Target audience | Audience matching |
| `relatedVideos` | string[]? | Similar content IDs | Content graph building |

### Timestamps
| Field | Type | Description | AI Applications |
|-------|------|-------------|-----------------|
| `uploadDate` | Date | Upload timestamp | Temporal analysis, content freshness |

## Comments Metadata

### Comment Information
| Field | Type | Description | AI Applications |
|-------|------|-------------|-----------------|
| `id` | string | Unique identifier | Primary key for comment tracking |
| `userId` | string | Commenter's ID | User engagement tracking |
| `username` | string | Commenter's username | User identification |
| `videoId` | string | Associated video ID | Content-comment relationship |
| `text` | string | Comment content | Sentiment analysis, content moderation |
| `timestamp` | Date | Comment creation time | Temporal engagement analysis |
| `commentLikes` | number | Comment like count | Comment popularity scoring |
| `isLiked` | boolean? | Current user's like status | User preference tracking |

## User Interaction Data

### Interaction Events
| Field | Type | Description | AI Applications |
|-------|------|-------------|-----------------|
| `userId` | string | User identifier | User behavior modeling |
| `videoId` | string | Video identifier | Content-user matching |
| `watchDuration` | number | Seconds watched | Engagement analysis |
| `watchPercentage` | number | Completion percentage | Content quality scoring |
| `interactionType` | enum | Type of interaction | User action modeling |
| `timestamp` | Date | Event timestamp | Temporal pattern analysis |

### Session Data
| Field | Type | Description | AI Applications |
|-------|------|-------------|-----------------|
| `sessionId` | string | Session identifier | Session analysis |
| `startTime` | Date | Session start | Usage pattern analysis |
| `endTime` | Date | Session end | Session duration analysis |
| `videosWatched` | object[] | Videos in session | Viewing sequence analysis |
| `timeOfDay` | string | Time period | Temporal preferences |
| `deviceType` | string | Device used | Platform optimization |

## User Preferences

### Content Preferences
| Field | Type | Description | AI Applications |
|-------|------|-------------|-----------------|
| `likedVideos` | string[] | Liked content IDs | Explicit preferences |
| `watchHistory` | string[] | Watched content IDs | Implicit preferences |
| `preferredGenres` | string[] | Favorite genres | Genre affinity |
| `preferredMoods` | string[] | Preferred moods | Mood affinity |
| `preferredArtists` | string[] | Followed creators | Creator affinity |

### Session Analytics
| Field | Type | Description | AI Applications |
|-------|------|-------------|-----------------|
| `totalWatchTime` | number | Total watch seconds | Engagement level |
| `averageSessionDuration` | number | Avg. session length | Usage patterns |
| `preferredTimeOfDay` | string? | Peak usage time | Temporal preferences |
| `preferredDeviceType` | string? | Most used device | Platform preferences |

## AI Applications

### Recommendation Systems
1. **Content-Based Filtering**
   - Using audio features
   - Genre and mood matching
   - Artist similarity

2. **Collaborative Filtering**
   - User interaction patterns
   - Watch time analysis
   - Engagement metrics

3. **Contextual Recommendations**
   - Time-of-day preferences
   - Device-specific content
   - Regional relevance

### Trend Analysis
1. **Content Performance**
   - Engagement metrics tracking
   - Viral potential prediction
   - Content lifecycle analysis

2. **User Behavior**
   - Session pattern analysis
   - Platform usage patterns
   - Interaction sequences

### Content Understanding
1. **Audio Analysis**
   - Music style clustering
   - Tempo and energy patterns
   - Genre classification

## Implementation Notes

### Data Collection
- All timestamps use Firestore Timestamp
- Watch time metrics are updated in real-time
- Interaction events are atomic operations
- Session data is updated on session end

### Privacy Considerations
- User data is anonymized for analysis
- Preferences are user-controlled
- Watch history can be cleared
- Device data is used only for optimization

### Performance Optimization
- Indexes on frequently queried fields
- Batch updates for analytics
- Caching for active session data
- Pagination for large result sets 