import type { ReactNode } from 'react';
import { View } from 'react-native';

/** Native: text selection happens in each block's SelectionMenu */
export function SelectionScope({ children }: { onAdd: (quote: string, block: number | null) => void; swipe?: boolean; children: ReactNode }) {
  return <View>{children}</View>;
}
