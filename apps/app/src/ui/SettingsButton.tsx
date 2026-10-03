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
  const on = usePathname().startsWith('/settings');
  return (
    <Pressable
      onPress={() => router.navigate('/settings')}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      accessibilityState={{ selected: on }}
      hitSlop={8}
      style={{ position: 'absolute', top: insets.top + 8, right: 10, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="settings" size={24} color={on ? C.accent : C.muted} />
    </Pressable>
  );
}
