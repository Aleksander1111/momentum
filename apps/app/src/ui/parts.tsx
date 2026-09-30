import { useState, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { C } from './theme';
import { H, T } from './Text';
import { Chevron } from './icons';

export function Sect({ children, first }: { children: ReactNode; first?: boolean }) {
  return <H style={{ fontSize: 16, marginTop: first ? 0 : 22, marginBottom: 8 }}>{children}</H>;
}

export function List({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, overflow: 'hidden' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({
  children,
  first,
  selected,
  onPress,
  style,
}: {
  children: ReactNode;
  first?: boolean;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const base: StyleProp<ViewStyle> = [
    {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderTopWidth: first ? 0 : 1,
      borderTopColor: C.line,
      backgroundColor: selected ? C.card : undefined,
    },
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={base}>
      {children}
    </Pressable>
  );
}

/** Row body: main line plus optional muted sub-line. */
export function RowText({ title, sub, size = 15 }: { title: string; sub?: string; size?: number }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <T style={{ fontSize: size }}>{title}</T>
      {sub ? <T style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>{sub}</T> : null}
    </View>
  );
}

export function Count({ children }: { children: ReactNode }) {
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 999, paddingVertical: 1, paddingHorizontal: 8 }}>
      <T style={{ color: C.muted, fontSize: 12 }}>{children}</T>
    </View>
  );
}

export function Back({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, alignSelf: 'flex-start' }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderLeftWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: C.muted,
          transform: [{ rotate: '45deg' }],
          marginLeft: 3,
        }}
      />
      <T style={{ color: C.muted, fontSize: 14 }}>{label}</T>
    </Pressable>
  );
}

export function Btn({
  label,
  kind,
  onPress,
  disabled,
  style,
}: {
  label: string;
  kind: 'primary' | 'ghost';
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 22,
          opacity: disabled ? 0.5 : 1,
        },
        kind === 'primary'
          ? { backgroundColor: C.accent }
          : { backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
        style,
      ]}
    >
      <T style={{ fontSize: 15, fontWeight: '700', color: kind === 'primary' ? C.white : C.ink }}>{label}</T>
    </Pressable>
  );
}

/** Serif picker with a down chevron and a dropdown of options. */
export function Pick({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ zIndex: 10 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <H style={{ fontSize: 17 }}>{value ?? ''}</H>
        <View
          style={{
            width: 7,
            height: 7,
            borderRightWidth: 2,
            borderBottomWidth: 2,
            borderColor: C.ink,
            transform: [{ translateY: -2 }, { rotate: '45deg' }],
          }}
        />
      </Pressable>
      {open ? (
        <List style={{ position: 'absolute', top: 30, left: 0, minWidth: 220, boxShadow: '0 2px 8px rgba(30,41,59,.14)' }}>
          {options.map((o, i) => (
            <Row
              key={o}
              first={i === 0}
              selected={o === value}
              onPress={() => {
                setOpen(false);
                onChange(o);
              }}
            >
              <RowText title={o} />
            </Row>
          ))}
        </List>
      ) : null}
    </View>
  );
}

export { Chevron };
