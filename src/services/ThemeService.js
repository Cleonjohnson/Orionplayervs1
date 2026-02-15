/**
 * App theme (TiviMate-style customization)
 * Options: gold (default), blue, green. Persisted for state-of-the-art UX.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_APP_THEME = 'orion_app_theme';
const THEMES = {
  gold: { accent: '#FFD700', accentDim: '#B8860B', name: 'Gold' },
  blue: { accent: '#2196F3', accentDim: '#1565C0', name: 'Blue' },
  green: { accent: '#4CAF50', accentDim: '#2E7D32', name: 'Green' },
};

let cachedTheme = 'gold';

export function getThemeAccent() {
  return THEMES[cachedTheme]?.accent ?? THEMES.gold.accent;
}

export function getThemeAccentDim() {
  return THEMES[cachedTheme]?.accentDim ?? THEMES.gold.accentDim;
}

export async function getAppTheme() {
  try {
    const v = await AsyncStorage.getItem(KEY_APP_THEME);
    const t = (v && THEMES[v]) ? v : 'gold';
    cachedTheme = t;
    return t;
  } catch (e) {
    return 'gold';
  }
}

export async function setAppTheme(themeKey) {
  if (!THEMES[themeKey]) return;
  try {
    await AsyncStorage.setItem(KEY_APP_THEME, themeKey);
    cachedTheme = themeKey;
  } catch (e) {
    console.warn('[ThemeService] setAppTheme failed:', e);
  }
}

export function getThemesList() {
  return Object.entries(THEMES).map(([key, val]) => ({ key, ...val }));
}
