import { createContext } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { snapshot } from '../lib/snapshot';
import { C } from './theme';
import { T } from './Text';

/**
 * Whether what the user selects or picks goes to the chat at once, with no button: on the feed's card, whose chat opens
 * below it
 */
export const AddsAtOnce = createContext(false);

/** The button that adds the selected text or the picked diagram element to the chat's context; the exported app has no chat */
export function AddToContext({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  if (snapshot) return null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        {
          backgroundColor: C.accent,
          borderRadius: 999,
          paddingVertical: 6,
          paddingHorizontal: 12,
          boxShadow: '0 2px 8px rgba(30,41,59,.25)',
        },
        style,
      ]}
    >
      <T style={{ color: C.surface, fontSize: 13, fontWeight: '700' }}>Add to context</T>
    </Pressable>
  );
}
