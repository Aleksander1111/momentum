import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { api, NetworkError, UnauthorizedError } from '../lib/api';
import { C, useTheme } from '../ui/theme';
import { Field } from '../ui/Field';
import { Logo } from '../ui/Logo';
import { Btn } from '../ui/parts';
import { T } from '../ui/Text';

export default function Session() {
  useTheme();
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // Why the last sign in failed, in words: a wrong password is told from a back-end out of reach
  const [failed, setFailed] = useState<string | null>(null);

  const signIn = async () => {
    if (!password || busy) return;
    setBusy(true);
    setFailed(null);
    try {
      await api.session({ password });
      await qc.invalidateQueries();
      router.replace('/feed');
    } catch (e) {
      setFailed(
        e instanceof UnauthorizedError
          ? 'Wrong password'
          : e instanceof NetworkError
            ? 'Momentum cannot be reached. Check the connection to it and try again.'
            : 'Signing in did not work. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.screen }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }}>
        <Logo width={260} style={{ marginBottom: 26 }} />
        <Field
          icon="lock"
          placeholder="Password"
          secureTextEntry
          autoFocus
          autoCapitalize="none"
          autoComplete="current-password"
          value={password}
          invalid={!!failed}
          onChangeText={(v) => {
            setPassword(v);
            setFailed(null);
          }}
          onSubmitEditing={signIn}
          containerStyle={{ width: '100%', maxWidth: 340 }}
        />
        {failed ? (
          <T accessibilityRole="alert" style={{ color: C.no, fontSize: 14, textAlign: 'center', maxWidth: 340, marginTop: -6 }}>
            {failed}
          </T>
        ) : null}
        <Btn label="Sign in" kind="primary" onPress={signIn} disabled={busy} style={{ width: '100%', maxWidth: 340 }} />
      </View>
    </SafeAreaView>
  );
}
