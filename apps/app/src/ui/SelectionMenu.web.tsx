import type { ReactNode } from 'react';
import { View } from 'react-native';

/** Web: a card block marked with its index, so the card's selection scope knows the headings a selection sits under */
export function SelectionMenu({ block, children }: { block: number; onAdd: (text: string) => void; children: ReactNode }) {
  return <View {...({ dataSet: { block: String(block) } } as object)}>{children}</View>;
}
