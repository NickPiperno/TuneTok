import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type FormErrorProps = {
  message: string;
};

export const FormError: React.FC<FormErrorProps> = ({ message }) => {
  if (!message) return null;
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 4,
  },
  text: {
    color: '#FF2B4E',
    fontSize: 12,
    fontWeight: '500',
  },
}); 