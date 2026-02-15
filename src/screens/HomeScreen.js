/**
 * Orion Player 2.0 - Home Screen (Netflix Premium Style)
 * Cinematic Hero Banner + Horizontal Sections.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  FlatList,
  Dimensions,
  ImageBackground,
  StatusBar,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { getMovies, getChannels, getSeries, getHistory, clearInvalidSeriesCache, addToFavorites, removeFromFavorites, checkFavoriteStatus } from '../services/DatabaseService';
import { isCategoryLocked } from '../services/SettingsService';
import PinEntryModal from '../components/PinEntryModal';
import { syncLiveTV, syncMovies, syncSeries } from '../services/PlaylistService';
import { ORION_LOGO, BRAND } from '../constants/Branding';
import { isTV, fs } from '../constants/device';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.6;
const POSTER_WIDTH = 110;
const POSTER_HEIGHT = 165;
const CONTINUE_CARD_WIDTH = 160;
const CONTINUE_CARD_HEIGHT = 90;
const LOGO_SIZE = 80;
const CARD_GAP = 12;
const RAIL_PADDING = 20;

const SECURE_KEYS = {
  username: 'orion_xtream_username',
  password: 'orion_xtream_password',
  baseUrl: 'orion_xtream_base_url',
};

function getCredentials() {
  return Promise.all([
    SecureStore.getItemAsync(SECURE_KEYS.username),
    SecureStore.getItemAsync(SECURE_KEYS.password),
    SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
  ]).then(([username, password, baseUrl]) => ({
    username: username || '',
    password: password || '',
    baseUrl: baseUrl || '',
  }));
}

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim().replace(/\/+$/, '');
  return t.toLowerCase().startsWith('http') ? t : `http://${t}`;
}

function buildMovieUrl(cred, streamId, ext = 'mp4') {
  if (!cred?.baseUrl || !cred?.username || !cred?.password) return null;
  const base = normalizeBaseUrl(cred.baseUrl).replace(/\/+$/, '');
  return `${base}/movie/${cred.username}/${cred.password}/${streamId}.${ext}`;
}

function buildLiveUrl(cred, streamId) {
  if (!cred?.baseUrl || !cred?.username || !cred?.password) return null;
  const base = normalizeBaseUrl(cred.baseUrl).replace(/\/+$/, '');
  return `${base}/live/${cred.username}/${cred.password}/${streamId}.ts`;
}

function pickRandom(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ------------------- Section Header -------------------
function SectionHeader({ title, onSeeAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, isTV && { fontSize: fs(18, 26) }]}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ------------------- Horizontal Rail (Posters) -------------------
function PosterRail({ data, onPress, keyPrefix = 'rail' }) {
  if (!data?.length) return null;

  const renderItem = ({ item }) => {
    const poster = item.stream_icon ?? item.logo ?? item.cover ?? null;
    const id = item.stream_id ?? item.series_id ?? item.name ?? '';
    return (
      <TouchableOpacity
        style={styles.posterCard}
        onPress={() => onPress(item)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: poster || 'https://via.placeholder.com/110x165/1A1A1A/444444?text=?' }}
          style={styles.poster}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={data}
      horizontal
      nestedScrollEnabled
      keyExtractor={(item, index) => `${keyPrefix}-${item.stream_id ?? item.series_id ?? item.name ?? index}`}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.railContent}
      ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
    />
  );
}

// ------------------- Continue Watching Rail (with progress bars) -------------------
function ContinueWatchingRail({ data, onPress, keyPrefix = 'continue' }) {
  if (!data?.length) return null;

  const renderItem = ({ item }) => {
    const poster = item.stream_icon ?? item.cover ?? item.logo ?? null;
    const progress = item.duration > 0 ? item.position / item.duration : 0;
    const remaining = item.duration > 0 ? Math.floor((item.duration - item.position) / 60000) : 0;

    return (
      <TouchableOpacity
        style={styles.continueCard}
        onPress={() => onPress(item)}
        activeOpacity={0.85}
      >
        <ImageBackground
          source={{ uri: poster || 'https://via.placeholder.com/160x90/1A1A1A/444444?text=?' }}
          style={styles.continueBg}
          imageStyle={styles.continueImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.continueGradient}
          >
            <View style={styles.continuePlayIcon}>
              <Ionicons name="play" size={20} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </ImageBackground>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.continueTitle} numberOfLines={1}>{item.name}</Text>
        {remaining > 0 && (
          <Text style={styles.continueRemaining}>{remaining}m left</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={data}
      horizontal
      nestedScrollEnabled
      keyExtractor={(item, index) => `${keyPrefix}-${item.stream_id ?? index}`}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.railContent}
      ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
    />
  );
}

// ------------------- Horizontal Rail (Square Logos - Live TV) -------------------
function LogoRail({ data, onPress, onFavoritePress, favorites = {}, keyPrefix = 'logo' }) {
  if (!data?.length) return null;

  const renderItem = ({ item }) => {
    const logo = item.stream_icon ?? item.logo ?? null;
    const isFav = !!favorites[item.stream_id];
    return (
      <TouchableOpacity
        style={styles.logoCard}
        onPress={() => onPress(item)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: logo || 'https://via.placeholder.com/80/1A1A1A/444444?text=TV' }}
          style={styles.logo}
          resizeMode="contain"
        />
        {onFavoritePress && (
          <TouchableOpacity
            style={styles.logoFavBtn}
            onPress={(e) => { e?.stopPropagation?.(); onFavoritePress(item); }}
          >
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={18} color={isFav ? '#e74c3c' : "#FFFFFF"} />
          </TouchableOpacity>
        )}
        <Text style={styles.logoLabel} numberOfLines={1}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={data}
      horizontal
      nestedScrollEnabled
      keyExtractor={(item, index) => `${keyPrefix}-${item.stream_id ?? index}`}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.railContent}
      ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
    />
  );
}

// ------------------- Hero Section -------------------
function HeroSection({ featuredMovie, onPlay, onDetails }) {
  const cover = featuredMovie?.stream_icon ?? featuredMovie?.logo ?? featuredMovie?.cover ?? null;
  const title = featuredMovie?.name ?? 'Orion Player';

  return (
    <View style={[styles.heroContainer, { height: HERO_HEIGHT }]}>
      <ImageBackground
        source={{ uri: cover || 'https://via.placeholder.com/1200x800/1A1A1A/222222?text=Cinema' }}
        style={styles.heroBg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', 'rgba(15,15,15,0.5)', "#121212"]}
          locations={[0.3, 0.6, 1]}
          style={styles.heroGradient}
        >
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.heroButtons}>
              <TouchableOpacity style={styles.playBtn} onPress={onPlay} activeOpacity={0.9}>
                <Ionicons name="play" size={22} color="#000000" />
                <Text style={styles.playBtnText}>PLAY</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.detailsBtn} onPress={onDetails} activeOpacity={0.9}>
                <Ionicons name="information-circle" size={22} color="#FFFFFF" />
                <Text style={styles.detailsBtnText}>DETAILS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

// ------------------- Main Component -------------------
export default function HomeScreen({ navigation }) {
  const [featuredMovie, setFeaturedMovie] = useState(null);
  const [movies, setMovies] = useState([]);
  const [channels, setChannels] = useState([]);
  const [liveFavorites, setLiveFavorites] = useState({});
  const [series, setSeries] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCategory, setPinCategory] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Just load from database - no auto-sync (onboarding handles first-time)
      const [moviesList, channelsList, seriesList, historyList] = await Promise.all([
        getMovies(),
        getChannels(null, 'live'),
        getSeries(),
        getHistory(),
      ]);

      setMovies(moviesList ?? []);
      setChannels(channelsList ?? []);
      setSeries(seriesList ?? []);
      setContinueWatching(historyList ?? []);
      setFeaturedMovie(pickRandom(moviesList ?? []) ?? pickRandom(seriesList ?? []));
    } catch (e) {
      console.warn('[Home] loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Clean up any bad/empty series cache entries on startup
      clearInvalidSeriesCache().catch(() => {});
      loadData().catch((e) => console.warn('[Home] loadData error:', e));
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    if (!channels?.length) return;
    const slice = channels.slice(0, 24);
    Promise.all(
      slice.map((ch) =>
        ch.stream_id != null
          ? checkFavoriteStatus(ch.stream_id, 'live').then((ok) => ({ sid: ch.stream_id, ok: !!ok }))
          : null
      )
    ).then((results) => {
      const favs = {};
      results.filter(Boolean).forEach((r) => { favs[r.sid] = r.ok; });
      setLiveFavorites(favs);
    });
  }, [channels]);

  const handleLiveFavoritePress = useCallback(async (item) => {
    const sid = item.stream_id;
    if (sid == null) return;
    const isFav = liveFavorites[sid];
    const favItem = { stream_id: sid, name: item.name, stream_icon: item.stream_icon ?? item.logo };
    if (isFav) {
      await removeFromFavorites(sid, 'live');
      setLiveFavorites((prev) => ({ ...prev, [sid]: false }));
    } else {
      await addToFavorites(favItem, 'live');
      setLiveFavorites((prev) => ({ ...prev, [sid]: true }));
    }
  }, [liveFavorites]);

  const handlePress = async (item) => {
    const type = item.stream_type ?? item.type ?? (item.series_id != null ? 'series' : 'movie');
    const category = type === 'live' || type === 'radio' ? 'live' : type === 'series' ? 'series' : 'movies';
    const locked = await isCategoryLocked(category);
    const doNav = () => {
      if (type === 'live' || type === 'radio') {
        getCredentials().then((cred) => {
          const stream_url = item.stream_url ?? buildLiveUrl(cred, item.stream_id);
          const channelIdx = channels.findIndex((c) => (c.stream_id ?? c.id) === (item.stream_id ?? item.id));
          navigation.navigate('Player', {
            stream_id: item.stream_id,
            name: item.name,
            stream_url: stream_url || undefined,
            type,
            cover: item.logo ?? item.stream_icon,
            ...(type === 'live' && channels?.length > 0 && { channelList: channels, currentChannelIndex: channelIdx >= 0 ? channelIdx : 0 }),
          });
        });
      } else {
        navigation.navigate('ContentDetails', { item: { ...item, stream_icon: item.stream_icon ?? item.logo ?? item.cover, type: item.series_id != null ? 'series' : 'movie' } });
      }
    };
    if (locked) {
      setPinCategory(category);
      setPendingAction(doNav);
      setShowPinModal(true);
    } else {
      doNav();
    }
  };

  const handlePinVerify = async (pin) => {
    const { verifyContentPin } = await import('../services/SettingsService');
    return !!await verifyContentPin(pin);
  };

  const handlePinSuccess = () => {
    setShowPinModal(false);
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  };

  // Handle Continue Watching - resume directly to player
  const handleContinuePress = async (item) => {
    const type = item.type ?? 'movie';
    const cred = await getCredentials();

    if (type === 'series') {
      // For series, go to details (we'd need episode info to resume properly)
      navigation.navigate('ContentDetails', {
        item: {
          ...item,
          stream_icon: item.stream_icon ?? item.cover,
          type: 'series',
        },
      });
    } else {
      // For movies, resume directly with startTime
      const stream_url = buildMovieUrl(cred, item.stream_id, item.container_extension ?? 'mp4');
      navigation.navigate('Player', {
        stream_id: item.stream_id,
        name: item.name,
        stream_url: stream_url || undefined,
        type: 'movie',
        cover: item.stream_icon,
        extension: item.container_extension ?? 'mp4',
        startTime: item.position ?? 0, // Resume from saved position
      });
    }
  };

  const handleHeroPlay = async () => {
    if (!featuredMovie) return;
    const type = featuredMovie.series_id != null ? 'series' : 'movie';
    if (type === 'movie') {
      const cred = await getCredentials();
      const stream_url = buildMovieUrl(cred, featuredMovie.stream_id, featuredMovie.container_extension);
      navigation.navigate('Player', {
        stream_id: featuredMovie.stream_id,
        name: featuredMovie.name,
        stream_url: stream_url || undefined,
        type: 'movie',
        cover: featuredMovie.stream_icon,
      });
    } else {
      navigation.navigate('ContentDetails', {
        item: { ...featuredMovie, stream_icon: featuredMovie.cover ?? featuredMovie.stream_icon, type: 'series' },
      });
    }
  };

  const handleHeroDetails = () => {
    if (!featuredMovie) return;
    const type = featuredMovie.series_id != null ? 'series' : 'movie';
    navigation.navigate('ContentDetails', {
      item: {
        ...featuredMovie,
        stream_icon: featuredMovie.stream_icon ?? featuredMovie.cover ?? featuredMovie.logo,
        type,
      },
    });
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightRow}>
          <TouchableOpacity onPress={() => navigation.navigate('GameHub')} style={styles.headerIconBtn}>
            <Ionicons name="game-controller" size={26} color="#FFD700" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Search')} style={styles.headerIconBtn}>
            <Ionicons name="search-outline" size={26} color="#FFD700" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.headerIconBtn}>
            <Ionicons name="settings-outline" size={26} color="#FFD700" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#121212" }]}>
      <StatusBar barStyle="light-content" />
      <PinEntryModal
        visible={showPinModal}
        category={pinCategory}
        onVerify={handlePinVerify}
        onSuccess={handlePinSuccess}
        onCancel={() => { setShowPinModal(false); setPendingAction(null); }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        <View style={styles.homeBrandStrip}>
          <Image source={ORION_LOGO} style={styles.homeBrandLogo} resizeMode="contain" />
          <Text style={styles.homeBrandTagline} numberOfLines={2}>{BRAND.tagline}</Text>
        </View>
        <HeroSection
          featuredMovie={featuredMovie}
          onPlay={handleHeroPlay}
          onDetails={handleHeroDetails}
        />

        {/* Continue Watching - only show if there's history */}
        {continueWatching.length > 0 && (
          <View style={styles.railSection}>
            <SectionHeader title="Continue Watching" />
            <ContinueWatchingRail 
              data={continueWatching} 
              onPress={handleContinuePress} 
              keyPrefix="continue" 
            />
          </View>
        )}

        <View style={styles.railSection}>
          <SectionHeader title="Live TV" onSeeAll={() => navigation.navigate('LiveTV')} />
          <LogoRail data={channels.slice(0, 12)} onPress={handlePress} onFavoritePress={handleLiveFavoritePress} favorites={liveFavorites} keyPrefix="live" />
        </View>

        <View style={styles.railSection}>
          <SectionHeader title="New Movies" onSeeAll={() => navigation.navigate('VodCategory')} />
          <PosterRail data={movies.slice(0, 15)} onPress={handlePress} keyPrefix="movies" />
        </View>

        <View style={styles.railSection}>
          <SectionHeader title="Series" onSeeAll={() => navigation.navigate('Series')} />
          <PosterRail data={series.slice(0, 15)} onPress={handlePress} keyPrefix="series" />
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        {isTV ? (
          <>
            <FocusablePressable style={styles.bottomNavBtn} onPress={() => navigation.navigate('Home')} focusedStyle={styles.bottomNavBtnFocused}>
              <Ionicons name="home" size={28} color="#FFD700" />
              <Text style={[styles.bottomNavLabel, { fontSize: fs(12, 20) }]}>Home</Text>
            </FocusablePressable>
            <FocusablePressable style={styles.bottomNavBtn} onPress={() => navigation.navigate('Radio')} focusedStyle={styles.bottomNavBtnFocused}>
              <Ionicons name="radio" size={28} color="#888888" />
              <Text style={[styles.bottomNavLabelSec, { fontSize: fs(12, 16) }]}>Radio</Text>
            </FocusablePressable>
            <FocusablePressable style={styles.bottomNavBtn} onPress={() => navigation.navigate('Search')} focusedStyle={styles.bottomNavBtnFocused}>
              <Ionicons name="search-outline" size={28} color="#888888" />
              <Text style={[styles.bottomNavLabelSec, { fontSize: fs(12, 20) }]}>Search</Text>
            </FocusablePressable>
            <FocusablePressable style={styles.bottomNavBtn} onPress={() => navigation.navigate('Favorites')} focusedStyle={styles.bottomNavBtnFocused}>
              <Ionicons name="heart-outline" size={28} color="#888888" />
              <Text style={[styles.bottomNavLabelSec, { fontSize: fs(12, 16) }]}>Favorites</Text>
            </FocusablePressable>
            <FocusablePressable style={styles.bottomNavBtn} onPress={() => navigation.navigate('Settings')} focusedStyle={styles.bottomNavBtnFocused}>
              <Ionicons name="settings-outline" size={28} color="#888888" />
              <Text style={[styles.bottomNavLabelSec, { fontSize: fs(12, 20) }]}>Settings</Text>
            </FocusablePressable>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.bottomNavBtn} onPress={() => navigation.navigate('Home')}>
              <Ionicons name="home" size={24} color="#FFD700" />
              <Text style={styles.bottomNavLabel}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomNavBtn} onPress={() => navigation.navigate('Radio')}>
              <Ionicons name="radio" size={24} color="#888888" />
              <Text style={styles.bottomNavLabelSec}>Radio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomNavBtn} onPress={() => navigation.navigate('Search')}>
              <Ionicons name="search-outline" size={24} color="#888888" />
              <Text style={styles.bottomNavLabelSec}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomNavBtn} onPress={() => navigation.navigate('Favorites')}>
              <Ionicons name="heart-outline" size={24} color="#888888" />
              <Text style={styles.bottomNavLabelSec}>Favorites</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomNavBtn} onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="settings-outline" size={24} color="#888888" />
              <Text style={styles.bottomNavLabelSec}>Settings</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: "#FFD700", marginTop: 12, fontSize: 16 },
  scroll: { flex: 1 },
  content: { paddingBottom: 100 },
  homeBrandStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: RAIL_PADDING,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.15)',
  },
  homeBrandLogo: { width: 40, height: 40 },
  homeBrandTagline: { flex: 1, fontSize: 11, color: "#888888", fontStyle: 'italic' },
  heroContainer: { width: SCREEN_WIDTH },
  heroBg: { flex: 1, justifyContent: 'flex-end' },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: RAIL_PADDING,
    paddingBottom: 40,
  },
  heroContent: {},
  heroTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: "#FFFFFF",
    marginBottom: 18,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    letterSpacing: 0.5,
  },
  heroButtons: { flexDirection: 'row', gap: 12 },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 6,
    gap: 10,
  },
  playBtnText: { fontSize: 16, fontWeight: 'bold', color: "#000000" },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.6)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    gap: 8,
  },
  detailsBtnText: { fontSize: 16, fontWeight: '600', color: "#FFFFFF" },
  railSection: { marginTop: 32 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: RAIL_PADDING,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: "#FFD700", letterSpacing: 0.5 },
  seeAllText: { fontSize: 14, color: "#FFD700", fontWeight: '600' },
  railContent: { paddingHorizontal: RAIL_PADDING, paddingRight: RAIL_PADDING + 20 },
  posterCard: {},
  poster: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 10 },
  logoCard: {
    width: LOGO_SIZE + 20,
    alignItems: 'center',
    position: 'relative',
  },
  logoFavBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 10,
    backgroundColor: "#1A1A1A",
  },
  logoLabel: {
    color: "#CCCCCC",
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    width: LOGO_SIZE + 20,
  },
  // Continue Watching styles
  continueCard: {
    width: CONTINUE_CARD_WIDTH,
  },
  continueBg: {
    width: CONTINUE_CARD_WIDTH,
    height: CONTINUE_CARD_HEIGHT,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: 'hidden',
  },
  continueImage: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  continueGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continuePlayIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  progressBarBg: {
    height: 3,
    backgroundColor: "#333333",
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E50914', // Netflix red
  },
  continueTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  continueRemaining: {
    color: "#888888",
    fontSize: 11,
    marginTop: 2,
  },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  headerIconBtn: { marginLeft: 12, padding: 4 },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 28,
    backgroundColor: "#121212",
    borderTopWidth: 1,
    borderTopColor: "#222222",
  },
  bottomNavBtn: { alignItems: 'center' },
  bottomNavBtnFocused: { borderColor: "#FFD700", borderWidth: 2, borderRadius: 8, backgroundColor: 'rgba(255,215,0,0.12)' },
  bottomNavLabel: { fontSize: 11, color: "#FFD700", marginTop: 4 },
  bottomNavLabelSec: { fontSize: 11, color: "#888888", marginTop: 4 },
});