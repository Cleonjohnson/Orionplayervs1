/**
 * Orion Player 2.0 - Pro Video Player
 * Fullscreen, auto landscape, overlay (fade 3s), Tools (Resize / Audio).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  BackHandler,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { Video } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SECURE_KEYS = { username: 'orion_xtream_username', password: 'orion_xtream_password', baseUrl: 'orion_xtream_base_url' };
const OVERLAY_HIDE_MS = 3000;
const RESIZE_MODES = ['contain', 'cover', 'stretch'];

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim().replace(/\/+$/, '');
  return t.toLowerCase().startsWith('http') ? t : `http://${t}`;
}

function buildStreamUri(baseUrl, username, password, streamId, type, extension) {
  const base = normalizeBaseUrl(baseUrl).replace(/\/+$/, '');
  if (type === 'movie') return `${base}/movie/${username}/${password}/${streamId}.${extension || 'mp4'}`;
  if (type === 'series') return `${base}/series/${username}/${password}/${streamId}.${extension || 'mp4'}`;
  return `${base}/live/${username}/${password}/${streamId}.ts`;
}

export default function VideoPlayerScreen({ route, navigation }) {
  const { stream_id, name, type = 'live', extension } = route?.params ?? {};
  const [uri, setUri] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [resizeMode, setResizeMode] = useState('contain');
  const [showOverlay, setShowOverlay] = useState(true);
  const [showTools, setShowTools] = useState(false);
  const overlayTimeoutRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (stream_id == null) {
        if (mounted) setError('Missing stream.');
        setLoading(false);
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
          setLoading(false);
          return;
        }
        const u = buildStreamUri(baseUrl, username, password, stream_id, type, extension);
        if (mounted) setUri(u);
      } catch (e) {
        if (mounted) setError(e?.message || 'Failed to load.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [stream_id, type, extension]);

  useEffect(() => {
    (async () => {
      try {
        const autoRotate = await Settings.getAutoRotate();
        if (autoRotate) {
          await ScreenOrientation.unlockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.unlockAsync();
        }
      } catch (_) {}
    })();
    return () => {
      ScreenOrientation.unlockAsync()
        .then(() => ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP))
        .catch(() => {});
    };
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    overlayTimeoutRef.current = setTimeout(() => {
      setShowOverlay(false);
    }, OVERLAY_HIDE_MS);
  }, []);

  useEffect(() => {
    if (!showOverlay) return;
    resetOverlayTimer();
    return () => {
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    };
  }, [showOverlay, resetOverlayTimer]);

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status?.isLoaded) return;
    setIsPlaying(status.isPlaying);
    setPositionMillis(status.positionMillis ?? 0);
    setDurationMillis(status.durationMillis ?? 0);
  }, []);

  const togglePlayPause = async () => {
    try {
      if (isPlaying) await videoRef.current?.pauseAsync();
      else await videoRef.current?.playAsync();
    } catch (_) {}
  };

  const seekTo = (value) => {
    try {
      videoRef.current?.setPositionAsync(value);
    } catch (_) {}
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backBtnFull} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
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
        resizeMode={resizeMode}
        style={styles.video}
        onError={(e) => setError(e?.message || 'Playback error')}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />

      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={resetOverlayTimer} activeOpacity={1} />

      {showOverlay && (
        <>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.titleBar} numberOfLines={1}>{name || 'Playing'}</Text>
            <TouchableOpacity onPress={() => setShowTools(true)} style={styles.iconBtn}>
              <Ionicons name="settings" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.centerOverlay} onPress={togglePlayPause} activeOpacity={1}>
            <View style={styles.bigPlayWrap}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={48} color="#fff" />
            </View>
          </TouchableOpacity>

          {durationMillis > 0 && (
            <View style={styles.bottomBar}>
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
            </View>
          )}
        </>
      )}

      <Modal visible={showTools} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTools(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Player Tools</Text>
            <Text style={styles.modalLabel}>Resize Mode</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeRow}>
              {RESIZE_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modeBtn, resizeMode === mode && styles.modeBtnActive]}
                  onPress={() => { setResizeMode(mode); setShowTools(false); }}
                >
                  <Text style={styles.modeBtnText}>{mode}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.modalLabel}>Audio Track</Text>
            <Text style={styles.modalHint}>Use device volume. Track selection depends on stream.</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowTools(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { ...StyleSheet.absoluteFillObject },
  errorText: { color: '#ff6b6b', fontSize: 16, textAlign: 'center', padding: 24 },
  backBtnFull: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText: { color: '#FFD700', fontSize: 16 },
  loadingText: { color: '#FFD700', fontSize: 16, textAlign: 'center', marginTop: 48 },
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
  sliderRow: { flexDirection: 'row', alignItems: 'center' },
  timeText: { color: '#888', fontSize: 12, width: 40 },
  sliderTrack: { flex: 1, height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden' },
  sliderFill: { height: '100%', backgroundColor: '#FFD700', borderRadius: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24 },
  modalTitle: { color: '#FFD700', fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  modalLabel: { color: '#fff', fontSize: 14, marginBottom: 8 },
  modeRow: { marginBottom: 16 },
  modeBtn: { marginRight: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#333' },
  modeBtnActive: { backgroundColor: '#FFD700' },
  modeBtnText: { color: '#fff', fontSize: 14 },
  modalHint: { color: '#888', fontSize: 12, marginBottom: 16 },
  modalClose: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 24 },
  modalCloseText: { color: '#FFD700', fontSize: 16 },
});
