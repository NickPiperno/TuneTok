import { db } from '../config/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, runTransaction } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

export type UserProfileError = {
  code: string;
  message: string;
  retry?: boolean;
};

export interface Creator {
  id: string;
  username: string;
  displayName?: string;
  photoURL?: string;
  isFollowed?: boolean;
}

/**
 * Follow an artist
 */
export const followCreator = async (
  userId: string,
  artist: string
): Promise<true | UserProfileError> => {
  try {
    const userPrefsRef = doc(db, 'userPreferences', userId);
    
    // Use transaction to ensure atomic updates
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userPrefsRef);
      if (!userDoc.exists()) {
        throw new Error('User preferences not found');
      }

      // Update only the following array
      transaction.update(userPrefsRef, {
        following: arrayUnion(artist),
        updatedAt: Timestamp.now()
      });
    });

    return true;
  } catch (error: any) {
    console.error('Follow artist error:', error);
    return {
      code: error.code || 'follow/unknown',
      message: error.message || 'Failed to follow artist',
      retry: true
    };
  }
};

/**
 * Unfollow an artist
 */
export const unfollowCreator = async (
  userId: string,
  artist: string
): Promise<true | UserProfileError> => {
  try {
    const userPrefsRef = doc(db, 'userPreferences', userId);
    
    // Use transaction to ensure atomic updates
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userPrefsRef);
      if (!userDoc.exists()) {
        throw new Error('User preferences not found');
      }

      // Update only the following array
      transaction.update(userPrefsRef, {
        following: arrayRemove(artist),
        updatedAt: Timestamp.now()
      });
    });

    return true;
  } catch (error: any) {
    console.error('Unfollow artist error:', error);
    return {
      code: error.code || 'unfollow/unknown',
      message: error.message || 'Failed to unfollow artist',
      retry: true
    };
  }
};

/**
 * Check if user follows a creator
 */
export const isFollowingCreator = async (
  userId: string,
  artist: string
): Promise<boolean | UserProfileError> => {
  try {
    const userPrefsRef = doc(db, 'userPreferences', userId);
    const userDoc = await getDoc(userPrefsRef);
    
    if (!userDoc.exists()) {
      return {
        code: 'user/not-found',
        message: 'User preferences not found'
      };
    }

    const userPrefs = userDoc.data();
    return userPrefs.following?.includes(artist) || userPrefs.preferredArtists?.includes(artist) || false;
  } catch (error: any) {
    console.error('Check following status error:', error);
    return {
      code: error.code || 'follow-check/unknown',
      message: error.message || 'Failed to check following status',
      retry: true
    };
  }
}; 