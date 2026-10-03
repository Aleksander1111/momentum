import { Image, Platform, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useWorkspaces } from '../lib/workspace';
import { T } from './Text';

/** Words of a project name: split at separators and at lower-to-upper case changes */
function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s._-]+/)
    .filter(Boolean);
}

/** Up to two letters: the first of each of the first two words */
export function initials(name: string): string {
  const w = words(name);
  return (w.length ? w.slice(0, 2).map((x) => x[0]) : [name[0] ?? '?']).join('').toUpperCase();
}

/** A hue fixed by the name, so a project keeps its colour everywhere */
export function hueOf(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % 360;
}

/** The SVG text of a base64 SVG data URL, decoded as UTF-8 */
function svgText(dataUrl: string): string {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  return decodeURIComponent(Array.from(bin, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
}

/** The logo drawn from a name: its initials on a square coloured by it */
function Generated({ name, size }: { name: string; size: number }) {
  const letters = initials(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        backgroundColor: `hsl(${hueOf(name)}, 55%, 45%)`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T style={{ color: '#fff', fontWeight: '700', fontSize: size * (letters.length > 1 ? 0.42 : 0.5), lineHeight: size }}>
        {letters}
      </T>
    </View>
  );
}

/** A project's logo: the one it uploaded, or one drawn from its name */
export function ProjectLogo({ name, size, style }: { name: string; size: number; style?: StyleProp<ViewStyle> }) {
  const { data } = useWorkspaces();
  const logo = data?.find((w) => w.name === name)?.logo ?? null;
  return (
    <View accessibilityLabel={name} style={[{ width: size, height: size, borderRadius: size * 0.25, overflow: 'hidden' }, style]}>
      {!logo ? (
        <Generated name={name} size={size} />
      ) : logo.startsWith('data:image/svg') && Platform.OS !== 'web' ? (
        <SvgXml xml={svgText(logo)} width={size} height={size} />
      ) : (
        <Image source={{ uri: logo }} style={{ width: size, height: size }} resizeMode="contain" />
      )}
    </View>
  );
}

/** A project's name led by its logo, wherever the name is shown */
export function ProjectName({ name, size = 16, style }: { name: string; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.4, minWidth: 0 }}>
      <ProjectLogo name={name} size={size} />
      <T style={[{ flexShrink: 1 }, style]} numberOfLines={1}>
        {name}
      </T>
    </View>
  );
}
