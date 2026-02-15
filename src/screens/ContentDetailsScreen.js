/**
 * Orion Player 2.0 - Content Details (Netflix-style)
 * Gateway screen before Player. Hero image, meta, action bar, synopsis, More Like This.
 * My List button now properly adds/removes favorites.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ImageBackground,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Share,
  Modal,
} from 'react-native';
import PinPromptModal from '../components/PinPromptModal';
import { isContentLocked, toggleContentLock } from '../services/SettingsService';
import TouchableOpacity from '../components/TouchableOpacity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';
import { useWindowDimensionsCompat } from '../theme/useWindowDimensionsCompat';
import {
  getMovies,
  addToFavorites,
  checkFavoriteStatus,
  removeFromFavorites,
  getSpecificHistory,
} from '../services/DatabaseService';

// Black color inlined where needed to avoid undefined constant

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.45;
const POSTER_WIDTH = 110;
const POSTER_HEIGHT = 165;
const CARD_GAP = 10;
const RATING_STORAGE_KEY = 'orion_content_rating_';
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

function buildMovieUrl(cred, streamId, ext = 'mp4') {
  if (!cred?.baseUrl || !cred?.username || !cred?.password) return null;
  const base = normalizeBaseUrl(cred.baseUrl).replace(/\/+$/, '');
  return `${base}/movie/${cred.username}/${cred.password}/${streamId}.${ext}`;
}

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

function formatDuration(minutes) {
  if (!minutes || typeof minutes !== 'number') return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const ACTION_BAR_BREAKPOINT = 500; // below this width use two rows so Play is clear

export default function ContentDetailsScreen({ route, navigation }) {
  const { width: winWidth } = useWindowDimensionsCompat();
  const isNarrow = winWidth < ACTION_BAR_BREAKPOINT;
  const item = route?.params?.item ?? route?.params ?? {};
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [moreLikeThis, setMoreLikeThis] = useState([]);
  const [loadingMore, setLoadingMore] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [watchHistory, setWatchHistory] = useState(null); // { position, duration }
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateThanks, setRateThanks] = useState(false);

  const streamId = item.stream_id ?? item.series_id ?? item.num;
  const contentType = item.type ?? (item.series_id != null ? 'series' : 'movie');
  const title = item.name ?? item.title ?? 'Untitled';
  const backdrop = item.stream_icon ?? item.logo ?? item.icon ?? item.cover;
  const year = item.releaseDate ? String(item.releaseDate).slice(0, 4) : (item.year ? String(item.year) : null);
  const duration = formatDuration(item.duration ?? item.runtime);
  const rating = item.rating ?? item.rating_5based;
  const is4K = item.container_extension === 'mkv' || (item.name && /4k|uhd|ultra/i.test(item.name));
  const synopsis = item.plot ?? item.description ?? item.synopsis ?? '';

  // Check favorite status on mount
  useEffect(() => {
    if (streamId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await checkFavoriteStatus(streamId, contentType);
        if (!cancelled) setIsFav(status === true);
      } catch (e) {
        console.warn('[ContentDetails] checkFavoriteStatus error:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [streamId, contentType]);

  // Check watch history on mount
  useEffect(() => {
    if (streamId == null || contentType !== 'movie') return;
    let cancelled = false;
    (async () => {
      try {
        const history = await getSpecificHistory(streamId);
        if (!cancelled && history && history.position > 0) {
          setWatchHistory(history);
        }
      } catch (e) {
        console.warn('[ContentDetails] getSpecificHistory error:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [streamId, contentType]);

  // Load "More Like This"
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getMovies();
        if (cancelled) return;
        const filtered = (all ?? []).filter((m) => (m.stream_id ?? m.num) !== streamId);
        const shuffled = [...filtered].sort(() => Math.random() - 0.5);
        setMoreLikeThis(shuffled.slice(0, 12));
      } catch (e) {
        if (!cancelled) setMoreLikeThis([]);
      } finally {
        if (!cancelled) setLoadingMore(false);
      }
    })();
    return () => { cancelled = true; };
  }, [streamId]);

  const handlePlayInternal = useCallback(async (resume = false) => {
    const cred = await getCredentials();
    if (contentType === 'series') {
      navigation.navigate('SeriesDetails', {
        series_id: streamId,
        name: title,
        cover: backdrop,
      });
    } else {
      const stream_url = buildMovieUrl(cred, streamId, item.container_extension ?? 'mp4');
      navigation.navigate('Player', {
        stream_id: streamId,
        name: title,
        stream_url: stream_url || undefined,
        type: 'movie',
        cover: backdrop,
        extension: item.container_extension ?? 'mp4',
        startTime: resume && watchHistory ? watchHistory.position : 0,
      });
    }
  }, [navigation, streamId, title, backdrop, item.container_extension, contentType, watchHistory]);

  // Guarded play that checks per-item lock first
  const pendingResumeRef = React.useRef(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const locked = await isContentLocked(streamId);
        if (mounted) setIsLocked(!!locked);
      } catch (e) {
        console.warn('[ContentDetails] isContentLocked error:', e);
      }
    })();
    return () => { mounted = false; };
  }, [streamId]);

  const handlePlay = useCallback(async (resume = false) => {
    // Update pending flag and check lock
    pendingResumeRef.current = !!resume;
    try {
      const locked = await isContentLocked(streamId);
      if (locked) {
        setShowPinPrompt(true);
        return;
      }
      // not locked — proceed
      await handlePlayInternal(resume);
    } catch (e) {
      console.warn('[ContentDetails] play guard error:', e);
    }
  }, [streamId, handlePlayInternal]);

  const onPinSuccessForPlay = async () => {
    setShowPinPrompt(false);
    try {
      await handlePlayInternal(pendingResumeRef.current);
    } catch (e) {
      console.warn('[ContentDetails] post-pin play error:', e);
    }
  };

  const handleToggleLock = useCallback(async () => {
    try {
      const nowLocked = await toggleContentLock(streamId);
      setIsLocked(!!nowLocked);
    } catch (e) {
      console.warn('[ContentDetails] toggleContentLock error:', e);
    }
  }, [streamId]);

  // Format remaining time
  const formatRemaining = useCallback(() => {
    if (!watchHistory || !watchHistory.duration) return null;
    const remaining = watchHistory.duration - watchHistory.position;
    const minutes = Math.floor(remaining / 60000);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m left`;
    }
    return `${minutes}m left`;
  }, [watchHistory]);

  const handleFavoriteToggle = useCallback(async () => {
    if (favLoading || streamId == null) return;
    setFavLoading(true);
    try {
      if (isFav) {
        await removeFromFavorites(streamId, contentType);
        setIsFav(false);
      } else {
        await addToFavorites(
          { stream_id: streamId, name: title, stream_icon: backdrop, ...item },
          contentType
        );
        setIsFav(true);
      }
    } catch (e) {
      console.warn('[ContentDetails] favorite toggle error:', e);
    } finally {
      setFavLoading(false);
    }
  }, [isFav, favLoading, streamId, title, backdrop, item, contentType]);

  const handleTrailer = useCallback(() => {
    // Placeholder - no trailer support yet
  }, []);

  const handleShare = useCallback(() => {
    Share.share({
      message: `Check out ${title} on Orion Player! The baddest Jamaican App.`,
      title: title,
    }).catch(() => {});
  }, [title]);

  const handleRateSelect = useCallback(
    async (stars) => {
      try {
        await AsyncStorage.setItem(RATING_STORAGE_KEY + (streamId ?? 'unknown'), String(stars));
        setRateThanks(true);
        setTimeout(() => {
          setShowRateModal(false);
          setRateThanks(false);
        }, 1500);
      } catch (e) {
        console.warn('[ContentDetails] save rating error:', e);
      }
    },
    [streamId]
  );

  const handleMoreItemPress = useCallback(
    (relatedItem) => {
      navigation.push('ContentDetails', {
        item: { ...relatedItem, stream_icon: relatedItem.stream_icon ?? relatedItem.logo },
      });
    },
    [navigation]
  );

  const renderMoreItem = ({ item: related }) => {
    const poster = related.stream_icon ?? related.logo ?? related.icon;
    return (
      <TouchableOpacity
        style={styles.moreCard}
        onPress={() => handleMoreItemPress(related)}
        activeOpacity={0.85}
      >
        {poster ? (
          <Image source={{ uri: poster }} style={styles.morePoster} resizeMode="cover" />
        ) : (
          <View style={[styles.morePoster, styles.morePlaceholder]}>
            <Ionicons name="film-outline" size={28} color="#666" />
          </View>
        )}
        <Text style={styles.moreTitle} numberOfLines={2}>
          {related.name ?? 'Movie'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={[styles.heroWrap, { height: HERO_HEIGHT }]}>
          {backdrop ? (
            <ImageBackground
              source={{ uri: backdrop }}
              style={styles.heroBg}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['transparent', 'transparent', 'rgba(15,15,15,0.7)', "#121212"]}
                locations={[0, 0.4, 0.75, 1]}
                style={styles.heroGradient}
              />
            </ImageBackground>
          ) : (
            <View style={[styles.heroBg, styles.heroPlaceholder]}>
              <Ionicons name="film-outline" size={80} color="#333" />
              <LinearGradient
                colors={['transparent', "#121212"]}
                locations={[0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
            </View>
          )}
        </View>

        {/* Title & Meta */}
        <View style={styles.contentSection}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.metaRow}>
            {year ? <Text style={styles.meta}>{year}</Text> : null}
            {year && duration ? <Text style={styles.metaDot}> • </Text> : null}
            {duration ? <Text style={styles.meta}>{duration}</Text> : null}
            {(year || duration) && rating != null ? <Text style={styles.metaDot}> • </Text> : null}
            {rating != null && rating !== '' ? (
              <View style={styles.ratingWrap}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.meta}> {rating}</Text>
              </View>
            ) : null}
            {is4K ? (
              <>
                <Text style={styles.metaDot}> • </Text>
                <View style={styles.badge4K}>
                  <Text style={styles.badge4KText}>4K</Text>
                </View>
              </>
            ) : null}
            {contentType === 'series' ? (
              <>
                <Text style={styles.metaDot}> • </Text>
                <View style={styles.badgeSeries}>
                  <Text style={styles.badgeSeriesText}>SERIES</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Action Bar: two rows in portrait so Play is clear; one row in landscape */}
          <View style={styles.actionBar}>
            {/* Row 1 in narrow (portrait): Play/Resume full width. In wide: Play + secondary inline. */}
            <View style={[styles.actionRowPrimary, isNarrow && styles.actionRowPrimaryNarrow]}>
              {watchHistory && contentType === 'movie' ? (
                <View style={styles.playBtnGroup}>
                  <TouchableOpacity
                    style={styles.resumeBtn}
                    onPress={() => handlePlay(true)}
                    activeOpacity={0.85}
                  >
                <Ionicons name="play" size={24} color="#000000" />
                    <View style={styles.resumeBtnTextWrap}>
                      <Text style={styles.resumeBtnText}>Resume</Text>
                      <Text style={styles.resumeBtnSubtext}>{(formatRemaining && formatRemaining()) || ''}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.restartBtn}
                    onPress={() => handlePlay(false)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="refresh" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.playBtn, isNarrow && styles.playBtnNarrow]}
                  onPress={() => handlePlay(false)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="play" size={24} color="#000000" />
                  <Text style={styles.playBtnText}>{contentType === 'series' ? 'Episodes' : 'Play'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Row 2 in narrow; same row in wide */}
            <View style={[styles.actionRowSecondary, isNarrow && styles.actionRowSecondaryNarrow]}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleFavoriteToggle}
                activeOpacity={0.85}
                disabled={favLoading}
              >
                {favLoading ? (
                  <ActivityIndicator size="small" color="#FFD700" />
                ) : isFav ? (
                  <Ionicons name="checkmark-circle" size={28} color="#FFD700" />
                ) : (
                  <Ionicons name="add-circle-outline" size={28} color="#FFFFFF" />
                )}
                <Text style={[styles.secondaryBtnText, isFav && { color: "#FFD700" }]}>
                  {isFav ? 'Added' : 'My List'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleTrailer}
                activeOpacity={0.85}
              >
                <Ionicons name="play-circle-outline" size={28} color="#FFFFFF" />
                <Text style={styles.secondaryBtnText}>Trailer</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare} activeOpacity={0.85}>
                <Ionicons name="share-social" size={28} color="#FFFFFF" />
                <Text style={styles.secondaryBtnText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleToggleLock}
                activeOpacity={0.85}
              >
                <Ionicons name={isLocked ? 'lock-closed' : 'lock-open'} size={28} color={isLocked ? '#FFD700' : '#FFFFFF'} />
                <Text style={[styles.secondaryBtnText, isLocked && { color: '#FFD700' }]}>{isLocked ? 'Locked' : 'Lock'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setShowRateModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="star" size={28} color="#FFFFFF" />
                <Text style={styles.secondaryBtnText}>Rate</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Rate Modal */}
          <Modal
            visible={showRateModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowRateModal(false)}
          >
            <TouchableOpacity
              style={styles.rateModalOverlay}
              activeOpacity={1}
              onPress={() => setShowRateModal(false)}
            >
              <View style={styles.rateModalBox} onStartShouldSetResponder={() => true}>
                <Text style={styles.rateModalTitle}>Rate Dis!</Text>
                {rateThanks ? (
                  <Text style={styles.rateThanks}>Thanks for voting!</Text>
                ) : (
                  <View style={styles.rateFiresRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity
                        key={n}
                        style={styles.rateFireBtn}
                        onPress={() => handleRateSelect(n)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="flame" size={36} color="#FFD700" />
                        <Text style={styles.rateFireText}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </Modal>

          {/* PIN prompt for locked content */}
          <PinPromptModal visible={showPinPrompt} onCancel={() => setShowPinPrompt(false)} onSuccess={onPinSuccessForPlay} />

          {/* Synopsis */}
          {synopsis ? (
            <View style={styles.synopsisSection}>
              <Text
                style={styles.synopsisText}
                numberOfLines={synopsisExpanded ? undefined : 3}
              >
                {synopsis}
              </Text>
              {synopsis.length > 120 && (
                <TouchableOpacity
                  onPress={() => setSynopsisExpanded(!synopsisExpanded)}
                  style={styles.expandBtn}
                >
                  <Text style={styles.expandBtnText}>
                    {synopsisExpanded ? 'Show less' : 'Read more'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* More Like This */}
          <Text style={styles.sectionTitle}>More Like This</Text>
          {loadingMore ? (
            <ActivityIndicator size="small" color="#FFD700" style={{ marginVertical: 20 }} />
          ) : moreLikeThis.length > 0 ? (
            <FlatList
              data={moreLikeThis}
              horizontal
              renderItem={renderMoreItem}
              keyExtractor={(m) => String(m.stream_id ?? m.num ?? m.name ?? Math.random())}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.moreList}
              ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
            />
          ) : (
            <Text style={styles.emptyMore}>No related titles</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  scroll: { flex: 1 },
  heroWrap: { width: SCREEN_WIDTH },
  heroBg: { flex: 1, width: '100%' },
  heroGradient: { flex: 1, width: '100%' },
  heroPlaceholder: {
    backgroundColor: "#1E1E1E",
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: "#FFFFFF",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  meta: { fontSize: 14, color: '#aaa' },
  metaDot: { fontSize: 14, color: '#666', marginHorizontal: 4 },
  ratingWrap: { flexDirection: 'row', alignItems: 'center' },
  badge4K: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  badge4KText: { fontSize: 11, color: "#FFFFFF", fontWeight: '700' },
  badgeSeries: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  badgeSeriesText: { fontSize: 10, color: "#000000", fontWeight: '700' },
  actionBar: {
    marginBottom: 24,
  },
  actionBarNarrow: {
    flexDirection: 'column',
  },
  actionBarWide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRowPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 20,
    minWidth: 0,
  },
  actionRowPrimaryNarrow: {
    width: '100%',
    marginRight: 0,
    marginBottom: 12,
  },
  actionRowSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  actionRowSecondaryNarrow: {
    width: '100%',
    justifyContent: 'space-evenly',
  },
  playBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 6,
    minWidth: 0,
  },
  playBtnNarrow: {
    width: '100%',
  },
  playBtnText: { fontSize: 17, fontWeight: '700', color: "#000000", marginLeft: 8 },
  // Resume/Restart buttons
  playBtnGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  resumeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  resumeBtnTextWrap: {
    marginLeft: 10,
  },
  resumeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: "#000000",
  },
  resumeBtnSubtext: {
    fontSize: 11,
    color: '#666',
    marginTop: 1,
  },
  restartBtn: {
    backgroundColor: "#1E1E1E",
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  secondaryBtnText: { fontSize: 12, color: '#aaa', marginTop: 4 },
  synopsisSection: { marginBottom: 24 },
  synopsisText: { fontSize: 15, color: '#aaa', lineHeight: 22 },
  expandBtn: { marginTop: 6 },
  expandBtnText: { fontSize: 14, color: "#FFD700", fontWeight: '600' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#FFFFFF",
    marginBottom: 12,
  },
  moreList: { paddingRight: 20 },
  moreCard: { width: POSTER_WIDTH },
  morePoster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 8,
  },
  morePlaceholder: {
    backgroundColor: "#1E1E1E",
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreTitle: {
    fontSize: 12,
    color: "#FFFFFF",
    marginTop: 6,
    fontWeight: '500',
  },
  emptyMore: { fontSize: 14, color: '#666', marginVertical: 20 },
  rateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  rateModalBox: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
    minWidth: 280,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  rateModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: "#FFFFFF",
    textAlign: 'center',
    marginBottom: 20,
  },
  rateThanks: {
    fontSize: 16,
    color: "#FFD700",
    textAlign: 'center',
    fontWeight: '600',
  },
  rateFiresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rateFireBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  rateFireText: {
    fontSize: 14,
    color: "#FFD700",
    fontWeight: '700',
    marginTop: 4,
  },
});