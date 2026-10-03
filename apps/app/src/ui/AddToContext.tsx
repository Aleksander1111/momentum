import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { C } from './theme';
import { T } from './Text';

/** The button that adds the selected text or the picked diagram element to the chat's context */
export function AddToContext({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
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
