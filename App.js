import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, LogBox, Image, ScrollView, Platform } from 'react-native';
import TouchableOpacity from './src/components/TouchableOpacity';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { isTV, KEY_DEVICE, KEY_DEVICE_SELECTED } from './src/constants/device';

// Import Screens (Make sure these paths match your files!)
import DeviceSelectScreen from './src/screens/DeviceSelectScreen';
import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import LiveTVScreen from './src/screens/LiveTVScreen';
import ChannelListScreen from './src/screens/ChannelListScreen';
import VodCategoryScreen from './src/screens/VodCategoryScreen';
import SeriesCategoryScreen from './src/screens/SeriesCategoryScreen';
import MovieListScreen from './src/screens/MovieListScreen';
import SeriesListScreen from './src/screens/SeriesListScreen';
import SeriesDetailsScreen from './src/screens/SeriesDetailsScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import UniversalPlayer from './src/screens/UniversalPlayer';
import VideoPlayerScreen from './src/screens/VideoPlayerScreen';
import MovieDetailsScreen from './src/screens/MovieDetailsScreen';
import ContentDetailsScreen from './src/screens/ContentDetailsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SearchScreen from './src/screens/SearchScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import RadioScreen from './src/screens/RadioScreen';
import EPGScreen from './src/screens/EPGScreen';
import TVGuideScreen from './src/screens/TVGuideScreen';
import AgreementScreen from './src/screens/AgreementScreen';
import HubScreen from './src/screens/HubScreen';
import GameHubScreen from './src/screens/GameHubScreen';
import KingTuffheadGameScreen from './src/screens/KingTuffheadGameScreen';
import CharadesMenuScreen from './src/screens/CharadesMenuScreen';
import CharadesGameScreen from './src/screens/CharadesGameScreen';
import BorderControlScreen from './src/screens/BorderControlScreen';
import PolitricksScreen from './src/screens/PolitricksScreen';
import YardieHustleScreen from './src/screens/YardieHustleScreen';

// Import Database Helper (to wake it up early)
import { initDB, getCategories } from './src/services/DatabaseService';
import { smartEpgSync } from './src/services/BackgroundSyncService';
import { initAudioMode, refreshSfxEnabled, refreshSfxVolume } from './src/services/SoundService';
import { getAppTheme } from './src/services/ThemeService';
import { registerForPushNotificationsAsync, setupNotificationListeners } from './src/services/NotificationService';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { checkAndApplyOnLoad } from './src/services/UpdateService';
import FloatingRadioPlayer from './src/components/FloatingRadioPlayer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensionsCompat } from './src/theme/useWindowDimensionsCompat';
import { ORION_LOGO } from './src/constants/Branding';
// Fallback logo source — avoid static require to missing asset (prevents bundler errors).
// If no branding image is provided, leave source null and SafeImage will show fallbackText.
const LOADING_LOGO_SOURCE = ORION_LOGO || null;

// Default background color used during loading/error screens
const BG = '#0f0f0f';

// Ignore minor warnings to keep screen clean
LogBox.ignoreLogs(['new NativeEventEmitter', 'stmt.runSync']);

const HIDE_RADIO_ROUTES = [
  'Player',
  'UniversalPlayer',
  'VideoPlayer',
  'GameHub',
  'CharadesGame',
  'BorderControl',
  'Politricks',
  'YardieHustle',
  'KingTuffhead',
];

const Stack = createStackNavigator();

class AppErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[App] ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const errMsg = err?.message || String(err);
      const errStack = err?.stack || '';
      return (
        <View style={styles.errorContainer}>
          <SafeImage source={LOADING_LOGO_SOURCE} style={styles.loadingLogo} fallbackText="ORION" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorSub}>The app hit an error during startup.</Text>
          <ScrollView style={styles.errorScroll} nestedScrollEnabled>
            <Text style={styles.errorDetail}>{errMsg}</Text>
            {errStack ? <Text style={styles.errorStack}>{errStack}</Text> : null}
          </ScrollView>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.errorButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function SafeImage({ source, style }) {
  const [failed, setFailed] = useState(false);
  // If no source or failed to load, show simple text fallback so bundler doesn't require missing assets.
  if (!source || failed) {
    return <Text style={[style, { color: '#FFF', textAlign: 'center' }]}>ORION</Text>;
  }
  return (
    <Image
      source={source}
      style={style}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

function AppContent() {
  const { accent } = useTheme();
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('DeviceSelect');
  const [currentRouteName, setCurrentRouteName] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const navRef = useRef(null);

  const onNavStateChange = useCallback((state) => {
    if (!state?.routes?.[state.index]) return;
    const route = state.routes[state.index];
    const name = route.state?.routes?.[route.state.index]?.name ?? route.name;
    setCurrentRouteName(name);
  }, []);

  // Window dimensions and safe area hooks must be called unconditionally
  // (fixes "Rendered more hooks than during the previous render" runtime error).
  const { width: windowWidth } = useWindowDimensionsCompat();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;
    const INIT_DELAY_MS = 1200;

    const prepareApp = async () => {
      try {
        console.log('[App] Starting System Check...');
        // Keep startup minimal so app always opens; defer heavy init to background
        try {
          await getAppTheme();
        } catch (e) {
          console.warn('[App] getAppTheme failed:', e);
        }
        if (isTV) {
          await AsyncStorage.setItem(KEY_DEVICE, 'tv').catch(() => {});
          await AsyncStorage.setItem(KEY_DEVICE_SELECTED, 'true').catch(() => {});
          setInitialRoute('Login');
        } else {
          const deviceSelected = await AsyncStorage.getItem(KEY_DEVICE_SELECTED).catch(() => null);
          setInitialRoute(deviceSelected === 'true' ? 'Login' : 'DeviceSelect');
        }

        // Run DB and sound init in background so they never block or crash the gate
        (async () => {
          try {
            await initDB();
            await getCategories('live');
          } catch (e) {
            console.warn('[App] DB init failed:', e);
          }
          try {
            await initAudioMode();
            await refreshSfxEnabled();
            await refreshSfxVolume();
          } catch (e) {
            console.warn('[App] Sound init failed:', e);
          }
        })();

        // Defer Audio + push so they never block or crash the opening gate (TV/boxes without Play Services)
        setTimeout(async () => {
          if (cancelled) return;
          try {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              staysActiveInBackground: true,
              playsInSilentModeIOS: true,
              shouldDuckAndroid: true,
              playThroughEarpieceAndroid: false,
            });
          } catch (e) {
            console.log('Audio init failed', e);
          }
          try {
            const token = await registerForPushNotificationsAsync();
            if (!cancelled) setPushEnabled(!!token);
          } catch (e) {
            console.log('Push init failed', e);
          }
          smartEpgSync({ force: false }).catch((e) => console.warn('[App] Background sync error:', e));
          checkAndApplyOnLoad().catch((e) => console.warn('[App] OTA check error:', e));
        }, 0);
      } catch (e) {
        console.warn('[App] Global Error:', e);
      } finally {
        setTimeout(() => {
          if (!cancelled) {
            console.log('[App] System Check Complete. Opening Gates.');
            setIsReady(true);
          }
        }, INIT_DELAY_MS);
      }
    };

    prepareApp();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isReady || !pushEnabled || !navRef.current) return;
    const cleanup = setupNotificationListeners(navRef);
    return cleanup;
  }, [isReady, pushEnabled]);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <SafeImage source={LOADING_LOGO_SOURCE} style={[styles.loadingLogo, isTV && { width: 260, height: 114 }]} fallbackText="ORION" />
        <ActivityIndicator size="large" color={accent} style={{ marginTop: 24 }} />
        <Text style={[styles.loadingText, { color: accent }, isTV && { fontSize: 28 }]}>Orion Entertainment Hub</Text>
        <Text style={[styles.subText, isTV && { fontSize: 18, color: '#888' }]}>Initializing System...</Text>
      </View>
    );
  }

  const showRadio = currentRouteName == null || !HIDE_RADIO_ROUTES.includes(currentRouteName);
  const isNarrow = windowWidth < 520; // match FloatingRadioPlayer NARROW_WIDTH
  const baseHeight = isNarrow ? 92 : 56;
  const safeBottom = Math.max(insets.bottom || 0, Platform.OS === 'android' ? 10 : 0);
  const radioBarHeight = baseHeight + safeBottom;
  const reservedBottom = showRadio ? Math.ceil(radioBarHeight + 12) : 0; // add small padding

  return (
      <View style={{ flex: 1, paddingBottom: reservedBottom }}>
        <NavigationContainer ref={navRef} onStateChange={onNavStateChange}>
          <StatusBar style="light" />
          <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerStyle: { backgroundColor: '#0f0f0f' },
            headerTintColor: accent,
            headerTitleStyle: { fontWeight: 'bold', ...(isTV && { fontSize: 26 }) },
            cardStyle: { backgroundColor: '#0f0f0f' },
          }}
        >
          <Stack.Screen name="DeviceSelect" component={DeviceSelectScreen} options={{ title: 'Choose Device', headerShown: true }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Agreement" component={AgreementScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Hub" component={HubScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'IPTV' }} />
          <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
          <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'My List' }} />
          <Stack.Screen name="LiveTV" component={LiveTVScreen} options={{ title: 'Live Channels' }} />
          <Stack.Screen name="Radio" component={RadioScreen} options={{ title: 'Radio' }} />
          <Stack.Screen
            name="ChannelList"
            component={ChannelListScreen}
            options={({ route }) => ({ title: route.params?.category_name || 'Channels' })}
          />
          <Stack.Screen name="Movies" component={VodCategoryScreen} options={{ title: 'Movies' }} />
          <Stack.Screen name="VodCategory" component={VodCategoryScreen} options={{ title: 'Movie Categories' }} />
          <Stack.Screen name="VodList" component={MovieListScreen} options={({ route }) => ({ title: route.params?.category_name || 'Movies' })} />
          <Stack.Screen name="Series" component={SeriesCategoryScreen} options={{ title: 'Series' }} />
          <Stack.Screen name="MovieList" component={MovieListScreen} options={({ route }) => ({ title: route.params?.category_name || 'Movies' })} />
          <Stack.Screen name="SeriesList" component={SeriesListScreen} options={({ route }) => ({ title: route.params?.category_name || 'Series' })} />
          <Stack.Screen name="SeriesDetails" component={SeriesDetailsScreen} options={({ route }) => ({ title: route.params?.name || 'Series' })} />
          <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} options={({ route }) => ({ title: route.params?.name || 'Movie' })} />
          <Stack.Screen name="ContentDetails" component={ContentDetailsScreen} options={{ title: '', headerTransparent: true, headerTintColor: '#fff' }} />
          <Stack.Screen name="Player" component={PlayerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EPG" component={EPGScreen} options={({ route }) => ({ title: route.params?.channel_name || 'Program Guide' })} />
          <Stack.Screen name="TVGuide" component={TVGuideScreen} options={{ title: 'TV Guide' }} />
          <Stack.Screen name="UniversalPlayer" component={UniversalPlayer} options={{ headerShown: false }} />
          <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          <Stack.Screen name="GameHub" component={GameHubScreen} options={{ title: 'GameHub', headerShown: false }} />
          <Stack.Screen name="CharadesMenu" component={CharadesMenuScreen} options={{ title: 'JamRock Charades' }} />
          <Stack.Screen name="CharadesGame" component={CharadesGameScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BorderControl" component={BorderControlScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Politricks" component={PolitricksScreen} options={{ headerShown: false }} />
          <Stack.Screen name="YardieHustle" component={YardieHustleScreen} options={{ headerShown: false }} />
          <Stack.Screen name="KingTuffhead" component={KingTuffheadGameScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
        <FloatingRadioPlayer visible={showRadio} />
      </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <AppContent />
        </AppErrorBoundary>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 200,
    height: 88,
  },
  loadingText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  },
  subText: {
    color: '#666',
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorScroll: {
    maxHeight: 200,
    alignSelf: 'stretch',
    marginHorizontal: 24,
    marginBottom: 16,
  },
  errorDetail: {
    fontSize: 12,
    color: '#FF6B6B',
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 10,
    color: '#666',
  },
  errorButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});