import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const API_URL = 'http://localhost:8000'; // Change this to your server URL in production

export interface MusicGenParams {
  genre?: string;
  mood?: string;
  duration?: number;
  temperature?: number;
  top_k?: number;
}

export interface MusicGenError {
  message: string;
  details?: string;
}

export const generateMusic = async (params: MusicGenParams): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/generate-music`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to generate music');
    }

    // Get the audio data as a blob
    const blob = await response.blob();

    // Create a unique filename for the downloaded audio
    const timestamp = new Date().getTime();
    const filename = `generated_music_${timestamp}.wav`;
    
    // Get the app's documents directory
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the data URL prefix to get just the base64 string
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
    });
    reader.readAsDataURL(blob);

    const base64Data = await base64Promise;

    // Write the file using Expo's FileSystem
    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return fileUri;
  } catch (error) {
    console.error('Error generating music:', error);
    throw error;
  }
};

export const checkServerHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}; 