import { forwardRef, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { Platform, TextInput, View, type StyleProp, type TextInputProps, type TextInputContentSizeChangeEvent, type ViewStyle } from 'react-native';
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

/**
 * A multiline field that grows with its text from `min` to `max` pixels high, then scrolls. With `follow`, as while its
 * mic types into it, it keeps its last line in view. Spread what it returns onto the field: the height into its style.
 */
export function useGrowingField(field: RefObject<TextInput | null>, value: string, min: number, max: number, follow = false) {
  const [content, setContent] = useState(min);
  // On the web the field's scroll height never drops below its own height: measured collapsed, it shrinks as lines go
  useLayoutEffect(() => {
    const el = field.current as unknown as HTMLTextAreaElement | null;
    if (Platform.OS !== 'web' || !el?.style) return;
    el.style.height = '0px';
    const h = el.scrollHeight;
    el.style.height = `${Math.min(max, Math.max(min, h))}px`;
    setContent(h);
    if (follow) el.scrollTop = el.scrollHeight;
  }, [value, follow]);
  return {
    height: Math.min(max, Math.max(min, content)),
    onContentSizeChange: Platform.OS === 'web' ? undefined : (e: TextInputContentSizeChangeEvent) => setContent(e.nativeEvent.contentSize.height),
    // A native field scrolls to its caret: kept at the end, the last line stays in view
    selection: follow && Platform.OS !== 'web' ? { start: value.length, end: value.length } : undefined,
  };
}
