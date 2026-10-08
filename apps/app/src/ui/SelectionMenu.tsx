import { useContext, type ReactNode } from 'react';
import { View, type NativeSyntheticEvent } from 'react-native';
import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { AddsAtOnce } from './AddToContext';

type NativeProps = { label: string; onAdd: (e: NativeSyntheticEvent<{ text: string }>) => void; children: ReactNode };

/** The native view of modules/selection-menu; absent from a build made before it, when the block stays plain */
const Native = requireOptionalNativeModule('SelectionMenu') ? requireNativeView<NativeProps>('SelectionMenu') : null;

/**
 * Native: one card block whose selectable texts offer "Add to context" in Android's text selection menu (long-press to
 * select); on the feed's card, "Ask about this", which opens the chat below the card. On the web the block is marked for
 * the card's selection scope instead.
 */
export function SelectionMenu({ onAdd, children }: { block: number; onAdd: (text: string) => void; children: ReactNode }) {
  const atOnce = useContext(AddsAtOnce);
  if (!Native) return <View>{children}</View>;
  return (
    <Native label={atOnce ? 'Ask about this' : 'Add to context'} onAdd={(e) => onAdd(e.nativeEvent.text)}>
      {children}
    </Native>
  );
}
