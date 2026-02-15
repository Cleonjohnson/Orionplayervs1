/**
 * Orion Player 2.0 - Series Details (Defensive; no null crashes)
 * Defensive destructuring, render guard for missing series_id, safe cover and episodes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
  StyleSheet,
  Dimensions,
  ActivityIndicator as Spinner,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { getSeriesInfo } from '../services/XtreamService';
import { getCachedSeriesInfo, cacheSeriesInfo, addToFavorites, removeFromFavorites, checkFavoriteStatus } from '../services/DatabaseService';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/500x750';
const { width } = Dimensions.get('window');
const HERO_HEIGHT = 320;
const EPISODE_IMAGE_WIDTH = 120;
const EPISODE_IMAGE_HEIGHT = 68;
const SECURE_KEYS = { username: 'orion_xtream_username', password: 'orion_xtream_password', baseUrl: 'orion_xtream_base_url' };

/** Parse episode duration to total seconds. Handles: number (seconds), "HH:MM:SS", "MM:SS", or "M". */
function parseDurationToSeconds(duration) {
  if (duration == null || duration === '') return null;
  const n = Number(duration);
  if (!Number.isNaN(n) && n >= 0) return n;
  if (typeof duration !== 'string') return null;
  const parts = String(duration).trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p) || p < 0)) return null;
  if (parts.length === 1) return parts[0] * 60; // "45" -> 45 minutes
  if (parts.length === 2) return parts[0] * 60 + parts[1]; // "45:30"
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]; // "1:45:30"
  return null;
}

/** Format seconds as "Xm Ys" only if valid. */
function formatDuration(seconds) {
  const s = seconds == null ? null : (typeof seconds === 'number' && !Number.isNaN(seconds) ? seconds : parseDurationToSeconds(seconds));
  if (s == null || s < 0 || !Number.isFinite(s)) return null;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (m > 0 && sec > 0) return `${m}m ${sec}s`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

export default function SeriesDetailsScreen({ route, navigation }) {
  const params = (route && route.params) || {};
  const series_id = params.series_id ?? params.seriesId ?? null;
  const name = params.name ?? '';
  const cover = params.cover ?? null;

  const [info, setInfo] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (series_id == null) return;
    let cancelled = false;
    checkFavoriteStatus(series_id, 'series').then((status) => {
      if (!cancelled) setIsFav(status === true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [series_id]);

  const handleFavoriteToggle = useCallback(async () => {
    if (series_id == null || favLoading) return;
    setFavLoading(true);
    try {
      if (isFav) {
        await removeFromFavorites(series_id, 'series');
        setIsFav(false);
      } else {
        await addToFavorites(
          { series_id, name: name || info?.name, stream_icon: cover ?? info?.cover },
          'series'
        );
        setIsFav(true);
      }
    } catch (e) {
      console.warn('[SeriesDetails] favorite toggle error:', e);
    } finally {
      setFavLoading(false);
    }
  }, [series_id, name, cover, info, isFav, favLoading]);

  const loadSeries = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (series_id == null) {
        setInfo(null);
        setSeasons([]);
        setLoading(false);
        return;
      }

      // Try cache first (instant load)
      console.log(`[SeriesDetails] Checking cache for series ${series_id}...`);
      const cached = await getCachedSeriesInfo(series_id);
      if (cached && cached.info && cached.seasons?.length > 0) {
        console.log(`[SeriesDetails] ✅ Using cached data (${cached.seasons.length} seasons)`);
        setInfo(cached.info);
        setSeasons(cached.seasons);
        if (cached.seasons.length > 0) {
          const firstNum = cached.seasons[0]?.season_number ?? 1;
          setSelectedSeason(firstNum);
        }
        setLoading(false);
        return;
      }

      console.log(`[SeriesDetails] Cache miss - fetching from API...`);
      const [username, password, baseUrl] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEYS.username),
        SecureStore.getItemAsync(SECURE_KEYS.password),
        SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
      ]);
      if (!username || !password || !baseUrl) {
        console.warn('[SeriesDetails] Missing credentials');
        setInfo(null);
        setSeasons([]);
        setError(true);
        setLoading(false);
        return;
      }
      
      console.log(`[SeriesDetails] Loading series ${series_id} from API...`);
      const result = await getSeriesInfo({
        baseUrl,
        username,
        password,
        seriesId: series_id,
      });
      
      console.log(`[SeriesDetails] API Result:`, result?.info ? 'Has info' : 'No info', `${result?.seasons?.length ?? 0} seasons`);
      
      setInfo(result && result.info ? result.info : null);
      const list = (result && result.seasons) ? result.seasons : [];
      setSeasons(Array.isArray(list) ? list : []);
      
      // Only cache successful results (with actual seasons data)
      // DON'T cache empty results - those are likely timeouts/failures
      if (result && result.seasons && result.seasons.length > 0) {
        await cacheSeriesInfo(series_id, result.info, result.seasons);
        console.log(`[SeriesDetails] ✅ Cached series ${series_id} with ${result.seasons.length} seasons`);
      } else {
        console.log(`[SeriesDetails] ⚠️ NOT caching empty result for series ${series_id}`);
      }
      
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0];
        const firstNum = (first && (first.season_number ?? first.seasonNumber)) ?? 1;
        setSelectedSeason(firstNum);
      } else {
        // No seasons found - might be a network error
        if (!result?.info && !result?.seasons?.length) {
          console.warn('[SeriesDetails] No data returned - possible network error');
          setError(true);
        }
      }
    } catch (err) {
      console.error('[SeriesDetails] loadSeries error:', err?.message ?? err);
      setError(true);
      setInfo(null);
      setSeasons([]);
    } finally {
      setLoading(false);
    }
  }, [series_id]);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  if (series_id == null || series_id === '') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No Series Selected</Text>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.button}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const infoObj = info && typeof info === 'object' ? info : null;
  const coverFromInfo = infoObj && (infoObj.cover ?? infoObj.cover_big);
  const coverUri = (typeof coverFromInfo === 'string' && coverFromInfo)
    ? coverFromInfo
    : (typeof cover === 'string' && cover ? cover : null);
  const imageSourceUri = coverUri || PLACEHOLDER_IMAGE;

  const plot = (infoObj && infoObj.plot) ? String(infoObj.plot) : '';
  const seriesName = (infoObj && infoObj.name) ? String(infoObj.name) : (name ? String(name) : 'Series');
  const releaseDate = infoObj && infoObj.releaseDate != null ? infoObj.releaseDate : null;

  const seasonsList = Array.isArray(seasons) ? seasons : [];
  const currentSeasonData = seasonsList.find(
    (s) => s && (s.season_number ?? s.seasonNumber) === selectedSeason
  ) || seasonsList[0];
  const episodes = (currentSeasonData && currentSeasonData.episodes)
    ? currentSeasonData.episodes
    : [];
  const episodesList = Array.isArray(episodes) ? episodes : [];

  const onPressEpisode = useCallback(
    async (episode) => {
      if (!episode || !navigation) return;
      const episodeId = episode.id ?? episode.episode_id;
      if (episodeId == null) return;
      const [username, password, baseUrl] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEYS.username),
        SecureStore.getItemAsync(SECURE_KEYS.password),
        SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
      ]);
      if (!username || !password || !baseUrl) return;
      const base = (baseUrl || '').trim().replace(/\/+$/, '');
      const scheme = base.toLowerCase().startsWith('http') ? '' : 'http://';
      const root = scheme ? scheme + base : base;
      
      // Use the correct container extension from episode data
      const extension = episode.container_extension || episode.extension || 'mkv';
      const stream_url = `${root}/series/${username}/${password}/${episodeId}.${extension}`;
      const title = episode.title || episode.name || seriesName || 'Episode';
      
      console.log('[SeriesDetails] Playing episode:', {
        episodeId,
        extension,
        url: stream_url.replace(password, '***'),
      });
      
      navigation.navigate('Player', {
        stream_id: episodeId,
        stream_url,
        title,
        name: title,
        type: 'series',
        extension,
        cover: episode.info?.movie_image ?? episode.movie_image ?? episode.cover ?? coverUri,
      });
    },
    [navigation, seriesName, coverUri]
  );

  if (loading && !infoObj && seasonsList.length === 0) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading series info...</Text>
        <Text style={styles.loadingSubtext}>This may take up to 30 seconds for slow servers</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <ImageBackground
            source={{ uri: imageSourceUri }}
            style={styles.heroBg}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(15,15,15,1)']}
              style={styles.heroGradient}
            />
          </ImageBackground>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation && navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.title}>{seriesName}</Text>
          {releaseDate != null && releaseDate !== '' ? (
            <Text style={styles.year}>{String(releaseDate).slice(0, 4)}</Text>
          ) : null}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.myListBtn}
              onPress={handleFavoriteToggle}
              disabled={favLoading}
              activeOpacity={0.85}
            >
              {favLoading ? (
                <ActivityIndicator size="small" color="#FFD700" />
              ) : isFav ? (
                <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
              ) : (
                <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
              )}
              <Text style={[styles.myListBtnText, isFav && { color: "#FFD700" }]}>
                {isFav ? 'In My List' : 'My List'}
              </Text>
            </TouchableOpacity>
          </View>
          {plot ? <Text style={styles.plot}>{plot}</Text> : null}
        </View>

        {seasonsList.length > 0 && (
          <View style={styles.seasonSection}>
            <Text style={styles.sectionLabel}>Season</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContent}
            >
              {seasonsList.map((s, idx) => {
                if (!s) return null;
                const num = s.season_number ?? s.seasonNumber ?? idx + 1;
                const isSelected = num === selectedSeason;
                return (
                  <TouchableOpacity
                    key={`season-${num}-${idx}`}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => setSelectedSeason(num)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      Season {num}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.episodesSection}>
          <Text style={styles.episodesHeading}>
            {currentSeasonData
              ? `Season ${currentSeasonData.season_number ?? currentSeasonData.seasonNumber ?? 1} · ${episodesList.length} episodes`
              : 'Episodes'}
          </Text>
          {error ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Server is slow or unavailable</Text>
              <Text style={styles.emptySubtext}>The series info couldn't be loaded. Try again or check your connection.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadSeries}>
                <Ionicons name="refresh" size={20} color="#FFD700" />
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : !episodesList || episodesList.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No episodes in this season.</Text>
            </View>
          ) : (
            episodesList.map((item, index) => {
              if (!item) return null;
              const episodeNum = item.episode_num ?? index + 1;
              const seasonNum = currentSeasonData?.season_number ?? currentSeasonData?.seasonNumber ?? 1;
              const title = item.title ?? item.name ?? `Episode ${episodeNum}`;
              // Some providers don't send episode thumbnails. Fall back to the series cover.
              const screenshot = item.info?.movie_image ?? item.movie_image ?? item.cover ?? item.info?.cover ?? coverUri ?? null;
              const durationRaw = item.duration ?? item.info?.duration;
              const durationStr = formatDuration(durationRaw);
              const key = item.id ?? item.episode_id ?? `ep-${index}`;

              return (
                <TouchableOpacity
                  key={key}
                  style={styles.episodeCard}
                  onPress={() => onPressEpisode(item)}
                  activeOpacity={0.85}
                >
                  <View style={styles.episodeImageWrap}>
                    {screenshot && typeof screenshot === 'string' ? (
                      <Image source={{ uri: screenshot }} style={styles.episodeImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.episodeImagePlaceholder}>
                        <Ionicons name="film-outline" size={28} color="#555" />
                      </View>
                    )}
                  </View>
                  <View style={styles.episodeBody}>
                    <Text style={styles.episodeTitle} numberOfLines={2}>
                      S{seasonNum}:E{episodeNum} – {title}
                    </Text>
                    {durationStr ? <Text style={styles.episodeDuration}>{durationStr}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={styles.playBtn}
                    onPress={() => onPressEpisode(item)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="play-circle" size={44} color="#FFD700" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  errorText: { color: "#FFD700", fontSize: 18, marginBottom: 20, textAlign: 'center' },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  buttonText: { color: "#FFD700", fontSize: 16, fontWeight: '600' },
  loadingText: { color: "#FFD700", marginTop: 12, fontSize: 16 },
  loadingSubtext: { color: '#888', marginTop: 8, fontSize: 13 },
  heroWrap: { height: HERO_HEIGHT, position: 'relative', marginBottom: 16 },
  heroBg: { width: '100%', height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: "#121212" },
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  infoSection: { paddingHorizontal: 20, marginBottom: 20 },
  title: { color: "#FFD700", fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
  year: { color: '#b0b0b0', fontSize: 14, marginBottom: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  myListBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingRight: 16 },
  myListBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: '600' },
  plot: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 22 },
  seasonSection: { marginBottom: 20 },
  sectionLabel: { color: '#b0b0b0', fontSize: 12, marginBottom: 8, paddingHorizontal: 20 },
  chipsContent: { paddingHorizontal: 20, gap: 10, flexDirection: 'row' },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: '#333',
  },
  chipActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  chipText: { color: "#FFFFFF", fontSize: 14 },
  chipTextActive: { color: '#000', fontWeight: '600' },
  episodesSection: { paddingHorizontal: 20 },
  episodesHeading: { color: "#FFD700", fontSize: 18, fontWeight: '600', marginBottom: 14 },
  emptyWrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyText: { color: '#888', fontSize: 16, marginBottom: 8, textAlign: 'center' },
  emptySubtext: { color: '#666', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: "#1E1E1E",
    gap: 8,
  },
  retryText: { color: "#FFD700", fontSize: 16, fontWeight: '600' },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  episodeImageWrap: {
    width: EPISODE_IMAGE_WIDTH,
    height: EPISODE_IMAGE_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 14,
  },
  episodeImage: { width: '100%', height: '100%' },
  episodeImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeBody: { flex: 1 },
  episodeTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: '600', marginBottom: 2 },
  episodeDuration: { color: '#888', fontSize: 13 },
  playBtn: { padding: 4 },
});
