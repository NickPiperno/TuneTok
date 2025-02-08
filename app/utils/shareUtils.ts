import { Playlist } from '../types/playlist';

/**
 * Generates a slug from a string by removing special characters and replacing spaces with hyphens
 */
const generateSlug = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
};

/**
 * Generates a shareable URL for a playlist
 */
export const generatePlaylistUrl = (playlist: Playlist): string => {
    const slug = generateSlug(playlist.playlistName);
    return `https://tunetok.app/playlist/${playlist.id}/${slug}`;
};

/**
 * Generates share content for a playlist
 */
export const generateShareContent = (playlist: Playlist) => {
    const url = generatePlaylistUrl(playlist);
    return {
        title: `Check out "${playlist.playlistName}" on TuneTok!`,
        message: `Check out my playlist "${playlist.playlistName}" on TuneTok!\n\n${url}`,
        url: url
    };
}; 