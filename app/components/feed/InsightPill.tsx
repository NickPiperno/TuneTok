import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface InsightPillProps {
  narration?: string;
  isLoading?: boolean;
  sessionDuration: number; // in seconds
}

export const InsightPill: React.FC<InsightPillProps> = ({
  narration,
  isLoading = false,
  sessionDuration,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasEnoughData = sessionDuration >= 30;

  // Configure layout animation
  const configureAnimation = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        200,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
  };

  // Handle expansion toggle
  const handleToggleExpand = () => {
    configureAnimation();
    setIsExpanded(!isExpanded);
  };

  const renderContent = () => {
    console.log('InsightPill state:', {
      isLoading,
      hasEnoughData,
      hasNarration: !!narration,
      narrationLength: narration?.length,
      isExpanded
    });

    if (isLoading) {
      return <Text style={styles.loadingText}>Analyzing your music journey...</Text>;
    }

    if (!hasEnoughData) {
      return <Text style={styles.insufficientText}>Keep swiping for personalized insights!</Text>;
    }

    if (!narration) {
      return <Text style={styles.loadingText}>Generating your insights...</Text>;
    }

    if (isExpanded) {
      return (
        <ScrollView 
          style={styles.expandedContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.insightTitle}>Your Session Insights</Text>
          <Text style={styles.narrationText}>{narration}</Text>
        </ScrollView>
      );
    }

    return (
      <Text style={styles.collapsedText}>
        Your music journey insights are ready!
      </Text>
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handleToggleExpand}
      style={styles.touchable}
    >
      <Animated.View style={[
        styles.container,
        isExpanded ? styles.expandedContainer : styles.collapsedContainer
      ]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[
          styles.content,
          isExpanded && styles.expandedContentWrapper
        ]}>
          {renderContent()}
          <MaterialIcons
            name={isExpanded ? 'expand-less' : 'expand-more'}
            size={24}
            color="#fff"
            style={styles.icon}
          />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    position: 'absolute',
    top: 50,
    left: '15%',
    right: '15%',
    zIndex: 1000,
  },
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 350,
  },
  collapsedContainer: {
    height: 50,
  },
  expandedContainer: {
    height: 350,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  expandedContentWrapper: {
    alignItems: 'flex-start',
    paddingVertical: 16,
    height: '100%',
  },
  expandedContent: {
    flex: 1,
    paddingRight: 12,
    width: '100%',
  },
  insightTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  narrationText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  collapsedText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    fontStyle: 'italic',
    flex: 1,
  },
  insufficientText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  icon: {
    marginLeft: 8,
  },
}); 