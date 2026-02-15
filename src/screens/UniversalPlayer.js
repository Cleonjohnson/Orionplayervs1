/**
 * Orion Player 2.0 - Universal Player (Netflix-style)
 * Custom controls, favorites, history, speed, next/prev.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
  BackHandler,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { Video } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SecureStore from 'expo-secure-store';
import * as Database from '../services/DatabaseService';
import * as Settings from '../services/SettingsService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SECURE_KEYS = { username: 'orion_xtream_username', password: 'orion_xtream_password', baseUrl: 'orion_xtream_base_url' };
const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
const HISTORY_SAVE_INTERVAL_MS = 10000;

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim().replace(/\/+$/, '');
  return t.toLowerCase().startsWith('http') ? t : `http://${t}`;
}

function buildStreamUri(baseUrl, username, password, streamId, type, extension) {
  const base = normalizeBaseUrl(baseUrl).replace(/\/+$/, '');
  if (type === 'movie') {
    const ext = extension || 'mp4';
    return `${base}/movie/${username}/${password}/${streamId}.${ext}`;
  }
  if (type === 'series') {
    const ext = extension || 'mp4';
    return `${base}/series/${username}/${password}/${streamId}.${ext}`;
  }
  return `${base}/live/${username}/${password}/${streamId}.ts`;
}

function hidePasswordInUrl(url, password) {
  if (!url || !password) return url || '';
  return url.replace(new RegExp(encodeURIComponent(password), 'g'), '***');
}

export default function UniversalPlayer({ route, navigation }) {
  const { stream_id, name, logo, type = 'live', playlist = [], extension } = route?.params ?? {};
  const [uri, setUri] = useState(null);
  const [attemptedUrlSafe, setAttemptedUrlSafe] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [rate, setRate] = useState(1);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const lastSaveRef = useRef(0);
  const videoRef = useRef(null);

  const currentIndex = playlist.findIndex((p) => String(p.stream_id) === String(stream_id));
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < playlist.length - 1;
  const isVod = type === 'movie';

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (stream_id == null) {
        if (mounted) setError('Missing stream.');
        return;
      }
      try {
        const [username, password, baseUrl] = await Promise.all([
          SecureStore.getItemAsync(SECURE_KEYS.username),
          SecureStore.getItemAsync(SECURE_KEYS.password),
          SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
        ]);
        if (!username || !password || !baseUrl) {
          if (mounted) setError('Missing credentials.');
          return;
        }
        const u = buildStreamUri(baseUrl, username, password, stream_id, type, extension);
        if (mounted) {
          setUri(u);
          setAttemptedUrlSafe(hidePasswordInUrl(u, password));
        }
        const fav = await Database.checkFavoriteStatus(stream_id);
        if (mounted) setIsFavorite(!!fav);
      } catch (e) {
        if (mounted) {
          setError(e?.message || 'Failed to load.');
          setAttemptedUrlSafe(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [stream_id, type]);

  useEffect(() => {
    (async () => {
      try {
        const autoRotate = await Settings.getAutoRotate();
        if (autoRotate) {
          await ScreenOrientation.unlockAsync();
        }
      } catch (_) {}
    })();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback(
    (status) => {
      if (!status?.isLoaded) return;
      setIsPlaying(status.isPlaying);
      setPositionMillis(status.positionMillis ?? 0);
      setDurationMillis(status.durationMillis ?? 0);
      if (isVod && status.positionMillis != null) {
        const now = Date.now();
        if (now - lastSaveRef.current >= HISTORY_SAVE_INTERVAL_MS) {
          lastSaveRef.current = now;
          Database.updateHistory(stream_id, status.positionMillis, { name, logo, stream_type: type });
        }
      }
    },
    [stream_id, name, logo, type, isVod]
  );

  const onError = useCallback((err) => {
    console.warn('[UniversalPlayer] onError:', err);
    setError(err?.message || 'Playback failed. Codec or network error.');
  }, []);

  const togglePlayPause = async () => {
    try {
      if (isPlaying) await videoRef.current?.pauseAsync();
      else await videoRef.current?.playAsync();
    } catch (_) {}
  };

  const toggleFavorite = async () => {
    if (isFavorite) await Database.removeFromFavorites(stream_id);
    else await Database.addToFavorites({ stream_id, name, logo, stream_type: type });
    setIsFavorite(!isFavorite);
  };

  const setPlaybackRate = async (r) => {
    setRate(r);
    setShowSpeedModal(false);
    try {
      await videoRef.current?.setStatusAsync({ rate: r });
    } catch (_) {}
  };

  const seekTo = async (value) => {
    try {
      await videoRef.current?.setPositionAsync(value);
    } catch (_) {}
  };

  const goPrev = () => {
    if (!hasPrev) return;
    const prev = playlist[currentIndex - 1];
    navigation.replace('UniversalPlayer', { ...prev, type, playlist });
  };

  const goNext = () => {
    if (!hasNext) return;
    const next = playlist[currentIndex + 1];
    navigation.replace('UniversalPlayer', { ...next, type, playlist });
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.hint}>Loading...</Text>
      </View>
    );
  }

  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri }}
        useNativeControls={false}
        shouldPlay={true}
        resizeMode="contain"
        style={StyleSheet.absoluteFill}
        onError={onError}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.titleBar} numberOfLines={1}>{name || 'Playing'}</Text>
        <TouchableOpacity onPress={toggleFavorite} style={styles.iconBtn}>
          <Text style={styles.iconText}>{isFavorite ? '♥' : '♡'}</Text>
        </TouchableOpacity>
      </View>

      {/* Center play/pause */}
      <TouchableOpacity style={styles.centerOverlay} onPress={togglePlayPause} activeOpacity={1}>
        {loading && <ActivityIndicator size="large" color="#FFD700" />}
        {!loading && (
          <View style={styles.bigPlayWrap}>
            <Text style={styles.bigPlayText}>{isPlaying ? '❚❚' : '▶'}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {isVod && durationMillis > 0 && (
          <View style={styles.sliderRow}>
            <Text style={styles.timeText}>{Math.floor(positionMillis / 1000)}s</Text>
            <TouchableOpacity
              style={styles.sliderTrack}
              onPress={(e) => {
                const x = e.nativeEvent.locationX;
                const w = SCREEN_WIDTH - 120;
                if (w > 0) seekTo((x / w) * durationMillis);
              }}
            >
              <View style={[styles.sliderFill, { width: `${progress * 100}%` }]} />
            </TouchableOpacity>
            <Text style={styles.timeText}>{Math.floor(durationMillis / 1000)}s</Text>
          </View>
        )}
        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={goPrev} style={[styles.ctrlBtn, !hasPrev && styles.ctrlBtnDisabled]}>
            <Text style={styles.ctrlText}>⏮</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSpeedModal(true)} style={styles.ctrlBtn}>
            <Text style={styles.ctrlText}>{rate}x</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn}>
            <Text style={styles.ctrlText}>CC</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goNext} style={[styles.ctrlBtn, !hasNext && styles.ctrlBtnDisabled]}>
            <Text style={styles.ctrlText}>⏭</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showSpeedModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSpeedModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Playback speed</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {SPEEDS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.speedBtn, rate === r && styles.speedBtnActive]}
                  onPress={() => setPlaybackRate(r)}
                >
                  <Text style={styles.speedBtnText}>{r}x</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  errorText: { color: '#ff6b6b', fontSize: 16, textAlign: 'center', padding: 24 },
  attemptedUrlText: { color: '#888', fontSize: 12, paddingHorizontal: 24, marginTop: 8 },
  backBtn: { marginTop: 16, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20 },
  backBtnText: { color: '#FFD700', fontSize: 16 },
  hint: { color: '#FFD700', marginTop: 12 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: 48,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  iconBtn: { padding: 8 },
  iconText: { color: '#fff', fontSize: 24 },
  titleBar: { flex: 1, color: '#fff', fontSize: 16, marginHorizontal: 8 },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigPlayWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigPlayText: { color: '#fff', fontSize: 36 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sliderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  timeText: { color: '#888', fontSize: 12, width: 40 },
  sliderTrack: { flex: 1, height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden' },
  sliderFill: { height: '100%', backgroundColor: '#FFD700', borderRadius: 3 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  ctrlBtn: { padding: 12 },
  ctrlBtnDisabled: { opacity: 0.4 },
  ctrlText: { color: '#fff', fontSize: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24 },
  modalTitle: { color: '#FFD700', fontSize: 18, marginBottom: 16, textAlign: 'center' },
  speedBtn: { marginRight: 12, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, backgroundColor: '#333' },
  speedBtnActive: { backgroundColor: '#FFD700' },
  speedBtnText: { color: '#fff', fontSize: 16 },
});
