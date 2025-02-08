import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/screens/LoginScreen';
import { RegisterScreen } from './components/screens/RegisterScreen';
import { LandingScreen } from './components/screens/LandingScreen';
import { FeedScreen } from './components/screens/FeedScreen';
import { SearchScreen } from './components/screens/SearchScreen';
import { OnboardingScreen } from './components/screens/OnboardingScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { PlaylistScreen } from './components/screens/PlaylistScreen';
import { PlaylistDetailsScreen } from './components/screens/PlaylistDetailsScreen';
import { ActivityIndicator } from 'react-native';

// Initialize navigation stack
const Stack = createNativeStackNavigator();

function NavigationContent() {
  const { user, isLoading, hasCompletedOnboarding } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2B4E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Navigator 
        id={undefined}
        initialRouteName={user ? (hasCompletedOnboarding ? "Feed" : "Onboarding") : "Landing"}
        screenOptions={{ 
          headerShown: false,
          contentStyle: { backgroundColor: '#F5F5F5' }
        }}
      >
        {user ? (
          // Authenticated stack
          <>
            <Stack.Screen name="Feed" component={FeedScreen} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Playlists" component={PlaylistScreen} />
            <Stack.Screen name="PlaylistDetails" component={PlaylistDetailsScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        ) : (
          // Non-authenticated stack
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="dark" />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, height: '100%' }}>
      <AuthProvider>
        <NavigationContainer>
          <NavigationContent />
        </NavigationContainer>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 