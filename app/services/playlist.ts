import { 
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    addDoc,
    updateDoc,
    deleteDoc,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Playlist, PlaylistError } from '../types/playlist';

const PLAYLISTS_COLLECTION = 'playlists';

// Validation functions
const validatePlaylistData = (
    playlistName: string,
    playlistDescription?: string,
): PlaylistError | null => {
    if (!playlistName || playlistName.trim().length === 0) {
        return {
            code: 'invalid-name',
            message: 'Playlist name cannot be empty'
        };
    }
    if (playlistName.trim().length > 50) {
        return {
            code: 'invalid-name',
            message: 'Playlist name cannot be longer than 50 characters'
        };
    }
    if (playlistDescription && playlistDescription.trim().length > 200) {
        return {
            code: 'invalid-description',
            message: 'Description cannot be longer than 200 characters'
        };
    }
    return null;
};

// Helper function to convert Firestore data to Playlist type
const convertToPlaylist = (id: string, data: any): Playlist => ({
    id,
    userId: data.userId,
    playlistName: data.playlistName,
    playlistDescription: data.playlistDescription,
    videos: data.videos || [],
    isPrivate: data.isPrivate ?? true
});

export const createPlaylist = async (
    userId: string,
    playlistName: string,
    playlistDescription?: string,
    isPrivate: boolean = true,
): Promise<Playlist | PlaylistError> => {
    try {
        // Validate input data
        const validationError = validatePlaylistData(playlistName, playlistDescription);
        if (validationError) return validationError;

        const playlistData = {
            userId,
            playlistName: playlistName.trim(),
            playlistDescription: playlistDescription?.trim(),
            videos: [],
            isPrivate,
            createdAt: new Date()
        };

        const docRef = await addDoc(collection(db, PLAYLISTS_COLLECTION), playlistData);
        
        // Return the playlist data directly without fetching
        return {
            id: docRef.id,
            ...playlistData
        };
    } catch (error) {
        console.error('Failed to create playlist:', error);
        return {
            code: 'create-playlist-error',
            message: 'Failed to create playlist',
            details: error instanceof Error ? error.message : String(error)
        };
    }
};

export const getPlaylist = async (playlistId: string): Promise<Playlist | PlaylistError> => {
    try {
        const docRef = doc(db, PLAYLISTS_COLLECTION, playlistId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return {
                code: 'playlist-not-found',
                message: 'Playlist not found'
            };
        }

        return {
            id: docSnap.id,
            ...docSnap.data()
        } as Playlist;
    } catch (error) {
        console.error('Failed to get playlist:', error);
        return {
            code: 'get-playlist-error',
            message: 'Failed to get playlist',
            details: error instanceof Error ? error.message : String(error)
        };
    }
};

export const getUserPlaylists = async (userId: string): Promise<Playlist[] | PlaylistError> => {
    try {
        const q = query(
            collection(db, PLAYLISTS_COLLECTION),
            where('userId', '==', userId),
            orderBy('__name__', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Playlist[];
    } catch (error) {
        console.error('Failed to get user playlists:', error);
        return {
            code: 'get-playlists-error',
            message: 'Failed to get user playlists',
            details: error instanceof Error ? error.message : String(error)
        };
    }
};

export const addVideoToPlaylist = async (
    playlistId: string,
    videoId: string
): Promise<boolean | PlaylistError> => {
    try {
        const playlistRef = doc(db, PLAYLISTS_COLLECTION, playlistId);
        await updateDoc(playlistRef, {
            videos: arrayUnion(videoId)
        });

        return true;
    } catch (error) {
        console.error('Failed to add video to playlist:', error);
        return {
            code: 'add-video-error',
            message: 'Failed to add video to playlist',
            details: error instanceof Error ? error.message : String(error)
        };
    }
};

export const removeVideoFromPlaylist = async (
    playlistId: string,
    videoId: string
): Promise<boolean | PlaylistError> => {
    try {
        const playlistRef = doc(db, PLAYLISTS_COLLECTION, playlistId);
        await updateDoc(playlistRef, {
            videos: arrayRemove(videoId)
        });

        return true;
    } catch (error) {
        console.error('Failed to remove video from playlist:', error);
        return {
            code: 'remove-video-error',
            message: 'Failed to remove video from playlist',
            details: error instanceof Error ? error.message : String(error)
        };
    }
};

export const deletePlaylist = async (playlistId: string): Promise<boolean | PlaylistError> => {
    try {
        await deleteDoc(doc(db, PLAYLISTS_COLLECTION, playlistId));
        return true;
    } catch (error) {
        console.error('Failed to delete playlist:', error);
        return {
            code: 'delete-playlist-error',
            message: 'Failed to delete playlist',
            details: error instanceof Error ? error.message : String(error)
        };
    }
};

export const updatePlaylist = async (
    playlistId: string,
    updates: Partial<Pick<Playlist, 'playlistName' | 'playlistDescription'>>
): Promise<boolean | PlaylistError> => {
    try {
        const playlistRef = doc(db, PLAYLISTS_COLLECTION, playlistId);
        await updateDoc(playlistRef, updates);
        return true;
    } catch (error) {
        console.error('Failed to update playlist:', error);
        return {
            code: 'update-playlist-error',
            message: 'Failed to update playlist',
            details: error instanceof Error ? error.message : String(error)
        };
    }
};

/**
 * Updates the order of videos in a playlist
 * @param playlistId The ID of the playlist to update
 * @param videoIds The new ordered array of video IDs
 * @returns Promise<boolean | PlaylistError>
 */
export const updatePlaylistVideoOrder = async (
    playlistId: string,
    videoIds: string[]
): Promise<boolean | PlaylistError> => {
    try {
        const playlistRef = doc(db, PLAYLISTS_COLLECTION, playlistId);
        
        // Update the videos array with the new order
        await updateDoc(playlistRef, {
            videos: videoIds
        });

        return true;
    } catch (error) {
        console.error('Failed to update playlist video order:', error);
        return {
            code: 'update-order-error',
            message: 'Failed to update video order in playlist',
            details: error instanceof Error ? error.message : String(error)
        };
    }
}; 