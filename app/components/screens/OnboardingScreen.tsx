import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

type RootStackParamList = {
  Onboarding: undefined;
  Feed: undefined;
};

type OnboardingScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

// Predefined options for user selection
const GENRES = ['pop', 'hip-hop', 'rock', 'electronic', 'r&b', 'jazz', 'classical', 'country'];
const MOODS = ['energetic', 'chill', 'happy', 'relaxed', 'focused', 'party', 'workout', 'study'];

// Theme-compliant colors
const COLORS = {
  primary: '#37474F',    // Dark Blue-Gray for primary actions
  accent: '#B67B5D',     // Muted Copper for accents
  background: {
    light: '#FFFFFF',    // Pure white for light mode
    option: '#F5F5F5',   // Off-white for option buttons
  },
  text: {
    primary: '#121212',  // Soft Black for primary text
    secondary: '#666666', // Gray for secondary text
  },
  border: '#E0E0E0',     // Light gray for borders
};

export const OnboardingScreen = ({ navigation }: OnboardingScreenProps) => {
  const { user, setHasCompletedOnboarding } = useAuth();
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const toggleMood = (mood: string) => {
    setSelectedMoods(prev => 
      prev.includes(mood) 
        ? prev.filter(m => m !== mood)
        : [...prev, mood]
    );
  };

  const handleSubmit = async () => {
    console.log('Starting handleSubmit...', { user, selectedGenres, selectedMoods });
    
    if (!user) {
      console.error('No user found');
      Alert.alert('Error', 'No user found. Please try signing in again.');
      return;
    }
    
    if (isSubmitting) return;
    
    if (selectedGenres.length === 0 || selectedMoods.length === 0) {
      Alert.alert(
        'Incomplete Preferences',
        'Please select at least one genre and one mood to help us personalize your feed.'
      );
      return;
    }

    setIsSubmitting(true);
    console.log('Attempting to update preferences for user:', user.uid);

    try {
      // Check if document exists
      const userPrefsRef = doc(db, 'userPreferences', user.uid);
      const docSnap = await getDoc(userPrefsRef);
      console.log('Document exists:', docSnap.exists());
      
      const updateData = {
        userId: user.uid,
        preferredGenres: selectedGenres.map(g => g.toLowerCase()),
        preferredMoods: selectedMoods.map(m => m.toLowerCase()),
        hasCompletedOnboarding: true,
        updatedAt: new Date(),
        // Initialize other required fields if they don't exist
        likedVideos: [],
        watchHistory: [],
        preferredArtists: [],
        totalWatchTime: 0,
        averageSessionDuration: 0
      };
      console.log('Setting data:', updateData);
      
      if (!docSnap.exists()) {
        console.log('Creating new document');
        await setDoc(userPrefsRef, {
          ...updateData,
          createdAt: new Date()
        });
      } else {
        console.log('Updating existing document');
        await setDoc(userPrefsRef, updateData, { merge: true });
      }
      console.log('Successfully updated preferences');

      // Update local state
      setHasCompletedOnboarding(true);
      
      // Navigate to feed
      navigation.replace('Feed');
    } catch (error: any) {
      console.error('Failed to save preferences:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      Alert.alert(
        'Error',
        'Failed to save preferences. Please check your internet connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Welcome to TuneTok!</Text>
        <Text style={styles.subtitle}>Let's personalize your experience</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select your favorite genres</Text>
          <Text style={styles.sectionSubtitle}>Choose one or more</Text>
          <View style={styles.optionsGrid}>
            {GENRES.map(genre => (
              <TouchableOpacity
                key={genre}
                style={[
                  styles.option,
                  selectedGenres.includes(genre) && styles.selectedOption
                ]}
                onPress={() => toggleGenre(genre)}
              >
                <Text style={[
                  styles.optionText,
                  selectedGenres.includes(genre) && styles.selectedOptionText
                ]}>
                  {genre.charAt(0).toUpperCase() + genre.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's your vibe?</Text>
          <Text style={styles.sectionSubtitle}>Choose one or more</Text>
          <View style={styles.optionsGrid}>
            {MOODS.map(mood => (
              <TouchableOpacity
                key={mood}
                style={[
                  styles.option,
                  selectedMoods.includes(mood) && styles.selectedOption
                ]}
                onPress={() => toggleMood(mood)}
              >
                <Text style={[
                  styles.optionText,
                  selectedMoods.includes(mood) && styles.selectedOptionText
                ]}>
                  {mood.charAt(0).toUpperCase() + mood.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            isSubmitting && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Setting up...' : 'Start Exploring'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.light,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 10,
    color: COLORS.text.primary,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: COLORS.text.primary,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 15,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  option: {
    backgroundColor: COLORS.background.option,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  selectedOption: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionText: {
    color: COLORS.text.primary,
    fontSize: 14,
  },
  selectedOptionText: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 20,
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
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 