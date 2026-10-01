import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { C, F } from './theme';

const PAD = 16;
const BAR = 44;

/**
 * A diagram opened over the screen: fitted to the window but never below its own size, scrolling both ways when it
 * is larger. A tap outside it, the close button, Back or Escape closes it.
 */
export function DiagramFull({
  open,
  onClose,
  size,
  render,
}: {
  open: boolean;
  onClose: () => void;
  size: { width: number; ratio: number };
  render: (width: number, height: number) => ReactNode;
}) {
  const win = useWindowDimensions();
  const fit = Math.min(win.width - PAD * 2, (win.height - PAD * 2 - BAR) * size.ratio);
  const width = Math.max(size.width, fit);
  const height = width / size.ratio;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.dim }}>
        <View style={{ height: BAR, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: PAD }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close diagram" hitSlop={10}>
            <Text style={{ color: '#FFFFFF', fontSize: 28, lineHeight: 30, fontFamily: F.body }}>×</Text>
          </Pressable>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
            <Pressable
              onPress={onClose}
              style={{ flexGrow: 1, minWidth: win.width, alignItems: 'center', justifyContent: 'center', padding: PAD, paddingTop: 0 }}
            >
              <Pressable onPress={() => {}} style={{ backgroundColor: C.diagramSheet, borderRadius: 10, cursor: 'auto' }}>
                {render(width, height)}
              </Pressable>
            </Pressable>
          </ScrollView>
        </ScrollView>
      </View>
    </Modal>
  );
}
