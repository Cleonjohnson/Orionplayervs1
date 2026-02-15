/**
 * Orion Player 2.0 - Floating Radio Player (Culture FM)
 * Global audio bar; pauses when video/game takes over (handled by visibility prop).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Platform, Image, Linking, Alert } from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import { Audio } from 'expo-av';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useWindowDimensionsCompat } from '../theme/useWindowDimensionsCompat';

const BG = '#0f0f0f';
// Use same stream URL as RadioChannels Culture FM (avoids 404 from outdated stream IDs)
const CULTURE_FM_STREAM_URL = 'https://stream.zeno.fm/pagu8b4f9yzuv';
// Avoid static require for branding image (may be missing in some checkouts). Use null placeholder.
const CULTURE_FM_LOGO = null;

const NARROW_WIDTH = 520; // below this use two-line layout so tagline shows in portrait

async function openWebsite(url) {
  if (!url) return;
  const safeUrl = url.startsWith('http') ? url : `https://${url}`;
  try {
    await Linking.openURL(safeUrl);
  } catch (e) {
    console.warn('[FloatingRadioPlayer] openWebsite error:', e);
    Alert.alert('Cannot open link', safeUrl);
  }
}

export default function FloatingRadioPlayer({ visible = true }) {
  const { width: windowWidth } = useWindowDimensionsCompat();
  const { accent } = useTheme();
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const soundRef = useRef(null);
  const marqueeAnim = useRef(new Animated.Value(0)).current;
  const togglingRef = useRef(false);

  const loadAndPlay = useCallback(async () => {
    if (soundRef.current) return;
    setLoading(true);
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuck: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: CULTURE_FM_STREAM_URL },
        { shouldPlay: true, isLooping: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status?.isLoaded) setIsPlaying(status.isPlaying);
      });
      setIsPlaying(true);
    } catch (e) {
      console.warn('[FloatingRadioPlayer] load error:', e);
      setIsPlaying(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setIsPlaying(false);
    } catch (e) {
      console.warn('[FloatingRadioPlayer] stop error:', e);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (togglingRef.current || loading) return;
    togglingRef.current = true;
    try {
      if (isPlaying) {
        if (soundRef.current) await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        if (soundRef.current) {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        } else {
          await loadAndPlay();
        }
      }
    } catch (e) {
      console.warn('[FloatingRadioPlayer] toggle error:', e);
    } finally {
      togglingRef.current = false;
    }
  }, [isPlaying, loading, loadAndPlay]);

  // When hidden (e.g. user entered Player/Game), pause radio to avoid conflict
  useEffect(() => {
    if (!visible && isPlaying) {
      if (soundRef.current) {
        soundRef.current.pauseAsync().catch(() => {});
        setIsPlaying(false);
      }
    }
  }, [visible, isPlaying]);

  // Marquee: gentle loop
  useEffect(() => {
    if (!visible) return;
    const loop = () => {
      Animated.timing(marqueeAnim, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          marqueeAnim.setValue(0);
          loop();
        }
      });
    };
    loop();
    return () => marqueeAnim.stopAnimation();
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  if (!visible) return null;

  const isNarrow = windowWidth < NARROW_WIDTH;
  const baseHeight = isNarrow ? 92 : 56; // taller in narrow (portrait) so tagline fits
  // Add bottom safe area so the play button isn't in the Android gesture area.
  const safeBottom = Math.max(insets.bottom || 0, Platform.OS === 'android' ? 10 : 0);
  const barHeight = baseHeight + safeBottom;
  const paddingBottom = 12 + safeBottom;
  const translateX = marqueeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -260],
  });

  return (
    <View style={[styles.bar, isNarrow && styles.barNarrow, { height: barHeight, paddingBottom }]}>
      <View style={styles.inner}>
        <View style={styles.labelWrap}>
          {isNarrow ? (
            <View style={styles.narrowWrap}>
              <View style={styles.narrowRow}>
                <View style={styles.logoWrap}>
                  {CULTURE_FM_LOGO ? (
                    <Image source={CULTURE_FM_LOGO} style={styles.logoImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.logoImg, { backgroundColor: 'rgba(255,215,0,0.12)', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="radio" size={18} color="#FFD700" />
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => openWebsite('www.culturefmja.com')}
                  activeOpacity={0.8}
                  accessibilityRole="link"
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={[styles.label, { color: accent }]} numberOfLines={1}>Culture FM Live • 96.5</Text>
                  <Ionicons name="earth" size={14} color={accent} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.tagline, { color: accent }]} numberOfLines={2}>Tune in, Wise up, Get Cultured</Text>
            </View>
          ) : (
            <Animated.View style={[styles.marqueeWrap, { transform: [{ translateX }] }]}>
              <View style={styles.logoWrap}>
                {CULTURE_FM_LOGO ? (
                  <Image source={CULTURE_FM_LOGO} style={styles.logoImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.logoImg, { backgroundColor: 'rgba(255,215,0,0.12)', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="radio" size={18} color="#FFD700" />
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={() => openWebsite('www.culturefmja.com')}
                activeOpacity={0.8}
                accessibilityRole="link"
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Text style={[styles.label, { color: accent }]}>Culture FM Live • 96.5 • Tune in, Wise up, Get Cultured</Text>
                <Ionicons name="earth" size={14} color={accent} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.playBtn, { borderColor: accent }, isPlaying && { backgroundColor: accent }]}
          onPress={togglePlayPause}
          disabled={loading}
          activeOpacity={0.8}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause radio' : 'Play radio'}
        >
          {loading ? (
            <Text style={[styles.playText, { color: accent }]}>…</Text>
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={isPlaying ? '#000' : accent} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 52,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,215,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    // Make sure this sits above screen content and reliably receives taps.
    zIndex: 9999,
    elevation: 24,
  },
  barNarrow: {
    minHeight: 100,
    paddingVertical: 14,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  labelWrap: {
    flex: 1,
    overflow: 'hidden',
    marginRight: 12,
  },
  narrowWrap: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  narrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagline: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.95,
    lineHeight: 14,
  },
  marqueeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  logoImg: {
    width: 48,
    height: 48,
  },
  iconLabel: { marginRight: 8 },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  playBtn: {
    minWidth: 44,
    minHeight: 44,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    elevation: 2,
  },
  playText: { fontSize: 18 },
});
