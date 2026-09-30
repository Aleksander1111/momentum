import { forwardRef, useState } from 'react';
import { Pressable, View, type TextInput } from 'react-native';
import { C } from './theme';
import { Field } from './Field';
import { Icon } from './icons';

/** Field plus round accent send button. */
export const Composer = forwardRef<
  TextInput,
  { placeholder: string; onSend: (text: string) => Promise<unknown> | void; autoFocus?: boolean }
>(function Composer({ placeholder, onSend, autoFocus }, ref) {
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
  );
});
