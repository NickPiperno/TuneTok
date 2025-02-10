import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    TextInput,
    Modal,
    ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePlaylist } from '../../hooks/usePlaylist';
import { Playlist } from '../../types/playlist';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Video } from '../../types/video';

type RootStackParamList = {
    Feed: undefined;
    Search: undefined;
    Profile: undefined;
    Playlists: undefined;
    PlaylistDetails: { playlist: Playlist };
    Onboarding: undefined;
};

type PlaylistScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PlaylistItemProps {
    playlist: Playlist;
    onPress: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const PlaylistItem: React.FC<PlaylistItemProps> = ({ playlist, onPress, onEdit, onDelete }) => (
    <TouchableOpacity style={styles.playlistItem} onPress={onPress}>
        <View style={styles.playlistInfo}>
            <Text style={styles.playlistName}>{playlist.playlistName}</Text>
            <Text style={styles.playlistDetails}>
                {playlist.videos.length} {playlist.videos.length === 1 ? 'video' : 'videos'}
                {playlist.isPrivate ? ' • Private' : ' • Public'}
            </Text>
            {playlist.playlistDescription && (
                <Text style={styles.playlistDescription} numberOfLines={2}>
                    {playlist.playlistDescription}
                </Text>
            )}
        </View>
        <View style={styles.playlistActions}>
            <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                <Ionicons name="pencil" size={24} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
                <Ionicons name="trash-outline" size={24} color="#666" />
            </TouchableOpacity>
        </View>
    </TouchableOpacity>
);

interface CreatePlaylistModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (playlistName: string, playlistDescription: string, isPrivate: boolean) => void;
    initialValues?: {
        playlistName: string;
        playlistDescription?: string;
        isPrivate: boolean;
    };
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
    visible,
    onClose,
    onSubmit,
    initialValues
}) => {
    const [playlistName, setPlaylistName] = useState(initialValues?.playlistName ?? '');
    const [playlistDescription, setPlaylistDescription] = useState(initialValues?.playlistDescription ?? '');
    const [isPrivate, setIsPrivate] = useState(initialValues?.isPrivate ?? true);

    useEffect(() => {
        if (visible && initialValues) {
            setPlaylistName(initialValues.playlistName ?? '');
            setPlaylistDescription(initialValues.playlistDescription ?? '');
            setIsPrivate(initialValues.isPrivate);
        }
    }, [visible, initialValues]);

    const handleSubmit = () => {
        if (!playlistName.trim()) {
            Alert.alert('Error', 'Please enter a playlist name');
            return;
        }
        onSubmit(playlistName.trim(), playlistDescription.trim(), isPrivate);
        setPlaylistName('');
        setPlaylistDescription('');
        setIsPrivate(true);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>
                        {initialValues ? 'Edit Playlist' : 'Create New Playlist'}
                    </Text>
                    
                    <TextInput
                        style={styles.input}
                        placeholder="Playlist Name"
                        value={playlistName}
                        onChangeText={setPlaylistName}
                        maxLength={50}
                    />
                    
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Description (optional)"
                        value={playlistDescription}
                        onChangeText={setPlaylistDescription}
                        multiline
                        numberOfLines={3}
                        maxLength={200}
                    />
                    
                    <TouchableOpacity
                        style={styles.privacyToggle}
                        onPress={() => setIsPrivate(!isPrivate)}
                    >
                        <Ionicons
                            name={isPrivate ? 'lock-closed' : 'lock-open'}
                            size={24}
                            color="#666"
                        />
                        <Text style={styles.privacyText}>
                            {isPrivate ? 'Private' : 'Public'} Playlist
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onClose}
                        >
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.submitButton]}
                            onPress={handleSubmit}
                        >
                            <Text style={[styles.buttonText, styles.submitButtonText]}>
                                {initialValues ? 'Save Changes' : 'Create Playlist'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export const PlaylistScreen: React.FC = () => {
    const navigation = useNavigation<PlaylistScreenNavigationProp>();
    const {
        playlists,
        isLoading,
        error,
        createNewPlaylist,
        loadPlaylists,
        deleteUserPlaylist,
        updateUserPlaylist
    } = usePlaylist();

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

    useEffect(() => {
        loadPlaylists();
    }, [loadPlaylists]);

    const handleCreatePlaylist = async (
        playlistName: string,
        playlistDescription: string,
        isPrivate: boolean
    ) => {
        const result = await createNewPlaylist(playlistName, playlistDescription, isPrivate);
        if ('code' in result) {
            Alert.alert('Error', result.message);
        } else {
            setIsCreateModalVisible(false);
        }
    };

    const handleEditPlaylist = async (
        playlistName: string,
        playlistDescription: string,
        isPrivate: boolean
    ) => {
        if (!editingPlaylist) return;

        const success = await updateUserPlaylist(editingPlaylist.id, {
            playlistName,
            playlistDescription,
            isPrivate
        });

        if (success) {
            setEditingPlaylist(null);
        } else {
            Alert.alert('Error', 'Failed to update playlist');
        }
    };

    const handleDeletePlaylist = (playlist: Playlist) => {
        Alert.alert(
            'Delete Playlist',
            `Are you sure you want to delete "${playlist.playlistName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await deleteUserPlaylist(playlist.id);
                        if (!success) {
                            Alert.alert('Error', 'Failed to delete playlist');
                        }
                    }
                }
            ]
        );
    };

    if (isLoading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={loadPlaylists}
                >
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.wrapper}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.title}>My Playlists</Text>
                </View>

                <FlatList
                    data={playlists}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <PlaylistItem
                            playlist={item}
                            onPress={() => navigation.navigate('PlaylistDetails', { playlist: item })}
                            onEdit={() => setEditingPlaylist(item)}
                            onDelete={() => handleDeletePlaylist(item)}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No playlists yet</Text>
                            <Text style={styles.emptySubtext}>
                                Create a playlist to save your favorite videos
                            </Text>
                        </View>
                    }
                />

                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => setIsCreateModalVisible(true)}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>

                <CreatePlaylistModal
                    visible={isCreateModalVisible}
                    onClose={() => setIsCreateModalVisible(false)}
                    onSubmit={handleCreatePlaylist}
                />

                <CreatePlaylistModal
                    visible={!!editingPlaylist}
                    onClose={() => setEditingPlaylist(null)}
                    onSubmit={handleEditPlaylist}
                    initialValues={editingPlaylist || undefined}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        paddingTop: 60,
        backgroundColor: '#fff'
    },
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    backButton: {
        padding: 8,
        marginRight: 16,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        elevation: 3,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#000',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    playlistItem: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    playlistInfo: {
        flex: 1
    },
    playlistName: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4
    },
    playlistDetails: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4
    },
    playlistDescription: {
        fontSize: 14,
        color: '#666'
    },
    playlistActions: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    actionButton: {
        padding: 8,
        marginLeft: 8
    },
    fab: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
    },
    modalContent: {
        width: '90%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 16,
        textAlign: 'center'
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        fontSize: 16
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top'
    },
    privacyToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16
    },
    privacyText: {
        marginLeft: 8,
        fontSize: 16,
        color: '#666'
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    button: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        marginHorizontal: 8
    },
    cancelButton: {
        backgroundColor: '#f2f2f2'
    },
    submitButton: {
        backgroundColor: '#007AFF'
    },
    buttonText: {
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '600'
    },
    submitButtonText: {
        color: '#fff'
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