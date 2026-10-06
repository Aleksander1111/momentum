import { Pressable } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { embedded } from '../lib/embed';
import { Icon } from './icons';
import { C, useWide } from './theme';

/** Width of the top-right corner the button takes on a phone */
const CORNER = 44;

/**
 * On a phone Settings is not a tab but an icon in the top-right corner, over every screen. The first row of a screen
 * that reaches the right edge leaves this much room for it.
 */
export function useCornerRoom(): number {
  return useWide() || embedded ? 0 : CORNER;
}

export function SettingsButton() {
  const insets = useSafeAreaInsets();
  // On Settings itself it leads nowhere, and the settings scrolled under it would be out of reach
  if (usePathname().startsWith('/settings')) return null;
  return (
    <Pressable
      onPress={() => router.navigate('/settings')}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={8}
      // On the screen's colour: a row scrolled under it goes behind it, not through it
      style={{ position: 'absolute', top: insets.top + 8, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: C.screen, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="settings" size={24} color={C.muted} />
    </Pressable>
  );
}
