import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { auth } from '../../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { updateUserPreferences } from '../../services/videoMetadata';
import { GENRES, MOODS } from '../../constants/musicPreferences';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { signOut } from '../../services/auth';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Playlist } from '../../types/playlist';

interface UserPreferences {
  preferredGenres: string[];
  preferredMoods: string[];
  avatarUrl?: string;
  updatedAt?: Date;
  following: string[];
  preferredArtists: string[];
}

type RootStackParamList = {
  Feed: undefined;
  Search: undefined;
  Profile: undefined;
  Playlists: undefined;
  PlaylistDetails: { playlist: Playlist };
  Onboarding: undefined;
  SongIdentify: undefined;
};

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const ProfileScreen = () => {
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences>({
    preferredGenres: [],
    preferredMoods: [],
    following: [],
    preferredArtists: []
  });
  const [editMode, setEditMode] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const user = auth.currentUser;

  useEffect(() => {
    loadUserPreferences();
  }, []);

  const loadUserPreferences = async () => {
    if (!user) return;

    try {
      const userPrefsRef = doc(db, 'userPreferences', user.uid);
      const userPrefsDoc = await getDoc(userPrefsRef);
      
      if (userPrefsDoc.exists()) {
        const prefsData = userPrefsDoc.data();
        const normalizedPrefs: UserPreferences = {
          preferredGenres: (prefsData.preferredGenres || []).map((g: string) => g.toLowerCase()),
          preferredMoods: (prefsData.preferredMoods || []).map((m: string) => m.toLowerCase()),
          following: prefsData.following || [],
          preferredArtists: prefsData.preferredArtists || [],
          avatarUrl: prefsData.avatarUrl,
          updatedAt: prefsData.updatedAt ? new Date(prefsData.updatedAt) : undefined
        };
        setPreferences(normalizedPrefs);
        setSelectedGenres(normalizedPrefs.preferredGenres);
        setSelectedMoods(normalizedPrefs.preferredMoods);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load user preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!user) return;

    try {
      setLoading(true);
      await updateUserPreferences(user.uid, {
        preferredGenres: selectedGenres,
        preferredMoods: selectedMoods,
      });
      setEditMode(false);
      await loadUserPreferences();
      Alert.alert('Success', 'Preferences updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const error = await signOut();
      if (error) {
        Alert.alert('Error', 'Failed to log out. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const toggleGenre = (genre: string) => {
    const normalizedGenre = genre.toLowerCase();
    if (selectedGenres.includes(normalizedGenre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== normalizedGenre));
    } else {
      setSelectedGenres([...selectedGenres, normalizedGenre]);
    }
  };

  const toggleMood = (mood: string) => {
    const normalizedMood = mood.toLowerCase();
    if (selectedMoods.includes(normalizedMood)) {
      setSelectedMoods(selectedMoods.filter(m => m !== normalizedMood));
    } else {
      setSelectedMoods([...selectedMoods, normalizedMood]);
    }
  };

  const handleAvatarPress = async () => {
    if (!editMode) return;

    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to change your avatar.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0].uri) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;

    try {
      setUploadingAvatar(true);

      const response = await fetch(uri);
      const blob = await response.blob();

      const storage = getStorage();
      const avatarRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(avatarRef, blob);

      const downloadURL = await getDownloadURL(avatarRef);

      const userPrefsRef = doc(db, 'userPreferences', user.uid);
      await updateDoc(userPrefsRef, {
        avatarUrl: downloadURL,
        updatedAt: new Date()
      });

      setPreferences(prev => ({
        ...prev,
        avatarUrl: downloadURL
      }));

      Alert.alert('Success', 'Avatar updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to upload avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleAvatarPress}
            disabled={!editMode || uploadingAvatar}
            style={styles.avatarContainer}
          >
            {uploadingAvatar ? (
              <View style={styles.avatarLoading}>
                <ActivityIndicator color="#37474F" />
              </View>
            ) : (
              <>
                <Image
                  source={{ 
                    uri: preferences?.avatarUrl || user?.photoURL || 'https://via.placeholder.com/150'
                  }}
                  style={styles.avatar}
                />
                {editMode && (
                  <View style={styles.avatarOverlay}>
                    <MaterialIcons name="camera-alt" size={24} color="#fff" />
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.username}>{user?.displayName || 'User'}</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setEditMode(!editMode)}
          >
            <MaterialIcons
              name={editMode ? 'close' : 'edit'}
              size={24}
              color="#000"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Genres</Text>
          <View style={styles.tagsContainer}>
            {GENRES.map((genre) => (
              <TouchableOpacity
                key={genre}
                style={[
                  styles.tag,
                  selectedGenres.includes(genre.toLowerCase()) && styles.selectedTag,
                  !editMode && styles.readOnlyTag,
                ]}
                onPress={() => editMode && toggleGenre(genre)}
                disabled={!editMode}
              >
                <Text
                  style={[
                    styles.tagText,
                    selectedGenres.includes(genre.toLowerCase()) && styles.selectedTagText,
                  ]}
                >
                  {genre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Moods</Text>
          <View style={styles.tagsContainer}>
            {MOODS.map((mood) => (
              <TouchableOpacity
                key={mood}
                style={[
                  styles.tag,
                  selectedMoods.includes(mood.toLowerCase()) && styles.selectedTag,
                  !editMode && styles.readOnlyTag,
                ]}
                onPress={() => editMode && toggleMood(mood)}
                disabled={!editMode}
              >
                <Text
                  style={[
                    styles.tagText,
                    selectedMoods.includes(mood.toLowerCase()) && styles.selectedTagText,
                  ]}
                >
                  {mood}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {editMode && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSavePreferences}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Following Artists</Text>
          {(preferences?.following?.length > 0 || preferences?.preferredArtists?.length > 0) ? (
            <View style={styles.artistList}>
              {preferences?.preferredArtists?.map((artist: string) => (
                <View key={`preferred-${artist}`} style={styles.artistItemContainer}>
                  <Text style={styles.artistItem}>
                    {artist}
                  </Text>
                  <Text style={styles.artistBadge}>Preferred</Text>
                </View>
              ))}
              {preferences?.following?.map((artist: string) => (
                <View key={`following-${artist}`} style={styles.artistItemContainer}>
                  <Text style={styles.artistItem}>
                    {artist}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No artists followed yet</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.section}
          onPress={() => navigation.navigate('Playlists')}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Playlists</Text>
            <MaterialIcons name="chevron-right" size={24} color="#37474F" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.section}
          onPress={() => navigation.navigate('SongIdentify')}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Identify Songs</Text>
            <MaterialIcons name="chevron-right" size={24} color="#37474F" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <MaterialIcons name="logout" size={24} color="#fff" />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: '#F5F5F5',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    position: 'relative',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  username: {
    fontSize: 24,
    fontFamily: 'Inter',
    fontWeight: '600',
    color: '#121212',
  },
  editButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    padding: 10,
  },
  section: {
    padding: 24,
    marginVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter',
    fontWeight: '600',
    marginBottom: 16,
    color: '#121212',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  tag: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    margin: 5,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedTag: {
    backgroundColor: '#37474F',
    borderColor: '#37474F',
  },
  readOnlyTag: {
    opacity: 0.9,
  },
  tagText: {
    color: '#37474F',
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedTagText: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#37474F',
    margin: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: '600',
  },
  artistList: {
    marginTop: 12,
  },
  artistItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  artistItem: {
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#37474F',
  },
  artistBadge: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    fontFamily: 'Inter',
    fontSize: 14,
  },
  logoutButton: {
    backgroundColor: '#B67B5D',
    margin: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: '600',
    marginLeft: 8,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 20,
    padding: 8,
    marginRight: 16,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    elevation: 3,
    zIndex: 1,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  avatarLoading: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}); 