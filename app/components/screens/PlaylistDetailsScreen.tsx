import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Share,
    Image,
    FlatList,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePlaylist } from '../../hooks/usePlaylist';
import { Playlist } from '../../types/playlist';
import { Video, VideoError, VideoMetadata } from '../../types/video';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchVideoMetadataForPlaylist } from '../../services/video';
import { updatePlaylistVideoOrder } from '../../services/playlist';
import * as Clipboard from 'expo-clipboard';

type RootStackParamList = {
    PlaylistDetails: { playlist: Playlist };
};

type PlaylistDetailsRouteProp = RouteProp<RootStackParamList, 'PlaylistDetails'>;
type PlaylistDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PlaylistDetails'>;

interface VideoItemProps {
    video: Pick<Video, 'id' | 'title' | 'artist'>;
    onRemove: () => void;
}

const VideoItem: React.FC<VideoItemProps> = ({ video, onRemove }) => (
    <View style={styles.videoItem}>
        <View style={styles.videoInfo}>
            <View style={styles.videoDetails}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                    {video.title}
                </Text>
                <Text style={styles.videoArtist}>{video.artist}</Text>
            </View>
        </View>
        <TouchableOpacity
            style={styles.removeButton}
            onPress={onRemove}
        >
            <Ionicons name="close-circle" size={24} color="#ff3b30" />
        </TouchableOpacity>
    </View>
);

export const PlaylistDetailsScreen: React.FC = () => {
    const route = useRoute<PlaylistDetailsRouteProp>();
    const navigation = useNavigation<PlaylistDetailsNavigationProp>();
    const [playlistState, setPlaylistState] = useState(route.params.playlist);
    const { removeVideo, updateUserPlaylist } = usePlaylist();
    const [videos, setVideos] = useState<VideoMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const loadVideos = async () => {
            if (playlistState.videos.length === 0) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);
            try {
                const videoPromises = playlistState.videos.map((videoId: string) => 
                    fetchVideoMetadataForPlaylist(videoId)
                );
                const videoResults = await Promise.all(videoPromises);
                // Filter out any errors and keep only valid videos
                const validVideos = videoResults.filter((result: VideoMetadata | VideoError): result is VideoMetadata => 
                    !('code' in result)
                );
                
                setVideos(validVideos);
                // If we got any errors, show a warning
                const errors = videoResults.filter((result: VideoMetadata | VideoError): result is VideoError => 'code' in result);
                if (errors.length > 0) {
                    setError(`Failed to load ${errors.length} video(s). They may have been deleted or made private.`);
                }
            } catch (error) {
                setError('Failed to load videos. Please try again later.');
                console.error('Error loading videos:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadVideos();
    }, [playlistState.videos]);

    const handleRemoveVideo = useCallback(async (videoId: string) => {
        Alert.alert(
            'Remove Video',
            'Are you sure you want to remove this video from the playlist?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await removeVideo(playlistState.id, videoId);
                        if (!success) {
                            Alert.alert('Error', 'Failed to remove video');
                        }
                    }
                }
            ]
        );
    }, [playlistState.id, removeVideo]);

    const handlePrivacyToggle = useCallback(async () => {
        const success = await updateUserPlaylist(playlistState.id, {
            isPrivate: !playlistState.isPrivate
        });

        if (!success) {
            Alert.alert('Error', 'Failed to update playlist privacy');
        } else {
            setPlaylistState((prev: Playlist) => ({
                ...prev,
                isPrivate: !prev.isPrivate
            }));
        }
    }, [playlistState.id, playlistState.isPrivate, updateUserPlaylist]);

    const handleShare = useCallback(async () => {
        if (playlistState.isPrivate) {
            Alert.alert('Error', 'Cannot share private playlist');
            return;
        }

        try {
            const shareUrl = `https://tunetok.app/playlist/${playlistState.id}`;
            const shareOptions = {
                title: `Check out "${playlistState.playlistName}" on TuneTok!`,
                message: `Check out my playlist "${playlistState.playlistName}" on TuneTok!\n\n${shareUrl}`,
            };

            console.log('Attempting to share with options:', shareOptions);
            await Share.share(shareOptions);
        } catch (error) {
            console.error('Error sharing playlist:', error);
            Alert.alert('Error', 'Failed to share playlist');
        }
    }, [playlistState]);

    const handleCopyLink = useCallback(async () => {
        if (playlistState.isPrivate) {
            Alert.alert('Error', 'Cannot share private playlist');
            return;
        }

        try {
            const shareUrl = `https://tunetok.app/playlist/${playlistState.id}`;
            console.log('Attempting to copy URL:', shareUrl);
            await Clipboard.setStringAsync(shareUrl);
            Alert.alert('Success', 'Link copied to clipboard');
        } catch (error) {
            console.error('Error copying link:', error);
            Alert.alert('Error', 'Failed to copy link');
        }
    }, [playlistState]);

    const handleSpotifyPress = useCallback(async () => {
        Alert.alert(
            'Spotify Integration',
            'Export your TuneTok playlists to Spotify and enjoy your favorite music across platforms. This feature is coming soon!',
            [
                {
                    text: 'Can\'t Wait!',
                    style: 'default'
                }
            ],
            {
                userInterfaceStyle: 'light'
            }
        );
    }, []);

    if (isLoading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.playlistName}>{playlistState.playlistName}</Text>
                {playlistState.playlistDescription && (
                    <Text style={styles.playlistDescription}>
                        {playlistState.playlistDescription}
                    </Text>
                )}
                <View style={styles.playlistActions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handlePrivacyToggle}
                    >
                        <Ionicons
                            name={playlistState.isPrivate ? 'lock-closed' : 'lock-open'}
                            size={24}
                            color="#666"
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            playlistState.isPrivate && styles.disabledButton
                        ]}
                        onPress={handleShare}
                        disabled={playlistState.isPrivate}
                    >
                        <Ionicons
                            name="share-outline"
                            size={24}
                            color={playlistState.isPrivate ? '#ccc' : '#666'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            playlistState.isPrivate && styles.disabledButton
                        ]}
                        onPress={handleCopyLink}
                        disabled={playlistState.isPrivate}
                    >
                        <Ionicons
                            name="copy-outline"
                            size={24}
                            color={playlistState.isPrivate ? '#ccc' : '#666'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleSpotifyPress}
                    >
                        <MaterialCommunityIcons
                            name="spotify"
                            size={28}
                            color="#1DB954"
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <FlatList
                data={videos}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <VideoItem
                        video={item}
                        onRemove={() => handleRemoveVideo(item.id)}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No videos in playlist</Text>
                        <Text style={styles.emptySubtext}>
                            Add videos from the feed to get started
                        </Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    header: {
        padding: 16,
        paddingTop: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    playlistName: {
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    playlistDescription: {
        fontSize: 16,
        color: '#666',
        marginBottom: 16
    },
    playlistActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        gap: 24
    },
    actionButton: {
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    videoItem: {
        flexDirection: 'row',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
        alignItems: 'center'
    },
    videoInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center'
    },
    videoDetails: {
        flex: 1
    },
    videoTitle: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4
    },
    videoArtist: {
        fontSize: 14,
        color: '#666'
    },
    removeButton: {
        padding: 8
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center'
    },
    emptySubtext: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center'
    },
    errorContainer: {
        padding: 16,
        backgroundColor: '#ffebee'
    },
    errorText: {
        color: '#c62828',
        fontSize: 14,
        textAlign: 'center'
    },
    backButton: {
        position: 'absolute',
        left: 16,
        top: 16,
        padding: 8,
        zIndex: 1,
    },
    disabledButton: {
        opacity: 0.5
    }
}); 