/**
 * Orion Player 2.0 - Login Screen (Orion Premium Theme)
 * Deep dark background, Gold-bordered inputs, "ENTER ORION" button.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authenticate } from '../services/XtreamService';
import * as DatabaseService from '../services/DatabaseService';
import { needsOnboarding } from '../services/PlaylistService';
import { KEY_AGREEMENT_ACCEPTED } from './AgreementScreen';
import { ORION_LOGO } from '../constants/Branding';
import { isTV, fs as fsDevice } from '../constants/device';
import FocusablePressable from '../components/FocusablePressable';

const GOLD = '#FFD700';
/** TV: larger fonts and touch targets for 10-foot UI */
const fs = (phone, tv = 28) => (isTV ? tv : phone);
const SECURE_KEYS = {
  username: 'orion_xtream_username',
  password: 'orion_xtream_password',
  baseUrl: 'orion_xtream_base_url',
  remember: 'orion_remember_me',
};

export default function LoginScreen({ navigation, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remember = await SecureStore.getItemAsync(SECURE_KEYS.remember);
        if (remember !== 'true') {
          if (!cancelled) setRestoring(false);
          return;
        }
        const [u, p, url] = await Promise.all([
          SecureStore.getItemAsync(SECURE_KEYS.username),
          SecureStore.getItemAsync(SECURE_KEYS.password),
          SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
        ]);
        if (!cancelled) {
          if (u) setUsername(u);
          if (p) setPassword(p);
          if (url) setBaseUrl(url);
          setRememberMe(true);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveCredentials = async () => {
    try {
      await SecureStore.setItemAsync(SECURE_KEYS.remember, rememberMe ? 'true' : 'false');
      if (rememberMe) {
        await SecureStore.setItemAsync(SECURE_KEYS.username, username);
        await SecureStore.setItemAsync(SECURE_KEYS.password, password);
        await SecureStore.setItemAsync(SECURE_KEYS.baseUrl, baseUrl);
      } else {
        await SecureStore.deleteItemAsync(SECURE_KEYS.username);
        await SecureStore.deleteItemAsync(SECURE_KEYS.password);
        await SecureStore.deleteItemAsync(SECURE_KEYS.baseUrl);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleLogin = async () => {
    const trimmedUrl = (baseUrl || '').trim();
    const trimmedUser = (username || '').trim();
    const trimmedPass = password || '';

    setError('');

    if (!trimmedUser || !trimmedPass) {
      Alert.alert('Missing fields', 'Please enter username and password.');
      return;
    }
    if (!trimmedUrl) {
      Alert.alert('Missing server', 'Please enter your server URL (e.g. example.com:8080).');
      return;
    }

    setLoading(true);
    try {
      const result = await authenticate({
        username: trimmedUser,
        password: trimmedPass,
        baseUrl: trimmedUrl,
      });

      if (result.success) {
        try {
          await DatabaseService.saveUser({
            username: trimmedUser,
            password: trimmedPass,
            baseUrl: trimmedUrl,
          });
        } catch (saveErr) {
          console.warn('[Login] Save user failed (non-blocking):', saveErr);
        }
        try {
          await saveCredentials();
        } catch (saveErr) {
          console.warn('[Login] Save credentials failed (non-blocking):', saveErr);
        }
        
        const needsSetup = await needsOnboarding();
        const agreementAccepted = await AsyncStorage.getItem(KEY_AGREEMENT_ACCEPTED);
        const hasAgreed = agreementAccepted === 'true';
        let targetScreen = 'Hub';
        if (!hasAgreed) targetScreen = 'Agreement';
        else if (needsSetup) targetScreen = 'Onboarding';
        else targetScreen = 'Hub';

        console.log(`[Login] Navigating to ${targetScreen} (needsSetup: ${needsSetup}, agreed: ${hasAgreed})`);

        try {
          if (navigation && typeof navigation.reset === 'function') {
            navigation.reset({ index: 0, routes: [{ name: targetScreen }] });
          } else if (onLoginSuccess) {
            onLoginSuccess({ username: trimmedUser, password: trimmedPass, baseUrl: trimmedUrl });
          }
        } catch (navErr) {
          Alert.alert('Nav Error', navErr?.message || 'Could not navigate.');
        }
      } else {
        setLoading(false);
        const errMsg = result.error || 'Invalid credentials.';
        Alert.alert('Connection Failed', errMsg);
        setError(errMsg);
      }
    } catch (e) {
      setLoading(false);
      const errMsg = e?.message || 'Something went wrong.';
      Alert.alert('Connection Failed', errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (restoring) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.logoWrap}>
          <Image source={ORION_LOGO} style={[styles.logoImg, isTV && { width: 220, height: 100 }]} resizeMode="contain" />
          <Text style={[styles.logo, { fontSize: fs(32, 36) }]}>ORION PLAYER</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Server URL (e.g. http://example.com:8080)"
            placeholderTextColor="#888888"
            value={baseUrl}
            onChangeText={setBaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#888888"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setRememberMe((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>Remember me</Text>
          </TouchableOpacity>

          {isTV ? (
            <FocusablePressable
              style={[styles.button, styles.buttonTV, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              focusedStyle={styles.buttonFocused}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={[styles.buttonText, { fontSize: fs(18, 26) }]}>ENTER ORION</Text>
              )}
            </FocusablePressable>
          ) : (
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.buttonText}>ENTER ORION</Text>
              )}
            </TouchableOpacity>
          )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: "#B0B0B0",
    marginTop: 12,
    fontSize: 16,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImg: {
    width: 180,
    height: 80,
    marginBottom: 12,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 4,
  },
  logoSub: {
    fontSize: 18,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 3,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 12,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: GOLD,
  },
  checkMark: {
    color: "#000000",
    fontSize: 14,
    fontWeight: '700',
  },
  checkLabel: {
    color: "#B0B0B0",
    fontSize: 16,
  },
  button: {
    backgroundColor: GOLD,
    borderRadius: 8,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTV: {
    minHeight: 56,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  buttonFocused: {
    borderColor: "#FFFFFF",
    borderWidth: 2,
    backgroundColor: "#FFC700",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#000000",
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
