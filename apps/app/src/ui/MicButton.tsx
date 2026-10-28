import { Pressable, View } from 'react-native';
import { C } from './theme';
import { Icon } from './icons';

/**
 * Starts and stops this device's microphone. Round and outlined beside a send button, filled while listening; `small`
 * fits a composer's button row; `bare` is the glyph alone, inside a field. Dimmed while the PC cannot transcribe.
 */
export function MicButton({
  listening,
  available,
  onPress,
  bare,
  small,
}: {
  listening: boolean;
  available: boolean;
  onPress: () => void;
  bare?: boolean;
  small?: boolean;
}) {
  const enabled = available || listening;
  const size = small ? 32 : 40;
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
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: listening ? C.accent : C.surface,
          borderWidth: listening ? 0 : 1,
          borderColor: C.line,
        }}
      >
        <Icon name="mic" size={small ? 16 : 19} color={listening ? C.surface : C.ink} />
      </View>
    </Pressable>
  );
}
