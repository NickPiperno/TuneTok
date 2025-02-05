import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchSuggestion {
  type: 'artist' | 'genre' | 'mood' | 'recent';
  text: string;
}

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  onSelectSuggestion: (suggestion: SearchSuggestion) => void;
  isTablet?: boolean;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  suggestions,
  onSelectSuggestion,
  isTablet = false,
}) => {
  const getIconName = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'artist':
        return 'person';
      case 'genre':
        return 'musical-notes';
      case 'mood':
        return 'heart';
      case 'recent':
        return 'time';
      default:
        return 'search';
    }
  };

  return (
    <View style={[styles.container, isTablet && styles.containerTablet]}>
      {suggestions.map((suggestion, index) => (
        <TouchableOpacity
          key={`${suggestion.type}-${suggestion.text}-${index}`}
          style={[styles.suggestionItem, isTablet && styles.suggestionItemTablet]}
          onPress={() => onSelectSuggestion(suggestion)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, isTablet && styles.iconContainerTablet]}>
            <Ionicons
              name={getIconName(suggestion.type)}
              size={isTablet ? 20 : 16}
              color="#666"
            />
          </View>
          <Text 
            style={[styles.suggestionText, isTablet && styles.suggestionTextTablet]} 
            numberOfLines={1}
          >
            {suggestion.text}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={isTablet ? 20 : 16}
            color="#999"
            style={styles.arrowIcon}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
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
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#121212',
  },
  arrowIcon: {
    marginLeft: 8,
  },
  containerTablet: {
    borderRadius: 16,
    marginTop: 12,
  },
  suggestionItemTablet: {
    padding: 16,
  },
  iconContainerTablet: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
  },
  suggestionTextTablet: {
    fontSize: 16,
  },
}); 