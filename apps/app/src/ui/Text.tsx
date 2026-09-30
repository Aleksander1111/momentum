import { Text as RNText, type TextProps } from 'react-native';
import { C, F } from './theme';

/** Body text: Calibri stack, ink colour. */
export function T({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ fontFamily: F.body, color: C.ink }, style]} />;
}

/** Heading text: Cambria stack, bold. */
export function H({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ fontFamily: F.head, fontWeight: '700', color: C.ink }, style]} />;
}
