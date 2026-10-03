import { forwardRef, type ReactNode } from 'react';
import { Platform, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { C, F } from './theme';
import { Icon, type PATHS } from './icons';

type Props = TextInputProps & {
  icon?: keyof typeof PATHS;
  containerStyle?: StyleProp<ViewStyle>;
  invalid?: boolean;
  /** At the end of the field, such as a mic */
  trailing?: ReactNode;
};

/** White, bordered, rounded input with an optional leading glyph. */
export const Field = forwardRef<TextInput, Props>(function Field(
  { icon, containerStyle, invalid, trailing, style, ...props },
  ref,
) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: invalid ? C.no : C.line,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: Platform.OS === 'web' ? 11 : 8,
        },
        containerStyle,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={C.muted} /> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={C.muted}
        {...props}
        style={[
          { flex: 1, minWidth: 0, fontSize: 15, color: C.ink, fontFamily: F.body, padding: 0 },
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          style,
        ]}
      />
      {trailing}
    </View>
  );
});
