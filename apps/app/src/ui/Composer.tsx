import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Platform, Pressable, View, type NativeSyntheticEvent, type TextInput, type TextInputKeyPressEventData } from 'react-native';
import type { ContextItem, VoiceItem, VoiceOutcome, VoiceTarget } from '@momentum/contract';
import { chatContext } from '../lib/context';
import { HttpError, NetworkError } from '../lib/api';
import { chatFiles, uploading, useChatFiles } from '../lib/attachments';
import { listenForFiles, pickFiles } from '../lib/pickFiles';
import { PendingFileChip } from './Attachments';
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

/**
 * One part of a card added to the context; × takes it out. Waiting in the composer it keeps to one line; in the sent
 * message's bubble (`inverse`) it wraps and shows the whole quote.
 */
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
        alignItems: inverse ? 'flex-start' : 'center',
        gap: 6,
        maxWidth: '100%',
        backgroundColor: inverse ? 'rgba(255,255,255,.14)' : C.card,
        borderRadius: 8,
        paddingVertical: 4,
        paddingLeft: 8,
        paddingRight: onRemove ? 4 : 8,
      }}
    >
      <View style={{ height: 17, justifyContent: 'center' }}>
        <DomainIcon type={type} size={13} color={colour} />
      </View>
      <T numberOfLines={inverse ? undefined : 1} style={{ flexShrink: 1, fontSize: 12.5, lineHeight: 17, color: inverse ? C.surface : C.ink }}>
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

/** The field's height for its content: one line to six */
const fieldHeight = (content: number) => Math.min(120, Math.max(20, content));

/** Spoken items from this composer's mic: where they go, and what the screen does with each outcome */
export interface ComposerVoice {
  target: VoiceTarget | null;
  onOutcome: (outcome: VoiceOutcome, item: VoiceItem) => void;
}

/**
 * Field plus round accent send button; the context items waiting for this chat as chips above them. With `attachTo`, a
 * paperclip before the field picks files for that project's next message, and on the web files pasted into the field or
 * dropped on the composer join them; they wait as chips beside the context and send waits for their upload. With `voice`,
 * a mic beside send: while it listens the field shows the text as heard so far; an item that failed comes back to the field.
 * With `onStop`, a stop button beside send ends the answer being written.
 */
export const Composer = forwardRef<
  TextInput,
  {
    placeholder: string;
    onSend: (text: string) => Promise<unknown> | void;
    autoFocus?: boolean;
    context?: ContextItem[];
    /** The project whose next message takes the files attached here */
    attachTo?: string | null;
    voice?: ComposerVoice;
    onStop?: () => Promise<unknown>;
  }
>(function Composer({ placeholder, onSend, autoFocus, context, attachTo, voice, onStop }, ref) {
  const field = useRef<TextInput>(null);
  const area = useRef<View>(null);
  useImperativeHandle(ref, () => field.current!, []);
  const files = useChatFiles(attachTo ?? null);
  useEffect(() => {
    if (!attachTo) return;
    return listenForFiles(field.current, area.current, (picked) => chatFiles.add(attachTo, picked));
  }, [attachTo]);
  const [text, setText] = useState('');
  const [stopping, setStopping] = useState(false);
  const [busy, setBusy] = useState(false);
  // Why the last message did not go, until the text changes
  const [failed, setFailed] = useState<string | null>(null);
  // The field grows with what is written, up to a few lines
  const [height, setHeight] = useState(20);
  const mic = useVoice(voice?.target ?? null, (outcome, item) => {
    if (outcome.kind === 'failed') setText(item.text);
    voice?.onOutcome(outcome, item);
  });
  const heard = mic.listening || mic.partial !== null;
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    if (uploading(files)) return setFailed('Not sent yet: the files are still uploading.');
    setBusy(true);
    setFailed(null);
    try {
      await onSend(t);
      setText('');
    } catch (e) {
      setFailed(
        e instanceof NetworkError
          ? 'Not sent: Momentum cannot be reached. It stays here to send again.'
          : e instanceof HttpError
            ? `Not sent: ${e.message}`
            : 'Not sent. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  // On a keyboard Enter sends and Shift+Enter starts a new line; on a touch keyboard Enter starts a new line and the button sends
  const onKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData & { shiftKey?: boolean; isComposing?: boolean }>) => {
    if (Platform.OS !== 'web' || e.nativeEvent.key !== 'Enter' || e.nativeEvent.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void send();
  };
  const shown = heard ? (mic.partial ?? '') : text;
  // On the web the field's scroll height never drops below its own height: measured collapsed, it shrinks as lines go
  useLayoutEffect(() => {
    const el = field.current as unknown as HTMLTextAreaElement | null;
    if (Platform.OS !== 'web' || !el?.style) return;
    el.style.height = '0px';
    const h = el.scrollHeight;
    el.style.height = `${fieldHeight(h)}px`;
    setHeight(h);
  }, [shown]);
  return (
    <View ref={area} style={{ gap: 8 }}>
      {context?.length || files.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(context ?? []).map((c, i) => (
            <ContextChip key={i} item={c} onRemove={() => chatContext.remove(c)} />
          ))}
          {files.map((f) => (
            <PendingFileChip key={f.key} file={f} />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        {attachTo ? (
          <Pressable
            onPress={() => pickFiles((picked) => chatFiles.add(attachTo, picked), () => setFailed('The files could not be read.'))}
            accessibilityRole="button"
            accessibilityLabel="Attach files"
            hitSlop={6}
            style={{ height: 40, justifyContent: 'center' }}
          >
            <Icon name="attach" size={21} color={C.muted} />
          </Pressable>
        ) : null}
        <Field
          ref={field}
          placeholder={placeholder}
          value={shown}
          onChangeText={(v) => {
            setText(v);
            setFailed(null);
          }}
          multiline
          onKeyPress={onKeyPress}
          onContentSizeChange={Platform.OS === 'web' ? undefined : (e) => setHeight(e.nativeEvent.contentSize.height)}
          autoFocus={autoFocus}
          editable={!heard}
          invalid={!!failed}
          style={{ height: fieldHeight(height), lineHeight: 20 }}
          containerStyle={{ flex: 1 }}
        />
        {voice ? (
          <MicButton listening={mic.listening} available={mic.available && !!voice.target} onPress={mic.listening ? mic.stop : mic.start} />
        ) : null}
        {onStop ? (
          <Pressable
            onPress={() => {
              setStopping(true);
              onStop().finally(() => setStopping(false));
            }}
            disabled={stopping}
            accessibilityRole="button"
            accessibilityLabel="Stop answering"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: C.ink,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: stopping ? 0.6 : 1,
            }}
          >
            <Icon name="stop" size={14} color={C.ink} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={send}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Send"
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
      {failed ? (
        <T accessibilityRole="alert" style={{ color: C.no, fontSize: 13 }}>
          {failed}
        </T>
      ) : null}
    </View>
  );
});
