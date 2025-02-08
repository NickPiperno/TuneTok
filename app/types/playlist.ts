import { FirestoreTimestamp } from '../services/videoMetadata';

export interface Playlist {
    id: string;
    userId: string;
    playlistName: string;
    playlistDescription?: string;
    videos: string[];  // Array of video IDs
    isPrivate: boolean;
}

export interface PlaylistError {
    code: string;
    message: string;
    details?: string;
}

export type PlaylistSortOrder = 'newest' | 'oldest' | 'custom';

export interface PlaylistMetadata {
    totalVideos: number;
    totalDuration: number;  // Total duration in seconds
} 