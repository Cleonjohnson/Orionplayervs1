/**
 * Sound Service - Global sound effects for games (expo-av + Haptics)
 * Plays real audio (short SFX) when enabled; volume 0–1. Toggle in Settings or in-game Sound panel.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

const KEY_SFX_ENABLED = 'orion_sfx_enabled';
const KEY_SFX_VOLUME = 'orion_sfx_volume';
// Try multiple URLs (some block 403); first that loads wins. Or add assets/sounds/tap.mp3 and use require().
const SFX_URIS = [
  'https://assets.mixkit.co/sfx/2560-hit.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
];

let cachedEnabled = true;
let cachedVolume = 1;
let cachedGameMusicEnabled = true;
let audioModeSet = false;
let sfxSound = null;
let sfxLoadPromise = null;
let sfxIsLongClip = false; // true if we're using a long clip and must stop after short play

async function ensureAudioMode() {
  if (audioModeSet) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    audioModeSet = true;
  } catch (e) {
    console.warn('[SoundService] setAudioModeAsync failed:', e);
  }
}

function getVolume() {
  return Math.max(0, Math.min(1, cachedVolume));
}

export async function getSfxEnabled() {
  try {
    const v = await AsyncStorage.getItem(KEY_SFX_ENABLED);
    cachedEnabled = v === null ? true : v === 'true';
    return cachedEnabled;
  } catch (e) {
    return true;
  }
}

export async function setSfxEnabled(enabled) {
  try {
    await AsyncStorage.setItem(KEY_SFX_ENABLED, String(enabled));
    cachedEnabled = enabled;
  } catch (e) {
    console.warn('[SoundService] setSfxEnabled failed:', e);
  }
}

export async function getSfxVolume() {
  try {
    const v = await AsyncStorage.getItem(KEY_SFX_VOLUME);
    const num = v == null ? 1 : parseFloat(v, 10);
    cachedVolume = Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 1;
    return cachedVolume;
  } catch (e) {
    return 1;
  }
}

export async function setSfxVolume(volume) {
  const v = Math.max(0, Math.min(1, Number(volume)));
  try {
    await AsyncStorage.setItem(KEY_SFX_VOLUME, String(v));
    cachedVolume = v;
  } catch (e) {
    console.warn('[SoundService] setSfxVolume failed:', e);
  }
}

async function ensureSfxLoaded() {
  if (sfxSound) return true;
  if (sfxLoadPromise) return sfxLoadPromise;
  sfxLoadPromise = (async () => {
    await ensureAudioMode();
    for (let i = 0; i < SFX_URIS.length; i++) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: SFX_URIS[i] },
          { shouldPlay: false }
        );
        sfxSound = sound;
        sfxIsLongClip = SFX_URIS[i].indexOf('SoundHelix') !== -1;
        return true;
      } catch (e) {
        if (i === SFX_URIS.length - 1) {
          console.warn('[SoundService] SFX load failed (using Haptics only):', e?.message || e);
        }
      }
    }
    return false;
  })();
  return sfxLoadPromise;
}

/**
 * Play a sound effect. Respects Sound Effects toggle and volume.
 * Types: 'coin' | 'crash' | 'success' | 'tap' | 'jump' | 'scroll' | 'fail'
 */
export function playSfx(type) {
  if (!cachedEnabled) return;
  const vol = getVolume();
  // Haptics (always when enabled)
  try {
    switch (type) {
      case 'coin':
      case 'success':
      case 'scroll':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'crash':
      case 'fail':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'tap':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'jump':
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
    }
  } catch (_) {}
  // Audio (if loaded and volume > 0)
  if (vol <= 0) return;
  ensureSfxLoaded().then((loaded) => {
    if (!loaded || !sfxSound) return;
    sfxSound.setVolumeAsync(vol).catch(() => {});
    sfxSound.setPositionAsync(0).catch(() => {});
    sfxSound.playAsync().then(() => {
      if (sfxIsLongClip) {
        setTimeout(() => {
          sfxSound?.setPositionAsync(0).catch(() => {});
          sfxSound?.stopAsync().catch(() => {});
        }, 120);
      }
    }).catch(() => {});
  });
}

export async function initAudioMode() {
  await ensureAudioMode();
}

export async function refreshSfxEnabled() {
  await getSfxEnabled();
}

export async function refreshSfxVolume() {
  await getSfxVolume();
}

export async function getGameMusicEnabled() {
  try {
    const v = await AsyncStorage.getItem(KEY_GAME_MUSIC_ENABLED);
    cachedGameMusicEnabled = v === null ? true : v === 'true';
    return cachedGameMusicEnabled;
  } catch (e) {
    return true;
  }
}

export async function setGameMusicEnabled(enabled) {
  try {
    await AsyncStorage.setItem(KEY_GAME_MUSIC_ENABLED, String(enabled));
    cachedGameMusicEnabled = enabled;
  } catch (e) {
    console.warn('[SoundService] setGameMusicEnabled failed:', e);
  }
}

export async function refreshGameMusicEnabled() {
  await getGameMusicEnabled();
}
