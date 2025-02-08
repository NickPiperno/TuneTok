import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Platform,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Dimensions,
  useWindowDimensions,
  ScaledSize,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar } from '../common/SearchBar';
import { SearchResultItem } from '../common/SearchResultItem';
import { SearchSuggestions } from '../common/SearchSuggestions';
import { Video, VideoError } from '../../types/video';
import { useSearch } from '../../hooks/useSearch';

type RootStackParamList = {
  Search: undefined;
  Feed: {
    initialVideo?: Video;
    initialIndex?: number;
  };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Search'>;

interface SearchSuggestion {
  type: 'artist' | 'genre' | 'mood' | 'recent';
  text: string;
}

// Error messages based on error codes
const ERROR_MESSAGES: Record<string, string> = {
  'search/auth-failed': 'Authentication failed. Please try logging in again.',
  'search/unauthenticated': 'Please log in to search videos.',
  'search/unknown': 'An unexpected error occurred. Please try again.',
  'permission-denied': 'You don\'t have permission to perform this search.',
  'not-found': 'The search service is currently unavailable.',
  'invalid-argument': 'Invalid search query. Please try different keywords.',
  'failed-precondition': 'Search service is not properly configured.',
  'unavailable': 'Search service is temporarily unavailable. Please try again later.',
};

export const SearchScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  // Use our new search hook
  const { search, suggestions: getSuggestions, loading: isLoading, error: searchError } = useSearch();

  const handleQueryChange = useCallback(async (text: string) => {
    setQuery(text);
    setRetryCount(0);
    
    if (!text) {
      setIsSearching(false);
      setSearchResults([]);
      setSuggestions([]);
      return;
    }

    try {
      const suggestionsResult = await getSuggestions(text);
      if ('code' in suggestionsResult) {
        console.error('Suggestions error:', suggestionsResult);
        // Don't show error for suggestions, but log it
        console.warn('Failed to get suggestions:', {
          code: suggestionsResult.code,
          message: suggestionsResult.message
        });
      } else {
        setSuggestions(suggestionsResult);
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
      // Don't show error for suggestions failures
    }
  }, [getSuggestions]);

  const handleSearch = async (searchQuery: string, isRetry: boolean = false) => {
    if (!isRetry) {
      setIsSearching(true);
    }
    
    try {
      if (searchQuery) {
        const response = await search(searchQuery);
        if ('code' in response) {
          console.error('Search error:', {
            code: response.code,
            message: response.message
          });

          // Handle retryable errors
          if (retryCount < MAX_RETRIES) {
            setRetryCount(prev => prev + 1);
            // Exponential backoff
            const delay = Math.pow(2, retryCount) * 1000;
            setTimeout(() => handleSearch(searchQuery, true), delay);
            return;
          }

          setSearchResults([]);
        } else {
          setSearchResults(response);
          setRetryCount(0);
        }
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    }
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    handleSearch(suggestion.text);
  };

  const handleVideoPress = (video: Video) => {
    // Navigate to feed with the selected video
    navigation.navigate('Feed', {
      initialVideo: video,
      initialIndex: 0
    });
  };

  // Adjust layout based on screen size
  const getLayoutStyles = useCallback((dimensions: { width: number; height: number }) => {
    const isLandscape = dimensions.width > dimensions.height;
    const isTablet = dimensions.width >= 768;

    return {
      searchContainer: {
        paddingHorizontal: isTablet ? 40 : 20,
        marginBottom: isTablet ? 24 : 16,
      },
      resultsList: {
        paddingHorizontal: isTablet ? 40 : 20,
        paddingTop: 8,
        paddingBottom: isTablet ? 32 : 20,
      },
      suggestionsContainer: {
        position: 'absolute' as const,
        top: 0,
        left: isTablet ? 40 : 20,
        right: isTablet ? 40 : 20,
        maxHeight: isLandscape ? windowHeight * 0.5 : windowHeight * 0.4,
      },
    };
  }, [windowHeight]);

  const layoutStyles = getLayoutStyles({ width: windowWidth, height: windowHeight });

  const renderSearchResult = ({ item }: { item: Video }) => (
    <SearchResultItem 
      video={item} 
      onPress={handleVideoPress}
      isTablet={windowWidth >= 768}
    />
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF2B4E" />
        </View>
      );
    }

    if (searchError) {
      return (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>
            {ERROR_MESSAGES[searchError.code] || searchError.message}
          </Text>
        </View>
      );
    }

    if (!isSearching) {
      return (
        <>
          <View style={[
            styles.placeholderContent,
            windowWidth >= 768 && styles.placeholderContentTablet
          ]}>
            <Text style={[
              styles.placeholderText,
              windowWidth >= 768 && styles.placeholderTextTablet
            ]}>
              Search for your favorite music, artists, or genres
            </Text>
          </View>
          {suggestions.length > 0 && (
            <View style={[
              styles.suggestionsContainer,
              layoutStyles.suggestionsContainer
            ]}>
              <SearchSuggestions
                suggestions={suggestions}
                onSelectSuggestion={handleSuggestionSelect}
                isTablet={windowWidth >= 768}
              />
            </View>
          )}
        </>
      );
    }

    if (searchResults.length === 0) {
      return (
        <View style={styles.centerContent}>
          <Text style={[
            styles.noResultsText,
            windowWidth >= 768 && styles.noResultsTextTablet
          ]}>
            No results found. Try different keywords.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={searchResults}
        renderItem={renderSearchResult}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.resultsList,
          layoutStyles.resultsList
        ]}
        showsVerticalScrollIndicator={false}
        numColumns={windowWidth >= 768 ? 2 : 1}
        columnWrapperStyle={windowWidth >= 768 ? styles.resultsGrid : undefined}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, windowWidth >= 768 && styles.headerTablet]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#121212" />
        </TouchableOpacity>
        <Text style={[
          styles.title,
          windowWidth >= 768 && styles.titleTablet
        ]}>Search</Text>
      </View>

      <View style={[styles.searchContainer, layoutStyles.searchContainer]}>
        <SearchBar
          onSearch={handleSearch}
          onChangeText={handleQueryChange}
          value={query}
          placeholder="Search music, artists, genres..."
          autoFocus={false}
        />
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTablet: {
    paddingHorizontal: 40,
    paddingVertical: 24,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#121212',
  },
  titleTablet: {
    fontSize: 32,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  content: {
    flex: 1,
  },
  placeholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  placeholderContentTablet: {
    paddingHorizontal: 60,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  placeholderTextTablet: {
    fontSize: 18,
    lineHeight: 28,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  noResultsTextTablet: {
    fontSize: 18,
  },
  errorText: {
    fontSize: 16,
    color: '#FF2B4E',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  resultsList: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  resultsGrid: {
    gap: 16,
    justifyContent: 'space-between',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
  },
}); 