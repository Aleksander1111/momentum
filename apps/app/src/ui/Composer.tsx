import { forwardRef, useState } from 'react';
import { Pressable, View, type TextInput } from 'react-native';
import type { ContextItem, VoiceItem, VoiceOutcome, VoiceTarget } from '@momentum/contract';
import { chatContext } from '../lib/context';
import { useVoice } from '../lib/voice';
import { C, F, useTheme } from './theme';
import { DomainIcon, domainColour } from './domains';
import { entityName } from './EntityRef';
import { Field } from './Field';
import { Icon } from './icons';
import { MicButton } from './MicButton';
import { T } from './Text';

/** How a context item reads on its chip: the entity, then the quote or the diagram element; a whole card is its title */
export function contextLabel(c: ContextItem): string {
  if (c.element !== undefined) return `${c.title} › < ${c.element} >`;
  return c.quote !== undefined ? `${c.title} › “${c.quote}”` : c.title;
}

/** One part of a card added to the context; × takes it out */
export function ContextChip({ item, onRemove, inverse }: { item: ContextItem; onRemove?: () => void; inverse?: boolean }) {
  // The entity reads as entities do everywhere: its type's glyph and colour; on the inverted bubble, the other scheme's
  const { scheme } = useTheme();
  const type = entityName(item.path).type;
  const colour = domainColour(type, inverse ? (scheme === 'dark' ? 'light' : 'dark') : scheme);
  const part = item.element !== undefined ? ` › < ${item.element} >` : item.quote !== undefined ? ` › “${item.quote}”` : '';
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
      <DomainIcon type={type} size={13} color={colour} />
      <T numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, color: inverse ? C.surface : C.ink }}>
        <T style={{ fontSize: 12.5, color: colour, fontWeight: '600' }}>{item.title}</T>
        {part}
      </T>
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove from context" hitSlop={8}>
          <T style={{ fontSize: 16, lineHeight: 18, color: C.muted, fontFamily: F.body }}>×</T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Spoken items from this composer's mic: where they go, and what the screen does with each outcome */
export interface ComposerVoice {
  target: VoiceTarget | null;
  onOutcome: (outcome: VoiceOutcome, item: VoiceItem) => void;
}

/**
 * Field plus round accent send button; the context items waiting for this chat as chips above them. With `voice`, a mic
 * beside send: while it listens the field shows the text as heard so far; an item that failed comes back to the field.
 */
export const Composer = forwardRef<
  TextInput,
  {
    placeholder: string;
    onSend: (text: string) => Promise<unknown> | void;
    autoFocus?: boolean;
    context?: ContextItem[];
    voice?: ComposerVoice;
  }
>(function Composer({ placeholder, onSend, autoFocus, context, voice }, ref) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const mic = useVoice(voice?.target ?? null, (outcome, item) => {
    if (outcome.kind === 'failed') setText(item.text);
    voice?.onOutcome(outcome, item);
  });
  const heard = mic.listening || mic.partial !== null;
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
          value={heard ? (mic.partial ?? '') : text}
          onChangeText={setText}
          onSubmitEditing={send}
          autoFocus={autoFocus}
          editable={!heard}
          containerStyle={{ flex: 1 }}
        />
        {voice ? (
          <MicButton listening={mic.listening} available={mic.available && !!voice.target} onPress={mic.listening ? mic.stop : mic.start} />
        ) : null}
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
