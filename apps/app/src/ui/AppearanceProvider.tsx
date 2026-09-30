import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyScheme, PALETTES, ThemeContext, type Appearance, type Theme } from './theme';

const KEY = 'momentum.appearance';

const isAppearance = (v: unknown): v is Appearance => v === 'system' || v === 'light' || v === 'dark';

/** On the web the choice is read synchronously so the first paint already has the right colours. */
function readWeb(): Appearance | null {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return isAppearance(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Resolves the user's appearance choice against the device scheme and provides it to every route. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [appearance, setState] = useState<Appearance | null>(() => (Platform.OS === 'web' ? readWeb() : null));

  useEffect(() => {
    if (appearance !== null) return;
    AsyncStorage.getItem(KEY)
      .then((v) => setState(isAppearance(v) ? v : 'system'))
      .catch(() => setState('system'));
  }, [appearance]);

  const setAppearance = useCallback((a: Appearance) => {
    setState(a);
    void AsyncStorage.setItem(KEY, a).catch(() => {});
  }, []);

  const scheme = (appearance ?? 'system') === 'system' ? (system === 'dark' ? 'dark' : 'light') : (appearance as 'light' | 'dark');
  applyScheme(scheme);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const { screen } = PALETTES[scheme];
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.style.background = screen;
    document.body.style.background = screen;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', screen));
  }, [scheme]);

  const value = useMemo<Theme>(() => ({ scheme, appearance: appearance ?? 'system', setAppearance }), [scheme, appearance, setAppearance]);

  if (appearance === null) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
