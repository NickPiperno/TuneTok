import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { 
  validateEmail, 
  validatePassword, 
  validateUsername, 
  validateConfirmPassword,
  ValidationError 
} from '../../utils/validation';
import { FormError } from '../common/FormError';
import { signUp, AuthError } from '../../services/auth';
import { Ionicons } from '@expo/vector-icons';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Onboarding: undefined;
  Feed: undefined;
};

type RegisterScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

export const RegisterScreen = ({ navigation }: RegisterScreenProps) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    const usernameError = validateUsername(formData.username);
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    const confirmPasswordError = validateConfirmPassword(
      formData.password,
      formData.confirmPassword
    );

    if (usernameError) newErrors.username = usernameError.message;
    if (emailError) newErrors.email = emailError.message;
    if (passwordError) newErrors.password = passwordError.message;
    if (confirmPasswordError) newErrors.confirmPassword = confirmPasswordError.message;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    if (!validateForm()) {
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await signUp(formData.email, formData.password, formData.username);
      
      if ('code' in result) {
        // Handle Firebase auth errors
        const authError = result as AuthError;
        let errorMessage = 'Registration failed. ';
        
        switch (authError.code) {
          case 'auth/email-already-in-use':
            errorMessage += 'This email is already registered.';
            break;
          case 'auth/invalid-email':
            errorMessage += 'Please enter a valid email address.';
            break;
          case 'auth/weak-password':
            errorMessage += 'Password is too weak.';
            break;
          default:
            errorMessage += authError.message;
        }
        
        Alert.alert('Error', errorMessage);
      } else {
        // Navigate to onboarding
        navigation.replace('Onboarding');
      }
    } catch (error) {
      Alert.alert('Error', 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
        >
          <View style={styles.formContainer}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join TuneTok to discover amazing music</Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, errors.username && styles.inputError]}
                placeholder="Username"
                value={formData.username}
                onChangeText={(text) => handleInputChange('username', text)}
                autoCapitalize="none"
              />
              <FormError message={errors.username} />
            </View>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="Email"
                value={formData.email}
                onChangeText={(text) => handleInputChange('email', text)}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <FormError message={errors.email} />
            </View>
            
            <View style={styles.inputContainer}>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, errors.password && styles.inputError]}
                  placeholder="Password"
                  value={formData.password}
                  onChangeText={(text) => handleInputChange('password', text)}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
              <FormError message={errors.password} />
            </View>
            
            <View style={styles.inputContainer}>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, errors.confirmPassword && styles.inputError]}
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChangeText={(text) => handleInputChange('confirmPassword', text)}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
              <FormError message={errors.confirmPassword} />
            </View>

            <TouchableOpacity 
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? 'Creating Account...' : 'Sign Up'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#121212', // Dark text for contrast
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#37474F', // Secondary text color from theme
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  button: {
    backgroundColor: '#FF2B4E', // Primary accent color
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: {
    color: '#FF2B4E', // Primary accent color
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 8,
  },
  inputError: {
    borderColor: '#FF2B4E',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 16,
  },
}); 