import { forwardRef, useState } from 'react';
import { Pressable, View, type TextInput } from 'react-native';
import type { ContextItem } from '@momentum/contract';
import { chatContext } from '../lib/context';
import { C, F } from './theme';
import { Field } from './Field';
import { Icon } from './icons';
import { T } from './Text';

/** How a context item reads on its chip: the entity, then the quote or the diagram element */
export function contextLabel(c: ContextItem): string {
  return `${c.title} › ${c.element !== undefined ? `< ${c.element} >` : `“${c.quote}”`}`;
}

/** One part of a card added to the context; × takes it out */
export function ContextChip({ item, onRemove, inverse }: { item: ContextItem; onRemove?: () => void; inverse?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        maxWidth: '100%',
        backgroundColor: inverse ? 'rgba(255,255,255,.14)' : C.card,
        borderRadius: 8,
        paddingVertical: 4,
        paddingLeft: 8,
        paddingRight: onRemove ? 4 : 8,
      }}
    >
      <T numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, color: inverse ? C.surface : C.ink }}>
        {contextLabel(item)}
      </T>
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove from context" hitSlop={8}>
          <T style={{ fontSize: 16, lineHeight: 18, color: C.muted, fontFamily: F.body }}>×</T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Field plus round accent send button; the context items waiting for this chat as chips above them. */
export const Composer = forwardRef<
  TextInput,
  { placeholder: string; onSend: (text: string) => Promise<unknown> | void; autoFocus?: boolean; context?: ContextItem[] }
>(function Composer({ placeholder, onSend, autoFocus, context }, ref) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onSend(t);
      setText('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {context?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {context.map((c, i) => (
            <ContextChip key={i} item={c} onRemove={() => chatContext.remove(c)} />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Field
          ref={ref}
          placeholder={placeholder}
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          autoFocus={autoFocus}
          containerStyle={{ flex: 1 }}
        />
        <Pressable
          onPress={send}
          disabled={busy}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: C.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Icon name="send" size={18} color={C.surface} />
        </Pressable>
      </View>
    </View>
  );
});
