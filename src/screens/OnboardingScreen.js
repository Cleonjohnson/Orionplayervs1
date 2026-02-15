/**
 * Orion Player 2.0 - Onboarding Screen
 * First-time setup wizard with progress tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';
import { syncAllContentWithProgress } from '../services/PlaylistService';

// Black color inlined where needed to avoid undefined constant

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SECURE_KEYS = {
  username: 'orion_xtream_username',
  password: 'orion_xtream_password',
  baseUrl: 'orion_xtream_base_url',
  onboardingComplete: 'orion_onboarding_complete',
};

export default function OnboardingScreen({ navigation, route }) {
  const [step, setStep] = useState('welcome'); // welcome, syncing, complete, error
  const [currentTask, setCurrentTask] = useState('');
  const [progress, setProgress] = useState({
    live: { status: 'pending', count: 0, message: '' },
    movies: { status: 'pending', count: 0, message: '' },
    series: { status: 'pending', count: 0, message: '' },
    epg: { status: 'pending', count: 0, message: '' },
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const startSync = async () => {
    setStep('syncing');
    setErrorMessage('');

    try {
      // Get credentials
      const [username, password, baseUrl] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEYS.username),
        SecureStore.getItemAsync(SECURE_KEYS.password),
        SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
      ]);

      if (!username || !password || !baseUrl) {
        throw new Error('Missing credentials. Please log in again.');
      }

      const cred = { username, password, baseUrl };

      // Progress callback
      const handleProgress = (type, current, total, message) => {
        console.log(`[Onboarding] ${type}: ${message}`);
        setCurrentTask(message);
        setProgress((prev) => ({
          ...prev,
          [type]: {
            status: current >= total ? 'complete' : 'loading',
            count: type === 'live' || type === 'movies' || type === 'series' || type === 'epg' 
              ? parseInt(message.match(/\d+/)?.[0] || 0) 
              : 0,
            message,
          },
        }));

        // Animate progress bar
        Animated.timing(progressAnim, {
          toValue: (current / total) * 100,
          duration: 300,
          useNativeDriver: false,
        }).start();
      };

      // Run sync with timeout protection (60s max)
      const syncPromise = syncAllContentWithProgress(cred, handleProgress);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sync timeout (60s)')), 60000)
      );

      const result = await Promise.race([syncPromise, timeoutPromise]);

      if (result.success) {
        // Mark all as complete
        setProgress((prev) => ({
          live: { ...prev.live, status: 'complete' },
          movies: { ...prev.movies, status: 'complete' },
          series: { ...prev.series, status: 'complete' },
          epg: { ...prev.epg, status: 'complete' },
        }));
        setStep('complete');
        
        // Mark onboarding as complete
        await SecureStore.setItemAsync(SECURE_KEYS.onboardingComplete, 'true');
        
        // Auto-navigate after 2s
        setTimeout(() => {
          if (navigation?.reset) {
            navigation.reset({ index: 0, routes: [{ name: 'Hub' }] });
          }
        }, 2000);
      } else {
        throw new Error(result.errors?.join(', ') || 'Sync failed');
      }
    } catch (err) {
      console.error('[Onboarding] Sync error:', err);
      setErrorMessage(err?.message || 'Failed to sync content');
      setStep('error');
    }
  };

  const handleRetry = () => {
    setRetryCount(retryCount + 1);
    setProgress({
      live: { status: 'pending', count: 0, message: '' },
      movies: { status: 'pending', count: 0, message: '' },
      series: { status: 'pending', count: 0, message: '' },
      epg: { status: 'pending', count: 0, message: '' },
    });
    startSync();
  };

  const handleSkip = async () => {
    await SecureStore.setItemAsync(SECURE_KEYS.onboardingComplete, 'true');
    if (navigation?.reset) {
      navigation.reset({ index: 0, routes: [{ name: 'Hub' }] });
    }
  };

  const renderWelcome = () => (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={["#FFD700", "#FFA500"]}
          style={styles.iconGradient}
        >
          <Ionicons name="rocket" size={80} color="#FFFFFF" />
        </LinearGradient>
      </View>

      <Text style={styles.title}>Welcome to Orion Player 2.0</Text>
      <Text style={styles.subtitle}>
        Let's set up your content library
      </Text>

      <View style={styles.featureList}>
        <View style={styles.featureItem}>
          <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
          <Text style={styles.featureText}>Sync Live TV channels</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
          <Text style={styles.featureText}>Load your movie library</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
          <Text style={styles.featureText}>Import series collection</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
          <Text style={styles.featureText}>Download TV guide (EPG)</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={startSync}>
        <LinearGradient
          colors={["#FFD700", "#FFA500"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.startButtonGradient}
        >
          <Text style={styles.startButtonText}>Start Setup</Text>
          <Ionicons name="arrow-forward" size={22} color="#000000" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderSyncing = () => {
    const tasks = [
      { key: 'live', icon: 'tv', label: 'Live TV Channels' },
      { key: 'movies', icon: 'film', label: 'Movies' },
      { key: 'series', icon: 'albums', label: 'Series' },
      { key: 'epg', icon: 'calendar', label: 'TV Guide' },
    ];

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Setting Up Your Library</Text>
        <Text style={styles.currentTask}>{currentTask}</Text>

        <View style={styles.taskList}>
          {tasks.map((task) => {
            const taskProgress = progress[task.key];
            const isLoading = taskProgress.status === 'loading';
            const isComplete = taskProgress.status === 'complete';

            return (
              <View key={task.key} style={styles.taskItem}>
                <View style={styles.taskLeft}>
                  {isComplete ? (
                    <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                  ) : isLoading ? (
                    <ActivityIndicator size="small" color="#FFD700" />
                  ) : (
                    <Ionicons name={task.icon} size={28} color="#555555" />
                  )}
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskLabel, isComplete && styles.taskLabelComplete]}>
                      {task.label}
                    </Text>
                    {taskProgress.count > 0 && (
                      <Text style={styles.taskCount}>
                        {taskProgress.count} {task.key === 'epg' ? 'channels' : 'items'}
                      </Text>
                    )}
                  </View>
                </View>
                {isLoading && (
                  <View style={styles.taskProgress}>
                    <View style={styles.taskProgressBar}>
                      <View style={[styles.taskProgressFill, { width: '60%' }]} />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.loadingFooter}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>This may take a minute...</Text>
        </View>
      </View>
    );
  };

  const renderComplete = () => {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={100} color="#4CAF50" />
        </View>

        <Text style={styles.title}>Setup Complete!</Text>
        <Text style={styles.subtitle}>Your library is ready</Text>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{progress.live.count}</Text>
            <Text style={styles.statLabel}>Channels</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{progress.movies.count}</Text>
            <Text style={styles.statLabel}>Movies</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{progress.series.count}</Text>
            <Text style={styles.statLabel}>Series</Text>
          </View>
        </View>

        <Text style={styles.redirectText}>Taking you to home...</Text>
      </Animated.View>
    );
  };

  const renderError = () => (
    <View style={styles.container}>
      <View style={styles.errorIcon}>
        <Ionicons name="alert-circle" size={100} color="#F44336" />
      </View>

      <Text style={styles.title}>Setup Failed</Text>
      <Text style={styles.errorText}>{errorMessage}</Text>

      <View style={styles.errorButtons}>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButtonAlt} onPress={handleSkip}>
          <Text style={styles.skipButtonAltText}>Skip for now</Text>
        </TouchableOpacity>
      </View>

      {retryCount > 0 && (
        <Text style={styles.retryCount}>Retry attempt: {retryCount}</Text>
      )}
    </View>
  );

  return (
    <LinearGradient colors={["#121212", "#1E1E1E", "#121212"]} style={styles.screen}>
      {step === 'welcome' && renderWelcome()}
      {step === 'syncing' && renderSyncing()}
      {step === 'complete' && renderComplete()}
      {step === 'error' && renderError()}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 500,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 30,
  },
  iconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    // Removed 'l_d_d: 10' as it appears to be a typo or invalid style property
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: "#FFFFFF",
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: "#AAAAAA",
    marginBottom: 40,
    textAlign: 'center',
  },
  featureList: {
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 16,
    color: "#FFFFFF",
    marginLeft: 12,
  },
  startButton: {
    width: '100%',
    marginBottom: 20,
  },
  startButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#000000",
    marginRight: 8,
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    color: "#888888",
    textDecorationLine: 'underline',
  },
  currentTask: {
    fontSize: 14,
    color: "#FFD700",
    marginBottom: 30,
    textAlign: 'center',
    minHeight: 20,
  },
  taskList: {
    width: '100%',
    marginBottom: 40,
  },
  taskItem: {
    backgroundColor: "#1E1E1E",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#333333",
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskInfo: {
    marginLeft: 12,
    flex: 1,
  },
  taskLabel: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  taskLabelComplete: {
    color: "#4CAF50",
  },
  taskCount: {
    fontSize: 13,
    color: "#FFD700",
  },
  taskProgress: {
    marginTop: 8,
  },
  taskProgressBar: {
    height: 4,
    backgroundColor: "#333333",
    borderRadius: 2,
    overflow: 'hidden',
  },
  taskProgressFill: {
    height: '100%',
    backgroundColor: "#FFD700",
  },
  loadingFooter: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: "#888888",
    marginTop: 12,
  },
  successIcon: {
    marginBottom: 30,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 30,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: "#FFD700",
  },
  statLabel: {
    fontSize: 14,
    color: "#AAAAAA",
    marginTop: 4,
  },
  redirectText: {
    fontSize: 14,
    color: "#888888",
    marginTop: 20,
  },
  errorIcon: {
    marginBottom: 30,
  },
  errorText: {
    fontSize: 14,
    color: "#AAAAAA",
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  errorButtons: {
    width: '100%',
  },
  retryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: "#FFD700",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: "#000000",
    marginLeft: 8,
  },
  skipButtonAlt: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#555555",
  },
  skipButtonAltText: {
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: 'center',
  },
  retryCount: {
    fontSize: 12,
    color: "#666666",
    marginTop: 16,
  },
});