import { useState, useEffect } from 'react';
import { ThemeBrightness, DEFAULT_BRIGHTNESS, BRIGHTNESS_OPTIONS, ThemeAccent } from '../types/theme';
import { safeStorage } from '../utils/safeStorage';
import { applySystemBars } from '../utils/systemBars';
import { STORAGE_KEY_THEME_BRIGHT, STORAGE_KEY_THEME_MIGRATED, STORAGE_KEY_THEME_ACCENT } from '../utils/storageKeys';

export function useThemeSettings() {
  const [themeBrightness, setThemeBrightness] = useState<ThemeBrightness>(() => {
    const saved = safeStorage.getItem(STORAGE_KEY_THEME_BRIGHT) as ThemeBrightness;
    const migrated = safeStorage.getItem(STORAGE_KEY_THEME_MIGRATED) === 'soft-default';
    if (!migrated) {
      safeStorage.setItem(STORAGE_KEY_THEME_MIGRATED, 'soft-default');
      safeStorage.setItem(STORAGE_KEY_THEME_BRIGHT, DEFAULT_BRIGHTNESS);
      return DEFAULT_BRIGHTNESS;
    }
    return BRIGHTNESS_OPTIONS.some((b) => b.id === saved) ? saved : DEFAULT_BRIGHTNESS;
  });

  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(() => {
    return (safeStorage.getItem(STORAGE_KEY_THEME_ACCENT) as ThemeAccent) || 'orange';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeBrightness);
    safeStorage.setItem(STORAGE_KEY_THEME_BRIGHT, themeBrightness);
    applySystemBars();
  }, [themeBrightness]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', themeAccent);
    safeStorage.setItem(STORAGE_KEY_THEME_ACCENT, themeAccent);
    applySystemBars();
  }, [themeAccent]);

  return { themeBrightness, themeAccent, setThemeBrightness, setThemeAccent };
}
