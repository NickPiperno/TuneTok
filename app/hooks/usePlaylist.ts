import { useState, useCallback, useEffect } from 'react';
import { auth } from '../config/firebase';
import { Playlist, PlaylistError } from '../types/playlist';
import {
    createPlaylist,
    getPlaylist,
    getUserPlaylists,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
} from '../services/playlist';
import NetInfo from '@react-native-community/netinfo';

interface UsePlaylistResult {
    playlists: Playlist[];
    isLoading: boolean;
    error: string | null;
    isOnline: boolean;
    createNewPlaylist: (playlistName: string, playlistDescription?: string, isPrivate?: boolean) => Promise<Playlist | PlaylistError>;
    loadPlaylists: () => Promise<void>;
    addVideo: (playlistId: string, videoId: string) => Promise<boolean>;
    removeVideo: (playlistId: string, videoId: string) => Promise<boolean>;
    deleteUserPlaylist: (playlistId: string) => Promise<boolean>;
    updateUserPlaylist: (playlistId: string, updates: { playlistName?: string; playlistDescription?: string; isPrivate?: boolean }) => Promise<boolean>;
    retryFailedOperation: () => Promise<void>;
}

export const usePlaylist = (): UsePlaylistResult => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(true);
    const [failedOperation, setFailedOperation] = useState<(() => Promise<void>) | null>(null);

    // Monitor network connectivity
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setIsOnline(!!state.isConnected);
        });
        return () => unsubscribe();
    }, []);

    const handleError = useCallback((err: any, operation?: () => Promise<void>) => {
        console.error('Playlist operation error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        if (operation) {
            setFailedOperation(() => operation);
        }
    }, []);

    const retryFailedOperation = useCallback(async () => {
        if (failedOperation) {
            setError(null);
            try {
                await failedOperation();
                setFailedOperation(null);
            } catch (err) {
                handleError(err);
            }
        }
    }, [failedOperation, handleError]);

    const loadPlaylists = useCallback(async () => {
        if (!auth.currentUser) {
            setError('User must be authenticated to access playlists');
            return;
        }

        if (!isOnline) {
            console.log('Loading playlists from cache...');
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await getUserPlaylists(auth.currentUser.uid);
            if ('code' in result) {
                setError(result.message);
            } else {
                setPlaylists(result);
            }
        } catch (err) {
            handleError(err, () => loadPlaylists());
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, handleError]);

    const createNewPlaylist = useCallback(async (
        playlistName: string,
        playlistDescription?: string,
        isPrivate: boolean = true
    ): Promise<Playlist | PlaylistError> => {
        if (!auth.currentUser) {
            return {
                code: 'auth-error',
                message: 'User must be authenticated to create a playlist'
            };
        }

        try {
            const result = await createPlaylist(auth.currentUser.uid, playlistName, playlistDescription, isPrivate);
            if (!('code' in result)) {
                setPlaylists(prev => [result, ...prev]);
            }
            return result;
        } catch (err) {
            console.error('Error creating playlist:', err);
            return {
                code: 'create-error',
                message: 'Failed to create playlist',
                details: err instanceof Error ? err.message : String(err)
            };
        }
    }, []);

    const addVideo = useCallback(async (
        playlistId: string,
        videoId: string
    ): Promise<boolean> => {
        try {
            const result = await addVideoToPlaylist(playlistId, videoId);
            if (typeof result === 'boolean' && result) {
                // Update local state
                setPlaylists(prev => prev.map(playlist => {
                    if (playlist.id === playlistId) {
                        return {
                            ...playlist,
                            videos: [...playlist.videos, videoId]
                        };
                    }
                    return playlist;
                }));
            }
            return typeof result === 'boolean' ? result : false;
        } catch (err) {
            console.error('Error adding video to playlist:', err);
            return false;
        }
    }, []);

    const removeVideo = useCallback(async (
        playlistId: string,
        videoId: string
    ): Promise<boolean> => {
        try {
            const result = await removeVideoFromPlaylist(playlistId, videoId);
            if (typeof result === 'boolean' && result) {
                // Update local state
                setPlaylists(prev => prev.map(playlist => {
                    if (playlist.id === playlistId) {
                        return {
                            ...playlist,
                            videos: playlist.videos.filter(id => id !== videoId)
                        };
                    }
                    return playlist;
                }));
            }
            return typeof result === 'boolean' ? result : false;
        } catch (err) {
            console.error('Error removing video from playlist:', err);
            return false;
        }
    }, []);

    const deleteUserPlaylist = useCallback(async (playlistId: string): Promise<boolean> => {
        try {
            const result = await deletePlaylist(playlistId);
            if (typeof result === 'boolean' && result) {
                // Update local state
                setPlaylists(prev => prev.filter(playlist => playlist.id !== playlistId));
            }
            return typeof result === 'boolean' ? result : false;
        } catch (err) {
            console.error('Error deleting playlist:', err);
            return false;
        }
    }, []);

    const updateUserPlaylist = useCallback(async (
        playlistId: string,
        updates: { playlistName?: string; playlistDescription?: string; isPrivate?: boolean }
    ): Promise<boolean> => {
        try {
            const result = await updatePlaylist(playlistId, updates);
            if (typeof result === 'boolean' && result) {
                // Update local state
                setPlaylists(prev => prev.map(playlist => {
                    if (playlist.id === playlistId) {
                        return {
                            ...playlist,
                            ...updates
                        };
                    }
                    return playlist;
                }));
            }
            return typeof result === 'boolean' ? result : false;
        } catch (err) {
            console.error('Error updating playlist:', err);
            return false;
        }
    }, []);

    return {
        playlists,
        isLoading,
        error,
        isOnline,
        createNewPlaylist,
        loadPlaylists,
        addVideo,
        removeVideo,
        deleteUserPlaylist,
        updateUserPlaylist,
        retryFailedOperation
    };
}; 