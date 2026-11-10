import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { useApp } from '@/store/app-store';

import { dark, light, type Palette } from './tokens';

interface ThemeValue {
  palette: Palette;
  scheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeValue>({ palette: light, scheme: 'light' });

/** Follows the phone's light or dark setting unless the person picked Day or Night. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const pref = useApp((s) => s.device.theme);
  const system = useColorScheme();
  const scheme: 'light' | 'dark' = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const palette = scheme === 'dark' ? dark : light;

  useEffect(() => {
    // The window behind the app, so screen transitions never flash white.
    SystemUI.setBackgroundColorAsync(palette.bg).catch(() => undefined);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = palette.bg;
      document.documentElement.style.colorScheme = scheme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.bg);
    }
  }, [palette.bg, scheme]);

  return <ThemeContext.Provider value={{ palette, scheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
