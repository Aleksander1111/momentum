import { Pressable, View } from 'react-native';
import { C } from './theme';
import { Icon } from './icons';

/**
 * Starts and stops this device's microphone. Round and outlined beside a send button, filled while listening; `bare`
 * is the glyph alone, inside a field. Dimmed while the PC cannot transcribe.
 */
export function MicButton({
  listening,
  available,
  onPress,
  bare,
}: {
  listening: boolean;
  available: boolean;
  onPress: () => void;
  bare?: boolean;
}) {
  const enabled = available || listening;
  if (bare) {
    return (
      <Pressable
        onPress={onPress}
        disabled={!enabled}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop listening' : 'Speak'}
        style={{ opacity: enabled ? 1 : 0.4 }}
      >
        <Icon name="mic" size={19} color={listening ? C.accent : C.muted} />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={listening ? 'Stop listening' : 'Speak'}
      style={{ opacity: enabled ? 1 : 0.4 }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: listening ? C.accent : C.surface,
          borderWidth: listening ? 0 : 1,
          borderColor: C.line,
        }}
      >
        <Icon name="mic" size={19} color={listening ? C.surface : C.ink} />
      </View>
    </Pressable>
  );
}
