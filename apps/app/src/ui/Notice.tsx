import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { dismiss, useNotice } from '../lib/notice';
import { T } from './Text';
import { C } from './theme';

/** How long a notice stays unless pressed away */
const SHOWN_MS = 8_000;

/** The last refusal, over every screen, until pressed or a few seconds pass */
export function NoticeBar() {
  const notice = useNotice();
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => dismiss(notice.id), SHOWN_MS);
    return () => clearTimeout(t);
  }, [notice]);
  if (!notice) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: 24, alignItems: 'center' }}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={notice.text}
        onPress={() => dismiss(notice.id)}
        style={{ maxWidth: 560, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 }}
      >
        <T style={{ color: C.screen, fontSize: 14 }}>{notice.text}</T>
      </Pressable>
    </View>
  );
}
