import type { ReactNode } from 'react';
import { View, type NativeSyntheticEvent } from 'react-native';
import { requireNativeView, requireOptionalNativeModule } from 'expo';

type NativeProps = { label: string; onAdd: (e: NativeSyntheticEvent<{ text: string }>) => void; children: ReactNode };

/** The native view of modules/selection-menu; absent from a build made before it, when the block stays plain */
const Native = requireOptionalNativeModule('SelectionMenu') ? requireNativeView<NativeProps>('SelectionMenu') : null;

/**
 * Native: one card block whose selectable texts offer "Add to context" in Android's text selection menu (long-press to
 * select). On the web the block is marked for the card's selection scope instead.
 */
export function SelectionMenu({ onAdd, children }: { block: number; onAdd: (text: string) => void; children: ReactNode }) {
  if (!Native) return <View>{children}</View>;
  return (
    <Native label="Add to context" onAdd={(e) => onAdd(e.nativeEvent.text)}>
      {children}
    </Native>
  );
}
