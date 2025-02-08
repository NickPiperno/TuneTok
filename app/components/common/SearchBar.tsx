import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Animated,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash/debounce';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onChangeText: (text: string) => void;
  value: string;
  placeholder?: string;
  autoFocus?: boolean;
  debounceMs?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onChangeText,
  value,
  placeholder = 'Search music, artists, genres...',
  autoFocus = false,
  debounceMs = 300,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  // Debounce the search callback
  const debouncedSearch = useCallback(
    debounce((text: string) => {
      onSearch(text);
    }, debounceMs),
    [onSearch, debounceMs]
  );

  const handleTextChange = (text: string) => {
    onChangeText(text);
    debouncedSearch(text);
  };

  const handleClear = () => {
    onChangeText('');
    onSearch('');
    Keyboard.dismiss();
  };

  return (
    <View style={[styles.container, isFocused && styles.containerFocused]}>
      <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
      
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        placeholderTextColor="#666"
        autoFocus={autoFocus}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        returnKeyType="search"
        clearButtonMode="never"
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Ionicons name="close-circle" size={20} color="#666" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  containerFocused: {
    borderColor: '#FF2B4E',
    ...Platform.select({
      ios: {
        shadowOpacity: 0.15,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#121212',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
}); 