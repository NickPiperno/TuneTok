import { FirestoreTimestamp } from '../services/videoMetadata';

export interface Video {
    id: string;
    url: string;
    title: string;
    artist: string;
    description?: string;
    tags: string[];
    genre?: string;
    mood?: string;
    likes: number;
    comments: number;
    shares: number;
    views: number;
    uploadDate: FirestoreTimestamp;
}

export interface VideoError {
    code: string;
    message: string;
    details?: string;
    retry?: boolean;
}

export interface VideoMetadata {
    id: string;
    title: string;
    artist: string;
    likes: number;
    comments: number;
    shares: number;
    description?: string;
} 