import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Feed: undefined;
  Search: undefined;
  Profile: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Feed'>;

export const NavigationButtons: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <>
      <TouchableOpacity 
        style={styles.searchButton}
        onPress={() => navigation.navigate('Search')}
      >
        <Ionicons name="search-outline" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.profileButton}
        onPress={() => navigation.navigate('Profile')}
      >
        <Ionicons name="person-outline" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  searchButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 20,
    left: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  profileButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 20,
    right: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
}); 