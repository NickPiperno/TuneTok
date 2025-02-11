import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { VoiceRecorderButton } from '../common/AIGenerateButton';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

// Theme-compliant colors from theme-rules.md
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

interface SongResult {
  uri: string;
  result?: {
    status: {
      code: number;
      msg: string;
      version: string;
    };
    metadata?: {
      music?: [{
        title: string;
        artists?: { name: string }[];
        album?: { name: string };
      }];
      humming?: [{
        title: string;
        artists?: { name: string }[];
        album?: { name: string };
      }];
    };
    cost_time: number;
  };
  error?: any;
}

export const SongIdentifyScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [identificationResult, setIdentificationResult] = useState<SongResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddingToFeed, setIsAddingToFeed] = useState(false);
  const [addedToFeed, setAddedToFeed] = useState(false);

  const handleAddToFeed = async (song: any) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to add songs to your feed');
      return;
    }

    try {
      setIsAddingToFeed(true);
      const userPrefsRef = doc(db, 'userPreferences', user.uid);
      const userPrefsDoc = await getDoc(userPrefsRef);

      if (!userPrefsDoc.exists()) {
        throw new Error('User preferences not found');
      }

      const songData = {
        title: song.title,
        artists: song.artists?.map((artist: { name: string }) => artist.name) || [],
        album: song.album?.name,
        addedAt: new Date(),
      };

      await updateDoc(userPrefsRef, {
        preferredSongs: arrayUnion(songData)
      });

      setAddedToFeed(true);
      Alert.alert('Success', 'Song added to your feed preferences!');
    } catch (error) {
      console.error('Error adding song to feed:', error);
      Alert.alert('Error', 'Failed to add song to feed. Please try again.');
    } finally {
      setIsAddingToFeed(false);
    }
  };

  const handleRecordingComplete = (result: SongResult) => {
    setIsProcessing(true);
    console.log('Recording complete:', result);
    
    if (result.error) {
      console.error('Error details:', result.error);
    }
    
    setIdentificationResult(result);
    setIsProcessing(false);
  };

  const renderResults = () => {
    if (isProcessing) {
      return (
        <View style={styles.resultContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.processingText}>Identifying song...</Text>
        </View>
      );
    }

    if (!identificationResult) {
      return (
        <View style={styles.resultContainer}>
          <Text style={styles.noResultText}>
            Tap the button above to start recording and identify a song
          </Text>
        </View>
      );
    }

    if (identificationResult.error) {
      const errorMessage = typeof identificationResult.error === 'string' 
        ? identificationResult.error
        : identificationResult.error?.message || 'Unknown error occurred';
        
      return (
        <View style={styles.resultContainer}>
          <Ionicons name="alert-circle" size={48} color="#DC2626" />
          <Text style={styles.errorText}>
            Sorry, we couldn't identify the song: {errorMessage}
          </Text>
          <Text style={styles.errorSubtext}>
            Please check your internet connection and try again.
          </Text>
        </View>
      );
    }

    const song = identificationResult.result?.metadata?.music?.[0] || 
                 identificationResult.result?.metadata?.humming?.[0];
    if (!song) {
      return (
        <View style={styles.resultContainer}>
          <Ionicons name="alert-circle" size={48} color="#DC2626" />
          <Text style={styles.errorText}>
            No matching songs found. Please try again with a clearer recording.
          </Text>
          <Text style={styles.errorSubtext}>
            Try to record for at least 5 seconds with minimal background noise.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.resultContainer}>
        <Ionicons name="musical-notes" size={48} color={COLORS.primary} />
        <Text style={styles.songTitle}>{song.title}</Text>
        {song.artists && (
          <Text style={styles.artistName}>
            by {song.artists.map(artist => artist.name).join(', ')}
          </Text>
        )}
        {song.album?.name && (
          <Text style={styles.albumName}>
            Album: {song.album.name}
          </Text>
        )}
        <Text style={styles.confidenceText}>
          Match found with {Math.round(identificationResult.result?.cost_time * 100) / 100}s processing time
        </Text>

        <TouchableOpacity
          style={[
            styles.addToFeedButton,
            addedToFeed && styles.addedToFeedButton,
            isAddingToFeed && styles.addingToFeedButton
          ]}
          onPress={() => handleAddToFeed(song)}
          disabled={isAddingToFeed || addedToFeed}
        >
          {isAddingToFeed ? (
            <View style={styles.addToFeedContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={[styles.addToFeedText, styles.addedToFeedText]}>
                Adding to Feed...
              </Text>
            </View>
          ) : (
            <View style={styles.addToFeedContent}>
              <MaterialCommunityIcons
                name={addedToFeed ? "check" : "plus"}
                size={20}
                color={addedToFeed ? "#fff" : COLORS.primary}
              />
              <Text style={[
                styles.addToFeedText,
                addedToFeed && styles.addedToFeedText
              ]}>
                {addedToFeed ? 'Added to Feed' : 'Add to Feed'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Identify Songs</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.recorderContainer}>
          <VoiceRecorderButton
            onRecordingComplete={handleRecordingComplete}
            style={styles.recorderButton}
          />
        </View>
        {renderResults()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#121212',
    fontFamily: 'Inter',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  recorderContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  recorderButton: {
    width: '80%',
  },
  resultContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  processingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#37474F',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  noResultText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Inter',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  errorSubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  songTitle: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '600',
    color: '#37474F',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  artistName: {
    marginTop: 8,
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  albumName: {
    marginTop: 4,
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  confidenceText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  addToFeedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    minWidth: 150,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  addedToFeedButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  addingToFeedButton: {
    backgroundColor: COLORS.primary,
    opacity: 0.8,
  },
  addToFeedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToFeedText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  addedToFeedText: {
    color: '#fff',
  },
}); 