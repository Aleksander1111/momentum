import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { C, useTheme } from '../ui/theme';
import { Field } from '../ui/Field';
import { Logo } from '../ui/Logo';
import { Btn } from '../ui/parts';

export default function Session() {
  useTheme();
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const signIn = async () => {
    if (!password || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await api.session({ password });
      await qc.invalidateQueries();
      router.replace('/feed');
    } catch {
      setFailed(true);
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
          invalid={failed}
          onChangeText={(v) => {
            setPassword(v);
            setFailed(false);
          }}
          onSubmitEditing={signIn}
          containerStyle={{ width: '100%', maxWidth: 340 }}
        />
        <Btn label="Sign in" kind="primary" onPress={signIn} disabled={busy} style={{ width: '100%', maxWidth: 340 }} />
      </View>
    </SafeAreaView>
  );
}
