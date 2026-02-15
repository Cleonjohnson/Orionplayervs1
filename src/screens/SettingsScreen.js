/**
 * Orion Player 2.0 - Settings Screen (Account Dashboard)
 * User Account Info + App Preferences.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TouchableOpacity from '../components/TouchableOpacity';
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { syncLiveTV, syncMovies, syncSeries } from '../services/PlaylistService';
import { performBackgroundSync } from '../services/BackgroundSyncService';
import { getPinEnabled, setPinEnabled, getLockLive, setLockLive, getLockMovies, setLockMovies, getLockSeries, setLockSeries, getContentPin, setContentPin } from '../services/SettingsService';
import { getSfxEnabled, setSfxEnabled, getSfxVolume, setSfxVolume, getGameMusicEnabled, setGameMusicEnabled } from '../services/SoundService';
import { getAppTheme, setAppTheme, getThemesList } from '../services/ThemeService';
import { getPreferredVideoQuality, setPreferredVideoQuality, getPreferHighQualityOnTV, setPreferHighQualityOnTV } from '../services/SettingsService';
import { getAccountInfo, formatExpiryDisplay } from '../services/XtreamService';
import { useTheme } from '../context/ThemeContext';
import { ORION_BANNER, BRAND } from '../constants/Branding';
import { checkForUpdate, fetchAndReload, isUpdatesAvailable } from '../services/UpdateService';
import { isTV, fs } from '../constants/device';

const GOLD = '#FFD700';
// --- SAFETY PALETTE ---
const BG = "#121212";
const TEXT = "#FFFFFF";
const ACCENT = "#FFD700";
// -----------------------
import * as FileSystem from 'expo-file-system';
const SECURE_KEYS = {
  username: 'orion_xtream_username',
  password: 'orion_xtream_password',
  baseUrl: 'orion_xtream_base_url',
};

export default function SettingsScreen({ navigation }) {
  const { themeKey: contextThemeKey, setThemeKey, accent } = useTheme();
  const [userInfo, setUserInfo] = useState({
    username: 'Loading...',
    expiry: 'Loading...',
    status: 'Active',
  });
  const [parentalControl, setParentalControl] = useState(false);
  const [lockLive, setLockLiveState] = useState(false);
  const [lockMovies, setLockMoviesState] = useState(false);
  const [lockSeries, setLockSeriesState] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [sfxEnabled, setSfxEnabledState] = useState(true);
  const [sfxVolume, setSfxVolumeState] = useState(1);
  const [appTheme, setAppThemeState] = useState(contextThemeKey);
  const [refreshing, setRefreshing] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateApplying, setUpdateApplying] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [preferredVideoQuality, setPreferredVideoQualityState] = useState('auto');
  // PRO features state
  const [cacheSize, setCacheSize] = useState(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isTestingNetwork, setIsTestingNetwork] = useState(false);
  const [useMpegTs, setUseMpegTs] = useState(false);
  const [useExternalPlayer, setUseExternalPlayer] = useState(false);
  const [preferHighQualityTV, setPreferHighQualityTV] = useState(false);
  // Purchase / license states
  const [licenseCodeInput, setLicenseCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [licenseTier, setLicenseTier] = useState(null); // 'free' | 'pro'
  const SERVER_BASE = 'https://YOUR_SERVER_URL_HERE'; // <- replace with your deployed server

  useEffect(() => {
    (async () => {
      try {
        const tier = await AsyncStorage.getItem('orion_tier');
        setLicenseTier(tier || 'free');
      } catch (_) {}
    })();
  }, []);

  const loadAccount = useCallback(async () => {
    try {
      const [username, password, baseUrl] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEYS.username),
        SecureStore.getItemAsync(SECURE_KEYS.password),
        SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
      ]);
      const displayName = username || 'Guest';
      if (!username || !password || !baseUrl) {
        setUserInfo({ username: displayName, expiry: '—', status: 'Active' });
        return;
      }
      const base = (baseUrl || '').trim().toLowerCase().startsWith('http') ? baseUrl.trim() : 'http://' + baseUrl.trim();
      const account = await getAccountInfo({ username, password, baseUrl: base });
      const expiryStr = account?.exp_date != null ? formatExpiryDisplay(account.exp_date) : null;
      setUserInfo({
        username: displayName,
        expiry: expiryStr || '—',
        status: account?.status === 'Active' || account?.active_cons != null ? 'Active' : 'Active',
      });
    } catch (e) {
      console.warn('Load account error:', e);
      setUserInfo((prev) => ({ ...prev, expiry: '—', status: 'Unknown' }));
    }
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAccount();
    setRefreshing(false);
  }, [loadAccount]);

  useEffect(() => {
    const loadParental = async () => {
      try {
        const [pinOn, live, movies, series] = await Promise.all([
          getPinEnabled(),
          getLockLive(),
          getLockMovies(),
          getLockSeries(),
        ]);
        setParentalControl(pinOn);
        setLockLiveState(live);
        setLockMoviesState(movies);
        setLockSeriesState(series);
      } catch (e) {
        console.warn('Load parental settings error:', e);
      }
    };
    loadParental();
  }, []);

  const handleParentalChange = async (value) => {
    setParentalControl(value);
    try {
      await setPinEnabled(value);
    } catch (e) {
      console.warn('Set PIN enabled error:', e);
    }
  };

  const handleLockLiveChange = async (value) => {
    setLockLiveState(value);
    try {
      await setLockLive(value);
    } catch (e) {
      console.warn('Set lock Live error:', e);
    }
  };

  const handleLockMoviesChange = async (value) => {
    setLockMoviesState(value);
    try {
      await setLockMovies(value);
    } catch (e) {
      console.warn('Set lock Movies error:', e);
    }
  };

  const handleLockSeriesChange = async (value) => {
    setLockSeriesState(value);
    try {
      await setLockSeries(value);
    } catch (e) {
      console.warn('Set lock Series error:', e);
    }
  };

  const handleSfxChange = async (value) => {
    setSfxEnabledState(value);
    try {
      await setSfxEnabled(value); // SoundService – updates global cache for games
    } catch (e) {
      console.warn('Set SFX error:', e);
    }
  };

  useEffect(() => {
    getAppTheme().then(setAppThemeState);
  }, []);

  // Load preferred video quality from settings store
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = await getPreferredVideoQuality();
        if (mounted) setPreferredVideoQualityState(v || 'auto');
      } catch (e) {
        console.warn('Load preferred video quality error:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load "prefer highest quality on TV" setting
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = await getPreferHighQualityOnTV();
        if (mounted) setPreferHighQualityTV(!!v);
      } catch (e) {
        console.warn('[Settings] load preferHighQualityOnTV error:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setAppThemeState(contextThemeKey);
  }, [contextThemeKey]);

  const handleThemeSelect = async (key) => {
    setAppThemeState(key);
    await setAppTheme(key);
    setThemeKey(key);
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await SecureStore.deleteItemAsync(SECURE_KEYS.username);
            await SecureStore.deleteItemAsync(SECURE_KEYS.password);
            await SecureStore.deleteItemAsync(SECURE_KEYS.baseUrl);
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          } catch (e) {
            console.warn('Logout error:', e);
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }
        },
      },
    ]);
  };

  const handleClearCache = () => {
    // enhanced: calculate cache size and delete files
    (async () => {
      try {
        setIsClearingCache(true);
        const human = (bytes) => {
          if (!bytes) return '0 B';
          const thresh = 1024;
          if (Math.abs(bytes) < thresh) return bytes + ' B';
          const units = ['KB','MB','GB','TB'];
          let u = -1;
          do {
            bytes /= thresh;
            ++u;
          } while(Math.abs(bytes) >= thresh && u < units.length - 1);
          return bytes.toFixed(1) + ' ' + units[u];
        };

        async function getDirSize(dir) {
          let total = 0;
          try {
            const entries = await FileSystem.readDirectoryAsync(dir);
            for (const name of entries) {
              const full = dir + name;
              const info = await FileSystem.getInfoAsync(full, { size: true });
              if (info.isDirectory) {
                total += await getDirSize(full + '/');
              } else {
                total += info.size || 0;
              }
            }
          } catch (e) {
            // ignore
          }
          return total;
        }

        const cacheDir = FileSystem.cacheDirectory || FileSystem.cacheDirectory;
        const sizeBytes = await getDirSize(cacheDir);
        // delete cache directory contents
        try {
          await FileSystem.deleteAsync(cacheDir, { idempotent: true });
          // recreate empty cache dir (some platforms expect it)
          try { await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }); } catch (_) {}
        } catch (e) {
          console.warn('[Settings] clear cache delete error:', e);
        }
        setCacheSize(0);
        Alert.alert('Cache Cleared', `Cleared ${human(sizeBytes)} from cache.`);
      } catch (e) {
        console.warn('[Settings] clear cache error:', e);
        Alert.alert('Clear Cache', 'Failed to clear cache.');
      } finally {
        setIsClearingCache(false);
      }
    })();
  };

  const runPingTest = async () => {
    const url = 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png';
    setIsTestingNetwork(true);
    try {
      const start = Date.now();
      // add cache-buster
      const res = await fetch(url + '?_=' + start, { cache: 'no-store' });
      const took = Date.now() - start;
      if (!res.ok) throw new Error('Request failed');
      const label = took < 100 ? 'Good' : took < 300 ? 'Fair' : 'Slow';
      Alert.alert('Ping Test', `Speed: ${label} (${took} ms)`);
    } catch (e) {
      console.warn('[Settings] ping test failed:', e);
      Alert.alert('Ping Test', 'Network test failed.');
    } finally {
      setIsTestingNetwork(false);
    }
  };

  const getCred = async () => {
    const [username, password, baseUrl] = await Promise.all([
      SecureStore.getItemAsync(SECURE_KEYS.username),
      SecureStore.getItemAsync(SECURE_KEYS.password),
      SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
    ]);
    return { username: username || '', password: password || '', baseUrl: baseUrl || '' };
  };

  const handleSync = async (type) => {
    const cred = await getCred();
    if (!cred.username || !cred.password || !cred.baseUrl) {
      Alert.alert('Sync Error', 'Please log in first with valid credentials.');
      return;
    }
    const url = cred.baseUrl.trim();
    const base = url.toLowerCase().startsWith('http') ? url : `http://${url}`;
    const opts = { username: cred.username, password: cred.password, baseUrl: base };
    setSyncing(true);
    try {
      if (type === 'live') {
        const r = await syncLiveTV(opts);
        Alert.alert('Live TV Sync', r.success ? `Loaded ${r.channelsCount} channels.` : (r.error || 'Failed.'));
      } else if (type === 'movies') {
        const r = await syncMovies(opts);
        Alert.alert('Movies Sync', r.success ? `Loaded ${r.count} movies.` : (r.error || 'Failed.'));
      } else if (type === 'series') {
        const r = await syncSeries(opts);
        Alert.alert('Series Sync', r.success ? `Loaded ${r.count} series.` : (r.error || 'Failed.'));
      }
    } catch (e) {
      Alert.alert('Sync Error', e?.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckForUpdate = async () => {
    setUpdateMessage('');
    setUpdateAvailable(false);
    setUpdateChecking(true);
    try {
      const result = await checkForUpdate();
      setUpdateMessage(result.message);
      setUpdateAvailable(result.available);
    } finally {
      setUpdateChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    setUpdateApplying(true);
    try {
      const result = await fetchAndReload();
      if (!result.ok) {
        setUpdateMessage(result.error || 'Update failed.');
      }
    } finally {
      setUpdateApplying(false);
    }
  };

  const openPhone = () => Linking.openURL(`tel:${BRAND.phoneTel}`);
  const openEmail = () => Linking.openURL(`mailto:${BRAND.email}`);
  const openWebsite = async (url = 'www.culturefmja.com') => {
    if (!url) return;
    const safeUrl = url.startsWith('http') ? url : `https://${url}`;
    try {
      await Linking.openURL(safeUrl);
    } catch (e) {
      console.warn('[Settings] openWebsite error:', e);
      Alert.alert('Cannot open link', safeUrl);
    }
  };

  // Load existing PIN when modal opens
  useEffect(() => {
    let mounted = true;
    if (!showPinSetup) return;
    (async () => {
      try {
        const existing = await getContentPin();
        if (mounted) setPinInput(existing || '');
      } catch (e) {
        console.warn('[Settings] load existing PIN error:', e);
      }
    })();
    return () => { mounted = false; };
  }, [showPinSetup]);

  const createCheckoutSession = async () => {
    setPurchaseLoading(true);
    try {
      const email = await AsyncStorage.getItem('orion_user_email');
      // Use Gumroad flow if GUMROAD_PRODUCT_URL is provided on server
      const gumRes = await fetch(`${SERVER_BASE}/gumroad-product`);
      if (gumRes.ok) {
        const g = await gumRes.json();
        const productUrl = g.url;
        // open product page with buyer email prefilled if possible
        const safeUrl = productUrl + (productUrl.includes('?') ? '&' : '?') + `buyer_email=${encodeURIComponent(email || '')}`;
        await Linking.openURL(safeUrl);
        // Poll for license by email for up to 2 minutes
        const start = Date.now();
        const timeout = 120 * 1000;
        const pollInterval = 3000;
        let found = false;
        while (Date.now() - start < timeout) {
          try {
            const r = await fetch(`${SERVER_BASE}/licenses-by-email?email=${encodeURIComponent(email || '')}`);
            const s = await r.json();
            if (s.found && s.code) {
              // redeem
              const verifyRes = await fetch(`${SERVER_BASE}/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: s.code }),
              });
              const v = await verifyRes.json();
              if (v.ok) {
                await AsyncStorage.setItem('orion_license_code', s.code);
                await AsyncStorage.setItem('orion_tier', 'pro');
                setLicenseTier('pro');
                Alert.alert('Success', 'Premium unlocked. Thank you!');
                found = true;
                break;
              } else {
                Alert.alert('Redeem failed', v.error || 'Could not redeem code.');
                found = true;
                break;
              }
            }
          } catch (e) {
            // ignore transient errors
          }
          await new Promise((r) => setTimeout(r, pollInterval));
        }
        if (!found) {
          Alert.alert('Checkout', 'If your purchase completed, check your email for the license code and paste it into Redeem.');
        }
      } else {
        Alert.alert('Checkout Error', 'Gumroad product not configured on server.');
      }
    } catch (e) {
      console.warn('[Settings] createCheckoutSession error:', e);
      Alert.alert('Error', 'Failed to start checkout.');
    } finally {
      setPurchaseLoading(false);
    }
  };

  const redeemLicense = async () => {
    const code = (licenseCodeInput || '').trim();
    if (!code) {
      Alert.alert('Enter code', 'Please enter your license code.');
      return;
    }
    setIsRedeeming(true);
    try {
      const res = await fetch(`${SERVER_BASE}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const j = await res.json();
      if (j.ok) {
        await AsyncStorage.setItem('orion_license_code', code);
        await AsyncStorage.setItem('orion_tier', 'pro');
        setLicenseTier('pro');
        Alert.alert('Success', 'Premium unlocked. Restart app if needed.');
      } else {
        Alert.alert('Invalid', j.error || 'Code invalid or already used.');
      }
    } catch (e) {
      console.warn('[Settings] redeemLicense error:', e);
      Alert.alert('Error', 'Failed to redeem code.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleSavePin = async () => {
    const pin = (pinInput || '').trim();
    if (!/^\d{4}$/.test(pin)) {
      Alert.alert('Invalid PIN', 'Please enter a 4-digit numeric PIN.');
      return;
    }
    try {
      await setContentPin(pin);
      setShowPinSetup(false);
      Alert.alert('PIN Saved', 'Parental PIN has been saved.');
    } catch (e) {
      console.warn('[Settings] save PIN error:', e);
      Alert.alert('Error', 'Failed to save PIN.');
    }
  };

  const handleCancelPin = () => {
    setPinInput('');
    setShowPinSetup(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />
      }
    >
      {/* About / Contact – ORION branding */}
      <View style={styles.aboutCard}>
        <Image source={ORION_BANNER} style={styles.aboutBanner} resizeMode="contain" />
        <Text style={styles.aboutTagline}>{BRAND.tagline}</Text>
        <TouchableOpacity style={styles.contactRow} onPress={openPhone}>
          <Ionicons name="call" size={22} color={GOLD} />
          <Text style={styles.contactText}>{BRAND.phone}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactRow} onPress={openEmail}>
          <Ionicons name="mail" size={22} color={GOLD} />
          <Text style={styles.contactText}>{BRAND.email}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactRow} onPress={() => openWebsite('www.culturefmja.com')}>
          <Ionicons name="globe-outline" size={22} color={GOLD} />
          <Text style={styles.contactText}>www.culturefmja.com</Text>
        </TouchableOpacity>
        <View style={styles.socialRow}>
          <Text style={styles.socialLabel}>Follow us:</Text>
          <View style={styles.socialIcons}>
            <TouchableOpacity onPress={() => Linking.openURL(BRAND.social.instagram)} style={styles.socialBtn}>
              <Ionicons name="logo-instagram" size={26} color={GOLD} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(BRAND.social.whatsapp)} style={styles.socialBtn}>
              <Ionicons name="logo-whatsapp" size={26} color={GOLD} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(BRAND.social.tiktok)} style={styles.socialBtn}>
              <Ionicons name="musical-notes" size={26} color={GOLD} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(BRAND.social.facebook)} style={styles.socialBtn}>
              <Ionicons name="logo-facebook" size={26} color={GOLD} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* App updates (OTA) */}
      {isUpdatesAvailable() && (
        <>
          <Text style={styles.sectionHeader}>APP UPDATES</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Check for updates</Text>
            {updateChecking || updateApplying ? (
              <ActivityIndicator size="small" color={GOLD} />
            ) : (
              <TouchableOpacity
                style={styles.updateBtn}
                onPress={handleCheckForUpdate}
                disabled={updateChecking || updateApplying}
              >
                <Ionicons name="refresh" size={22} color={GOLD} />
                <Text style={styles.updateBtnText}>Check</Text>
              </TouchableOpacity>
            )}
          </View>
          {updateMessage ? (
            <View style={styles.updateMessageRow}>
              <Text style={[styles.updateMessage, updateAvailable && { color: '#4CAF50' }]}>{updateMessage}</Text>
              {updateAvailable && (
                <TouchableOpacity
                  style={[styles.updateBtn, styles.updateApplyBtn]}
                  onPress={handleApplyUpdate}
                  disabled={updateApplying}
                >
                  {updateApplying ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.updateApplyBtnText}>Restart to apply</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </>
      )}

      <Text style={styles.header}>SETTINGS</Text>

      {/* Account Card (Hero) */}
      <LinearGradient
        colors={['#252525', '#1a1a1a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.accountCard}
      >
        <View style={styles.avatarWrap}>
          <Ionicons name="person-circle" size={80} color={GOLD} />
        </View>
        <Text style={styles.accountUsername}>{userInfo.username}</Text>
        <Text style={styles.accountStatus}>Subscription Active</Text>
        <Text style={styles.accountExpiry}>Expires: {userInfo.expiry}</Text>
      </LinearGradient>

      {/* General */}
      <Text style={styles.sectionHeader}>GENERAL</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Auto-Play Next Episode</Text>
        <Switch
          value={autoPlay}
          onValueChange={setAutoPlay}
          trackColor={{ false: '#333', true: GOLD }}
          thumbColor="#fff"
        />
      </View>

      {/* Appearance (TiviMate-style) */}
      <Text style={styles.sectionHeader}>APPEARANCE</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>App theme</Text>
      </View>
      <View style={styles.themeRow}>
        {getThemesList().map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.themeChip, appTheme === t.key && { borderColor: t.accent, backgroundColor: t.accent + '22' }]}
            onPress={() => handleThemeSelect(t.key)}
          >
            <View style={[styles.themeDot, { backgroundColor: t.accent }]} />
            <Text style={[styles.themeChipText, appTheme === t.key && { color: t.accent }]}>{t.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sound */}
      <Text style={styles.sectionHeader}>SOUND</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Sound Effects (Games)</Text>
        <Switch
          value={sfxEnabled}
          onValueChange={handleSfxChange}
          trackColor={{ false: '#333', true: GOLD }}
          thumbColor="#fff"
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Game sound volume</Text>
      </View>
      <View style={styles.sliderRow}>
        <Ionicons name="volume-mute-outline" size={20} color={GOLD} />
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={sfxVolume}
          onValueChange={setSfxVolumeState}
          onSlidingComplete={async (v) => {
            try { await setSfxVolume(v); } catch (e) { console.warn('Set volume error:', e); }
          }}
          minimumTrackTintColor={GOLD}
          maximumTrackTintColor="#333"
          thumbTintColor={GOLD}
        />
        <Ionicons name="volume-high-outline" size={20} color={GOLD} />
      </View>

      {/* Security */}
      <Text style={styles.sectionHeader}>SECURITY & CHILD LOCK</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Parental Control (Enable PIN)</Text>
        <Switch
          value={parentalControl}
          onValueChange={handleParentalChange}
          trackColor={{ false: '#333', true: GOLD }}
          thumbColor="#fff"
        />
      </View>
      {parentalControl && (
        <>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowPinSetup(true)}>
            <Ionicons name="key-outline" size={22} color={GOLD} />
            <Text style={styles.actionBtnText}>Set / Change PIN</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Lock Live TV</Text>
            <Switch value={lockLive} onValueChange={handleLockLiveChange} trackColor={{ false: '#333', true: GOLD }} thumbColor="#fff" />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Lock Movies</Text>
            <Switch value={lockMovies} onValueChange={handleLockMoviesChange} trackColor={{ false: '#333', true: GOLD }} thumbColor="#fff" />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Lock Series</Text>
            <Switch value={lockSeries} onValueChange={handleLockSeriesChange} trackColor={{ false: '#333', true: GOLD }} thumbColor="#fff" />
          </View>
        </>
      )}

      {/* Video quality preference for Live TV, Movies, Series */}
      <Text style={styles.sectionHeader}>VIDEO & PLAYBACK</Text>
      <Text style={styles.syncHint}>Preferred quality when provider offers multiple. Playback uses stream native resolution (up to UHD/4K when available).</Text>
      <View style={styles.chipRow}>
        {[
          { value: 'auto', label: 'Auto (best)' },
          { value: '1080p', label: 'HD 1080p' },
          { value: '4k', label: 'UHD 4K' },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.themeChip, preferredVideoQuality === opt.value && styles.themeChipActive]}
            onPress={async () => {
              setPreferredVideoQualityState(opt.value);
              try {
                await setPreferredVideoQuality(opt.value);
              } catch (e) {
                console.warn('Set video quality error:', e);
              }
            }}
          >
            <Text style={[styles.themeChipText, preferredVideoQuality === opt.value && styles.themeChipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
              {isTV && (
                <View style={[styles.row, { marginTop: 12 }]}>
                  <Text style={styles.rowLabel}>Prefer highest quality on TV</Text>
                  <Switch
                    value={preferHighQualityTV}
                    onValueChange={async (v) => {
                      setPreferHighQualityTV(v);
                      try { await setPreferHighQualityOnTV(v); } catch (e) { console.warn('setPreferHighQualityOnTV error', e); }
                    }}
                    trackColor={{ false: '#333', true: GOLD }}
                    thumbColor="#fff"
                  />
                </View>
              )}

      {/* PRO FEATURES */}
      <Text style={styles.sectionHeader}>PRO FEATURES</Text>
      <Text style={styles.syncHint}>Advanced tools for power users.</Text>

      <View style={{ marginTop: 8 }}>
        <TouchableOpacity
          style={[styles.actionBtn, isClearingCache && styles.actionBtnDisabled]}
          onPress={handleClearCache}
          disabled={isClearingCache}
        >
          <Ionicons name="trash-outline" size={22} color={GOLD} />
          <Text style={styles.actionBtnText}>Clear App Cache {cacheSize != null ? `(${Math.round(cacheSize)} bytes)` : ''}</Text>
          {isClearingCache && <ActivityIndicator size="small" color={GOLD} style={{ marginLeft: 8 }} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, isTestingNetwork && styles.actionBtnDisabled, { marginTop: 10 }]}
          onPress={runPingTest}
          disabled={isTestingNetwork}
        >
          <Ionicons name="speedometer-outline" size={22} color={GOLD} />
          <Text style={styles.actionBtnText}>Run Network Ping Test</Text>
          {isTestingNetwork && <ActivityIndicator size="small" color={GOLD} style={{ marginLeft: 8 }} />}
        </TouchableOpacity>

        <View style={[styles.row, { marginTop: 10 }]}>
          <Text style={styles.rowLabel}>Use MPEGTS (.ts)</Text>
          <Switch value={useMpegTs} onValueChange={setUseMpegTs} trackColor={{ false: '#333', true: GOLD }} thumbColor="#fff" />
        </View>

        <View style={[styles.row, { marginTop: 6 }]}>
          <Text style={styles.rowLabel}>Use External Player (VLC)</Text>
          <Switch value={useExternalPlayer} onValueChange={setUseExternalPlayer} trackColor={{ false: '#333', true: GOLD }} thumbColor="#fff" />
        </View>
        {useExternalPlayer && <Text style={{ color: '#aaa', fontSize: 12, marginTop: 6 }}>Will attempt to open streams in VLC app when available.</Text>}
      </View>

      {/* Purchase / Redeem */}
      <Text style={[styles.sectionHeader, { marginTop: 18 }]}>PREMIUM</Text>
      <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={styles.rowLabel}>Current Tier</Text>
        <Text style={{ color: GOLD, fontWeight: '700' }}>{licenseTier === 'pro' ? 'Premium' : 'Free'}</Text>
      </View>
      <View style={{ marginTop: 8 }}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FFD700' }]} onPress={createCheckoutSession} disabled={purchaseLoading}>
          <Ionicons name="card-outline" size={22} color="#000" />
          <Text style={[styles.actionBtnText, { color: '#000', marginLeft: 8 }]}>Buy on Web (Stripe)</Text>
          {purchaseLoading && <ActivityIndicator size="small" color="#000" style={{ marginLeft: 8 }} />}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', marginTop: 10, gap: 8 }}>
          <TextInput
            value={licenseCodeInput}
            onChangeText={setLicenseCodeInput}
            placeholder="Enter license code"
            placeholderTextColor="#888"
            style={{ flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, color: '#fff', borderWidth: 1, borderColor: '#333' }}
          />
          <TouchableOpacity style={[styles.actionBtn, { paddingHorizontal: 14 }]} onPress={redeemLicense} disabled={isRedeeming}>
            <Ionicons name="checkmark-circle-outline" size={22} color={GOLD} />
            <Text style={styles.actionBtnText}>Redeem</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Sync - CRITICAL for Home to load data */}
      <Text style={styles.sectionHeader}>CONTENT SYNC</Text>
      <Text style={styles.syncHint}>Tap to fetch Live TV, Movies & Series from your provider.</Text>
      <TouchableOpacity
        style={[styles.actionBtn, syncing && styles.actionBtnDisabled]}
        onPress={() => handleSync('live')}
        disabled={syncing}
      >
        <Ionicons name="tv-outline" size={22} color={GOLD} />
        <Text style={styles.actionBtnText}>Sync Live TV</Text>
        {syncing && <ActivityIndicator size="small" color={GOLD} style={{ marginLeft: 8 }} />}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, syncing && styles.actionBtnDisabled]}
        onPress={() => handleSync('movies')}
        disabled={syncing}
      >
        <Ionicons name="film-outline" size={22} color={GOLD} />
        <Text style={styles.actionBtnText}>Sync Movies</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, syncing && styles.actionBtnDisabled]}
        onPress={() => handleSync('series')}
        disabled={syncing}
      >
        <Ionicons name="layers-outline" size={22} color={GOLD} />
        <Text style={styles.actionBtnText}>Sync Series</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, syncing && styles.actionBtnDisabled]}
        onPress={async () => {
          setSyncing(true);
          try {
            const result = await performBackgroundSync({ force: true });
            if (result.success) {
              Alert.alert('Background Sync', `EPG updated for ${result.epg?.channelCount || 0} channels.\nSubtitle cache refreshed.`);
            } else {
              Alert.alert('Sync Error', result.epg?.error || result.subtitles?.error || 'Failed to sync');
            }
          } catch (e) {
            Alert.alert('Sync Error', e?.message || 'Unknown error');
          } finally {
            setSyncing(false);
          }
        }}
        disabled={syncing}
      >
        <Ionicons name="calendar-outline" size={22} color={GOLD} />
        <Text style={styles.actionBtnText}>Sync EPG & Subtitles</Text>
      </TouchableOpacity>

      {/* Maintenance */}
      <Text style={styles.sectionHeader}>MAINTENANCE</Text>
      <TouchableOpacity style={styles.actionBtn} onPress={handleClearCache}>
        <Ionicons name="trash-outline" size={22} color={GOLD} />
        <Text style={styles.actionBtnText}>Clear Image Cache</Text>
      </TouchableOpacity>

      {/* Footer - Log Out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#fff" />
        <Text style={styles.logoutBtnText}>LOG OUT</Text>
      </TouchableOpacity>
      {/* PIN setup modal */}
      <Modal visible={showPinSetup} transparent animationType="fade" onRequestClose={handleCancelPin}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Set Parental PIN</Text>
            <Text style={styles.modalSubtitle}>Enter a 4-digit PIN to protect content.</Text>
            <TextInput
              value={pinInput}
              onChangeText={setPinInput}
              keyboardType="numeric"
              maxLength={4}
              style={styles.modalInput}
              placeholder="1234"
              placeholderTextColor="#888"
              secureTextEntry
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={handleCancelPin}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSavePin}>
                <Text style={styles.modalBtnSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  content: { padding: 20, paddingBottom: 60 },
  aboutCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  aboutBanner: {
    width: '100%',
    height: 120,
    marginBottom: 12,
  },
  aboutTagline: {
    fontSize: fs(13, 28),
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  contactText: {
    fontSize: fs(15, 30),
    color: "#FFFFFF",
    fontWeight: '600',
  },
  socialRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  socialLabel: {
    fontSize: fs(12, 24),
    color: '#888',
    marginBottom: 8,
  },
  socialIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  socialBtn: {
    padding: 8,
  },
  header: {
    color: GOLD,
    fontSize: fs(24, 44),
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  accountCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
    marginBottom: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  avatarWrap: { marginBottom: 12 },
  accountUsername: { fontSize: fs(20, 40), fontWeight: '700', color: "#FFFFFF", marginBottom: 6 },
  accountStatus: { fontSize: fs(14, 28), color: '#22c55e', fontWeight: '600', marginBottom: 4 },
  accountExpiry: { fontSize: fs(13, 28), color: '#888' },
  sectionHeader: {
    color: GOLD,
    fontSize: fs(12, 26),
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GOLD,
  },
  updateBtnText: { fontSize: fs(14, 28), color: GOLD, fontWeight: '600' },
  updateMessageRow: {
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  updateMessage: { fontSize: fs(13, 28), color: '#888', marginBottom: 8 },
  updateApplyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: GOLD,
  },
  updateApplyBtnText: { fontSize: fs(14, 28), color: '#000', fontWeight: '700' },
  rowLabel: { fontSize: fs(15, 30), color: "#FFFFFF", flex: 1, marginRight: 12 },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 12,
  },
  slider: { flex: 1, height: 36 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    gap: 12,
  },
  actionBtnText: { fontSize: fs(15, 30), color: "#FFFFFF", fontWeight: '500' },
  actionBtnDisabled: { opacity: 0.6 },
  syncHint: { fontSize: fs(13, 28), color: '#888', marginBottom: 12, paddingHorizontal: 4 },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  themeChipActive: { borderColor: GOLD, backgroundColor: GOLD + '22' },
  themeChipTextActive: { color: GOLD },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#333',
    backgroundColor: "#1E1E1E",
    gap: 8,
  },
  themeDot: { width: 12, height: 12, borderRadius: 6 },
  themeChipText: { fontSize: fs(14, 28), color: "#FFFFFF", fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 10,
  },
  logoutBtnText: { fontSize: fs(16, 28), color: "#FFFFFF", fontWeight: '700', letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { width: '100%', maxWidth: 340, backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  modalTitle: { color: "#FFFFFF", fontSize: fs(20, 40), fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  modalSubtitle: { color: '#888', fontSize: fs(14, 28), textAlign: 'center', marginBottom: 20 },
  modalInput: { backgroundColor: '#0f0f0f', borderWidth: 2, borderColor: '#333', borderRadius: 10, padding: 14, fontSize: fs(18, 32), color: "#FFFFFF", textAlign: 'center', marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#333' },
  modalBtnCancelText: { color: "#FFFFFF", fontSize: fs(16, 28), fontWeight: '600' },
  modalBtnSave: { backgroundColor: GOLD },
  modalBtnSaveText: { color: '#000', fontSize: fs(16, 28), fontWeight: '700' },
});
