import { useState } from 'react';
import { 
  collection, 
  query as firestoreQuery, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  DocumentData,
  Query,
  Timestamp,
  CollectionReference 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Video, VideoError } from '../types/video';

// Types
interface SearchFilters {
  genre?: string;
  mood?: string;
  artist?: string;
}

interface SearchSuggestion {
  type: 'artist' | 'genre' | 'mood' | 'recent';
  text: string;
}

interface VideoMetadata extends DocumentData {
  artist?: string;
  genre?: string;
  mood?: string;
  title: string;
  uploadDate: Timestamp;
  url: string;
  tags: string[];
  likes: number;
  comments: number;
  shares: number;
  views: number;
  description?: string;
}

// Simple in-memory cache for search results
const searchCache = new Map<string, { timestamp: number; results: Video[] }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<VideoError | null>(null);

  const cleanCache = () => {
    const now = Date.now();
    for (const [key, value] of searchCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        searchCache.delete(key);
      }
    }
  };

  const search = async (
    query?: string,
    filters?: SearchFilters,
    searchLimit: number = 20
  ): Promise<Video[] | VideoError> => {
    setLoading(true);
    try {
      console.log('🔍 Search initiated with:', { query, filters, searchLimit });
      
      // Generate cache key
      const cacheKey = JSON.stringify({ query, filters, searchLimit });
      
      // Check cache first
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('📦 Returning cached results');
        setLoading(false);
        return cached.results;
      }

      const videosRef = collection(db, 'videoMetadata') as CollectionReference<VideoMetadata>;
      let queries: Query<VideoMetadata>[] = [];
      const videos: Video[] = [];

      if (query) {
        const lowercaseQuery = query.toLowerCase();
        console.log('🔤 Lowercase query:', lowercaseQuery);

        // Search by title - we have index for title + uploadDate
        queries.push(
          firestoreQuery(
            videosRef,
            where('title', '>=', lowercaseQuery),
            where('title', '<=', lowercaseQuery + '\uf8ff'),
            orderBy('title'),
            orderBy('uploadDate', 'desc'),
            orderBy('__name__', 'desc'),
            limit(searchLimit)
          )
        );

        // Search by artist - case insensitive search
        queries.push(
          firestoreQuery(
            videosRef,
            where('artist', '>=', lowercaseQuery),
            where('artist', '<=', lowercaseQuery + '\uf8ff'),
            orderBy('artist'),
            orderBy('uploadDate', 'desc'),
            orderBy('__name__', 'desc'),
            limit(searchLimit)
          )
        );

        // Also try uppercase first letter for proper names
        const properCaseQuery = lowercaseQuery.charAt(0).toUpperCase() + lowercaseQuery.slice(1);
        queries.push(
          firestoreQuery(
            videosRef,
            where('artist', '>=', properCaseQuery),
            where('artist', '<=', properCaseQuery + '\uf8ff'),
            orderBy('artist'),
            orderBy('uploadDate', 'desc'),
            orderBy('__name__', 'desc'),
            limit(searchLimit)
          )
        );

        // Also try fully uppercase for acronyms/stage names
        const uppercaseQuery = lowercaseQuery.toUpperCase();
        queries.push(
          firestoreQuery(
            videosRef,
            where('artist', '>=', uppercaseQuery),
            where('artist', '<=', uppercaseQuery + '\uf8ff'),
            orderBy('artist'),
            orderBy('uploadDate', 'desc'),
            orderBy('__name__', 'desc'),
            limit(searchLimit)
          )
        );

        // Search by tags - match the exact index structure from Firebase Console
        queries.push(
          firestoreQuery(
            videosRef,
            where('tags', 'array-contains', lowercaseQuery),
            orderBy('uploadDate', 'desc'),
            orderBy('__name__', 'desc'),
            limit(searchLimit)
          )
        );
      }

      // Apply filters - we have indexes for genre/mood + uploadDate
      if (filters) {
        if (filters.genre) {
          queries.push(
            firestoreQuery(
              videosRef,
              where('genre', '==', filters.genre.toLowerCase()),
              orderBy('uploadDate', 'desc'),
              orderBy('__name__', 'desc'),
              limit(searchLimit)
            )
          );
        }
        if (filters.mood) {
          queries.push(
            firestoreQuery(
              videosRef,
              where('mood', '==', filters.mood.toLowerCase()),
              orderBy('uploadDate', 'desc'),
              orderBy('__name__', 'desc'),
              limit(searchLimit)
            )
          );
        }
        if (filters.artist) {
          queries.push(
            firestoreQuery(
              videosRef,
              where('artist', '==', filters.artist.toLowerCase()),
              orderBy('artist'),
              orderBy('uploadDate', 'desc'),
              orderBy('__name__', 'desc'),
              limit(searchLimit)
            )
          );
        }
      }

      // If no queries and no tag results, return recent videos
      if (queries.length === 0 && videos.length === 0) {
        queries.push(
          firestoreQuery(
            videosRef, 
            orderBy('uploadDate', 'desc'),
            orderBy('__name__', 'desc'),
            limit(searchLimit)
          )
        );
      }

      // Execute remaining queries in parallel
      console.log('📊 Executing queries:', queries.length);
      const queryResults = await Promise.all(
        queries.map(q => getDocs(q))
      );

      // Merge results and remove duplicates
      const seenIds = new Set<string>(videos.map(v => v.id));

      for (const querySnapshot of queryResults) {
        console.log('📄 Query result size:', querySnapshot.size);
        querySnapshot.forEach(doc => {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            const data = doc.data();
            console.log('📝 Found document:', { id: doc.id, artist: data.artist, title: data.title });
            videos.push({
              id: doc.id,
              url: data.url,
              title: data.title,
              artist: data.artist || '',
              description: data.description,
              tags: data.tags || [],
              genre: data.genre,
              mood: data.mood,
              likes: data.likes || 0,
              comments: data.comments || 0,
              shares: data.shares || 0,
              views: data.views || 0,
              uploadDate: data.uploadDate
            } as Video);
          }
        });
      }

      console.log('🎯 Total results before sorting:', videos.length);
      // Sort by relevance and date
      const sortedVideos = videos
        .sort((a, b) => {
          // If there's a query, prioritize exact matches
          if (query) {
            const aTitle = a.title.toLowerCase();
            const bTitle = b.title.toLowerCase();
            const queryLower = query.toLowerCase();
            
            if (aTitle.startsWith(queryLower) && !bTitle.startsWith(queryLower)) return -1;
            if (!aTitle.startsWith(queryLower) && bTitle.startsWith(queryLower)) return 1;
          }
          
          // Then sort by date, with proper null checks
          const aTime = a.uploadDate?.toMillis?.() ?? 0;
          const bTime = b.uploadDate?.toMillis?.() ?? 0;
          return bTime - aTime;
        })
        .slice(0, searchLimit);

      // Cache the results
      searchCache.set(cacheKey, {
        timestamp: Date.now(),
        results: sortedVideos
      });
      
      // Clean old cache entries
      cleanCache();

      return sortedVideos;
    } catch (error: any) {
      const videoError = {
        code: error.code || 'search/unknown',
        message: error.message || 'Failed to search videos',
      };
      setError(videoError);
      return videoError;
    } finally {
      setLoading(false);
    }
  };

  const suggestions = async (query: string): Promise<SearchSuggestion[] | VideoError> => {
    try {
      const videosRef = collection(db, 'videoMetadata');
      const results: SearchSuggestion[] = [];

      // Get artist suggestions
      const artistQuery = firestoreQuery(
        videosRef,
        where('artist', '>=', query.toLowerCase()),
        where('artist', '<=', query.toLowerCase() + '\uf8ff'),
        orderBy('artist'),
        limit(5)
      );
      
      const artistDocs = await getDocs(artistQuery);
      artistDocs.forEach(doc => {
        const data = doc.data() as VideoMetadata;
        if (data.artist) {
          results.push({
            type: 'artist',
            text: data.artist
          });
        }
      });

      // Get genre suggestions
      const genreQuery = firestoreQuery(
        videosRef,
        where('genre', '>=', query.toLowerCase()),
        where('genre', '<=', query.toLowerCase() + '\uf8ff'),
        orderBy('genre'),
        limit(3)
      );
      
      const genreDocs = await getDocs(genreQuery);
      genreDocs.forEach(doc => {
        const data = doc.data() as VideoMetadata;
        if (data.genre) {
          results.push({
            type: 'genre',
            text: data.genre
          });
        }
      });

      // Get mood suggestions
      const moodQuery = firestoreQuery(
        videosRef,
        where('mood', '>=', query.toLowerCase()),
        where('mood', '<=', query.toLowerCase() + '\uf8ff'),
        orderBy('mood'),
        limit(3)
      );
      
      const moodDocs = await getDocs(moodQuery);
      moodDocs.forEach(doc => {
        const data = doc.data() as VideoMetadata;
        if (data.mood) {
          results.push({
            type: 'mood',
            text: data.mood
          });
        }
      });

      return results;
    } catch (error: any) {
      return {
        code: error.code || 'suggestions/unknown',
        message: error.message || 'Failed to get search suggestions',
      };
    }
  };

  return {
    search,
    suggestions,
    loading,
    error,
  };
}; 