import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Playlist } from '../../types/playlist';
import { Video } from '../../types/video';
import { getPlaylist } from '../../services/playlist';
import { fetchVideoById } from '../../services/video';
import { Ionicons } from '@expo/vector-icons';

type RootStackParamList = {
    SharedPlaylist: { playlistId: string };
};

type SharedPlaylistRouteProp = RouteProp<RootStackParamList, 'SharedPlaylist'>;
type SharedPlaylistNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SharedPlaylist'>;

interface VideoItemProps {
    video: Video;
}

const VideoItem: React.FC<VideoItemProps> = ({ video }) => (
    <View style={styles.videoItem}>
        <View style={styles.videoInfo}>
            <View style={styles.videoDetails}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                    {video.title}
                </Text>
                <Text style={styles.videoArtist}>{video.artist}</Text>
            </View>
        </View>
    </View>
);

export const SharedPlaylistScreen: React.FC = () => {
    const route = useRoute<SharedPlaylistRouteProp>();
    const navigation = useNavigation<SharedPlaylistNavigationProp>();
    const [playlist, setPlaylist] = useState<Playlist | null>(null);
    const [videos, setVideos] = useState<Video[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadPlaylist = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const result = await getPlaylist(route.params.playlistId);
                if ('code' in result) {
                    setError('Failed to load playlist');
                    return;
                }
                
                setPlaylist(result);
                
                // Load videos
                const videoPromises = result.videos.map(videoId => fetchVideoById(videoId));
                const videoResults = await Promise.all(videoPromises);
                const validVideos = videoResults.filter((result): result is Video => !('code' in result));
                setVideos(validVideos);
            } catch (error) {
                setError('Failed to load playlist');
                console.error('Error loading shared playlist:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadPlaylist();
    }, [route.params.playlistId]);

    if (isLoading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    if (error || !playlist) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>{error || 'Playlist not found'}</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.retryButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.playlistName}>{playlist.playlistName}</Text>
                {playlist.playlistDescription && (
                    <Text style={styles.playlistDescription}>
                        {playlist.playlistDescription}
                    </Text>
                )}
                <Text style={styles.playlistDetails}>
                    {videos.length} {videos.length === 1 ? 'video' : 'videos'}
                </Text>
            </View>

            <FlatList
                data={videos}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <VideoItem video={item} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No videos in playlist</Text>
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
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    playlistName: {
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 8
    },
    playlistDescription: {
        fontSize: 16,
        color: '#666',
        marginBottom: 16
    },
    playlistDetails: {
        fontSize: 14,
        color: '#666'
    },
    videoItem: {
        flexDirection: 'row',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center'
    },
    errorText: {
        fontSize: 16,
        color: '#ff3b30',
        marginBottom: 16,
        textAlign: 'center'
    },
    retryButton: {
        padding: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    }
}); 