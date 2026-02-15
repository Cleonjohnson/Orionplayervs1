/**
 * Orion Player 2.0 - Channel List (by category)
 * List vs Grid view toggle; navigates to Player (Ultimate Player) for Live/Radio.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getChannels, addToFavorites, removeFromFavorites, checkFavoriteStatus } from '../services/DatabaseService';
import { isCategoryLocked, verifyContentPin, getLockLive, setLockLive, getLockMovies, setLockMovies, getLockSeries, setLockSeries } from '../services/SettingsService';
import PinEntryModal from '../components/PinEntryModal';

const SECURE_KEYS = {
  username: 'orion_xtream_username',
  password: 'orion_xtream_password',
  baseUrl: 'orion_xtream_base_url',
};

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim().replace(/\/+$/, '');
  return t.toLowerCase().startsWith('http') ? t : `http://${t}`;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLS_GRID = 4;
const GAP = 8;
const PADDING = 16;
const POSTER_SIZE = (SCREEN_WIDTH - PADDING * 2 - GAP * (COLS_GRID - 1)) / COLS_GRID;
const POSTER_HEIGHT = POSTER_SIZE * 1.2;

export default function ChannelListScreen({ route, navigation }) {
  const { category_id, category_name, streamType = 'live' } = route.params || {};
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [favorites, setFavorites] = useState({}); // stream_id -> true
  const [showPinModal, setShowPinModal] = useState(false);
  const pendingPressRef = React.useRef(null);
  const [categoryLocked, setCategoryLocked] = useState(false);
  const [showLockAuthPrompt, setShowLockAuthPrompt] = useState(false);

  useEffect(() => {
    loadChannels();
  }, [category_id, streamType]);

  useEffect(() => {
    if (streamType !== 'live' || !channels.length) return;
    channels.forEach((item) => {
      const sid = item.stream_id;
      if (sid == null) return;
      checkFavoriteStatus(sid, 'live').then((ok) => {
        setFavorites((prev) => ({ ...prev, [sid]: !!ok }));
      });
    });
  }, [streamType, channels]);

  const handleFavoritePress = async (e, item) => {
    e?.stopPropagation?.();
    const sid = item.stream_id;
    if (sid == null) return;
    const isFav = favorites[sid];
    const icon = item.stream_icon ?? item.logo;
    const favItem = { stream_id: sid, name: item.name, stream_icon: icon };
    if (isFav) {
      await removeFromFavorites(sid, 'live');
      setFavorites((prev) => ({ ...prev, [sid]: false }));
    } else {
      await addToFavorites(favItem, 'live');
      setFavorites((prev) => ({ ...prev, [sid]: true }));
    }
  };

  const loadChannels = async () => {
    setLoading(true);
    const data = await getChannels(category_id || 'all', streamType);
    setChannels(data || []);
    setLoading(false);
  };

  const handlePress = async (item) => {
    const type = item.stream_type || (category_id === 'movie' ? 'movie' : 'live');
    const category = type === 'movie' ? 'movies' : 'live';
    const locked = await isCategoryLocked(category);
    const doPress = async (clickedItem, channelIdx) => {
      const target = clickedItem;
      let stream_url = target.stream_url || null;
      if (type !== 'radio' && !stream_url) {
        try {
          const [user, pass, baseUrl] = await Promise.all([
            SecureStore.getItemAsync(SECURE_KEYS.username),
            SecureStore.getItemAsync(SECURE_KEYS.password),
            SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
          ]);
          if (user && pass && baseUrl) {
            const base = normalizeBaseUrl(baseUrl).replace(/\/+$/, '');
            stream_url = type === 'movie'
              ? `${base}/movie/${user}/${pass}/${target.stream_id}.${target.container_extension || 'mp4'}`
              : `${base}/live/${user}/${pass}/${target.stream_id}.ts`;
          }
        } catch (_) {}
      }
      navigation.navigate('Player', {
        stream_id: target.stream_id,
        name: target.name,
        stream_url: stream_url || undefined,
        type,
        cover: target.stream_icon || target.logo,
        ...(type === 'movie' && { extension: target.container_extension || 'mp4' }),
        ...(type === 'live' && { channelList: channels, currentChannelIndex: channelIdx >= 0 ? channelIdx : 0 }),
      });
    };
    const channelIndex = channels.findIndex((c) => (c.stream_id ?? c.id) === (item.stream_id ?? item.id));
    if (locked) {
      pendingPressRef.current = () => doPress(item, channelIndex >= 0 ? channelIndex : 0);
      setShowPinModal(true);
    } else {
      doPress(item, channelIndex >= 0 ? channelIndex : 0);
    }
  };

  const toggleView = () => {
    setViewMode((m) => (m === 'list' ? 'grid' : 'list'));
  };

  const renderListRow = ({ item }) => {
    const logo = item.stream_icon ?? item.logo;
    const isFav = !!favorites[item.stream_id];
    return (
      <TouchableOpacity
        style={styles.channelCard}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.logoContainer}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
          ) : (
            <Text style={styles.placeholderLogo}>TV</Text>
          )}
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.channelName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.channelId}>ID: {item.stream_id}</Text>
        </View>
        {streamType === 'live' && (
          <TouchableOpacity
            style={styles.favBtn}
            onPress={(e) => handleFavoritePress(e, item)}
          >
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={24} color={isFav ? '#e74c3c' : "#FFFFFF"} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderGridItem = ({ item, index }) => {
    const logo = item.stream_icon ?? item.logo;
    const isFav = !!favorites[item.stream_id];
    return (
      <TouchableOpacity
        style={[styles.gridItem, index % COLS_GRID !== COLS_GRID - 1 && { marginRight: GAP }]}
        onPress={() => handlePress(item)}
        activeOpacity={0.85}
      >
        {logo ? (
          <Image source={{ uri: logo }} style={styles.gridPoster} resizeMode="cover" />
        ) : (
          <View style={styles.gridPlaceholder}>
            <Text style={styles.gridPlaceholderText}>TV</Text>
          </View>
        )}
        {streamType === 'live' && (
          <TouchableOpacity
            style={styles.gridFavBtn}
            onPress={(e) => { e?.stopPropagation?.(); handleFavoritePress(e, item); }}
          >
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? '#e74c3c' : "#FFFFFF"} />
          </TouchableOpacity>
        )}
        <Text style={styles.gridTitle} numberOfLines={2}>{item.name || 'Channel'}</Text>
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    // Add a header with both view toggle and category lock control.
    // Read current lock state and show visual feedback.
    (async () => {
      try {
        let locked = false;
        if (streamType === 'live') locked = await getLockLive();
        else if (streamType === 'movie') locked = await getLockMovies();
        else locked = await getLockSeries();
        setCategoryLocked(!!locked);
      } catch (e) {
        console.warn('[ChannelList] load category lock error:', e);
      }
    })();

    const headerRight = () => (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={toggleView} style={styles.headerToggle} hitSlop={12}>
          <Text style={styles.headerToggleText}>{viewMode === 'list' ? '⊞' : '≡'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            // Require PIN verification before toggling the category lock.
            setShowLockAuthPrompt(true);
          }}
          style={[styles.headerToggle, { marginLeft: 8 }]}
          hitSlop={12}
        >
          <Text style={styles.headerToggleText}>{categoryLocked ? '🔒' : '🔓'}</Text>
        </TouchableOpacity>
      </View>
    );

    navigation.setOptions({
      title: category_name || 'Channels',
      headerRight,
    });
  }, [navigation, category_name, viewMode, categoryLocked, streamType]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading {category_name}...</Text>
      </View>
    );
  }

  const data = channels || [];
  const isGrid = viewMode === 'grid';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{category_name || 'Channels'}</Text>
        <Text style={styles.headerCount}>{data.length} Channels</Text>
      </View>

      {data.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No channels in this category.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={isGrid ? renderGridItem : renderListRow}
          keyExtractor={(item, index) => (item.stream_id ? item.stream_id.toString() + '_' + index : index.toString())}
          numColumns={isGrid ? COLS_GRID : 1}
          key={viewMode}
          contentContainerStyle={isGrid ? styles.gridContent : styles.listContent}
          columnWrapperStyle={isGrid ? styles.gridRow : undefined}
          initialNumToRender={isGrid ? 12 : 10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}
      {/* PIN modal for category locks */}
      <PinEntryModal
        visible={showPinModal}
        category={streamType === 'movie' ? 'movies' : streamType === 'live' ? 'live' : 'series'}
        onVerify={verifyContentPin}
        onCancel={() => setShowPinModal(false)}
        onSuccess={() => {
          setShowPinModal(false);
          try { pendingPressRef.current?.(); } catch (_) {}
          pendingPressRef.current = null;
        }}
      />
      {/* Lock auth prompt for toggling category lock */}
      <PinEntryModal
        visible={showLockAuthPrompt}
        category={streamType === 'movie' ? 'movies' : streamType === 'live' ? 'live' : 'series'}
        onVerify={verifyContentPin}
        onCancel={() => setShowLockAuthPrompt(false)}
        onSuccess={async () => {
          setShowLockAuthPrompt(false);
          try {
            let now = false;
            if (streamType === 'live') {
              now = !(await getLockLive());
              await setLockLive(now);
            } else if (streamType === 'movie') {
              now = !(await getLockMovies());
              await setLockMovies(now);
            } else {
              now = !(await getLockSeries());
              await setLockSeries(now);
            }
            setCategoryLocked(!!now);
            Alert.alert('Category Lock', now ? 'Category locked' : 'Category unlocked');
          } catch (e) {
            console.warn('[ChannelList] toggle category lock error:', e);
            Alert.alert('Error', 'Could not toggle lock. See logs.');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#121212" },
  header: {
    padding: 20,
    backgroundColor: "#1E1E1E",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  headerTitle: { color: "#FFD700", fontSize: 20, fontWeight: 'bold' },
  headerCount: { color: "#888888", fontSize: 14, marginTop: 5 },
  headerToggle: { marginRight: 16, padding: 8 },
  headerToggleText: { color: "#FFD700", fontSize: 22, fontWeight: 'bold' },
  listContent: { padding: 10 },
  gridContent: { padding: PADDING, paddingBottom: 40 },
  gridRow: { marginBottom: GAP },
  channelCard: {
    flexDirection: 'row',
    backgroundColor: "#1E1E1E",
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    height: 70,
    alignItems: 'center',
  },
  logoContainer: {
    width: 70,
    height: 70,
    backgroundColor: "#000000",
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: { width: 50, height: 50 },
  placeholderLogo: { color: "#555555", fontWeight: 'bold' },
  infoContainer: { flex: 1, paddingHorizontal: 15, justifyContent: 'center' },
  channelName: { color: "#FFFFFF", fontSize: 16, fontWeight: '500' },
  channelId: { color: "#555555", fontSize: 12, marginTop: 2 },
  gridItem: { width: POSTER_SIZE, position: 'relative' },
  gridFavBtn: { position: 'absolute', top: 6, right: 6, padding: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  gridPoster: { width: POSTER_SIZE, height: POSTER_HEIGHT, borderRadius: 8 },
  gridPlaceholder: {
    width: POSTER_SIZE,
    height: POSTER_HEIGHT,
    borderRadius: 8,
    backgroundColor: "#1E1E1E",
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridPlaceholderText: { color: "#555555", fontSize: 18, fontWeight: 'bold' },
  gridTitle: { color: "#FFFFFF", fontSize: 12, marginTop: 6, fontWeight: '500' },
  loadingText: { color: "#FFD700", marginTop: 10 },
  emptyText: { color: "#888888", fontSize: 16 },
});