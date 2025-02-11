import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getArtistRecommendations } from '../../services/ai/artistRecommendation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ArtistRecommendation } from '../../services/ai/artistRecommendation';

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
  const [processingAI, setProcessingAI] = useState(false);
  const [recommendations, setRecommendations] = useState<ArtistRecommendation[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());

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

  const toggleArtist = (artistName: string) => {
    setSelectedArtists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(artistName)) {
        newSet.delete(artistName);
      } else {
        newSet.add(artistName);
      }
      return newSet;
    });
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
    setProcessingAI(true);
    console.log('Attempting to update preferences for user:', user.uid);

    try {
      // Get AI recommendations first
      const aiRecommendations = await getArtistRecommendations(
        selectedGenres.map(g => g.toLowerCase()),
        selectedMoods.map(m => m.toLowerCase())
      );
      
      setRecommendations(aiRecommendations);
      setShowRecommendations(true);
      setProcessingAI(false);
      
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      Alert.alert(
        'Error',
        'Failed to get recommendations. Please try again.'
      );
      setProcessingAI(false);
      setIsSubmitting(false);
    }
  };

  const handleConfirmRecommendations = async () => {
    try {
      const userPrefsRef = doc(db, 'userPreferences', user!.uid);
      const docSnap = await getDoc(userPrefsRef);
      
      // Filter recommendations to only include selected artists
      const selectedRecommendations = recommendations.filter(rec => 
        selectedArtists.has(rec.name)
      );
      
      const updateData = {
        userId: user!.uid,
        preferredGenres: selectedGenres.map(g => g.toLowerCase()),
        preferredMoods: selectedMoods.map(m => m.toLowerCase()),
        hasCompletedOnboarding: true,
        updatedAt: new Date(),
        recommendedArtists: selectedRecommendations,
        likedVideos: [],
        watchHistory: [],
        preferredArtists: Array.from(selectedArtists),
        totalWatchTime: 0,
        averageSessionDuration: 0
      };
      
      if (!docSnap.exists()) {
        await setDoc(userPrefsRef, {
          ...updateData,
          createdAt: new Date()
        });
      } else {
        await setDoc(userPrefsRef, updateData, { merge: true });
      }

      setHasCompletedOnboarding(true);
      navigation.replace('Feed');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      Alert.alert(
        'Error',
        'Failed to save preferences. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // When recommendations are loaded, automatically select all artists
  useEffect(() => {
    if (recommendations.length > 0) {
      setSelectedArtists(new Set(recommendations.map(rec => rec.name)));
    }
  }, [recommendations]);

  const RecommendationsModal = () => (
    <Modal
      visible={showRecommendations}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Your Personalized Artists</Text>
          <Text style={styles.modalSubtitle}>Based on your preferences, we think you'll love:</Text>

          <ScrollView style={styles.recommendationsList}>
            {recommendations.map((artist, index) => (
              <View key={index} style={styles.artistCard}>
                <View style={styles.artistHeader}>
                  <Text style={styles.artistName}>{artist.name}</Text>
                  <View style={styles.confidenceContainer}>
                    <MaterialCommunityIcons 
                      name="star" 
                      size={16} 
                      color="#FFD700" 
                    />
                    <Text style={styles.confidenceText}>
                      {Math.round(artist.confidence * 100)}% match
                    </Text>
                  </View>
                </View>

                <View style={styles.tagContainer}>
                  <View style={styles.tag}>
                    <MaterialCommunityIcons name="music" size={14} color={COLORS.primary} />
                    <Text style={styles.tagText}>{artist.genre}</Text>
                  </View>
                  <View style={styles.tag}>
                    <MaterialCommunityIcons name="emoticon-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.tagText}>{artist.mood}</Text>
                  </View>
                </View>

                <Text style={styles.reasoning}>{artist.reasoning}</Text>

                <TouchableOpacity
                  style={[
                    styles.addToFeedButton,
                    selectedArtists.has(artist.name) && styles.addedToFeedButton
                  ]}
                  onPress={() => toggleArtist(artist.name)}
                >
                  <MaterialCommunityIcons
                    name={selectedArtists.has(artist.name) ? "check" : "plus"}
                    size={20}
                    color={selectedArtists.has(artist.name) ? "#fff" : COLORS.primary}
                  />
                  <Text style={[
                    styles.addToFeedText,
                    selectedArtists.has(artist.name) && styles.addedToFeedText
                  ]}>
                    {selectedArtists.has(artist.name) ? 'Added to Feed' : 'Add to Feed'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.confirmButton,
              selectedArtists.size === 0 && styles.confirmButtonDisabled
            ]}
            onPress={handleConfirmRecommendations}
            disabled={selectedArtists.size === 0}
          >
            <Text style={styles.confirmButtonText}>
              {selectedArtists.size === 0 
                ? 'Select at least one artist' 
                : `Let's Go! (${selectedArtists.size} selected)`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

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
            (isSubmitting || processingAI) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting || processingAI}
        >
          {(isSubmitting || processingAI) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={[styles.submitButtonText, styles.loadingText]}>
                {processingAI ? 'Finding your perfect artists...' : 'Setting up...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>Start Exploring</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      <RecommendationsModal />
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.background.light,
    margin: 20,
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  recommendationsList: {
    maxHeight: '70%',
  },
  artistCard: {
    backgroundColor: COLORS.background.option,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  artistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  artistName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceText: {
    marginLeft: 4,
    color: COLORS.text.secondary,
    fontSize: 14,
  },
  tagContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(55, 71, 79, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    marginLeft: 4,
    color: COLORS.primary,
    fontSize: 14,
  },
  reasoning: {
    color: COLORS.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  addToFeedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  addedToFeedButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  addToFeedText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  addedToFeedText: {
    color: '#fff',
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 16,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 