import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (value: boolean) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  hasCompletedOnboarding: false,
  setHasCompletedOnboarding: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 Auth state changed:', {
        userId: user?.uid,
        isAuthenticated: !!user,
        email: user?.email
      });
      
      setUser(user);
      
      if (user) {
        try {
          console.log('👤 Checking onboarding status for user:', user.uid);
          // Check if user has completed onboarding
          const userPrefsDoc = await getDoc(doc(db, 'userPreferences', user.uid));
          console.log('📄 User preferences document:', {
            exists: userPrefsDoc.exists(),
            data: userPrefsDoc.exists() ? userPrefsDoc.data() : null
          });
          
          if (userPrefsDoc.exists()) {
            const data = userPrefsDoc.data();
            setHasCompletedOnboarding(data.hasCompletedOnboarding ?? false);
            console.log('✅ Onboarding status set:', data.hasCompletedOnboarding ?? false);
          } else {
            console.log('❌ No user preferences document found');
            setHasCompletedOnboarding(false);
          }
        } catch (error: any) {
          console.error('❌ Error checking onboarding status:', {
            code: error.code,
            message: error.message,
            stack: error.stack
          });
          setHasCompletedOnboarding(false);
        }
      } else {
        console.log('👋 User signed out, resetting onboarding status');
        setHasCompletedOnboarding(false);
      }
      
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      hasCompletedOnboarding, 
      setHasCompletedOnboarding 
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 