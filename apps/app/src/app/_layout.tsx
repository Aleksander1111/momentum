import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { persistOptions, queryClient } from '../lib/query';
import { AppearanceProvider } from '../ui/AppearanceProvider';
import { C, useTheme } from '../ui/theme';

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <Root />
    </AppearanceProvider>
  );
}

function Root() {
  const { scheme } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.screen }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
          onSuccess={() => {
            // Reactions queued while the API was unreachable resume once the cache is restored.
            void queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries());
          }}
        >
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.screen } }} />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
