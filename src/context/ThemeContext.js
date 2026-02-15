/**
 * Theme context so the app (navigator, loading screen) uses the user-selected accent.
 * ThemeService holds persistence; this context triggers re-renders when theme changes.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAppTheme, getThemeAccent, getThemeAccentDim } from '../services/ThemeService';

const ThemeContext = createContext({
  accent: '#FFD700',
  accentDim: '#B8860B',
  themeKey: 'gold',
  setThemeKey: () => {},
});

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKeyState] = useState('gold');
  const accent = getThemeAccent();
  const accentDim = getThemeAccentDim();

  useEffect(() => {
    getAppTheme().then(setThemeKeyState);
  }, []);

  const setThemeKey = (key) => {
    setThemeKeyState(key);
  };

  return (
    <ThemeContext.Provider value={{ accent, accentDim, themeKey, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  return ctx || { accent: '#FFD700', accentDim: '#B8860B', themeKey: 'gold', setThemeKey: () => {} };
}
