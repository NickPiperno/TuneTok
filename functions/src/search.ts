import { onCall, HttpsError, CallableRequest, FunctionsErrorCode } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Query, CollectionReference, QueryDocumentSnapshot, DocumentData, Timestamp } from "@google-cloud/firestore";

interface SearchQuery {
  query?: string;
  filters?: {
    genre?: string;
    mood?: string;
    artist?: string;
    searchInTags?: boolean;
  };
  limit?: number;
}

interface SearchSuggestion {
  type: "artist" | "genre" | "mood" | "recent";
  text: string;
}

interface Video {
  id: string;
  title: string;
  artist: string;
  uploadDate: Timestamp;
  tags?: string[];
  genre?: string;
  mood?: string;
}

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ITEMS = 1000;
const BATCH_SIZE = 20;

// Simple in-memory cache
const searchCache = new Map<string, { timestamp: number; results: Video[] }>();

// Clean up old cache entries
const cleanCache = () => {
  const now = Date.now();
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      searchCache.delete(key);
    }
  }
  // If still too many items, remove oldest
  if (searchCache.size > MAX_CACHE_ITEMS) {
    const oldest = [...searchCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, searchCache.size - MAX_CACHE_ITEMS);
    oldest.forEach(([key]) => searchCache.delete(key));
  }
};

// Enhanced error type guard
interface DetailedError extends Error {
  code?: string;
  details?: string;
  status?: number;
  message: string;
}

function isDetailedError(error: unknown): error is DetailedError {
  return error instanceof Error && (
    "code" in error ||
    "details" in error ||
    "status" in error
  );
}

// Type guard for Firestore Timestamp
function isValidTimestamp(value: unknown): value is Timestamp {
  if (!value || typeof value !== "object") return false;
  
  const timestamp = value as Record<string, unknown>;
  return "seconds" in timestamp && 
         "nanoseconds" in timestamp &&
         typeof timestamp.seconds === "number" &&
         typeof timestamp.nanoseconds === "number";
}

// Map error codes to HttpsError codes
function mapErrorCodeToHttps(error: DetailedError): FunctionsErrorCode {
  if (error.code?.includes("permission-denied") || error.code?.includes("unauthorized")) {
    return "permission-denied";
  }
  if (error.code?.includes("not-found")) {
    return "not-found";
  }
  if (error.code?.includes("invalid-argument")) {
    return "invalid-argument";
  }
  if (error.code?.includes("failed-precondition")) {
    return "failed-precondition";
  }
  if (error.code?.includes("unavailable")) {
    return "unavailable";
  }
  return "internal";
}

// Common function configuration
const functionConfig = {
  cors: ["*"],
  region: "us-central1",
  maxInstances: 10,
  minInstances: 0,
  timeoutSeconds: 60,
  enforceAppCheck: false // Set to true in production
};

// Verify auth token helper
async function verifyAuth(auth: CallableRequest["auth"]): Promise<admin.auth.DecodedIdToken> {
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated to use this service"
    );
  }

  try {
    // Get the JWT token string
    const tokenString = typeof auth.token === "string" ? auth.token : auth.token.toString();
    const decodedToken = await admin.auth().verifyIdToken(tokenString);
    
    if (!decodedToken.uid) {
      throw new HttpsError(
        "permission-denied",
        "Invalid authentication token"
      );
    }
    return decodedToken;
  } catch (error) {
    console.error("Auth verification error:", {
      code: isDetailedError(error) ? error.code : undefined,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new HttpsError(
      "unauthenticated",
      "Failed to verify authentication token"
    );
  }
}

// Search videos based on query and filters with optimization
export const search = onCall(
  functionConfig,
  async (request) => {
    console.log("🚀 Search function starting execution");
    
    try {
      // Verify authentication first
      const decodedToken = await verifyAuth(request.auth);
      
      console.log("🔐 Authentication verified:", {
        uid: decodedToken.uid,
        email: decodedToken.email,
        timestamp: new Date().toISOString()
      });

      console.log("📥 Search request received:", {
        hasAuth: !!request.auth,
        rawData: request.data,
        instanceId: process.env.FUNCTION_TARGET,
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });

      console.log("🔐 Admin SDK check:", {
        isInitialized: admin.apps.length > 0,
        defaultApp: admin.app().name,
        projectId: admin.app().options.projectId
      });

      const { query, filters = {}, limit = 20 } = request.data as SearchQuery;
      const cacheKey = JSON.stringify({ query, filters, limit });

      console.log("📋 Search parameters:", {
        query,
        filters,
        limit,
        cacheKey
      });

      // Check cache first
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log("🗄️ Cache hit for search:", { query, filters });
        return { videos: cached.results };
      }

      if (!query && Object.keys(filters).length === 0) {
        console.warn("⚠️ No search criteria provided");
        throw new HttpsError(
          "invalid-argument",
          "Search query or filters are required"
        );
      }

      const db = admin.firestore();
      console.log("🔌 Database connection:", {
        projectId: admin.app().options.projectId,
        databaseURL: admin.app().options.databaseURL,
        databaseInstance: db instanceof admin.firestore.Firestore ? "Valid Firestore instance" : "Invalid instance",
        timestamp: new Date().toISOString()
      });

      let videosRef: CollectionReference | Query = db.collection("videoMetadata");
      
      // Build optimized query
      const queryConstraints: Array<Query<DocumentData>> = [];
      
      if (query) {
        const lowercaseQuery = query.toLowerCase();
        console.log("🔍 Building query constraints for:", lowercaseQuery);
        
        try {
          // Use array-contains for tags as it's more efficient
          if (filters.searchInTags !== false) {
            const tagsQuery = videosRef
              .where("tags", "array-contains", lowercaseQuery)
              .orderBy("uploadDate", "desc");
            queryConstraints.push(tagsQuery);
            
            console.log("📑 Added tags query constraint");
          }

          // Use composite index for title + uploadDate
          const titleQuery = videosRef
            .where("title", ">=", lowercaseQuery)
            .where("title", "<=", lowercaseQuery + "\uf8ff")
            .orderBy("title")
            .orderBy("uploadDate", "desc");
          queryConstraints.push(titleQuery);
          
          console.log("📑 Added title query constraint");

          // Use composite index for artist + uploadDate
          const artistQuery = videosRef
            .where("artist", ">=", lowercaseQuery)
            .where("artist", "<=", lowercaseQuery + "\uf8ff")
            .orderBy("artist")
            .orderBy("uploadDate", "desc");
          queryConstraints.push(artistQuery);
          
          console.log("📑 Added artist query constraint");

          // Apply additional filters
          let baseFilteredQuery = videosRef;
          const appliedFilters: string[] = [];

          if (filters.genre) {
            baseFilteredQuery = baseFilteredQuery.where("genre", "==", filters.genre);
            appliedFilters.push("genre");
          }
          if (filters.mood) {
            baseFilteredQuery = baseFilteredQuery.where("mood", "==", filters.mood);
            appliedFilters.push("mood");
          }
          if (filters.artist) {
            baseFilteredQuery = baseFilteredQuery.where("artist", "==", filters.artist);
            appliedFilters.push("artist");
          }

          // Always order by uploadDate for consistency
          baseFilteredQuery = baseFilteredQuery.orderBy("uploadDate", "desc");

          if (appliedFilters.length > 0) {
            queryConstraints.push(baseFilteredQuery);
            console.log("📑 Added filtered query with:", appliedFilters);
          }

          console.log("📊 Query constraints built:", {
            constraintsCount: queryConstraints.length,
            hasTagsFilter: filters.searchInTags !== false,
            appliedFilters
          });
        } catch (error) {
          console.error("❌ Error building query constraints:", {
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack
            } : String(error),
            query: lowercaseQuery,
            filters
          });
          throw new HttpsError(
            "internal",
            "Error building search query"
          );
        }
      } else {
        // If no query, just apply filters with uploadDate ordering
        try {
          let baseQuery = videosRef;
          const appliedFilters: string[] = [];

          if (filters.genre) {
            baseQuery = baseQuery.where("genre", "==", filters.genre);
            appliedFilters.push("genre");
          }
          if (filters.mood) {
            baseQuery = baseQuery.where("mood", "==", filters.mood);
            appliedFilters.push("mood");
          }
          if (filters.artist) {
            baseQuery = baseQuery.where("artist", "==", filters.artist);
            appliedFilters.push("artist");
          }

          // Always order by uploadDate for consistency
          baseQuery = baseQuery.orderBy("uploadDate", "desc");
          queryConstraints.push(baseQuery);

          console.log("📊 Built filter-only query:", {
            appliedFilters,
            hasFilters: appliedFilters.length > 0
          });
        } catch (error) {
          console.error("❌ Error building filter-only query:", {
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack
            } : String(error),
            filters
          });
          throw new HttpsError(
            "internal",
            "Error building filtered query"
          );
        }
      }

      // Execute queries in parallel with batching
      const results = new Map();
      
      try {
        await Promise.all(
          queryConstraints.map(async (queryRef, index) => {
            console.log(`⚡ Executing query ${index + 1}/${queryConstraints.length}`);
            const snapshot = await queryRef.limit(BATCH_SIZE).get();
            console.log(`✅ Query ${index + 1} completed:`, {
              docsFound: snapshot.docs.length
            });
            
            snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
              if (!results.has(doc.id)) {
                const data = doc.data();
                
                // Validate uploadDate before adding to results
                if (!isValidTimestamp(data.uploadDate)) {
                  console.error("❌ Invalid uploadDate in document:", {
                    docId: doc.id,
                    uploadDate: data.uploadDate,
                    type: typeof data.uploadDate
                  });
                  return; // Skip this document
                }
                
                results.set(doc.id, { 
                  id: doc.id, 
                  ...data,
                  // Ensure uploadDate is properly handled
                  uploadDate: data.uploadDate
                });
              }
            });
          })
        );
      } catch (queryError: unknown) {
        const error = queryError as Error;
        console.error("❌ Query execution error:", {
          code: isDetailedError(error) ? error.code : undefined,
          message: error.message,
          stack: error.stack,
          details: isDetailedError(error) ? error.details : undefined
        });
        throw error;
      }

      // Add error handling for sorting
      const sortedResults = Array.from(results.values())
        .filter(doc => {
          if (!isValidTimestamp(doc.uploadDate)) {
            console.error("❌ Invalid uploadDate found during sorting:", {
              docId: doc.id,
              uploadDate: doc.uploadDate
            });
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          try {
            return b.uploadDate.seconds - a.uploadDate.seconds;
          } catch (error) {
            console.error("❌ Sorting error:", {
              docA: { id: a.id, uploadDate: a.uploadDate },
              docB: { id: b.id, uploadDate: b.uploadDate },
              error: error instanceof Error ? error.message : String(error)
            });
            return 0; // Keep original order on error
          }
        })
        .slice(0, limit);

      // Log detailed information about the results
      console.log("📊 Results processing:", {
        totalFound: results.size,
        afterSorting: sortedResults.length,
        firstResult: sortedResults[0] ? {
          id: sortedResults[0].id,
          title: sortedResults[0].title,
          uploadDate: sortedResults[0].uploadDate ? {
            seconds: sortedResults[0].uploadDate.seconds,
            nanoseconds: sortedResults[0].uploadDate.nanoseconds
          } : null
        } : null,
        hasInvalidDates: Array.from(results.values()).some(doc => !isValidTimestamp(doc.uploadDate))
      });

      // Update cache
      searchCache.set(cacheKey, {
        timestamp: Date.now(),
        results: sortedResults
      });
      cleanCache();

      console.log("✅ Search completed successfully:", {
        query,
        filters,
        resultCount: sortedResults.length
      });

      return { videos: sortedResults };
    } catch (error: unknown) {
      console.error("❌ Search function error:", {
        error: isDetailedError(error) ? {
          name: error.name,
          code: error.code,
          message: error.message,
          details: error.details,
          status: error.status,
          stack: error.stack
        } : String(error),
        timestamp: new Date().toISOString(),
        request: {
          auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token ? "[REDACTED]" : undefined
          } : null,
          data: request.data
        }
      });
      
      if (error instanceof HttpsError) {
        throw error; // Re-throw if it's already a proper HttpsError
      }
      
      if (isDetailedError(error)) {
        throw new HttpsError(
          mapErrorCodeToHttps(error),
          error.message || "An error occurred during search",
          {
            originalCode: error.code,
            details: error.details,
            timestamp: new Date().toISOString()
          }
        );
      }
      
      throw new HttpsError(
        "internal",
        "An unexpected error occurred while searching videos",
        {
          originalError: String(error),
          timestamp: new Date().toISOString()
        }
      );
    }
  }
);

// Get search suggestions based on partial input
export const suggestions = onCall(
  functionConfig,
  async (request) => {
    console.log("🚀 Suggestions function starting execution");
    
    try {
      // Verify authentication first
      const decodedToken = await verifyAuth(request.auth);
      
      console.log("🔐 Authentication verified:", {
        uid: decodedToken.uid,
        email: decodedToken.email,
        timestamp: new Date().toISOString()
      });

      console.log("📥 Request received:", {
        hasAuth: !!request.auth,
        rawData: request.data,
        instanceId: process.env.FUNCTION_TARGET,
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });

      if (!request.auth) {
        console.log("❌ Authentication missing");
        throw new HttpsError(
          "unauthenticated",
          "User must be authenticated to get suggestions"
        );
      }

      const { query } = request.data as { query: string };
      
      if (!query) {
        console.log("ℹ️ Empty query, returning empty results");
        return {
          suggestions: [] as SearchSuggestion[]
        };
      }

      console.log("🔐 Admin SDK check:", {
        isInitialized: admin.apps.length > 0,
        defaultApp: admin.app().name,
        projectId: admin.app().options.projectId
      });

      const db = admin.firestore();
      const lowercaseQuery = query.toLowerCase();
      let videosRef: CollectionReference | Query = db.collection("videoMetadata");
      
      // Get suggestions from different collections
      console.log("🔍 Starting collection queries for:", {
        query: lowercaseQuery,
        collection: videosRef instanceof admin.firestore.CollectionReference ? videosRef.path : "videoMetadata"
      });

      try {
        const [artistsSnapshot, genresSnapshot, moodsSnapshot] = await Promise.all([
          videosRef.where("artist", ">=", lowercaseQuery)
            .where("artist", "<=", lowercaseQuery + "\uf8ff")
            .orderBy("artist")
            .limit(3)
            .get()
            .catch(error => {
              console.error("❌ Artist query failed:", {
                error: isDetailedError(error) ? {
                  message: error.message,
                  code: error.code,
                  details: error.details,
                  query: lowercaseQuery
                } : String(error),
                type: error?.constructor?.name || "Unknown"
              });
              throw error;
            }),
          videosRef.where("genre", ">=", lowercaseQuery)
            .where("genre", "<=", lowercaseQuery + "\uf8ff")
            .orderBy("genre")
            .limit(3)
            .get()
            .catch(error => {
              console.error("❌ Genre query failed:", {
                error: isDetailedError(error) ? {
                  message: error.message,
                  code: error.code,
                  details: error.details,
                  query: lowercaseQuery
                } : String(error),
                type: error?.constructor?.name || "Unknown"
              });
              throw error;
            }),
          videosRef.where("mood", ">=", lowercaseQuery)
            .where("mood", "<=", lowercaseQuery + "\uf8ff")
            .orderBy("mood")
            .limit(3)
            .get()
            .catch(error => {
              console.error("❌ Mood query failed:", {
                error: isDetailedError(error) ? {
                  message: error.message,
                  code: error.code,
                  details: error.details,
                  query: lowercaseQuery
                } : String(error),
                type: error?.constructor?.name || "Unknown"
              });
              throw error;
            })
        ]);

        console.log("✅ Collection queries completed:", {
          artistsFound: artistsSnapshot.size,
          genresFound: genresSnapshot.size,
          moodsFound: moodsSnapshot.size
        });

        // Extract unique values with error checking
        const artists = new Set(artistsSnapshot.docs.map(doc => {
          const data = doc.data();
          if (!data.artist) {
            console.warn("⚠️ Document missing artist field:", doc.id);
            return null;
          }
          return data.artist;
        }).filter(Boolean));

        const genres = new Set(genresSnapshot.docs.map(doc => {
          const data = doc.data();
          if (!data.genre) {
            console.warn("⚠️ Document missing genre field:", doc.id);
            return null;
          }
          return data.genre;
        }).filter(Boolean));

        const moods = new Set(moodsSnapshot.docs.map(doc => {
          const data = doc.data();
          if (!data.mood) {
            console.warn("⚠️ Document missing mood field:", doc.id);
            return null;
          }
          return data.mood;
        }).filter(Boolean));

        console.log("📊 Unique values extracted:", {
          artistsCount: artists.size,
          genresCount: genres.size,
          moodsCount: moods.size
        });

        const suggestions: SearchSuggestion[] = [
          ...Array.from(artists).map(name => ({
            type: "artist" as const,
            text: name
          })),
          ...Array.from(genres).map(name => ({
            type: "genre" as const,
            text: name
          })),
          ...Array.from(moods).map(name => ({
            type: "mood" as const,
            text: name
          }))
        ];

        console.log("✅ Suggestions compiled:", {
          total: suggestions.length,
          byType: {
            artists: suggestions.filter(s => s.type === "artist").length,
            genres: suggestions.filter(s => s.type === "genre").length,
            moods: suggestions.filter(s => s.type === "mood").length
          }
        });

        return { suggestions };
      } catch (error: unknown) {
        console.error("❌ Suggestions query error:", {
          name: error instanceof Error ? error.name : "Unknown",
          code: isDetailedError(error) ? error.code : undefined,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          details: isDetailedError(error) ? error.details : undefined,
          type: error?.constructor?.name || "Unknown",
          query: lowercaseQuery
        });
        
        // Check for specific Firestore errors
        if (isDetailedError(error)) {
          if (error.code === "permission-denied") {
            throw new HttpsError("permission-denied", "Insufficient permissions to query the database");
          }
          if (error.code === "not-found") {
            throw new HttpsError("not-found", "The requested collection does not exist");
          }
          if (error.code === "failed-precondition") {
            throw new HttpsError("failed-precondition", "The query requires an index that does not exist");
          }
        }
        
        throw new HttpsError(
          "internal",
          `Failed to fetch suggestions: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } catch (error: unknown) {
      console.error("❌ Suggestions function error:", {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : String(error)
      });
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        "internal",
        "An unexpected error occurred while fetching suggestions"
      );
    }
  }
);

// Track recent searches for a user
export const trackSearch = onCall(
  functionConfig,
  async (request) => {
    console.log("🚀 Track search function starting execution");
    
    try {
      // Verify authentication first
      const decodedToken = await verifyAuth(request.auth);
      
      console.log("🔐 Authentication verified:", {
        uid: decodedToken.uid,
        email: decodedToken.email,
        timestamp: new Date().toISOString()
      });

      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "User must be authenticated to track recent searches"
        );
      }

      const { query } = request.data as { query: string };
      const userId = request.auth.uid;
      const db = admin.firestore();

      console.log("📝 Adding recent search:", {
        query,
        userId,
        timestamp: new Date().toISOString()
      });

      await db.collection("users").doc(userId).collection("recentSearches").add({
        query,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log("✅ Recent search tracked successfully");
      return { success: true };
    } catch (error: unknown) {
      console.error("❌ Track search function error:", {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : String(error)
      });
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        "internal",
        "An unexpected error occurred while tracking search"
      );
    }
  }
); 