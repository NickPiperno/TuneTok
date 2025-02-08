import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  UserCredential,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export type AuthError = {
  code: string;
  message: string;
};

export const signUp = async (
  email: string,
  password: string,
  username: string
): Promise<UserCredential | AuthError> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update the user's profile with the username
    await updateProfile(userCredential.user, {
      displayName: username
    });

    // Initialize user preferences
    await setDoc(doc(db, 'userPreferences', userCredential.user.uid), {
      userId: userCredential.user.uid,
      likedVideos: [],
      watchHistory: [],
      preferredGenres: [],
      preferredMoods: [],
      preferredArtists: [],
      totalWatchTime: 0,
      averageSessionDuration: 0,
      hasCompletedOnboarding: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    return userCredential;
  } catch (error: any) {
    return {
      code: error.code || 'auth/unknown',
      message: error.message || 'An unknown error occurred'
    };
  }
};

export const signIn = async (
  email: string,
  password: string
): Promise<UserCredential | AuthError> => {
  try {
    console.log('🔐 Attempting sign in for:', {
      email,
      timestamp: new Date().toISOString()
    });

    const result = await signInWithEmailAndPassword(auth, email, password);
    
    console.log('✅ Sign in successful:', {
      uid: result.user.uid,
      email: result.user.email,
      emailVerified: result.user.emailVerified,
      providerId: result.user.providerId,
      metadata: result.user.metadata
    });

    // Get the ID token to verify auth state
    const token = await result.user.getIdToken();
    console.log('🎫 Auth token received:', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 10) + '...'
    });

    return result;
  } catch (error: any) {
    console.error('❌ Sign in error:', {
      code: error.code,
      message: error.message,
      name: error.name,
      stack: error.stack,
      type: error.constructor.name
    });

    return {
      code: error.code || 'auth/unknown',
      message: error.message || 'An unknown error occurred'
    };
  }
};

export const signOut = async (): Promise<void | AuthError> => {
  try {
    console.log('🚪 Attempting sign out');
    await firebaseSignOut(auth);
    console.log('✅ Sign out successful');
  } catch (error: any) {
    console.error('❌ Sign out error:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    return {
      code: error.code || 'auth/unknown',
      message: error.message || 'An unknown error occurred'
    };
  }
};

export const resetPassword = async (email: string): Promise<void | AuthError> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    return {
      code: error.code || 'auth/unknown',
      message: error.message || 'An unknown error occurred'
    };
  }
}; 