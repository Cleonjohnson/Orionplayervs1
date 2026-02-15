/**
 * Orion Player 2.0 - Premium Settings (PIN lock, player mode, etc.)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  pinEnabled: 'orion_settings_pin_enabled',
  lockLive: 'orion_settings_lock_live',
  lockMovies: 'orion_settings_lock_movies',
  lockSeries: 'orion_settings_lock_series',
  playerMode: 'orion_settings_player_mode',
  resizeMode: 'orion_settings_resize_mode',
  autoRotate: 'orion_settings_auto_rotate',
  dataSaver: 'orion_settings_data_saver',
  preferredVideoQuality: 'orion_settings_preferred_video_quality',
  preferHighQualityTV: 'orion_settings_prefer_high_quality_tv',
};
const SECURE_PIN = 'orion_content_pin';

export async function getPinEnabled() {
  return (await AsyncStorage.getItem(KEYS.pinEnabled)) === 'true';
}

export async function setPinEnabled(value) {
  await AsyncStorage.setItem(KEYS.pinEnabled, value ? 'true' : 'false');
}

export async function getLockLive() {
  return (await AsyncStorage.getItem(KEYS.lockLive)) === 'true';
}

export async function setLockLive(value) {
  await AsyncStorage.setItem(KEYS.lockLive, value ? 'true' : 'false');
}

export async function getLockMovies() {
  return (await AsyncStorage.getItem(KEYS.lockMovies)) === 'true';
}

export async function setLockMovies(value) {
  await AsyncStorage.setItem(KEYS.lockMovies, value ? 'true' : 'false');
}

export async function getLockSeries() {
  return (await AsyncStorage.getItem(KEYS.lockSeries)) === 'true';
}

export async function setLockSeries(value) {
  await AsyncStorage.setItem(KEYS.lockSeries, value ? 'true' : 'false');
}

export async function getContentPin() {
  return await SecureStore.getItemAsync(SECURE_PIN);
}

export async function setContentPin(pin) {
  if (pin == null || pin === '') {
    await SecureStore.deleteItemAsync(SECURE_PIN);
    return;
  }
  await SecureStore.setItemAsync(SECURE_PIN, String(pin));
}

export async function verifyContentPin(pin) {
  const stored = await getContentPin();
  return stored != null && stored === String(pin);
}

export async function isCategoryLocked(category) {
  const enabled = await getPinEnabled();
  if (!enabled) return false;
  if (category === 'live') return await getLockLive();
  if (category === 'movies') return await getLockMovies();
  if (category === 'series') return await getLockSeries();
  return false;
}

export async function getPlayerMode() {
  const v = await AsyncStorage.getItem(KEYS.playerMode);
  return v === 'pro' ? 'pro' : 'universal';
}

export async function setPlayerMode(mode) {
  await AsyncStorage.setItem(KEYS.playerMode, mode === 'pro' ? 'pro' : 'universal');
}

export async function getResizeMode() {
  const v = await AsyncStorage.getItem(KEYS.resizeMode);
  return v === 'cover' || v === 'stretch' ? v : 'contain';
}

export async function setResizeMode(mode) {
  await AsyncStorage.setItem(KEYS.resizeMode, mode === 'cover' || mode === 'stretch' ? mode : 'contain');
}

export async function getAutoRotate() {
  return (await AsyncStorage.getItem(KEYS.autoRotate)) !== 'false';
}

export async function setAutoRotate(value) {
  await AsyncStorage.setItem(KEYS.autoRotate, value ? 'true' : 'false');
}

export async function getDataSaver() {
  return (await AsyncStorage.getItem(KEYS.dataSaver)) === 'true';
}

export async function setDataSaver(value) {
  await AsyncStorage.setItem(KEYS.dataSaver, value ? 'true' : 'false');
}

export async function getAllSettings() {
  const [pinEnabled, lockLive, lockMovies, lockSeries, playerMode, resizeMode, autoRotate, dataSaver, preferredVideoQuality] = await Promise.all([
    getPinEnabled(),
    getLockLive(),
    getLockMovies(),
    getLockSeries(),
    getPlayerMode(),
    getResizeMode(),
    getAutoRotate(),
    getDataSaver(),
    getPreferredVideoQuality(),
  ]);
  return {
    pinEnabled,
    lockLive,
    lockMovies,
    lockSeries,
    playerMode,
    resizeMode,
    autoRotate,
    dataSaver,
    preferredVideoQuality,
  };
}

// Preferred video quality (stored as a simple key: 'auto', '1080p', '4k', etc.)
export async function getPreferredVideoQuality() {
  try {
    const v = await AsyncStorage.getItem(KEYS.preferredVideoQuality);
    return v || 'auto';
  } catch (e) {
    console.warn('[SettingsService] getPreferredVideoQuality error:', e);
    return 'auto';
  }
}

export async function setPreferredVideoQuality(value) {
  try {
    await AsyncStorage.setItem(KEYS.preferredVideoQuality, value || 'auto');
  } catch (e) {
    console.warn('[SettingsService] setPreferredVideoQuality error:', e);
  }
}

export async function getPreferHighQualityOnTV() {
  try {
    const v = await AsyncStorage.getItem(KEYS.preferHighQualityTV);
    return v === 'true';
  } catch (e) {
    console.warn('[SettingsService] getPreferHighQualityOnTV error:', e);
    return false;
  }
}

export async function setPreferHighQualityOnTV(value) {
  try {
    await AsyncStorage.setItem(KEYS.preferHighQualityTV, value ? 'true' : 'false');
  } catch (e) {
    console.warn('[SettingsService] setPreferHighQualityOnTV error:', e);
  }
}

// Per-item content locks
const LOCKED_CONTENT_KEY = 'orion_settings_locked_content';

export async function getLockedContentIds() {
  try {
    const raw = await AsyncStorage.getItem(LOCKED_CONTENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[SettingsService] getLockedContentIds error:', e);
    return [];
  }
}

export async function isContentLocked(contentId) {
  try {
    const pinOn = await getPinEnabled();
    if (!pinOn) return false;
    if (contentId == null) return false;
    const list = await getLockedContentIds();
    return list.includes(String(contentId));
  } catch (e) {
    console.warn('[SettingsService] isContentLocked error:', e);
    return false;
  }
}

export async function toggleContentLock(contentId) {
  try {
    if (contentId == null) return false;
    const list = await getLockedContentIds();
    const id = String(contentId);
    const idx = list.indexOf(id);
    if (idx === -1) {
      list.push(id);
    } else {
      list.splice(idx, 1);
    }
    await AsyncStorage.setItem(LOCKED_CONTENT_KEY, JSON.stringify(list));
    return idx === -1; // true if now locked
  } catch (e) {
    console.warn('[SettingsService] toggleContentLock error:', e);
    return false;
  }
}
