import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Playlist } from '../../types/playlist';
import { getUserPlaylists, addVideoToPlaylist, createPlaylist } from '../../services/playlist';
import { CreatePlaylistModal } from '../screens/PlaylistScreen';

interface SaveToPlaylistModalProps {
    isVisible: boolean;
    onClose: () => void;
    videoId: string;
}

interface PlaylistItemProps {
    playlist: Playlist;
    onSelect: (playlistId: string) => void;
    isSelected: boolean;
}

const PlaylistItem: React.FC<PlaylistItemProps> = ({ playlist, onSelect, isSelected }) => (
    <TouchableOpacity
        style={[styles.playlistItem, isSelected && styles.selectedPlaylistItem]}
        onPress={() => onSelect(playlist.id)}
    >
        <MaterialCommunityIcons
            name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={isSelected ? '#45ff75' : 'white'}
        />
        <View style={styles.playlistInfo}>
            <Text style={styles.playlistTitle}>{playlist.playlistName}</Text>
            <Text style={styles.playlistCount}>{playlist.videos.length} videos</Text>
        </View>
    </TouchableOpacity>
);

export const SaveToPlaylistModal: React.FC<SaveToPlaylistModalProps> = ({
    isVisible,
    onClose,
    videoId
}) => {
    const { user } = useAuth();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const loadPlaylists = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const result = await getUserPlaylists(user.uid);
            if ('code' in result) {
                Alert.alert('Error', 'Failed to load playlists');
            } else {
                setPlaylists(result);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to load playlists');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (isVisible) {
            loadPlaylists();
        }
    }, [isVisible, loadPlaylists]);

    const handlePlaylistSelect = async (playlistId: string) => {
        setSelectedPlaylists(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playlistId)) {
                newSet.delete(playlistId);
            } else {
                newSet.add(playlistId);
            }
            return newSet;
        });
    };

    const handleSave = async () => {
        if (!user || selectedPlaylists.size === 0) {
            return;
        }

        try {
            setLoading(true);
            const promises = Array.from(selectedPlaylists).map(playlistId =>
                addVideoToPlaylist(playlistId, videoId)
            );
            await Promise.all(promises);
            
            Alert.alert('Success', 'Video saved to selected playlists');
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to save video to playlists');
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePlaylist = async (playlistName: string, playlistDescription: string, isPrivate: boolean) => {
        try {
            setLoading(true);
            
            if (!user) {
                Alert.alert('Error', 'You must be logged in to create a playlist');
                return;
            }
            
            const result = await createPlaylist(user.uid, playlistName, playlistDescription, isPrivate);
            if ('code' in result) {
                Alert.alert('Error', 'Failed to create playlist');
            } else {
                setShowCreateModal(false);
                setSelectedPlaylists(prev => {
                    const newSet = new Set(prev);
                    newSet.add(result.id);
                    return newSet;
                });
                loadPlaylists();
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to create playlist');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Save to Playlist</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <MaterialCommunityIcons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#45ff75" style={styles.loader} />
                    ) : (
                        <>
                            <FlatList
                                data={playlists}
                                keyExtractor={item => item.id}
                                renderItem={({ item }) => (
                                    <PlaylistItem
                                        playlist={item}
                                        onSelect={handlePlaylistSelect}
                                        isSelected={selectedPlaylists.has(item.id)}
                                    />
                                )}
                                style={styles.list}
                            />

                            <View style={styles.footer}>
                                <TouchableOpacity
                                    style={styles.createButton}
                                    onPress={() => setShowCreateModal(true)}
                                >
                                    <MaterialCommunityIcons name="playlist-plus" size={24} color="white" />
                                    <Text style={styles.createButtonText}>Create New Playlist</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.saveButton,
                                        selectedPlaylists.size === 0 && styles.saveButtonDisabled,
                                    ]}
                                    onPress={handleSave}
                                    disabled={selectedPlaylists.size === 0}
                                >
                                    <Text style={styles.saveButtonText}>
                                        Save to {selectedPlaylists.size} playlist{selectedPlaylists.size !== 1 ? 's' : ''}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </View>

            <CreatePlaylistModal
                visible={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreatePlaylist}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        minHeight: '50%',
        maxHeight: '80%',
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
    },
    closeButton: {
        padding: 8,
    },
    loader: {
        marginVertical: 20,
    },
    list: {
        flex: 1,
    },
    playlistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#2a2a2a',
    },
    selectedPlaylistItem: {
        backgroundColor: '#3a3a3a',
    },
    playlistInfo: {
        marginLeft: 12,
        flex: 1,
    },
    playlistTitle: {
        fontSize: 16,
        color: 'white',
        fontWeight: '500',
    },
    playlistCount: {
        fontSize: 14,
        color: '#999',
        marginTop: 4,
    },
    footer: {
        marginTop: 16,
        gap: 12,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#2a2a2a',
    },
    createButtonText: {
        color: 'white',
        fontSize: 16,
        marginLeft: 8,
    },
    saveButton: {
        backgroundColor: '#45ff75',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    saveButtonDisabled: {
        backgroundColor: '#2a2a2a',
    },
    saveButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
}); 