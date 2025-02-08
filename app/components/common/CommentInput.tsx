import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CommentInputProps {
  onSubmit: (comment: string) => void;
  placeholder?: string;
  maxLength?: number;
}

export const CommentInput: React.FC<CommentInputProps> = ({
  onSubmit,
  placeholder = 'Add a comment...',
  maxLength = 500,
}) => {
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    if (comment.trim()) {
      onSubmit(comment.trim());
      setComment('');
      Keyboard.dismiss();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}
    >
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={setComment}
          placeholder={placeholder}
          placeholderTextColor="#666"
          maxLength={maxLength}
          multiline
          numberOfLines={3}
          autoCapitalize="sentences"
          autoCorrect={true}
        />
        
        <TouchableOpacity
          style={[
            styles.submitButton,
            !comment.trim() && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!comment.trim()}
        >
          <Ionicons
            name="send"
            size={24}
            color={comment.trim() ? "#FF2B4E" : "#666"}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#121212',
    maxHeight: 100,
    marginRight: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  submitButton: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
}); 