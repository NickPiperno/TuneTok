import React from 'react';
import { StyleSheet, Button, View, Text } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import hmacSHA1 from 'crypto-js/hmac-sha1';
import Base64 from 'crypto-js/enc-base64';
import { Buffer } from 'buffer';

interface AudioResponse {
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
}

interface FileInfo {
  exists: boolean;
  uri: string;
  size?: number;
  isDirectory: boolean;
}

interface IdentifyOptions {
  host: string;
  endpoint: string;
  signature_version: string;
  data_type: string;
  secure: boolean;
  access_key: string;
  access_secret: string;
}

const defaultOptions: IdentifyOptions = {
  host: process.env.EXPO_PUBLIC_PROJECT_HOST || '',
  endpoint: '/v1/identify',
  signature_version: '1',
  data_type: 'audio',
  secure: true,
  access_key: process.env.EXPO_PUBLIC_PROJECT_ACCESS_KEY || '',
  access_secret: process.env.EXPO_PUBLIC_PROJECT_SECRET_KEY || '',
};

// Add debug logging
console.log('API Configuration:', {
  host: defaultOptions.host,
  hasAccessKey: !!defaultOptions.access_key,
  hasSecretKey: !!defaultOptions.access_secret,
});

function buildStringToSign(
  method: string,
  uri: string,
  accessKey: string,
  dataType: string,
  signatureVersion: string,
  timestamp: number,
): string {
  return [method, uri, accessKey, dataType, signatureVersion, timestamp].join('\n');
}

function signString(stringToSign: string, accessSecret: string): string {
  return Base64.stringify(hmacSHA1(stringToSign, accessSecret));
}

async function identify(uri: string, options: IdentifyOptions): Promise<AudioResponse> {
  const current_data = new Date();
  const timestamp = current_data.getTime() / 1000;

  const stringToSign = buildStringToSign(
    'POST',
    options.endpoint,
    options.access_key,
    options.data_type,
    options.signature_version,
    timestamp,
  );

  const fileinfo = await FileSystem.getInfoAsync(uri, { size: true }) as FileInfo;
  const signature = signString(stringToSign, options.access_secret);

  const formData = new FormData();
  formData.append('sample', {
    uri: uri,
    name: 'sample.wav',
    type: 'audio/wav',
  } as any);
  formData.append('access_key', options.access_key);
  formData.append('data_type', options.data_type);
  formData.append('signature_version', options.signature_version);
  formData.append('signature', signature);
  formData.append('sample_bytes', fileinfo.size?.toString() || '0');
  formData.append('timestamp', timestamp.toString());

  console.log('Making API request to:', options.host);
  
  const response = await fetch(options.host, {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    body: formData,
  });

  if (!response.ok) {
    console.error('API Error:', response.status, await response.text());
    throw new Error(`API request failed with status ${response.status}`);
  }

  const result = await response.json();
  console.log('Raw API response:', JSON.stringify(result, null, 2));
  return result as AudioResponse;
}

export function useVoiceRecorder() {
  const [recording, setRecording] = React.useState<Audio.Recording | null>(null);
  const [permissionStatus, setPermissionStatus] = React.useState<Audio.PermissionStatus | null>(null);

  React.useEffect(() => {
    const getPermissions = async () => {
      try {
        const permission = await Audio.requestPermissionsAsync();
        setPermissionStatus(permission.status);
      } catch (error) {
        console.error('Error requesting audio permissions:', error);
      }
    };

    getPermissions();
  }, []);

  const startRecording = async () => {
    try {
      if (permissionStatus !== 'granted') {
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Permission to record audio was denied');
        }
      }

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });
      await newRecording.startAsync();
      setRecording(newRecording);
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) {
        throw new Error('No active recording found');
      }

      let currentRecording = recording;
      setRecording(null); // Clear the recording state immediately to prevent double-stops

      if (currentRecording._isDoneRecording) {
        console.log('Recording is already stopped, skipping stopAndUnloadAsync');
      } else {
        await currentRecording.stopAndUnloadAsync();
      }

      const uri = currentRecording.getURI();
      
      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      // Create a unique filename
      const timestamp = new Date().getTime();
      const filename = `voice_recording_${timestamp}.wav`;
      const destinationUri = `${FileSystem.documentDirectory}${filename}`;

      // Move the recording to a permanent location
      await FileSystem.moveAsync({
        from: uri,
        to: destinationUri,
      });

      // Try to identify the song
      try {
        const result = await identify(destinationUri, defaultOptions);
        console.log('Song identification result:', result);
        return { uri: destinationUri, result };
      } catch (error) {
        console.error('Error identifying song:', error);
        return { uri: destinationUri, error };
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setRecording(null); // Ensure recording state is cleared even on error
      throw error;
    }
  };

  return {
    recording,
    permissionStatus,
    startRecording,
    stopRecording,
    isRecording: !!recording,
  };
}

// Helper function
function timeout(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});