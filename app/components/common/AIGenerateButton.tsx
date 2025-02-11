import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';

interface VoiceRecorderButtonProps {
  onRecordingComplete?: (result: { uri: string; result?: any; error?: any }) => void;
  style?: object;
}

export const VoiceRecorderButton: React.FC<VoiceRecorderButtonProps> = ({
  onRecordingComplete,
  style,
}) => {
  const { startRecording, stopRecording, isRecording } = useVoiceRecorder();

  const handlePress = async () => {
    try {
      if (isRecording) {
        const result = await stopRecording();
        onRecordingComplete?.(result);
      } else {
        await startRecording();
      }
    } catch (error) {
      console.error('Error handling recording:', error);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, isRecording && styles.recordingButton, style]}
      onPress={handlePress}
    >
      {isRecording ? (
        <View style={styles.recordingContainer}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.buttonText}>Recording...</Text>
        </View>
      ) : (
        <Text style={styles.buttonText}>Record Voice</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#6200EE',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recordingButton: {
    backgroundColor: '#DC2626', // Red color to indicate recording
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
}); 