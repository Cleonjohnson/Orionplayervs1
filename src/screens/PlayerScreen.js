/**
 * Orion Player 2.0 - Cinema Mode Player
 * Uses expo-video for better codec support (MKV, H.265, etc.)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Animated,
  Image,
  Modal,
  ScrollView,
  Platform,
  Share,
  PanResponder,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import Slider from '@react-native-community/slider';
import { VideoView, useVideoPlayer, VideoAirPlayButton } from 'expo-video';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import * as SecureStore from 'expo-secure-store';
import { TVEventHandler } from 'react-native';
import { getPreferHighQualityOnTV } from '../services/SettingsService';
import { updateHistory, removeFromHistory, addToFavorites, removeFromFavorites, checkFavoriteStatus } from '../services/DatabaseService';
import { buildLiveStreamUrl, buildLiveCatchupUrl } from '../services/XtreamService';
import PinPromptModal from '../components/PinPromptModal';
import { isContentLocked } from '../services/SettingsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GOLD = '#FFD700';
const CONTROLS_HIDE_MS = 4000;

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

function buildStreamUri(baseUrl, username, password, streamId, type, extension) {
  const base = normalizeBaseUrl(baseUrl).replace(/\/+$/, '');
  if (type === 'movie') return `${base}/movie/${username}/${password}/${streamId}.${extension || 'mp4'}`;
  if (type === 'series') return `${base}/series/${username}/${password}/${streamId}.${extension || 'mkv'}`;
  return `${base}/live/${username}/${password}/${streamId}.ts`;
}

const LANGUAGE_NAMES = { eng: 'English', spa: 'Spanish', fre: 'French', deu: 'German', ita: 'Italian', por: 'Portuguese', und: 'Default', auto: 'Auto' };
function getTrackLabel(track, fallback) {
  if (!track) return fallback || 'Unknown';
  const lang = track.language?.toLowerCase?.();
  return track.label || (lang && LANGUAGE_NAMES[lang]) || (lang && lang.toUpperCase()) || fallback || 'Unknown';
}

function formatTime(ms) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function PlayerScreen({ route, navigation }) {
  useKeepAwake();

  const params = route?.params || {};
  const stream_url = params.stream_url ?? params.url ?? null;
  const title = params.title ?? params.name ?? 'Playing';
  const cover = params.cover ?? params.logo ?? null;
  const { type = 'live', stream_id, extension, initialPosition = 0, startTime = 0, catchUpStart, catchUpDuration, channelList: paramChannelList, currentChannelIndex: paramChannelIndex } = params;
  const isVod = type === 'movie' || type === 'series';
  const isRadio = type === 'radio';

  // Live TV channel list for Prev/Next
  const [liveChannelList, setLiveChannelList] = useState(() => paramChannelList ?? []);
  const [liveChannelIndex, setLiveChannelIndex] = useState(() => (typeof paramChannelIndex === 'number' && paramChannelIndex >= 0 ? paramChannelIndex : 0));
  const hasChannelList = type === 'live' && liveChannelList?.length > 0;
  const currentChannel = hasChannelList ? liveChannelList[liveChannelIndex] : null;
  const effectiveStreamId = hasChannelList && currentChannel ? currentChannel.stream_id : stream_id;
  const effectiveTitle = hasChannelList && currentChannel ? (currentChannel.name ?? title) : title;
  const effectiveCover = hasChannelList && currentChannel ? (currentChannel.stream_icon ?? currentChannel.logo ?? cover) : cover;

  // Item data for history saving
  const itemRef = useRef({
    stream_id,
    name: title,
    stream_icon: cover,
    type,
    container_extension: extension,
  });

  // Track last save time
  const lastSaveTime = useRef(0);
  const SAVE_INTERVAL = 5000;

  // Core states - init uri from params so player gets valid source on first render
  const [uri, setUri] = useState(() => stream_url ?? params.url ?? null);
  const [error, setError] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  // Menu state
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('audio');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [contentFit, setContentFit] = useState('contain'); // contain | cover | fill
  const [availableAudioTracks, setAvailableAudioTracks] = useState([]);
  const [availableSubtitleTracks, setAvailableSubtitleTracks] = useState([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(null);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState(null);
  const [isFav, setIsFav] = useState(false);
  const [volume, setVolume] = useState(1);
  const [authorizedForContent, setAuthorizedForContent] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [brightness, setBrightness] = useState(0.5);
  const [showVolumeHUD, setShowVolumeHUD] = useState(false);
  const [preferHighQualityOnTV, setPreferHighQualityOnTV] = useState(false);
  const [channelToastVisible, setChannelToastVisible] = useState(false);
  const channelToastTimeoutRef = useRef(null);
  const [showBrightnessHUD, setShowBrightnessHUD] = useState(false);
  const [controlsLocked, setControlsLocked] = useState(false); // isLocked: screen lock
  const [showForwardAnim, setShowForwardAnim] = useState(false);
  const [showRewindAnim, setShowRewindAnim] = useState(false);

  const controlsTimerRef = useRef(null);
  const volumeHUDTimeoutRef = useRef(null);
  const brightnessHUDTimeoutRef = useRef(null);
  const lastTapRef = useRef(0); // timestamp for double-tap
  const lastTapZoneRef = useRef(null); // 'left' | 'right'
  const seekOverlayTimeoutRef = useRef(null);
  const gestureStartRef = useRef({ x: 0, volume: 1, brightness: 0.5 });
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const forwardSeekOpacity = useRef(new Animated.Value(0)).current;
  const rewindSeekOpacity = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);
  const lastPositionRef = useRef({ position: 0, duration: 0 });

  // Initialize video player with current URI (empty string = no source yet)
  const player = useVideoPlayer(uri || '', (p) => {
    if (p) {
      p.loop = false;
      if (typeof p.volume !== 'undefined') p.volume = volume;
      if (uri) {
        p.play();
      }
      // Enable AirPlay/Cast for screencast (iOS AirPlay)
      if (p.allowsExternalPlayback !== undefined) {
        p.allowsExternalPlayback = true;
      }
    }
  });

  // Sync player volume when our volume state changes
  useEffect(() => {
    if (!player || typeof player.volume === 'undefined') return;
    try {
      player.volume = Math.max(0, Math.min(1, volume));
    } catch (_) {}
  }, [player, volume]);

  // Listen for volume change from external (e.g. device buttons)
  useEffect(() => {
    if (!player || typeof player.addListener !== 'function') return;
    const handler = (payload) => {
      if (payload?.volume != null && isMountedRef.current) setVolume(payload.volume);
    };
    const sub = player.addListener('volumeChange', handler);
    return () => sub?.remove?.();
  }, [player]);

  // Load initial brightness
  useEffect(() => {
    let cancelled = false;
    Brightness.getBrightnessAsync?.()
      .then((v) => { if (!cancelled && typeof v === 'number') setBrightness(v); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Load prefer-high-quality-on-TV setting
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = await getPreferHighQualityOnTV();
        if (mounted) setPreferHighQualityOnTV(!!v);
      } catch (e) {
        console.warn('[Player] load preferHighQualityOnTV error:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Listen for sourceLoad - tracks are available when metadata finishes loading
  useEffect(() => {
    if (!player || !isMountedRef.current) return;
    
    const onSourceLoad = (payload) => {
      if (!isMountedRef.current) return;
      try {
        const audioTracks = payload?.availableAudioTracks ?? player?.availableAudioTracks ?? [];
        const subtitleTracks = payload?.availableSubtitleTracks ?? player?.availableSubtitleTracks ?? [];
        
        if (audioTracks.length > 0) {
          console.log('[Player] sourceLoad: Audio tracks:', audioTracks.length, audioTracks.map(t => t?.label || t?.language || t?.id));
          setAvailableAudioTracks(audioTracks);
          const current = player?.audioTrack ?? player?.currentAudioTrack;
          setCurrentAudioTrack(current || audioTracks[0]);
        }
        
        if (subtitleTracks.length > 0) {
          console.log('[Player] sourceLoad: Subtitle tracks:', subtitleTracks.length, subtitleTracks.map(t => t?.label || t?.language || t?.id));
          setAvailableSubtitleTracks(subtitleTracks);
          setCurrentSubtitleTrack(player?.subtitleTrack ?? player?.currentSubtitleTrack ?? null);
        }
      } catch (e) {
        console.warn('[Player] sourceLoad handler error:', e);
      }
    };

    const sub = typeof player.addListener === 'function' ? player.addListener('sourceLoad', onSourceLoad) : null;
    
    // Also poll periodically (tracks may populate slightly after sourceLoad on some devices)
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      try {
        const audioTracks = player.availableAudioTracks || [];
        const subtitleTracks = player.availableSubtitleTracks || [];
        setAvailableAudioTracks(prev => {
          if (audioTracks.length > 0 && prev.length === 0) {
            console.log('[Player] Poll: Audio tracks detected:', audioTracks.length);
            return audioTracks;
          }
          return prev.length > 0 ? prev : audioTracks;
        });
        setAvailableSubtitleTracks(prev => {
          if (subtitleTracks.length > 0 && prev.length === 0) {
            console.log('[Player] Poll: Subtitle tracks detected:', subtitleTracks.length);
            return subtitleTracks;
          }
          return prev.length > 0 ? prev : subtitleTracks;
        });
      } catch (_) {}
    }, 2000);

    return () => {
      sub?.remove?.();
      clearInterval(interval);
    };
  }, [player]);

  // Check favorite status for Live TV
  useEffect(() => {
    if (type !== 'live' || effectiveStreamId == null || !isMountedRef.current) return;
    let cancelled = false;
    checkFavoriteStatus(effectiveStreamId, 'live').then((status) => {
      if (!cancelled && isMountedRef.current) setIsFav(!!status);
    });
    return () => { cancelled = true; };
  }, [type, effectiveStreamId]);

  // Unlock orientation so video rotates when user physically rotates device
  useEffect(() => {
    isMountedRef.current = true;
    StatusBar.setHidden(true);

    const allowRotation = async () => {
      try {
        await ScreenOrientation.unlockAsync();
      } catch (e) {
        console.warn('[Player] Could not unlock orientation:', e);
      }
    };
    allowRotation();

    return () => {
      isMountedRef.current = false;
      StatusBar.setHidden(false);
      if (volumeHUDTimeoutRef.current) clearTimeout(volumeHUDTimeoutRef.current);
      if (brightnessHUDTimeoutRef.current) clearTimeout(brightnessHUDTimeoutRef.current);
      if (seekOverlayTimeoutRef.current) clearTimeout(seekOverlayTimeoutRef.current);
      // Save final position from ref (do NOT touch player - it may already be released)
      const { position: pos, duration: dur } = lastPositionRef.current;
      if (isVod && pos > 0 && dur > 0 && pos / dur <= 0.95) {
        updateHistory(itemRef.current, pos, dur).catch(() => {});
      }
    };
  }, [isVod]);

  // Build stream URI (use effectiveStreamId when we have channel list for Prev/Next)
  useEffect(() => {
    const sid = hasChannelList ? effectiveStreamId : stream_id;
    const useProvidedUrl = stream_url && !hasChannelList;
    if (useProvidedUrl) {
      console.log('[Player] Using provided stream_url:', stream_url?.substring(0, 80) + '...', 'Type:', type);
      setUri(stream_url);
      return;
    }
    if (sid == null) {
      setError('Missing stream information.');
      return;
    }

    let mounted = true;
    (async () => {
      try {
        // Check per-item lock; if locked and not yet authorized, prompt for PIN.
        try {
          const locked = await isContentLocked(sid);
          if (locked && !authorizedForContent) {
            if (mounted) setShowPinPrompt(true);
            return;
          }
        } catch (e) {
          console.warn('[Player] isContentLocked check failed:', e);
        }

        const [username, password, baseUrl] = await Promise.all([
          SecureStore.getItemAsync(SECURE_KEYS.username),
          SecureStore.getItemAsync(SECURE_KEYS.password),
          SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
        ]);
        if (!username || !password || !baseUrl) {
          if (mounted) setError('Missing credentials. Please log in again.');
          return;
        }
        const builtUri = buildStreamUri(baseUrl, username, password, sid, type, extension);
        console.log('[Player] Built stream_url:', builtUri?.substring(0, 80) + '...', 'Type:', type);

        // If the stream is an HLS master playlist (.m3u8) and the user prefers highest quality on TV,
        // fetch the master playlist and select the highest-resolution variant.
        let finalUri = builtUri;
        try {
          if (preferHighQualityOnTV && builtUri && builtUri.includes('.m3u8')) {
            const res = await fetch(builtUri);
            if (res.ok) {
              const text = await res.text();
              const lines = text.split(/\r?\n/);
              const variants = [];
              for (let i = 0; i < lines.length; i++) {
                const l = lines[i];
                if (l && l.startsWith('#EXT-X-STREAM-INF')) {
                  const info = l;
                  const next = (lines[i + 1] || '').trim();
                  const m = info.match(/RESOLUTION=(\d+)x(\d+)/);
                  const height = m ? parseInt(m[2], 10) : 0;
                  if (next) {
                    const url = new URL(next, builtUri).toString();
                    variants.push({ height: height || 0, url });
                  }
                }
              }
              if (variants.length > 0) {
                variants.sort((a, b) => b.height - a.height);
                finalUri = variants[0].url;
                console.log('[Player] Selected highest-variant:', finalUri);
              }
            }
          }
        } catch (e) {
          console.warn('[Player] manifest parsing/select variant failed:', e);
        }

        if (mounted) setUri(finalUri);
      } catch (e) {
        if (mounted) setError(e?.message || 'Failed to load stream.');
      }
    })();
    return () => { mounted = false; };
  }, [hasChannelList, effectiveStreamId, stream_url, stream_id, type, extension, catchUpStart, catchUpDuration, authorizedForContent]);

  const onPinSuccessForPlayer = () => {
    setShowPinPrompt(false);
    setAuthorizedForContent(true);
  };

  // Update player source when URI changes (use replaceAsync to avoid main-thread freeze)
  useEffect(() => {
    if (!uri || !player) return;
    console.log('[Player] Setting video source:', uri.substring(0, 80) + '...');
    let cancelled = false;
    (async () => {
      try {
        if (typeof player.replaceAsync === 'function') {
          await player.replaceAsync(uri);
        } else {
          player.replace(uri);
        }
        if (!cancelled) player?.play?.();
      } catch (e) {
        if (!cancelled) console.error('[Player] Error replacing source:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [uri, player]);

  // Monitor player status (never touch player after unmount - use isMountedRef)
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      try {
        const pos = (player.currentTime ?? 0) * 1000;
        const dur = (player.duration ?? 0) * 1000;

        lastPositionRef.current = { position: pos, duration: dur };

        setPosition(pos);
        setDuration(dur);
        setIsPlaying(player.playing ?? false);
        setIsBuffering(player.status === 'loading');

        if (player.status === 'readyToPlay' && !isVideoLoaded) {
          setIsVideoLoaded(true);
          setIsBuffering(false);
          console.log('[Player] Video ready to play');
          
          // Log available tracks when video is ready
          const audioCount = player.availableAudioTracks?.length || 0;
          const subCount = player.availableSubtitleTracks?.length || 0;
          console.log(`[Player] Tracks available: ${audioCount} audio, ${subCount} subtitle`);

          const seekTo = startTime > 0 ? startTime : initialPosition;
          if (seekTo > 0 && isVod && typeof player.seekBy === 'function') {
            console.log(`[Player] Seeking to ${Math.floor(seekTo / 1000)}s`);
            player.seekBy(seekTo / 1000);
          }
        }

        if (isVod && dur > 0 && pos > 0 && player.playing) {
          const now = Date.now();
          const progress = pos / dur;

          if (progress > 0.95) {
            removeFromHistory(stream_id).catch(() => {});
            return;
          }

          if (now - lastSaveTime.current >= SAVE_INTERVAL) {
            lastSaveTime.current = now;
            updateHistory(itemRef.current, pos, dur).catch(() => {});
          }
        }
      } catch (e) {
        if (isMountedRef.current) console.warn('[Player] Status update error:', e);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [player, isVod, stream_id, isVideoLoaded, startTime, initialPosition]);

  // Show transient channel ID overlay when channel changes (live mode)
  useEffect(() => {
    if (!hasChannelList) return;
    setChannelToastVisible(true);
    if (channelToastTimeoutRef.current) clearTimeout(channelToastTimeoutRef.current);
    channelToastTimeoutRef.current = setTimeout(() => setChannelToastVisible(false), 1400);
    return () => {
      if (channelToastTimeoutRef.current) clearTimeout(channelToastTimeoutRef.current);
    };
  }, [liveChannelIndex, hasChannelList]);

  // Handle player errors (only when still mounted - don't touch player after release)
  useEffect(() => {
    if (!player) return;
    const check = () => {
      if (!isMountedRef.current) return;
      try {
        if (player.status === 'error') {
          setError('Stream Offline or Unsupported Format');
          setIsBuffering(false);
        }
      } catch (_) {}
    };
    const t = setInterval(check, 1000);
    return () => clearInterval(t);
  }, [player, uri]);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    setShowControls(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();

    controlsTimerRef.current = setTimeout(() => {
      if (!showMenu) {
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setShowControls(false);
        });
      }
    }, CONTROLS_HIDE_MS);
  }, [fadeAnim, showMenu]);

  const DOUBLE_TAP_MS = 300;
  const SEEK_OVERLAY_MS = 500;
  const LEFT_ZONE = SCREEN_WIDTH * 0.35;
  const RIGHT_ZONE = SCREEN_WIDTH * 0.65;

  const handleScreenTap = useCallback((evt) => {
    if (showMenu) return;
    if (controlsLocked) return;
    const now = Date.now();
    const x = evt?.nativeEvent?.pageX ?? 0;
    const inLeftZone = x < LEFT_ZONE;
    const inRightZone = x > RIGHT_ZONE;
    const zone = inLeftZone ? 'left' : inRightZone ? 'right' : null;
    const timeSinceLastTap = now - lastTapRef.current;
    const sameZone = zone != null && lastTapZoneRef.current === zone;
    const isDoubleTap = timeSinceLastTap < DOUBLE_TAP_MS && sameZone;

    if (isDoubleTap && isVod && player) {
      if (seekOverlayTimeoutRef.current) clearTimeout(seekOverlayTimeoutRef.current);
      if (zone === 'left') {
        try { player.seekBy(-10); } catch (_) {}
        setShowRewindAnim(true);
        rewindSeekOpacity.setValue(0);
        Animated.timing(rewindSeekOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
        seekOverlayTimeoutRef.current = setTimeout(() => {
          Animated.timing(rewindSeekOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowRewindAnim(false));
        }, SEEK_OVERLAY_MS);
      } else {
        try { player.seekBy(10); } catch (_) {}
        setShowForwardAnim(true);
        forwardSeekOpacity.setValue(0);
        Animated.timing(forwardSeekOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
        seekOverlayTimeoutRef.current = setTimeout(() => {
          Animated.timing(forwardSeekOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowForwardAnim(false));
        }, SEEK_OVERLAY_MS);
      }
      lastTapRef.current = 0;
      lastTapZoneRef.current = null;
      resetControlsTimer();
      return;
    }

    lastTapRef.current = now;
    lastTapZoneRef.current = zone;
    if (showControls) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setShowControls(false);
      });
    } else {
      resetControlsTimer();
    }
  }, [showControls, showMenu, fadeAnim, resetControlsTimer, controlsLocked, isVod, player]);

  const applyBrightness = useCallback(async (value) => {
    const v = Math.max(0, Math.min(1, value));
    setBrightness(v);
    try {
      if (Brightness.setSystemBrightnessAsync) await Brightness.setSystemBrightnessAsync(v);
      else if (Brightness.setBrightnessAsync) await Brightness.setBrightnessAsync(v);
    } catch (_) {}
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.pageX ?? 0;
        gestureStartRef.current = { x, volume, brightness };
      },
      onPanResponderMove: (evt, g) => {
        const x = gestureStartRef.current.x;
        const deltaY = -g.dy;
        if (x < SCREEN_WIDTH * 0.25) {
          const newB = Math.max(0, Math.min(1, gestureStartRef.current.brightness + deltaY / 200));
          setBrightness(newB);
          applyBrightness(newB);
          setShowBrightnessHUD(true);
          if (brightnessHUDTimeoutRef.current) clearTimeout(brightnessHUDTimeoutRef.current);
          brightnessHUDTimeoutRef.current = setTimeout(() => setShowBrightnessHUD(false), 1500);
        } else if (x > SCREEN_WIDTH * 0.75) {
          const newV = Math.max(0, Math.min(1, gestureStartRef.current.volume + deltaY / 200));
          setVolume(newV);
          if (player && typeof player.volume !== 'undefined') player.volume = newV;
          setShowVolumeHUD(true);
          if (volumeHUDTimeoutRef.current) clearTimeout(volumeHUDTimeoutRef.current);
          volumeHUDTimeoutRef.current = setTimeout(() => setShowVolumeHUD(false), 1500);
        }
      },
    })
  ).current;

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [resetControlsTimer]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!player) return;
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
    resetControlsTimer();
  }, [player, resetControlsTimer]);

  // TV remote handler: map remote keys to player actions for TV devices.
  useEffect(() => {
    if (!Platform.isTV) return;
    let tvEvent = null;
    try {
      tvEvent = new TVEventHandler();
      tvEvent.enable(null, (cmp, evt) => {
        if (!evt || !isMountedRef.current) return;
        const t = evt.eventType || evt.eventKeyAction || evt.eventKey;
        // Note: event types differ by platform/device; handle common ones.
        switch (String(t)) {
          case 'playPause':
          case 'select':
          case 'click':
            togglePlay();
            break;
          case 'play':
            if (!isPlaying) togglePlay();
            break;
          case 'pause':
            if (isPlaying) togglePlay();
            break;
          case 'menu':
          case 'back':
            handleGoBack();
            break;
          case 'left':
          case 'rewind':
            if (type === 'live' && hasChannelList) {
              const len = liveChannelList.length || 0;
              if (len > 0) setLiveChannelIndex((prev) => (prev - 1 + len) % len);
            } else if (isVod && player) {
              try { player.seekBy(-10); } catch (_) {}
            }
            resetControlsTimer();
            break;
          case 'right':
          case 'forward':
            if (type === 'live' && hasChannelList) {
              const len = liveChannelList.length || 0;
              if (len > 0) setLiveChannelIndex((prev) => (prev + 1) % len);
            } else if (isVod && player) {
              try { player.seekBy(10); } catch (_) {}
            }
            resetControlsTimer();
            break;
          case 'up':
          case 'down':
            // Show controls so user can navigate UI
            resetControlsTimer();
            break;
          default:
            break;
        }
      });
    } catch (e) {
      console.warn('[Player] TVEventHandler init failed:', e);
    }
    return () => {
      try { tvEvent?.disable?.(); } catch (_) {}
    };
  }, [togglePlay, handleGoBack, isPlaying, isVod, player, type, hasChannelList, liveChannelList, resetControlsTimer]);

  // Seek handler
  const handleSeek = useCallback((e) => {
    if (!isVod || duration <= 0 || !player) return;
    const { locationX } = e.nativeEvent || {};
    const trackWidth = SCREEN_WIDTH - 80;
    if (trackWidth <= 0) return;
    const ratio = Math.max(0, Math.min(1, (locationX || 0) / trackWidth));
    const newPosition = Math.floor((ratio * duration) / 1000);
    player.seekBy(newPosition - (player.currentTime || 0));
    resetControlsTimer();
  }, [isVod, duration, player, resetControlsTimer]);

  // Go back handler
  const handleGoBack = useCallback(() => {
    navigation?.goBack();
  }, [navigation]);

  // Radio pulse animation
  useEffect(() => {
    if (!isRadio) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [isRadio, pulseAnim]);

  const progress = duration > 0 ? position / duration : 0;

  const openMenu = useCallback((tab = 'audio') => {
    console.log('[Player] ⚙️ Menu button pressed! Opening tab:', tab);
    setActiveTab(tab);
    setShowMenu(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    // Refresh tracks from player when menu opens (in case they loaded after our listener)
    if (player && isMountedRef.current) {
      try {
        const audioTracks = player.availableAudioTracks || [];
        const subtitleTracks = player.availableSubtitleTracks || [];
        if (audioTracks.length > 0) {
          setAvailableAudioTracks(audioTracks);
          const cur = player.audioTrack ?? player.currentAudioTrack ?? audioTracks[0];
          setCurrentAudioTrack(cur);
        }
        if (subtitleTracks.length > 0) {
          setAvailableSubtitleTracks(subtitleTracks);
          setCurrentSubtitleTrack(player.subtitleTrack ?? player.currentSubtitleTrack ?? null);
        }
        console.log('[Player] Menu - Audio tracks:', audioTracks.length, 'Subtitle tracks:', subtitleTracks.length);
      } catch (e) {
        console.warn('[Player] Error refreshing tracks:', e);
      }
    }
  }, [player]);

  const closeMenu = useCallback(() => {
    setShowMenu(false);
    resetControlsTimer();
  }, [resetControlsTimer]);

  // Select audio track (expo-video uses 'audioTrack' property)
  const selectAudioTrack = useCallback((track) => {
    if (!player || !isMountedRef.current) return;
    try {
      if (player.audioTrack !== undefined) {
        player.audioTrack = track;
      } else if (player.currentAudioTrack !== undefined) {
        player.currentAudioTrack = track;
      }
      setCurrentAudioTrack(track);
      console.log('[Player] Selected audio track:', track?.label || track?.language || track?.id);
    } catch (e) {
      console.warn('[Player] Error selecting audio track:', e);
    }
  }, [player]);

  // Select subtitle track (expo-video uses 'subtitleTrack' property)
  const selectSubtitleTrack = useCallback((track) => {
    if (!player || !isMountedRef.current) return;
    try {
      if (player.subtitleTrack !== undefined) {
        player.subtitleTrack = track;
      } else if (player.currentSubtitleTrack !== undefined) {
        player.currentSubtitleTrack = track;
      }
      setCurrentSubtitleTrack(track);
      console.log('[Player] Selected subtitle track:', track ? (track?.label || track?.language || track?.id) : 'Off');
    } catch (e) {
      console.warn('[Player] Error selecting subtitle track:', e);
    }
  }, [player]);

  // Set playback speed
  const setSpeed = useCallback((speed) => {
    if (!player || !isMountedRef.current) return;
    try {
      player.playbackRate = speed;
      setPlaybackSpeed(speed);
      console.log('[Player] Playback speed:', speed);
    } catch (e) {
      console.warn('[Player] Error setting speed:', e);
    }
  }, [player]);

  // Error state
  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar hidden />
        <Ionicons name="cloud-offline-outline" size={80} color="#ff6b6b" />
        <Text style={styles.errorTitle}>Stream Offline</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={20} color="#000" />
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading state
  if (!uri) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={styles.loadingText}>Preparing stream...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Video Component */}
      {!isRadio && uri && player && (
        <VideoView
          style={styles.video}
          player={player}
          nativeControls={false}
          contentFit={contentFit}
        />
      )}

      {/* Radio Mode */}
      {isRadio && (
        <View style={styles.radioContainer} pointerEvents="none">
          <Animated.View style={[styles.radioLogoWrap, { opacity: pulseAnim }]}>
            {cover ? (
              <Image
                source={typeof cover === 'number' ? cover : { uri: cover }}
                style={styles.radioLogo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.radioPlaceholder}>
                <Ionicons name="radio" size={100} color={GOLD} />
              </View>
            )}
          </Animated.View>
          <Text style={styles.radioTitle} numberOfLines={2}>{title}</Text>
        </View>
      )}

      {/* Tap Layer: tap = show controls / double-tap seek; pan = volume (right) / brightness (left) */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} collapsable={false}>
        <TouchableWithoutFeedback onPress={(e) => handleScreenTap(e)}>
          <View style={styles.tapLayer} />
        </TouchableWithoutFeedback>
      </View>
      
      {/* Prev / Next channel buttons (always available for live with channel list) */}
      {type === 'live' && hasChannelList && (
        <>
          <TouchableOpacity
            style={[styles.channelNavBtn, { left: 8 }]}
            onPress={() => {
              const len = liveChannelList.length;
              if (len === 0) return;
              setLiveChannelIndex((prev) => (prev - 1 + len) % len);
            }}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.channelNavBtn, { right: 8 }]}
            onPress={() => {
              const len = liveChannelList.length;
              if (len === 0) return;
              setLiveChannelIndex((prev) => (prev + 1) % len);
            }}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons name="chevron-forward" size={28} color="#fff" />
          </TouchableOpacity>
        </>
      )}

      {/* Channel ID toast */}
      {channelToastVisible && currentChannel && (
        <View style={styles.channelToast} pointerEvents="none">
          <Text style={styles.channelToastText}>{String(currentChannel.stream_id)} • {currentChannel.name}</Text>
        </View>
      )}

      {/* Volume HUD */}
      {showVolumeHUD && (
        <View style={styles.hudOverlay} pointerEvents="none">
          <View style={styles.hudBox}>
            <Ionicons name={volume > 0 ? 'volume-high' : 'volume-mute'} size={40} color="#fff" />
            <View style={styles.hudBarBg}>
              <View style={[styles.hudBarFill, { height: `${volume * 100}%` }]} />
            </View>
          </View>
        </View>
      )}
      {/* Brightness HUD */}
      {showBrightnessHUD && (
        <View style={styles.hudOverlay} pointerEvents="none">
          <View style={styles.hudBox}>
            <Ionicons name="sunny" size={40} color="#fff" />
            <View style={styles.hudBarBg}>
              <View style={[styles.hudBarFill, { height: `${brightness * 100}%` }]} />
            </View>
          </View>
        </View>
      )}
      {/* Lock overlay - only faded lock icon (top left), tap to unlock */}
      {controlsLocked && (
        <TouchableOpacity
          activeOpacity={1}
          style={styles.lockIconOverlay}
          onPress={() => setControlsLocked(false)}
        >
          <Ionicons name="lock-closed" size={32} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      )}

      {/* Double-tap seek overlays: >> 10s / << 10s (500ms) with fade */}
      {showForwardAnim && (
        <Animated.View style={[styles.seekIndicatorOverlay, { opacity: forwardSeekOpacity }]} pointerEvents="none">
          <Ionicons name="play-forward" size={48} color="rgba(255,255,255,0.9)" />
          <Text style={styles.seekIndicatorText}>> 10s</Text>
        </Animated.View>
      )}
      {showRewindAnim && (
        <Animated.View style={[styles.seekIndicatorOverlay, { opacity: rewindSeekOpacity }]} pointerEvents="none">
          <Ionicons name="play-back" size={48} color="rgba(255,255,255,0.9)" />
          <Text style={styles.seekIndicatorText}>&lt;&lt; 10s</Text>
        </Animated.View>
      )}

      {/* Buffering Spinner */}
      {(isBuffering || !isVideoLoaded) && !error && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      )}

      {/* Controls Overlay (hidden when locked) */}
      {showControls && !controlsLocked && (
        <Animated.View style={[styles.controlsOverlay, { opacity: fadeAnim }]} pointerEvents="box-none">
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleGoBack} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setControlsLocked(true)}
              style={styles.iconBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="lock-open-outline" size={26} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.videoTitle} numberOfLines={1}>{effectiveTitle}</Text>

            <View style={styles.topRightControls}>
              {type === 'live' && (
                <>
                  {hasChannelList && (
                    <>
                      <TouchableOpacity
                        onPress={() => {
                          const len = liveChannelList.length;
                          if (len === 0) return;
                          setLiveChannelIndex((prev) => (prev - 1 + len) % len);
                        }}
                        style={styles.iconBtn}
                      >
                        <Ionicons name="chevron-back" size={28} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          const len = liveChannelList.length;
                          if (len === 0) return;
                          setLiveChannelIndex((prev) => (prev + 1) % len);
                        }}
                        style={styles.iconBtn}
                      >
                        <Ionicons name="chevron-forward" size={28} color="#fff" />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        const item = { stream_id: effectiveStreamId, name: effectiveTitle, stream_icon: effectiveCover, type: 'live' };
                        if (isFav) {
                          await removeFromFavorites(effectiveStreamId, 'live');
                          setIsFav(false);
                        } else {
                          await addToFavorites(item, 'live');
                          setIsFav(true);
                        }
                      } catch (e) { console.warn('[Player] favorite error:', e); }
                    }}
                    style={styles.iconBtn}
                  >
                    <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={28} color={isFav ? '#e74c3c' : '#fff'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation?.navigate?.('EPG', { stream_id: effectiveStreamId, channel_name: effectiveTitle })}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="calendar-outline" size={28} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
              {!isRadio && Platform.OS === 'ios' && (
                <View style={[styles.iconBtn, { backgroundColor: 'transparent', padding: 4 }]}>
                  <VideoAirPlayButton tint="#fff" />
                </View>
              )}
              {!isRadio && Platform.OS === 'android' && (
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await Share.share({
                        message: stream_url || uri || '',
                        title,
                      });
                    } catch (_) {}
                  }}
                  style={styles.iconBtn}
                >
                  <Ionicons name="tv-outline" size={28} color="#fff" />
                </TouchableOpacity>
              )}
              {!isRadio && (
                <>
                  <TouchableOpacity 
                    onPress={() => openMenu('subs')} 
                    style={styles.iconBtn}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="text-outline" size={28} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => openMenu('audio')} 
                    style={styles.iconBtn}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="volume-high-outline" size={28} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity 
                onPress={() => openMenu('settings')} 
                style={styles.iconBtn}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                activeOpacity={0.6}
              >
                <Ionicons name="expand-outline" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => openMenu('settings')} 
                style={styles.iconBtn}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                activeOpacity={0.6}
              >
                <Ionicons name="settings-outline" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Center Play/Pause */}
          <View style={styles.centerControls}>
            {isVod && (
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => {
                  if (player) player.seekBy(-10);
                  resetControlsTimer();
                }}
              >
                <Ionicons name="play-back" size={32} color="#fff" />
                <Text style={styles.skipLabel}>10</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={togglePlay} style={styles.playPauseBtn}>
              <View style={styles.playPauseCircle}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={50} color="#fff" />
              </View>
            </TouchableOpacity>

            {isVod && (
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => {
                  if (player) player.seekBy(10);
                  resetControlsTimer();
                }}
              >
                <Ionicons name="play-forward" size={32} color="#fff" />
                <Text style={styles.skipLabel}>10</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bottom Bar */}
          <View style={styles.bottomBar}>
            {isVod && duration > 0 && (
              <>
                <TouchableOpacity
                  style={styles.seekTrack}
                  onPress={handleSeek}
                  activeOpacity={1}
                >
                  <View style={[styles.seekProgress, { width: `${progress * 100}%` }]} />
                  <View style={[styles.seekThumb, { left: `${progress * 100}%` }]} />
                </TouchableOpacity>
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{formatTime(position)}</Text>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>
              </>
            )}

            {!isVod && !isRadio && (
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>

          {/* Next Episode (series, last 60s) - mock */}
          {type === 'series' && duration > 0 && position > duration - 60000 && (
            <TouchableOpacity
              style={styles.nextEpBtn}
              onPress={() => {}}
              activeOpacity={0.8}
            >
              <Ionicons name="play-forward" size={20} color={GOLD} />
              <Text style={styles.nextEpText}>Next Ep &gt;&gt;</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* PIN prompt for locked content */}
      <PinPromptModal visible={showPinPrompt} onCancel={() => setShowPinPrompt(false)} onSuccess={onPinSuccessForPlayer} />

      {/* Premium Menu with Tabs */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.menuBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.menuContainer}>
                {/* Tab Bar */}
                <View style={styles.tabBar}>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'audio' && styles.tabActive]}
                    onPress={() => setActiveTab('audio')}
                  >
                    <Ionicons name="volume-high-outline" size={20} color={activeTab === 'audio' ? GOLD : '#888'} />
                    <Text style={[styles.tabText, activeTab === 'audio' && styles.tabTextActive]}>Audio</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'subs' && styles.tabActive]}
                    onPress={() => setActiveTab('subs')}
                  >
                    <Ionicons name="text-outline" size={20} color={activeTab === 'subs' ? GOLD : '#888'} />
                    <Text style={[styles.tabText, activeTab === 'subs' && styles.tabTextActive]}>Subtitles</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
                    onPress={() => setActiveTab('settings')}
                  >
                    <Ionicons name="options-outline" size={20} color={activeTab === 'settings' ? GOLD : '#888'} />
                    <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>Settings</Text>
                  </TouchableOpacity>
                </View>

                {/* Tab Content */}
                <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
                  {/* Audio Tab */}
                  {activeTab === 'audio' && (
                    <View>
                      <Text style={styles.sectionLabel}>Audio Track</Text>
                      {availableAudioTracks.length === 0 ? (
                        <View style={styles.noTracksBox}>
                          <Ionicons name="volume-mute-outline" size={32} color="#666" />
                          <Text style={styles.noTracksText}>No Audio Tracks Found</Text>
                          <Text style={styles.noTracksHint}>Using default audio</Text>
                        </View>
                      ) : (
                        availableAudioTracks.map((track, idx) => (
                          <TouchableOpacity
                            key={`audio-${idx}`}
                            style={[styles.optionRow, currentAudioTrack?.id === track?.id && styles.optionRowActive]}
                            onPress={() => selectAudioTrack(track)}
                          >
                            <View style={styles.optionInfo}>
                              <Text style={[styles.optionText, (currentAudioTrack?.id === track?.id || currentAudioTrack === track) && styles.optionTextActive]}>
                                {getTrackLabel(track, `Audio ${idx + 1}`)}
                              </Text>
                              <Text style={styles.optionSubtext}>
                                {track?.language ? getTrackLabel(track) : 'Default'}
                              </Text>
                            </View>
                            {(currentAudioTrack?.id === track?.id || currentAudioTrack === track) && (
                              <Ionicons name="checkmark-circle" size={22} color={GOLD} />
                            )}
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}

                  {/* Subtitles Tab */}
                  {activeTab === 'subs' && (
                    <View>
                      <Text style={styles.sectionLabel}>Subtitle Track</Text>

                      {/* Off Option */}
                      <TouchableOpacity
                        style={[styles.optionRow, currentSubtitleTrack === null && styles.optionRowActive]}
                        onPress={() => selectSubtitleTrack(null)}
                      >
                        <View style={styles.optionInfo}>
                          <Text style={[styles.optionText, currentSubtitleTrack === null && styles.optionTextActive]}>
                            Off
                          </Text>
                          <Text style={styles.optionSubtext}>Disable subtitles</Text>
                        </View>
                        {currentSubtitleTrack === null && (
                          <Ionicons name="checkmark-circle" size={22} color={GOLD} />
                        )}
                      </TouchableOpacity>

                      {availableSubtitleTracks.length === 0 ? (
                        <View style={styles.noTracksBox}>
                          <Ionicons name="text-outline" size={32} color="#666" />
                          <Text style={styles.noTracksText}>No Subtitles in Stream</Text>
                          <Text style={styles.noTracksHint}>Video has no embedded subtitles</Text>
                        </View>
                      ) : (
                        availableSubtitleTracks.map((track, idx) => (
                          <TouchableOpacity
                            key={`sub-${idx}`}
                            style={[styles.optionRow, currentSubtitleTrack?.id === track?.id && styles.optionRowActive]}
                            onPress={() => selectSubtitleTrack(track)}
                          >
                            <View style={styles.optionInfo}>
                              <Text style={[styles.optionText, (currentSubtitleTrack?.id === track?.id || currentSubtitleTrack === track) && styles.optionTextActive]}>
                                {getTrackLabel(track, `Subtitle ${idx + 1}`)}
                              </Text>
                              <Text style={styles.optionSubtext}>
                                {track?.language ? getTrackLabel(track) : 'Default'}
                              </Text>
                            </View>
                            {(currentSubtitleTrack?.id === track?.id || currentSubtitleTrack === track) && (
                              <Ionicons name="checkmark-circle" size={22} color={GOLD} />
                            )}
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}

                  {/* Settings Tab */}
                  {activeTab === 'settings' && (
                    <View>
                      <Text style={styles.sectionLabel}>Screen Size</Text>
                      <View style={styles.chipRow}>
                        {[
                          { value: 'contain', label: 'Fit' },
                          { value: 'cover', label: 'Fill' },
                          { value: 'fill', label: 'Stretch' },
                        ].map((opt) => (
                          <TouchableOpacity
                            key={opt.value}
                            style={[styles.chip, contentFit === opt.value && styles.chipActive]}
                            onPress={() => setContentFit(opt.value)}
                          >
                            <Text style={[styles.chipText, contentFit === opt.value && styles.chipTextActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Playback Speed</Text>
                      <View style={styles.chipRow}>
                        {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                          <TouchableOpacity
                            key={speed}
                            style={[styles.chip, playbackSpeed === speed && styles.chipActive]}
                            onPress={() => setSpeed(speed)}
                          >
                            <Text style={[styles.chipText, playbackSpeed === speed && styles.chipTextActive]}>
                              {speed}x
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Stream Info</Text>
                      <View style={styles.infoBox}>
                        <Text style={styles.infoText}>Using expo-video (better codec support)</Text>
                        <Text style={styles.infoText}>Format: {extension || 'auto'}</Text>
                        <Text style={styles.infoText}>Type: {type}</Text>
                        <Text style={styles.infoText}>Audio Tracks: {availableAudioTracks.length}</Text>
                        <Text style={styles.infoText}>Subtitle Tracks: {availableSubtitleTracks.length}</Text>
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Close Button */}
                <TouchableOpacity style={styles.menuCloseBtn} onPress={closeMenu}>
                  <Text style={styles.menuCloseBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  loadingText: {
    color: GOLD,
    fontSize: 16,
    marginTop: 16,
  },
  errorTitle: {
    color: '#ff6b6b',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  },
  errorSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  goBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    marginTop: 30,
  },
  goBackText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  iconBtn: {
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  iconBtnActive: {
    backgroundColor: 'rgba(255,215,0,0.3)',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 12,
  },
  hudOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  hudBox: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    minWidth: 80,
  },
  hudBarBg: {
    width: 6,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  hudBarFill: {
    width: '100%',
    backgroundColor: GOLD,
    borderRadius: 3,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  lockIconOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  lockHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 12,
  },
  seekIndicatorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  seekIndicatorText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  nextEpBtn: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.5)',
  },
  nextEpText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  channelNavBtn: {
    position: 'absolute',
    top: '40%',
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 24,
    zIndex: 50,
  },
  channelToast: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    zIndex: 1000,
  },
  channelToastText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginHorizontal: 12,
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseBtn: {
    marginHorizontal: 40,
  },
  playPauseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  skipBtn: {
    alignItems: 'center',
    padding: 10,
  },
  skipLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
  bottomBar: {
    paddingHorizontal: 40,
    paddingBottom: 30,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  seekTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginBottom: 12,
    position: 'relative',
  },
  seekProgress: {
    height: '100%',
    backgroundColor: GOLD,
    borderRadius: 2,
  },
  seekThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: GOLD,
    marginLeft: -8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: '#ccc',
    fontSize: 13,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    marginRight: 8,
  },
  liveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  radioContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  radioLogoWrap: {
    alignItems: 'center',
  },
  radioLogo: {
    width: 200,
    height: 200,
    borderRadius: 20,
  },
  radioPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,215,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioTitle: {
    color: GOLD,
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 24,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '85%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  tabTextActive: {
    color: GOLD,
  },
  tabContent: {
    padding: 20,
    maxHeight: 350,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  optionRowActive: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  optionInfo: {
    flex: 1,
  },
  optionText: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  optionSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  noTracksBox: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 12,
  },
  noTracksText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  noTracksHint: {
    color: '#555',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  chipText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#000',
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  infoText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 6,
  },
  menuCloseBtn: {
    backgroundColor: GOLD,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 8,
  },
  menuCloseBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
